-- Shunya Chat — greenfield schema (wipe + recreate).
-- Run this entire file in the Supabase SQL editor.
-- No backward compatibility: drops existing app tables.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS oauth_states CASCADE;
DROP TABLE IF EXISTS oauth_clients CASCADE;
DROP TABLE IF EXISTS user_credentials CASCADE;
DROP TABLE IF EXISTS user_integrations CASCADE;
DROP TABLE IF EXISTS integration_oauth_clients CASCADE;
DROP TABLE IF EXISTS compactions CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS threads CASCADE;
DROP TABLE IF EXISTS assistants CASCADE;
DROP TABLE IF EXISTS agents CASCADE;

-- ---------------------------------------------------------------------------
-- Agent registry — every agent is an MCP endpoint (+ auth)
-- ---------------------------------------------------------------------------
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,

  -- MCP Streamable HTTP URL (localhost for in-app servers, remote for SaaS)
  mcp_url TEXT NOT NULL,

  -- Whose credentials / how Connect works
  auth TEXT NOT NULL
    CHECK (auth IN (
      'none',
      'env_api_key',
      'user_api_key',
      'oauth_dcr',
      'oauth_static'
    )),

  -- If set, process hosts this FastMCP module (MCP_SERVERS[local_module]).
  -- Tool loading uses in-process Client to avoid self-HTTP deadlock; mcp_url
  -- is still the public/local URL for the same server.
  local_module TEXT,

  -- skills/{skill_id}/SKILL.md (defaults to id if null)
  skill_id TEXT,

  -- OAuth scopes (oauth_*)
  scopes TEXT[] NOT NULL DEFAULT '{}',

  -- env_api_key: required process env var names
  env_keys TEXT[] NOT NULL DEFAULT '{}',

  -- Optional OAuth endpoint overrides (else discover from mcp_url)
  oauth_authorize_url TEXT,
  oauth_token_url TEXT,
  oauth_registration_url TEXT,
  oauth_revocation_url TEXT,

  -- oauth_static: env var names for pre-registered client
  client_id_env TEXT,
  client_secret_env TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agents_enabled_sort ON agents (enabled, sort_order, id);

-- ---------------------------------------------------------------------------
-- Per-user credentials (OAuth tokens or pasted API keys) keyed by agent
-- ---------------------------------------------------------------------------
CREATE TABLE user_credentials (
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL
    CHECK (kind IN ('oauth', 'api_key')),
  status TEXT NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected', 'expired', 'revoked')),
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  oauth_client_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, agent_id)
);

CREATE INDEX idx_user_credentials_agent ON user_credentials (agent_id);

CREATE TABLE oauth_clients (
  agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  client_secret_enc TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE oauth_states (
  state TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  code_verifier TEXT NOT NULL,
  redirect_after TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_oauth_states_expires_at ON oauth_states (expires_at);

-- ---------------------------------------------------------------------------
-- Chat harness
-- ---------------------------------------------------------------------------
CREATE TABLE assistants (
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

CREATE INDEX idx_assistants_user_id ON assistants (user_id);

CREATE TABLE threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  assistant_id UUID NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_threads_user_id ON threads (user_id);
CREATE INDEX idx_threads_assistant_id ON threads (assistant_id);
CREATE INDEX idx_threads_updated_at ON threads (updated_at DESC);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
  content TEXT NOT NULL DEFAULT '',
  tool_calls JSONB,
  tool_call_id TEXT,
  additional_kwargs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_thread_id ON messages (thread_id);
CREATE INDEX idx_messages_created_at ON messages (created_at);

CREATE TABLE compactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  first_kept_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_compactions_thread_id ON compactions (thread_id);
CREATE INDEX idx_compactions_created_at ON compactions (thread_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Seed agents
-- mcp_url for local servers = API_PUBLIC_URL + /mcp/{id} (default localhost:8000)
-- ---------------------------------------------------------------------------
INSERT INTO agents (
  id, name, description, sort_order, mcp_url, auth,
  local_module, skill_id, scopes, env_keys,
  oauth_authorize_url, oauth_token_url, oauth_registration_url, oauth_revocation_url
) VALUES
(
  'search',
  'Perplexity',
  'Web search via Perplexity (docs & current info)',
  10,
  'http://127.0.0.1:8000/mcp/search',
  'env_api_key',
  'search',
  'search',
  '{}',
  ARRAY['PERPLEXITY_API_KEY'],
  NULL, NULL, NULL, NULL
),
(
  'calculator',
  'Calculator',
  'Math and expression evaluation',
  20,
  'http://127.0.0.1:8000/mcp/calculator',
  'none',
  'calculator',
  'calculator',
  '{}',
  '{}',
  NULL, NULL, NULL, NULL
),
(
  'weather',
  'Weather',
  'Current weather for a city',
  30,
  'http://127.0.0.1:8000/mcp/weather',
  'none',
  'weather',
  'weather',
  '{}',
  '{}',
  NULL, NULL, NULL, NULL
),
(
  'datetime',
  'Date & Time',
  'Current date/time and simple conversions',
  40,
  'http://127.0.0.1:8000/mcp/datetime',
  'none',
  'datetime',
  'datetime',
  '{}',
  '{}',
  NULL, NULL, NULL, NULL
),
(
  'linear',
  'Linear',
  'Issues, projects, and comments (read-only)',
  50,
  'https://mcp.linear.app/mcp/readonly',
  'oauth_dcr',
  NULL,
  'linear',
  ARRAY['read'],
  '{}',
  'https://mcp.linear.app/authorize',
  'https://mcp.linear.app/token',
  'https://mcp.linear.app/register',
  'https://mcp.linear.app/token'
);
