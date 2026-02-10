-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Spaces table
CREATE TABLE IF NOT EXISTS spaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT false,
  type TEXT DEFAULT 'shared', -- 'personal' or 'shared'
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  name TEXT NOT  NULL,
  type TEXT DEFAULT 'document', -- 'document' or 'folder'
  storage_path TEXT, -- Null for folders
  mime_type TEXT,
  size_bytes BIGINT,
  status TEXT DEFAULT 'processing', -- 'processing', 'completed', 'error'
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create Document Chunks table for RAG
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(768), -- Optimized for Gemini text-embedding-004
  metadata JSONB DEFAULT '{}'::jsonb,
  fts tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create indices for performance
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_document_chunks_fts ON document_chunks USING gin (fts);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_documents_space_id ON documents (space_id);
CREATE INDEX IF NOT EXISTS idx_spaces_owner_id ON spaces (owner_id);

-- 5. Hybrid Search Function using Reciprocal Rank Fusion (RRF)
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding vector(768),
  match_count INT DEFAULT 10,
  filter_space_ids UUID[] DEFAULT NULL,
  filter_document_ids UUID[] DEFAULT NULL
) RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH vector_matches AS (
    SELECT c.id, 1 / (row_number() OVER (ORDER BY c.embedding <=> query_embedding) + 60)::float as score
    FROM document_chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE (filter_space_ids IS NULL OR d.space_id = ANY(filter_space_ids))
    AND (filter_document_ids IS NULL OR d.id = ANY(filter_document_ids))
    ORDER BY c.embedding <=> query_embedding
    LIMIT 50
  ),
  keyword_matches AS (
    SELECT c.id, 1 / (row_number() OVER (ORDER BY ts_rank_cd(c.fts, plainto_tsquery('english', query_text)) DESC) + 60)::float as score
    FROM document_chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE (filter_space_ids IS NULL OR d.space_id = ANY(filter_space_ids))
    AND (filter_document_ids IS NULL OR d.id = ANY(filter_document_ids))
    AND c.fts @@ plainto_tsquery('english', query_text)
    ORDER BY ts_rank_cd(c.fts, plainto_tsquery('english', query_text)) DESC
    LIMIT 50
  )
  SELECT 
    c.id as chunk_id,
    c.document_id,
    c.content,
    c.metadata,
    (COALESCE(v.score, 0) + COALESCE(k.score, 0))::float as similarity
  FROM document_chunks c
  LEFT JOIN vector_matches v ON c.id = v.id
  LEFT JOIN keyword_matches k ON c.id = k.id
  WHERE v.id IS NOT NULL OR k.id IS NOT NULL
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- 6. Storage Bucket for Documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload files to their spaces
DROP POLICY IF EXISTS "authenticated_document_uploads" ON storage.objects;
CREATE POLICY "authenticated_document_uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Policy to allow public access to view documents (as defined in our business logic)
DROP POLICY IF EXISTS "public_document_view" ON storage.objects;
CREATE POLICY "public_document_view"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'documents');
