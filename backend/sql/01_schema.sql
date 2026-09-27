-- Shunya agent harness schema (Supabase / Postgres)
-- Run in the Supabase SQL editor. Auth.users is not required yet (dummy user).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Assistants: configured instances of a graph (basic_agent | deep_agent)
CREATE TABLE IF NOT EXISTS assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  graph_id TEXT NOT NULL CHECK (graph_id IN ('basic_agent', 'deep_agent')),
  system_prompt TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistants_user_id ON assistants (user_id);

-- Threads: conversation sessions owned by a user, pinned to an assistant
CREATE TABLE IF NOT EXISTS threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  assistant_id UUID NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads (user_id);
CREATE INDEX IF NOT EXISTS idx_threads_assistant_id ON threads (assistant_id);
CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON threads (updated_at DESC);

-- Messages: durable chat history for the UI (graph also keeps runtime state in-memory)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
  content TEXT NOT NULL DEFAULT '',
  tool_calls JSONB,
  tool_call_id TEXT,
  additional_kwargs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages (thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);

-- compactions: durable agent-context summaries for cold resume after process restart
CREATE TABLE IF NOT EXISTS compactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  first_kept_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compactions_thread_id ON compactions (thread_id);
CREATE INDEX IF NOT EXISTS idx_compactions_created_at ON compactions (thread_id, created_at DESC);
