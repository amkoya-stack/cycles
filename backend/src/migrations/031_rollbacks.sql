-- Migration 031: Rollback Tracking System
-- Records all rollback operations for audit and analysis

CREATE TABLE IF NOT EXISTS rollbacks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('feature_flag', 'canary_deployment', 'database_migration', 'code_deployment')),
  target_id TEXT NOT NULL, -- Feature key, migration version, deployment ID, etc.
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  metadata JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_rollbacks_type ON rollbacks(type);
CREATE INDEX idx_rollbacks_target_id ON rollbacks(target_id);
CREATE INDEX idx_rollbacks_status ON rollbacks(status);
CREATE INDEX idx_rollbacks_started_at ON rollbacks(started_at DESC);

-- Comments
COMMENT ON TABLE rollbacks IS 'Audit log of all rollback operations';
COMMENT ON COLUMN rollbacks.type IS 'Type of rollback: feature_flag, canary_deployment, database_migration, code_deployment';
COMMENT ON COLUMN rollbacks.target_id IS 'Identifier of what was rolled back (feature key, migration version, etc.)';
COMMENT ON COLUMN rollbacks.reason IS 'Reason for rollback (e.g., "High error rate", "User complaints")';

