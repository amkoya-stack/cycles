-- Migration 029: Feature Flags System
-- Enables gradual rollouts, A/B testing, and instant rollbacks

-- Create enum for feature flag types
DROP TYPE IF EXISTS feature_flag_type CASCADE;
CREATE TYPE feature_flag_type AS ENUM (
  'boolean',           -- Simple on/off
  'percentage',        -- Percentage rollout (0-100%)
  'user_targeting',    -- Target specific users
  'ip_targeting'      -- Target specific IP addresses
);

-- Create enum for feature flag status
DROP TYPE IF EXISTS feature_flag_status CASCADE;
CREATE TYPE feature_flag_status AS ENUM (
  'draft',     -- Being configured
  'active',    -- Live and being evaluated
  'paused',    -- Temporarily disabled
  'archived'   -- Deleted/removed
);

-- Feature flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  type feature_flag_type NOT NULL,
  status feature_flag_status NOT NULL DEFAULT 'draft',
  enabled BOOLEAN NOT NULL DEFAULT false,
  percentage INTEGER CHECK (percentage >= 0 AND percentage <= 100),
  target_users JSONB, -- Array of user IDs for user_targeting
  target_ips JSONB,   -- Array of IP addresses for ip_targeting
  metadata JSONB,     -- Additional configuration
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_percentage CHECK (
    (type = 'percentage' AND percentage IS NOT NULL) OR
    (type != 'percentage')
  )
);

-- Indexes
CREATE INDEX idx_feature_flags_key ON feature_flags(key);
CREATE INDEX idx_feature_flags_status ON feature_flags(status);
CREATE INDEX idx_feature_flags_type ON feature_flags(type);
CREATE INDEX idx_feature_flags_enabled ON feature_flags(enabled) WHERE enabled = true;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flags_updated_at();

-- Comments
COMMENT ON TABLE feature_flags IS 'Feature flags for gradual rollouts and A/B testing';
COMMENT ON COLUMN feature_flags.key IS 'Unique identifier for the flag (e.g., "new_payment_flow")';
COMMENT ON COLUMN feature_flags.type IS 'Type of flag: boolean, percentage, user_targeting, or ip_targeting';
COMMENT ON COLUMN feature_flags.percentage IS 'Percentage of users to enable (0-100) for percentage type';
COMMENT ON COLUMN feature_flags.target_users IS 'Array of user IDs for user_targeting type';
COMMENT ON COLUMN feature_flags.target_ips IS 'Array of IP addresses for ip_targeting type';
COMMENT ON COLUMN feature_flags.metadata IS 'Additional configuration (e.g., canary settings, rollback thresholds)';

