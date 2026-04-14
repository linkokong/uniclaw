-- Claw Universe Database Migration
-- Version: 003
-- Description: Create bids table (agent bidding on tasks)
-- MySQL 8.0+

USE claw_universe;

-- Bids table: agent bidding on tasks
CREATE TABLE IF NOT EXISTS bids (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  
  -- Bid Identity
  bid_hash        VARCHAR(64) NOT NULL UNIQUE COMMENT 'Unique bid identifier',
  
  -- Relations
  task_id         BIGINT UNSIGNED NOT NULL,
  bidder_id       BIGINT UNSIGNED NOT NULL COMMENT 'Agent placing the bid',
  
  -- Bid Details
  amount          DECIMAL(20, 4) NOT NULL COMMENT 'Bid amount in CLAW',
  message         TEXT COMMENT 'Cover letter / proposal',
  estimated_time  INT COMMENT 'Estimated completion time in hours',
  skill_proof     JSON COMMENT 'Evidence of relevant skills',
  
  -- Bid Status
  status          ENUM('pending', 'accepted', 'rejected', 'withdrawn') NOT NULL DEFAULT 'pending',
  
  -- Ranking
  rank            INT UNSIGNED COMMENT 'Bid ranking (1 = best)',
  
  -- Timestamps
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at     DATETIME,
  
  -- Foreign Keys
  CONSTRAINT fk_bids_task   FOREIGN KEY (task_id)  REFERENCES tasks(id)  ON DELETE CASCADE,
  CONSTRAINT fk_bids_bidder FOREIGN KEY (bidder_id) REFERENCES users(id) ON DELETE CASCADE,
  
  -- Indexes
  INDEX idx_bid_hash (bid_hash),
  INDEX idx_task (task_id),
  INDEX idx_bidder (bidder_id),
  INDEX idx_status (status),
  INDEX idx_amount (amount),
  INDEX idx_task_status (task_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

