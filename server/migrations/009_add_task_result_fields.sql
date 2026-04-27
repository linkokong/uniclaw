-- Add result fields to tasks table for MCP Server task submission
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS result_url TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS result_description TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS result_attachments TEXT[];
