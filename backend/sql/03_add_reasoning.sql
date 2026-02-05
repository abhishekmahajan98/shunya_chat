-- Add reasoning column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reasoning JSONB;
