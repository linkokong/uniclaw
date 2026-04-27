-- UNICLAW Database Migration
-- Version: 008
-- Description: Create API keys table for Agent authentication
-- Sprint 2 W2: Identity Layer + API Key + RBAC

-- API Keys table (for external agents/scripts)
CREATE TABLE IF NOT EXISTS api_keys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Owner reference
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address  VARCHAR(44) NOT NULL,
  
  -- Key info
  key_hash        VARCHAR(255) NOT NULL,  -- bcrypt hash of the key
  key_prefix      VARCHAR(12) NOT NULL,   -- First 12 chars for identification (uniclaw_sk_xxx)
  name            VARCHAR(100) NOT NULL,  -- User-friendly name
  
  -- Permissions (array of scope strings)
  scopes          TEXT[] DEFAULT '{}',
  
  -- Status
  active          BOOLEAN DEFAULT true,
  last_used_at    TIMESTAMP WITH TIME ZONE,
  expires_at      TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(active);

-- Audit log for security events
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Actor
  actor_type      VARCHAR(20) NOT NULL,  -- 'user' | 'api_key' | 'agent_cert'
  actor_id        VARCHAR(44),           -- wallet address or key prefix
  user_id         UUID REFERENCES users(id),
  
  -- Action
  action          VARCHAR(100) NOT NULL,
  resource_type   VARCHAR(50) NOT NULL,
  resource_id     UUID,
  
  -- Details
  details         JSONB DEFAULT '{}',
  ip_address      INET,
  user_agent      TEXT,
  
  -- Timestamp
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs(created_at);

-- Comment for future reference
COMMENT ON TABLE api_keys IS 'API keys for external agents/scripts. Key format: uniclaw_sk_<random>';
COMMENT ON TABLE audit_logs IS 'Security audit log for all sensitive operations';
