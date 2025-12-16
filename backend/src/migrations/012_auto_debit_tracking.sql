-- Migration 012: Add auto-debit execution tracking columns
-- Adds execution status tracking and retry logic to contribution_auto_debits

-- Add execution tracking columns
ALTER TABLE contribution_auto_debits 
ADD COLUMN IF NOT EXISTS last_execution_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_execution_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_execution_error TEXT,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS disabled_reason TEXT;

-- Create index for efficient auto-debit queries
CREATE INDEX IF NOT EXISTS idx_auto_debits_next_execution 
ON contribution_auto_debits(next_execution_at) 
WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_auto_debits_retry 
ON contribution_auto_debits(last_execution_status, retry_count, last_execution_at) 
WHERE enabled = true AND last_execution_status = 'failed';

-- Migration 012 completed: Auto-debit execution tracking
