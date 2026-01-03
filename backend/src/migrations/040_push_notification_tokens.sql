-- ============================================================================
-- Migration: Push Notification Tokens
-- Description: Creates table for storing FCM/APNS push notification tokens
-- ============================================================================

BEGIN;

-- ============================================================================
-- Push Notification Tokens Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS push_notification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Token Information
  token TEXT NOT NULL, -- FCM or APNS token
  platform TEXT NOT NULL CHECK (platform IN ('web', 'android', 'ios')),
  device_id TEXT, -- Optional device identifier
  device_name TEXT, -- Optional device name (e.g., "John's iPhone")
  
  -- App Information
  app_version TEXT, -- App version when token was registered
  user_agent TEXT, -- Browser user agent for web tokens
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, token), -- One token per user (can have multiple devices)
  CONSTRAINT push_tokens_user_fkey FOREIGN KEY (user_id) 
    REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for push notification tokens
CREATE INDEX IF NOT EXISTS idx_push_tokens_user 
  ON push_notification_tokens(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active 
  ON push_notification_tokens(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_tokens_platform 
  ON push_notification_tokens(platform, is_active);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_push_token_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER update_push_token_updated_at
  BEFORE UPDATE ON push_notification_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_push_token_updated_at();

COMMIT;

