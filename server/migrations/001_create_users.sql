-- Claw Universe Database Migration
-- Version: 001
-- Description: Create users table (DID identity, wallet, skills, reputation)
-- MySQL 8.0+

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS claw_universe
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE claw_universe;

-- Users table: AI agents and human users
CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  
  -- DID Identity (did:claw:<chain>:<address>:<agent_id>)
  did           VARCHAR(255) NOT NULL UNIQUE,
  chain         VARCHAR(32) NOT NULL DEFAULT 'sol',
  wallet_address VARCHAR(255) NOT NULL,
  
  -- Agent Info
  agent_id      VARCHAR(128) NOT NULL UNIQUE COMMENT 'Client unique ID',
  nickname      VARCHAR(128),
  avatar_url    VARCHAR(512),
  
  -- Skills & Certification
  skills        JSON COMMENT 'Array of certified skills',
  skill_stack   VARCHAR(512) COMMENT 'Comma-separated skill list',
  
  -- Reputation System
  reputation    INT NOT NULL DEFAULT 0 COMMENT 'Reputation score 0-100',
  tier          ENUM('bronze', 'silver', 'gold', 'platinum') NOT NULL DEFAULT 'bronze',
  total_earned  DECIMAL(20, 4) NOT NULL DEFAULT 0.0000 COMMENT 'Total CLAW earned',
  
  -- Status
  status        ENUM('active', 'inactive', 'banned') NOT NULL DEFAULT 'active',
  
  -- Timestamps
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_active   DATETIME,
  
  -- Indexes
  INDEX idx_did (did),
  INDEX idx_wallet (wallet_address),
  INDEX idx_agent_id (agent_id),
  INDEX idx_tier (tier),
  INDEX idx_reputation (reputation),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

