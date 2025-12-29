-- Migration 032: Chaos Testing System
-- Enables controlled failure injection for resilience testing

CREATE TYPE chaos_type AS ENUM (
  'latency',           -- Inject artificial latency
  'error',             -- Inject errors
  'timeout',           -- Simulate timeouts
  'database_failure',  -- Simulate database failures
  'redis_failure',     -- Simulate Redis failures
  'random_failure'     -- Random failures
);

CREATE TABLE IF NOT EXISTS chaos_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type chaos_type NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  probability INTEGER NOT NULL CHECK (probability >= 0 AND probability <= 100),
  target TEXT, -- Endpoint pattern, service name, etc.
  config JSONB NOT NULL DEFAULT '{}'::JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chaos_rules_enabled ON chaos_rules(enabled) WHERE enabled = true;
CREATE INDEX idx_chaos_rules_type ON chaos_rules(type);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_chaos_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_chaos_rules_updated_at
  BEFORE UPDATE ON chaos_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_chaos_rules_updated_at();

-- Comments
COMMENT ON TABLE chaos_rules IS 'Chaos testing rules for failure injection (development/staging only)';
COMMENT ON COLUMN chaos_rules.probability IS 'Percentage chance (0-100) of triggering this rule';
COMMENT ON COLUMN chaos_rules.target IS 'Optional target (endpoint pattern, service name)';
COMMENT ON COLUMN chaos_rules.config IS 'Rule-specific configuration (latencyMs, errorCode, etc.)';

