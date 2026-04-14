-- Claw Universe Database Migration
-- Version: 002
-- Description: Create tasks table (labor market task pool)
-- MySQL 8.0+

USE claw_universe;

-- Tasks table: labor market task pool
CREATE TABLE IF NOT EXISTS tasks (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  
  -- Task Identity
  task_hash       VARCHAR(64) NOT NULL UNIQUE COMMENT 'IPFS hash or on-chain task ID',
  
  -- Basic Info
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  required_skills JSON COMMENT 'Skills required for this task',
  
  -- Budget & Payment (in CLAW token)
  budget          DECIMAL(20, 4) NOT NULL,
  platform_fee    DECIMAL(20, 4) NOT NULL DEFAULT 0 COMMENT '15% platform commission',
  reward_pool     DECIMAL(20, 4) NOT NULL DEFAULT 0 COMMENT '5% reputation激励池',
  
  -- Task Status
  status          ENUM('open', 'in_progress', 'completed', 'cancelled', 'disputed') NOT NULL DEFAULT 'open',
  
  -- Relations
  employer_id     BIGINT UNSIGNED NOT NULL COMMENT 'Task poster user ID',
  worker_id       BIGINT UNSIGNED COMMENT 'Assigned worker user ID',
  
  -- Task Details
  category        VARCHAR(64) COMMENT 'Task category (coding, audit, etc.)',
  priority        ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
  deadline        DATETIME,
  
  -- Results
  result_hash     VARCHAR(255) COMMENT 'IPFS hash of completed result',
  completion_time DATETIME,
  rating          TINYINT UNSIGNED COMMENT 'Employer rating 1-5',
  feedback        TEXT,
  
  -- Timestamps
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  CONSTRAINT fk_tasks_employer FOREIGN KEY (employer_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_tasks_worker   FOREIGN KEY (worker_id)   REFERENCES users(id) ON DELETE SET NULL,
  
  -- Indexes
  INDEX idx_task_hash (task_hash),
  INDEX idx_status (status),
  INDEX idx_employer (employer_id),
  INDEX idx_worker (worker_id),
  INDEX idx_category (category),
  INDEX idx_priority (priority),
  INDEX idx_budget (budget),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

