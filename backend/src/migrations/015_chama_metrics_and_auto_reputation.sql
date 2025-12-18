-- Migration 015: Chama Performance Metrics & Auto-Reputation Updates
-- Tracks chama-level health metrics and automates reputation calculation

-- ==========================================
-- CHAMA METRICS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS chama_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
  
  -- Membership metrics
  total_members INTEGER DEFAULT 0,
  active_members INTEGER DEFAULT 0,
  retention_rate DECIMAL(5,2) DEFAULT 100.00, -- Percentage of members who stayed
  members_joined_month INTEGER DEFAULT 0,
  members_left_month INTEGER DEFAULT 0,
  average_tenure_months DECIMAL(8,2) DEFAULT 0, -- Average months members stay
  
  -- Loan performance
  total_loans_issued INTEGER DEFAULT 0,
  active_loans INTEGER DEFAULT 0,
  completed_loans INTEGER DEFAULT 0,
  defaulted_loans INTEGER DEFAULT 0,
  loan_default_rate DECIMAL(5,2) DEFAULT 0.00, -- Percentage of loans defaulted
  total_loans_value DECIMAL(15,2) DEFAULT 0.00,
  total_repaid_value DECIMAL(15,2) DEFAULT 0.00,
  
  -- Contribution performance
  total_contributions INTEGER DEFAULT 0,
  on_time_contributions INTEGER DEFAULT 0,
  late_contributions INTEGER DEFAULT 0,
  contribution_consistency_rate DECIMAL(5,2) DEFAULT 0.00,
  total_contributions_value DECIMAL(15,2) DEFAULT 0.00,
  
  -- Investment performance (for investment chamas)
  initial_capital DECIMAL(15,2) DEFAULT 0.00,
  current_capital DECIMAL(15,2) DEFAULT 0.00,
  total_returns DECIMAL(15,2) DEFAULT 0.00,
  roi_percentage DECIMAL(8,2) DEFAULT 0.00, -- Return on Investment %
  
  -- Activity metrics
  total_meetings INTEGER DEFAULT 0,
  average_attendance_rate DECIMAL(5,2) DEFAULT 0.00,
  total_votes INTEGER DEFAULT 0,
  average_participation_rate DECIMAL(5,2) DEFAULT 0.00,
  
  -- Health score (0-100)
  health_score INTEGER DEFAULT 50 CHECK (health_score >= 0 AND health_score <= 100),
  
  -- Timestamps
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  period_start DATE,
  period_end DATE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(chama_id, period_end)
);

CREATE INDEX idx_chama_metrics_chama ON chama_metrics(chama_id);
CREATE INDEX idx_chama_metrics_period ON chama_metrics(period_end DESC);
CREATE INDEX idx_chama_metrics_health ON chama_metrics(health_score DESC);

-- ==========================================
-- REPUTATION CALCULATION EVENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS reputation_calculation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
  trigger_type VARCHAR(50) NOT NULL, -- contribution, loan_repayment, meeting_attendance, vote, manual, scheduled
  trigger_id UUID, -- Reference to the triggering event (contribution_id, loan_id, etc)
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  score_before INTEGER,
  score_after INTEGER,
  tier_before VARCHAR(20),
  tier_after VARCHAR(20),
  error_message TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reputation_events_user ON reputation_calculation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_reputation_events_chama ON reputation_calculation_events(chama_id);
CREATE INDEX IF NOT EXISTS idx_reputation_events_status ON reputation_calculation_events(status);
CREATE INDEX IF NOT EXISTS idx_reputation_events_trigger ON reputation_calculation_events(trigger_type);
CREATE INDEX IF NOT EXISTS idx_reputation_events_created ON reputation_calculation_events(created_at DESC);

-- ==========================================
-- CHAMA METRICS CALCULATION FUNCTION
-- ==========================================
CREATE OR REPLACE FUNCTION calculate_chama_metrics(p_chama_id UUID, p_period_end DATE DEFAULT CURRENT_DATE)
RETURNS UUID AS $$
DECLARE
  v_metric_id UUID;
  v_period_start DATE;
  v_total_members INTEGER;
  v_active_members INTEGER;
  v_members_joined INTEGER;
  v_members_left INTEGER;
  v_retention_rate DECIMAL(5,2);
  v_avg_tenure DECIMAL(8,2);
  v_total_loans INTEGER;
  v_active_loans INTEGER;
  v_completed_loans INTEGER;
  v_defaulted_loans INTEGER;
  v_default_rate DECIMAL(5,2);
  v_total_contributions INTEGER;
  v_on_time_contributions INTEGER;
  v_contribution_rate DECIMAL(5,2);
  v_health_score INTEGER;
