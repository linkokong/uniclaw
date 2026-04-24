-- Claw Universe Database Migration
-- Version: 006
-- Description: Add on-chain PDA tracking columns to tasks table
-- PostgreSQL

-- Add task_pda column for linking DB records to on-chain accounts
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_pda VARCHAR(44) UNIQUE;

-- Add tx_signature for tracking the creation transaction
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tx_signature VARCHAR(100);

-- Index for fast PDA lookups
CREATE INDEX IF NOT EXISTS idx_tasks_pda ON tasks(task_pda);
