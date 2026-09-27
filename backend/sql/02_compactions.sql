-- Thread compactions: durable agent-context summaries for cold resume.
-- UI keeps full messages; agent context = latest summary + messages from first_kept onward.

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
