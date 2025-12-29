-- Migration 030: Canary Deployment System
-- Tracks gradual rollouts and enables instant rollbacks

CREATE TABLE IF NOT EXISTS canary_deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_key TEXT NOT NULL,
  version TEXT NOT NULL, -- 'v1', 'v2', etc.
  percentage INTEGER NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'rolled_back')),
  metrics JSONB NOT NULL DEFAULT '{
    "totalRequests": 0,
    "successCount": 0,
    "errorCount": 0,
    "errorRate": 0,
    "avgResponseTime": 0
  }'::JSONB,
  rollback_threshold DECIMAL(5,2), -- Auto-rollback if error rate exceeds this
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_canary_deployments_feature_key ON canary_deployments(feature_key);
CREATE INDEX idx_canary_deployments_status ON canary_deployments(status);
CREATE INDEX idx_canary_deployments_active ON canary_deployments(feature_key, status) WHERE status = 'active';

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_canary_deployments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_canary_deployments_updated_at
  BEFORE UPDATE ON canary_deployments
  FOR EACH ROW
  EXECUTE FUNCTION update_canary_deployments_updated_at();

-- Comments
COMMENT ON TABLE canary_deployments IS 'Tracks canary deployments for gradual feature rollouts';
COMMENT ON COLUMN canary_deployments.feature_key IS 'References feature_flags.key';
COMMENT ON COLUMN canary_deployments.percentage IS 'Current percentage of traffic routed to new version';
COMMENT ON COLUMN canary_deployments.metrics IS 'Real-time metrics: success/error counts, error rate, response times';
COMMENT ON COLUMN canary_deployments.rollback_threshold IS 'Auto-rollback if error rate exceeds this percentage';

