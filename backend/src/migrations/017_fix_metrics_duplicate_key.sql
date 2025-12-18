-- Migration: Fix duplicate key error in chama metrics calculation
-- Changes INSERT to use ON CONFLICT DO UPDATE

CREATE OR REPLACE FUNCTION calculate_chama_metrics(p_chama_id UUID, p_period_end DATE DEFAULT CURRENT_DATE)
RETURNS UUID AS $$
DECLARE
  v_period_start DATE;
  v_total_members INTEGER;
  v_active_members INTEGER;
  v_retention_rate NUMERIC;
  v_members_joined INTEGER;
  v_members_left INTEGER;
  v_avg_tenure NUMERIC;
  v_total_loans INTEGER;
  v_active_loans INTEGER;
  v_completed_loans INTEGER;
  v_defaulted_loans INTEGER;
  v_default_rate NUMERIC;
  v_total_contributions INTEGER;
  v_on_time_contributions INTEGER;
  v_contribution_rate NUMERIC;
  v_health_score NUMERIC;
  v_metric_id UUID;
BEGIN
  v_period_start := DATE_TRUNC('month', p_period_end)::DATE;
  
  -- Total members (all time)
  SELECT COUNT(*) INTO v_total_members
  FROM chama_members
  WHERE chama_id = p_chama_id;
  
  -- Active members
  SELECT COUNT(*) INTO v_active_members
  FROM chama_members
  WHERE chama_id = p_chama_id AND status = 'active';
  
  -- Retention rate
  v_retention_rate := CASE 
    WHEN v_total_members > 0 THEN (v_active_members::NUMERIC / v_total_members) * 100
    ELSE 100
  END;
  
  -- Members joined this month
  SELECT COUNT(*) INTO v_members_joined
  FROM chama_members
  WHERE chama_id = p_chama_id 
    AND joined_at >= v_period_start 
    AND joined_at < p_period_end + INTERVAL '1 day';
  
  -- Members left this month (use left_at instead of updated_at)
  SELECT COUNT(*) INTO v_members_left
  FROM chama_members
  WHERE chama_id = p_chama_id 
    AND status != 'active'
    AND left_at >= v_period_start 
    AND left_at < p_period_end + INTERVAL '1 day';
  
  -- Average tenure
  SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(left_at, CURRENT_TIMESTAMP) - joined_at)) / 2592000)
  INTO v_avg_tenure
  FROM chama_members
  WHERE chama_id = p_chama_id;
  
  -- Loan metrics (set to 0 if loans table doesn't exist yet)
  BEGIN
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'active'),
      COUNT(*) FILTER (WHERE status = 'completed'),
      COUNT(*) FILTER (WHERE status = 'defaulted')
    INTO v_total_loans, v_active_loans, v_completed_loans, v_defaulted_loans
    FROM loans
    WHERE chama_id = p_chama_id;
  EXCEPTION
    WHEN undefined_table THEN
      v_total_loans := 0;
      v_active_loans := 0;
      v_completed_loans := 0;
      v_defaulted_loans := 0;
  END;
  
  v_default_rate := CASE 
    WHEN v_total_loans > 0 THEN (v_defaulted_loans::NUMERIC / v_total_loans) * 100
    ELSE 0
  END;
  
  -- Contribution metrics
  SELECT COUNT(*) INTO v_total_contributions
  FROM contributions
  WHERE chama_id = p_chama_id 
    AND status = 'completed'
    AND contributed_at >= v_period_start 
    AND contributed_at < p_period_end + INTERVAL '1 day';
  
  SELECT COUNT(*) INTO v_on_time_contributions
  FROM contributions c
  JOIN contribution_cycles cc ON c.cycle_id = cc.id
  WHERE c.chama_id = p_chama_id 
    AND c.status = 'completed'
    AND c.contributed_at <= cc.due_date
    AND c.contributed_at >= v_period_start 
    AND c.contributed_at < p_period_end + INTERVAL '1 day';
  
  v_contribution_rate := CASE 
    WHEN v_total_contributions > 0 THEN (v_on_time_contributions::NUMERIC / v_total_contributions) * 100
    ELSE 100
  END;
  
  -- Health score calculation
  v_health_score := ROUND(
    (v_retention_rate * 0.4) +
    ((100 - v_default_rate) * 0.3) +
    (v_contribution_rate * 0.3)
  );
  
  v_health_score := GREATEST(0, LEAST(100, v_health_score));
  
  -- Insert or update metrics (handle duplicate key)
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
  )
  ON CONFLICT (chama_id, period_end) 
  DO UPDATE SET
    total_members = EXCLUDED.total_members,
    active_members = EXCLUDED.active_members,
    retention_rate = EXCLUDED.retention_rate,
    members_joined_month = EXCLUDED.members_joined_month,
    members_left_month = EXCLUDED.members_left_month,
    average_tenure_months = EXCLUDED.average_tenure_months,
    total_loans_issued = EXCLUDED.total_loans_issued,
    active_loans = EXCLUDED.active_loans,
    completed_loans = EXCLUDED.completed_loans,
    defaulted_loans = EXCLUDED.defaulted_loans,
    loan_default_rate = EXCLUDED.loan_default_rate,
    total_contributions = EXCLUDED.total_contributions,
    on_time_contributions = EXCLUDED.on_time_contributions,
    contribution_consistency_rate = EXCLUDED.contribution_consistency_rate,
    health_score = EXCLUDED.health_score
  RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_chama_metrics IS 'Calculates chama metrics with ON CONFLICT handling to prevent duplicate key errors';