BEGIN
  -- Calculate period start (last 30 days)
  v_period_start := p_period_end - INTERVAL '30 days';
  
  -- Membership metrics
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'active'),
    COUNT(*) FILTER (WHERE joined_at >= v_period_start),
    COUNT(*) FILTER (WHERE status = 'left' AND updated_at >= v_period_start)
  INTO v_total_members, v_active_members, v_members_joined, v_members_left
  FROM chama_members
  WHERE chama_id = p_chama_id;
  
  -- Retention rate
  v_retention_rate := CASE 
    WHEN v_total_members > 0 THEN 
      (v_active_members::DECIMAL / v_total_members * 100)
    ELSE 100
  END;
  
  -- Average tenure
  SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(updated_at, NOW()) - joined_at)) / 2592000) -- months
  INTO v_avg_tenure
  FROM chama_members
  WHERE chama_id = p_chama_id;
  
  -- Loan metrics (placeholder - will be implemented when loan system is added)
  v_total_loans := 0;
  v_active_loans := 0;
  v_completed_loans := 0;
  v_defaulted_loans := 0;
  v_default_rate := 0.00;
  
  -- Contribution metrics
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed' AND paid_at <= due_date)
  INTO v_total_contributions, v_on_time_contributions
  FROM contributions c
  JOIN contribution_cycles cc ON c.cycle_id = cc.id
  WHERE cc.chama_id = p_chama_id
    AND c.created_at >= v_period_start;
  
  v_contribution_rate := CASE 
    WHEN v_total_contributions > 0 THEN 
      (v_on_time_contributions::DECIMAL / v_total_contributions * 100)
    ELSE 0
  END;
  
  -- Calculate health score (weighted average)
  v_health_score := LEAST(100, GREATEST(0, 
    ROUND(
      (v_retention_rate * 0.3) +           -- 30% weight on retention
      (v_contribution_rate * 0.4) +        -- 40% weight on contribution consistency
      ((100 - v_default_rate) * 0.3)       -- 30% weight on loan performance
    )
  ));
  
  -- Upsert metrics
  INSERT INTO chama_metrics (
    chama_id, total_members, active_members, retention_rate,
    members_joined_month, members_left_month, average_tenure_months,
    total_loans_issued, active_loans, completed_loans, defaulted_loans, loan_default_rate,
    total_contributions, on_time_contributions, contribution_consistency_rate,
    health_score, calculated_at, period_start, period_end
  ) VALUES (
    p_chama_id, v_total_members, v_active_members, v_retention_rate,
    v_members_joined, v_members_left, v_avg_tenure,
    v_total_loans, v_active_loans, v_completed_loans, v_defaulted_loans, v_default_rate,
    v_total_contributions, v_on_time_contributions, v_contribution_rate,
    v_health_score, NOW(), v_period_start, p_period_end
  )
  ON CONFLICT (chama_id, period_end) 
  DO UPDATE SET
    total_members = EXCLUDED.total_members,
    active_members = EXCLUDED.active_members,
    retention_rate = EXCLUDED.retention_rate,
    members_joined_month = EXCLUDED.members_joined_month,
    members_left_month = EXCLUDED.members_left_month,
    average_tenure_months = EXCLUDED.average_tenure_months,
    total_contributions = EXCLUDED.total_contributions,
    on_time_contributions = EXCLUDED.on_time_contributions,
    contribution_consistency_rate = EXCLUDED.contribution_consistency_rate,
    health_score = EXCLUDED.health_score,
    calculated_at = NOW()
  RETURNING id INTO v_metric_id;
  
  -- Update chama activity_score to match health_score
  UPDATE chamas 
  SET activity_score = v_health_score
  WHERE id = p_chama_id;
  
  RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- TRIGGER: Auto-calculate reputation after contribution
-- ==========================================
CREATE OR REPLACE FUNCTION trigger_reputation_after_contribution()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for completed contributions
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Queue reputation calculation event
    INSERT INTO reputation_calculation_events (
      user_id, chama_id, trigger_type, trigger_id, status
    )
    SELECT 
      NEW.user_id,
      cc.chama_id,
      'contribution',
      NEW.id,
      'pending'
    FROM contribution_cycles cc
    WHERE cc.id = NEW.cycle_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_reputation_contribution
  AFTER INSERT OR UPDATE ON contributions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_reputation_after_contribution();

-- ==========================================
-- TRIGGER: Update chama metrics after contribution
-- ==========================================
CREATE OR REPLACE FUNCTION trigger_chama_metrics_after_contribution()
RETURNS TRIGGER AS $$
DECLARE
  v_chama_id UUID;
BEGIN
  -- Get chama_id from cycle
  SELECT chama_id INTO v_chama_id
  FROM contribution_cycles
  WHERE id = NEW.cycle_id;
  
  -- Recalculate chama metrics
  PERFORM calculate_chama_metrics(v_chama_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chama_metrics_contribution
  AFTER INSERT OR UPDATE ON contributions
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION trigger_chama_metrics_after_contribution();

-- ==========================================
-- TRIGGER: Update metrics when member joins/leaves
-- ==========================================
CREATE OR REPLACE FUNCTION trigger_chama_metrics_after_member_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate metrics for the chama
  PERFORM calculate_chama_metrics(NEW.chama_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chama_metrics_member
  AFTER INSERT OR UPDATE ON chama_members
  FOR EACH ROW
  EXECUTE FUNCTION trigger_chama_metrics_after_member_change();

-- ==========================================
-- COMMENTS
-- ==========================================
COMMENT ON TABLE chama_metrics IS 'Tracks chama-level performance metrics including retention, loan defaults, and investment performance';
COMMENT ON TABLE reputation_calculation_events IS 'Event queue for automated reputation score updates triggered by user actions';
COMMENT ON FUNCTION calculate_chama_metrics IS 'Calculates comprehensive chama performance metrics for a given period';
COMMENT ON COLUMN chama_metrics.health_score IS 'Overall chama health score (0-100) based on retention, contributions, and loan performance';
COMMENT ON COLUMN chama_metrics.retention_rate IS 'Percentage of members who remain active';
COMMENT ON COLUMN chama_metrics.loan_default_rate IS 'Percentage of loans that defaulted';
COMMENT ON COLUMN chama_metrics.roi_percentage IS 'Return on Investment percentage for investment chamas';
