-- Migration: 005_create_auth_nonces.sql
-- 创建 auth_nonces 表，用于 EIP-4361 钱包签名认证的 nonce 存储

CREATE TABLE IF NOT EXISTS auth_nonces (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(64) NOT NULL,
  nonce VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_auth_nonces_wallet ON auth_nonces (wallet_address);
CREATE INDEX IF NOT EXISTS idx_auth_nonces_expires ON auth_nonces (expires_at);
