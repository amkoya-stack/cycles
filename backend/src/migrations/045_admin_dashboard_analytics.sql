-- Migration: Admin Dashboard & Analytics Module
-- Phase 15: Admin Dashboard & Analytics

-- ============================================================================
-- ANALYTICS TABLES
-- ============================================================================

-- Dashboard metrics cache table
CREATE TABLE IF NOT EXISTS dashboard_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type VARCHAR(50) NOT NULL, -- 'user', 'chama', 'platform', 'transaction'
  metric_name VARCHAR(100) NOT NULL,
  metric_value JSONB NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB,
  UNIQUE(metric_type, metric_name, period_start, period_end)
);

CREATE INDEX idx_dashboard_metrics_type ON dashboard_metrics(metric_type);
CREATE INDEX idx_dashboard_metrics_name ON dashboard_metrics(metric_name);
CREATE INDEX idx_dashboard_metrics_period ON dashboard_metrics(period_start, period_end);
CREATE INDEX idx_dashboard_metrics_calculated ON dashboard_metrics(calculated_at);

-- Analytics events table (for tracking user behavior)
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL, -- 'page_view', 'action', 'transaction', 'error'
  event_name VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  chama_id UUID REFERENCES chamas(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  properties JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_chama ON analytics_events(chama_id);
CREATE INDEX idx_analytics_events_created ON analytics_events(created_at);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type VARCHAR(50) NOT NULL, -- 'user', 'chama', 'platform', 'transaction', 'financial'
  report_name VARCHAR(200) NOT NULL,
  generated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  parameters JSONB, -- Store query parameters used to generate report
  file_url VARCHAR(500), -- URL to generated report file (PDF, Excel)
  file_format VARCHAR(10), -- 'pdf', 'excel', 'csv'
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'generating', 'completed', 'failed'
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  expires_at TIMESTAMP -- For auto-cleanup of old reports
);

CREATE INDEX idx_reports_type ON reports(report_type);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_generated_by ON reports(generated_by_user_id);
CREATE INDEX idx_reports_created ON reports(created_at);
CREATE INDEX idx_reports_expires ON reports(expires_at);

-- ============================================================================
-- ADMIN MANAGEMENT TABLES
-- ============================================================================

-- Admin actions log (audit trail)
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 'user_suspend', 'user_verify', 'chama_feature', 'chama_suspend', 'dispute_resolve', etc.
  target_type VARCHAR(50) NOT NULL, -- 'user', 'chama', 'transaction', 'dispute'
  target_id UUID NOT NULL,
  action_details JSONB,
  reason TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_actions_admin ON admin_actions(admin_user_id);
CREATE INDEX idx_admin_actions_type ON admin_actions(action_type);
CREATE INDEX idx_admin_actions_target ON admin_actions(target_type, target_id);
CREATE INDEX idx_admin_actions_created ON admin_actions(created_at);

-- Fraud detection alerts
CREATE TABLE IF NOT EXISTS fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(50) NOT NULL, -- 'suspicious_transaction', 'unusual_activity', 'multiple_accounts', 'chargeback', etc.
  severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  chama_id UUID REFERENCES chamas(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  evidence JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'investigating', 'resolved', 'false_positive', 'dismissed'
  resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE INDEX idx_fraud_alerts_type ON fraud_alerts(alert_type);
CREATE INDEX idx_fraud_alerts_severity ON fraud_alerts(severity);
CREATE INDEX idx_fraud_alerts_status ON fraud_alerts(status);
CREATE INDEX idx_fraud_alerts_user ON fraud_alerts(user_id);
CREATE INDEX idx_fraud_alerts_chama ON fraud_alerts(chama_id);
CREATE INDEX idx_fraud_alerts_created ON fraud_alerts(created_at);

-- Content moderation queue
CREATE TABLE IF NOT EXISTS content_moderation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(50) NOT NULL, -- 'chama_name', 'chama_description', 'post', 'comment', 'document'
  content_id UUID NOT NULL,
  reported_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason VARCHAR(100),
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'reviewing', 'approved', 'rejected', 'removed'
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  review_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP
);

CREATE INDEX idx_content_moderation_type ON content_moderation(content_type);
CREATE INDEX idx_content_moderation_status ON content_moderation(status);
CREATE INDEX idx_content_moderation_reported_by ON content_moderation(reported_by_user_id);
CREATE INDEX idx_content_moderation_created ON content_moderation(created_at);

-- ============================================================================
-- USER DASHBOARD METRICS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW user_dashboard_metrics AS
SELECT 
  u.id as user_id,
  COUNT(DISTINCT cm.chama_id) as chamas_joined,
  COUNT(DISTINCT CASE WHEN cm.role IN ('admin', 'treasurer') THEN cm.chama_id END) as chamas_admin,
  COUNT(DISTINCT CASE WHEN ft.status = 'completed' AND tc.code = 'CONTRIBUTION' THEN ft.id END) as contribution_count,
  COUNT(DISTINCT l.id) as total_loans,
  COUNT(DISTINCT CASE WHEN l.status = 'active' THEN l.id END) as active_loans,
  COUNT(DISTINCT CASE WHEN l.status = 'repaid' THEN l.id END) as repaid_loans,
  COUNT(DISTINCT CASE WHEN l.status = 'defaulted' THEN l.id END) as defaulted_loans,
  u.created_at as user_joined_at
