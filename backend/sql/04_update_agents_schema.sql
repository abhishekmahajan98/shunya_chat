-- Add capabilities column to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS capabilities text[];

-- Update existing agents with default capabilities
-- This ensures the hardcoded "search" agent logic is preserved in the DB
INSERT INTO agents (id, name, icon, description, category, url, has_access, capabilities)
VALUES (
  'search',
  'Quick Search',
  'search',
  'Fast web lookup for instant answers using Perplexity',
  'research',
  'http://localhost:8001',
  true,
  ARRAY['search', 'web', 'lookup', 'find', 'research']
)
ON CONFLICT (id) DO UPDATE SET
  capabilities = EXCLUDED.capabilities,
  url = EXCLUDED.url;
