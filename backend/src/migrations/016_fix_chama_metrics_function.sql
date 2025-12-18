-- ==========================================
-- MIGRATION 016: FIX CHAMA METRICS FUNCTION
-- Fix calculate_chama_metrics() to use correct column names
-- ==========================================

-- Drop and recreate the function with correct column references
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
    COUNT(*) FILTER (WHERE status = 'left' AND left_at >= v_period_start)  -- FIXED: use left_at instead of updated_at
  INTO v_total_members, v_active_members, v_members_joined, v_members_left
  FROM chama_members
  WHERE chama_id = p_chama_id;
  
  -- Retention rate
  v_retention_rate := CASE 
    WHEN v_total_members > 0 THEN 
      (v_active_members::DECIMAL / v_total_members * 100)
    ELSE 100
  END;
  
  -- Average tenure (months)
  SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(left_at, NOW()) - joined_at)) / 2592000)  -- FIXED: use left_at instead of updated_at
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
    COUNT(*) FILTER (WHERE c.status = 'completed' AND c.contributed_at <= cc.due_date)
  INTO v_total_contributions, v_on_time_contributions
  FROM contributions c
  JOIN contribution_cycles cc ON c.cycle_id = cc.id
  WHERE c.chama_id = p_chama_id
    AND c.contributed_at >= v_period_start;
  
  -- Contribution consistency rate
  v_contribution_rate := CASE 
    WHEN v_total_contributions > 0 THEN 
      (v_on_time_contributions::DECIMAL / v_total_contributions * 100)
    ELSE 100
  END;
  
  -- Calculate health score (0-100)
  -- Weighted: 40% retention, 30% loan performance, 30% contributions
  v_health_score := ROUND(
    (v_retention_rate * 0.4) +
    ((100 - v_default_rate) * 0.3) +
    (v_contribution_rate * 0.3)
  );
  
  -- Ensure health score is between 0-100
  v_health_score := GREATEST(0, LEAST(100, v_health_score));
  
  -- Insert metrics
  INSERT INTO chama_metrics (
    chama_id,
    period_start,
    period_end,
    total_members,
    active_members,
    retention_rate,
    members_joined_month,
    members_left_month,
    average_tenure_months,
    total_loans_issued,
    active_loans,
    completed_loans,
    defaulted_loans,
    loan_default_rate,
    total_contributions,
    on_time_contributions,
    contribution_consistency_rate,
    health_score
  ) VALUES (
    p_chama_id,
    v_period_start,
    p_period_end,
    v_total_members,
    v_active_members,
    v_retention_rate,
    v_members_joined,
    v_members_left,
    COALESCE(v_avg_tenure, 0),
    v_total_loans,
    v_active_loans,
    v_completed_loans,
    v_defaulted_loans,
    v_default_rate,
    v_total_contributions,
    v_on_time_contributions,
    v_contribution_rate,
    v_health_score
  ) RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION calculate_chama_metrics IS 'Fixed to use left_at instead of non-existent updated_at column';
