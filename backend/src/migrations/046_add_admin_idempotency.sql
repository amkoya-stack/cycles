-- Migration: Add Idempotency Support to Admin Actions
-- Phase 15 Production Readiness: Idempotency Everywhere

-- Add idempotency_key column to admin_actions table
ALTER TABLE admin_actions 
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

-- Create unique index for idempotency (action_type + target_id + idempotency_key)
-- This ensures the same action with the same key can't be executed twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_actions_idempotency 
ON admin_actions(action_type, target_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_actions_idempotency_key 
ON admin_actions(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