FROM users u
LEFT JOIN chama_members cm ON u.id = cm.user_id AND cm.status = 'active'
LEFT JOIN transactions ft ON u.id = ft.initiated_by
LEFT JOIN transaction_codes tc ON ft.transaction_code_id = tc.id
LEFT JOIN loans l ON u.id = l.borrower_id
GROUP BY u.id, u.created_at;

-- ============================================================================
-- CHAMA DASHBOARD METRICS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW chama_dashboard_metrics AS
SELECT 
  c.id as chama_id,
  c.name as chama_name,
  COUNT(DISTINCT cm.user_id) FILTER (WHERE cm.status = 'active') as active_members,
  COUNT(DISTINCT cm.user_id) FILTER (WHERE cm.status = 'pending') as pending_members,
  COUNT(DISTINCT l.id) as total_loans_issued,
  COUNT(DISTINCT CASE WHEN l.status = 'active' THEN l.id END) as active_loans,
  COUNT(DISTINCT CASE WHEN l.status = 'repaid' THEN l.id END) as repaid_loans,
  COUNT(DISTINCT CASE WHEN l.status = 'defaulted' THEN l.id END) as defaulted_loans,
  c.created_at as chama_created_at,
  COUNT(DISTINCT d.id) FILTER (WHERE d.status IN ('filed', 'under_review', 'discussion', 'voting')) as active_disputes,
  COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'resolved') as resolved_disputes
FROM chamas c
LEFT JOIN chama_members cm ON c.id = cm.chama_id
LEFT JOIN loans l ON c.id = l.chama_id
LEFT JOIN disputes d ON c.id = d.chama_id
GROUP BY c.id, c.name, c.created_at;

-- ============================================================================
-- PLATFORM DASHBOARD METRICS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW platform_dashboard_metrics AS
SELECT 
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_users_30d,
  (SELECT COUNT(*) FROM chamas) as total_chamas,
  (SELECT COUNT(*) FROM chamas WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_chamas_30d,
  (SELECT COUNT(*) FROM transactions WHERE status = 'completed') as total_transactions,
  (SELECT COUNT(*) FROM transactions WHERE status = 'completed' AND created_at >= CURRENT_DATE) as transactions_today,
  (SELECT COUNT(*) FROM transactions WHERE status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '30 days') as transactions_30d,
  (SELECT COALESCE(SUM(amount), 0) FROM transactions t 
   JOIN transaction_codes tc ON t.transaction_code_id = tc.id 
   WHERE t.status = 'completed' AND tc.code = 'DEPOSIT') as total_deposits,
  (SELECT COALESCE(SUM(amount), 0) FROM transactions t 
   JOIN transaction_codes tc ON t.transaction_code_id = tc.id 
   WHERE t.status = 'completed' AND tc.code = 'DEPOSIT' AND t.created_at >= CURRENT_DATE - INTERVAL '30 days') as deposits_30d,
  (SELECT COALESCE(SUM(amount), 0) FROM transactions t 
   JOIN transaction_codes tc ON t.transaction_code_id = tc.id 
   WHERE t.status = 'completed' AND tc.code = 'CONTRIBUTION') as total_contributions,
  (SELECT COUNT(*) FROM loans WHERE status = 'active') as active_loans,
  0 as active_loans_amount, -- TODO: Fix loans table schema reference
  (SELECT COUNT(*) FROM loans WHERE status = 'repaid') as repaid_loans,
  (SELECT COUNT(*) FROM loans WHERE status = 'defaulted') as defaulted_loans,
  (SELECT COUNT(*) FROM disputes WHERE status IN ('filed', 'under_review', 'discussion', 'voting')) as active_disputes,
  (SELECT COUNT(*) FROM fraud_alerts WHERE status = 'open') as open_fraud_alerts;

-- ============================================================================
-- TRIGGERS FOR AUTO-UPDATES
-- ============================================================================

-- Function to update dashboard metrics cache (can be called by cron job)
CREATE OR REPLACE FUNCTION refresh_dashboard_metrics()
RETURNS void AS $$
BEGIN
  -- This function can be called periodically to refresh cached metrics
  -- For now, we'll use views which are always up-to-date
  -- In production, you might want to materialize these views
  NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE dashboard_metrics IS 'Cached dashboard metrics for performance';
COMMENT ON TABLE analytics_events IS 'User behavior and event tracking';
COMMENT ON TABLE reports IS 'Generated reports (PDF, Excel, CSV)';
COMMENT ON TABLE admin_actions IS 'Audit trail of all admin actions';
COMMENT ON TABLE fraud_alerts IS 'Fraud detection and security alerts';
COMMENT ON TABLE content_moderation IS 'Content moderation queue for user-generated content';

COMMENT ON VIEW user_dashboard_metrics IS 'Pre-calculated metrics for user dashboard';
COMMENT ON VIEW chama_dashboard_metrics IS 'Pre-calculated metrics for chama dashboard';
COMMENT ON VIEW platform_dashboard_metrics IS 'Pre-calculated metrics for platform admin dashboard';

