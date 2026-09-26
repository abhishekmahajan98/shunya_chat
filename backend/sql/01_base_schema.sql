-- Base schema for Shunya Chat (auth + chat history)
-- Run this in the Supabase SQL Editor on a fresh project.
-- Auth users live in auth.users (managed by Supabase Auth).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL DEFAULT 'New Chat',
  model TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations (updated_at DESC);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  attachments JSONB DEFAULT '[]'::jsonb,
  reasoning JSONB,
  citations JSONB,
  agents JSONB
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);

-- Chat attachment storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "authenticated_uploads" ON storage.objects;
CREATE POLICY "authenticated_uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "public_view" ON storage.objects;
CREATE POLICY "public_view"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'chat-attachments');

-- NOTE: Table RLS is left disabled so the FastAPI backend can use the
-- anon or service_role key without attaching a user JWT to the client.
-- Auth is enforced in the API layer (Bearer token → auth.get_user).
