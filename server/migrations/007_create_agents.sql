-- Claw Universe Database Migration
-- Version: 007
-- Description: Create agents table for the Agent rental marketplace
-- PostgreSQL

CREATE TABLE IF NOT EXISTS agents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Owner identity
  owner_wallet    VARCHAR(44) NOT NULL,

  -- Agent info
  name            VARCHAR(100) NOT NULL,
  description     TEXT DEFAULT '',
  capabilities    TEXT[] DEFAULT '{}',

  -- Pricing: each field stores amount, currency stored separately
  hourly_rate     DECIMAL(20, 4) DEFAULT 0,
  monthly_rate    DECIMAL(20, 4) DEFAULT 0,
  currency        VARCHAR(10) DEFAULT 'SOL',  -- SOL | UNICLAW | USDGO

  -- Status
  verified        BOOLEAN DEFAULT false,
  available       BOOLEAN DEFAULT true,

  -- Stats
  total_jobs      INTEGER DEFAULT 0,
  rating          DECIMAL(3, 2) DEFAULT 0,
  total_hours     DECIMAL(10, 2) DEFAULT 0,

  -- Timestamps
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_wallet);
CREATE INDEX IF NOT EXISTS idx_agents_available ON agents(available);
CREATE INDEX IF NOT EXISTS idx_agents_currency ON agents(currency);
