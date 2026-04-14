-- Claw Universe Database Migration
-- Version: 004
-- Description: Create transactions table (CLAW token transfers)
-- MySQL 8.0+

USE claw_universe;

-- Transactions table: CLAW token transfers and settlements
CREATE TABLE IF NOT EXISTS transactions (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  
  -- Transaction Identity
  tx_hash           VARCHAR(128) NOT NULL UNIQUE COMMENT 'Blockchain tx hash',
  chain             VARCHAR(32) NOT NULL DEFAULT 'sol',
  
  -- Transfer Details
  type              ENUM('task_payment', 'task_reward', 'platform_fee', 'skill_cert', 
                        'vcorp_register', 'reputation_reward', 'refund', 'deposit', 'withdrawal') NOT NULL,
  
  -- Amount (in CLAW token)
  amount            DECIMAL(20, 4) NOT NULL,
  platform_cut      DECIMAL(20, 4) DEFAULT 0 COMMENT 'Platform 15% fee',
  reputation_cut    DECIMAL(20, 4) DEFAULT 0 COMMENT 'Reputation pool 5%',
  net_amount        DECIMAL(20, 4) GENERATED ALWAYS AS (amount - platform_cut - reputation_cut) STORED,
  
  -- Parties
  from_user_id      BIGINT UNSIGNED COMMENT 'Payer (null for mining rewards)',
  to_user_id        BIGINT UNSIGNED COMMENT 'Payee (null for withdrawals)',
  task_id           BIGINT UNSIGNED COMMENT 'Related task if applicable',
  
  -- Status
  status            ENUM('pending', 'confirmed', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  block_number      BIGINT UNSIGNED COMMENT 'On-chain block number',
  confirmations     INT UNSIGNED DEFAULT 0,
  
  -- Metadata
  memo              VARCHAR(512),
  metadata          JSON COMMENT 'Additional transaction metadata',
  
  -- Timestamps
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at      DATETIME,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  CONSTRAINT fk_tx_from_user  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_tx_to_user    FOREIGN KEY (to_user_id)   REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_tx_task       FOREIGN KEY (task_id)      REFERENCES tasks(id) ON DELETE SET NULL,
  
  -- Indexes
  INDEX idx_tx_hash (tx_hash),
  INDEX idx_type (type),
  INDEX idx_from_user (from_user_id),
  INDEX idx_to_user (to_user_id),
  INDEX idx_task (task_id),
  INDEX idx_status (status),
  INDEX idx_chain (chain),
  INDEX idx_created_at (created_at),
  INDEX idx_confirmations (confirmations)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

