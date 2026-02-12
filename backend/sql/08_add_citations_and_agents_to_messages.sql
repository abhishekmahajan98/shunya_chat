-- Add citations and agents columns to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS citations JSONB;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS agents JSONB;

-- Add comment for documentation
COMMENT ON COLUMN messages.citations IS 'Sources/citations used in the assistant response';
COMMENT ON COLUMN messages.agents IS 'List of agent IDs used to generate the response';
