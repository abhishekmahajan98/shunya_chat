-- Add missing columns to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES documents(id) ON DELETE CASCADE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'document';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'processing';

-- Update existing documents if any to have 'document' type
UPDATE documents SET type = 'document' WHERE type IS NULL;
UPDATE documents SET status = 'completed' WHERE status IS NULL;

-- Ensure indices exist
CREATE INDEX IF NOT EXISTS idx_documents_parent_id ON documents (parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents (type);
