-- Phase 16: Security & Compliance
-- Enhanced KYC, AML, Security Features, GDPR, Audit

BEGIN;

-- ============================================================================
-- ENHANCED KYC
-- ============================================================================

-- KYC documents table
CREATE TABLE IF NOT EXISTS kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL, -- 'id_front', 'id_back', 'selfie', 'address_proof', 'biometric_template'
  file_url TEXT NOT NULL,
  file_hash TEXT, -- SHA-256 hash for integrity verification
  mime_type VARCHAR(100),
  file_size BIGINT,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'verified', 'rejected', 'expired'
  verification_notes TEXT,
  verified_by_user_id UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB, -- Additional data (e.g., OCR results, face match score)
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kyc_documents_user ON kyc_documents(user_id);
CREATE INDEX idx_kyc_documents_type ON kyc_documents(document_type);
CREATE INDEX idx_kyc_documents_status ON kyc_documents(verification_status);

-- Biometric authentication data
CREATE TABLE IF NOT EXISTS biometric_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  biometric_type VARCHAR(20) NOT NULL, -- 'fingerprint', 'face_id', 'voice'
  template_hash TEXT NOT NULL, -- Hash of biometric template (never store raw biometrics)
  device_id TEXT, -- Device that registered the biometric
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_biometric_data_user ON biometric_data(user_id);
CREATE INDEX idx_biometric_data_active ON biometric_data(user_id, is_active) WHERE is_active = TRUE;

-- Address verification
CREATE TABLE IF NOT EXISTS address_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  county TEXT,
  postal_code TEXT,
  country TEXT NOT NULL DEFAULT 'Kenya',
  verification_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
  verification_method VARCHAR(50), -- 'document', 'geolocation', 'manual'
  verified_by_user_id UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  geolocation JSONB, -- lat/lng coordinates
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_address_verifications_user ON address_verifications(user_id);
CREATE INDEX idx_address_verifications_status ON address_verifications(verification_status);

-- Add KYC fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'submitted', 'under_review', 'verified', 'rejected', 'expired'
ADD COLUMN IF NOT EXISTS kyc_level INTEGER DEFAULT 0, -- 0 = basic, 1 = standard, 2 = enhanced
ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS kyc_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS transaction_pin_hash TEXT, -- 6-digit PIN for withdrawals
ADD COLUMN IF NOT EXISTS transaction_pin_set_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS biometric_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS address_verified BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- AML COMPLIANCE
-- ============================================================================

-- Transaction monitoring alerts
CREATE TABLE IF NOT EXISTS aml_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  chama_id UUID REFERENCES chamas(id) ON DELETE SET NULL,
  transaction_id UUID,
  alert_type VARCHAR(50) NOT NULL, -- 'large_transaction', 'suspicious_pattern', 'watchlist_match', 'velocity_check'
  severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  description TEXT NOT NULL,
  risk_score INTEGER DEFAULT 0, -- 0-100
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'investigating', 'resolved', 'false_positive'
  assigned_to_user_id UUID REFERENCES users(id),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  metadata JSONB, -- Additional context (transaction amounts, patterns, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_aml_alerts_user ON aml_alerts(user_id);
CREATE INDEX idx_aml_alerts_status ON aml_alerts(status);
CREATE INDEX idx_aml_alerts_severity ON aml_alerts(severity);
CREATE INDEX idx_aml_alerts_created ON aml_alerts(created_at);

-- Watchlist screening
CREATE TABLE IF NOT EXISTS watchlist_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_type VARCHAR(50) NOT NULL, -- 'sanctions', 'pep', 'adverse_media', 'custom'
  list_name VARCHAR(100),
  match_found BOOLEAN NOT NULL DEFAULT FALSE,
  match_details JSONB, -- Details of the match if found
  checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_watchlist_checks_user ON watchlist_checks(user_id);
CREATE INDEX idx_watchlist_checks_match ON watchlist_checks(match_found) WHERE match_found = TRUE;

-- Regulatory reports
CREATE TABLE IF NOT EXISTS regulatory_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type VARCHAR(50) NOT NULL, -- 'suspicious_activity', 'large_cash', 'cbk_monthly', 'custom'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  generated_by_user_id UUID NOT NULL REFERENCES users(id),
  file_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'submitted', 'approved'
  submitted_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_regulatory_reports_type ON regulatory_reports(report_type);
CREATE INDEX idx_regulatory_reports_period ON regulatory_reports(period_start, period_end);

-- ============================================================================
-- SECURITY FEATURES
-- ============================================================================

-- Device fingerprinting and sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL, -- Unique device identifier
  device_fingerprint TEXT NOT NULL, -- Browser/device fingerprint hash
  device_name TEXT, -- User-friendly device name
  device_type VARCHAR(50), -- 'mobile', 'tablet', 'desktop', 'unknown'
  ip_address VARCHAR(45),
  user_agent TEXT,
  location JSONB, -- Geolocation data
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_user_sessions_device ON user_sessions(device_id);

-- IP whitelisting for admins
CREATE TABLE IF NOT EXISTS admin_ip_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address VARCHAR(45) NOT NULL,
  ip_range CIDR, -- For CIDR notation (e.g., 192.168.1.0/24)
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_ip_whitelist_admin ON admin_ip_whitelist(admin_user_id);
CREATE INDEX idx_admin_ip_whitelist_active ON admin_ip_whitelist(admin_user_id, is_active) WHERE is_active = TRUE;

-- Withdrawal limits
CREATE TABLE IF NOT EXISTS withdrawal_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  limit_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
  amount_limit DECIMAL(15, 2) NOT NULL,
  current_period_amount DECIMAL(15, 2) DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_withdrawal_limits_user ON withdrawal_limits(user_id);
CREATE INDEX idx_withdrawal_limits_period ON withdrawal_limits(user_id, period_start, period_end);

-- ============================================================================
-- GDPR & DATA PROTECTION
-- ============================================================================

-- Data export requests (GDPR right to data portability)
CREATE TABLE IF NOT EXISTS data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL DEFAULT 'full', -- 'full', 'partial', 'specific_fields'
  fields_requested TEXT[], -- Array of field names if partial
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  file_url TEXT, -- URL to exported data file (encrypted)
  expires_at TIMESTAMPTZ, -- Export files expire after 30 days
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_data_export_requests_user ON data_export_requests(user_id);
CREATE INDEX idx_data_export_requests_status ON data_export_requests(status);

-- Data deletion requests (GDPR right to be forgotten)
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
  approved_by_user_id UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  deletion_scheduled_at TIMESTAMPTZ,
  deletion_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_data_deletion_requests_user ON data_deletion_requests(user_id);
CREATE INDEX idx_data_deletion_requests_status ON data_deletion_requests(status);

-- Access logs (who accessed what data)
CREATE TABLE IF NOT EXISTS data_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accessed_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_chama_id UUID REFERENCES chamas(id) ON DELETE SET NULL,
  access_type VARCHAR(50) NOT NULL, -- 'view_profile', 'view_transactions', 'export_data', 'admin_action'
  resource_type VARCHAR(50), -- 'user', 'chama', 'transaction', 'document'
  resource_id UUID,
  ip_address VARCHAR(45),
  user_agent TEXT,
  access_granted BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_data_access_logs_accessed_by ON data_access_logs(accessed_by_user_id);
CREATE INDEX idx_data_access_logs_target ON data_access_logs(target_user_id);
CREATE INDEX idx_data_access_logs_created ON data_access_logs(created_at);

-- Data retention policies
CREATE TABLE IF NOT EXISTS data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_type VARCHAR(50) NOT NULL, -- 'user_data', 'transaction_data', 'logs', 'documents'
  retention_period_days INTEGER NOT NULL,
  auto_delete BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ENHANCED AUDIT TRAILS
-- ============================================================================

-- Enhanced audit log (extends existing audit_log table)
-- Add new columns to existing audit_log if they don't exist
DO $$ 
BEGIN
  -- Add chama_id if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'audit_log' AND column_name = 'chama_id') THEN
    ALTER TABLE audit_log ADD COLUMN chama_id UUID REFERENCES chamas(id) ON DELETE SET NULL;
  END IF;
  
  -- Add action if not exists (for enhanced audit trail)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'audit_log' AND column_name = 'action') THEN
    ALTER TABLE audit_log ADD COLUMN action VARCHAR(100);
  END IF;
  
  -- Add entity_type if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'audit_log' AND column_name = 'entity_type') THEN
    ALTER TABLE audit_log ADD COLUMN entity_type VARCHAR(50);
  END IF;
  
  -- Add entity_id if not exists (replaces record_id for consistency)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'audit_log' AND column_name = 'entity_id') THEN
    ALTER TABLE audit_log ADD COLUMN entity_id UUID;
  END IF;
  
  -- Add details JSONB if not exists (replaces old_data/new_data for enhanced audit)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'audit_log' AND column_name = 'details') THEN
    ALTER TABLE audit_log ADD COLUMN details JSONB;
  END IF;
  
  -- Add device fingerprint if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'audit_log' AND column_name = 'device_fingerprint') THEN
    ALTER TABLE audit_log ADD COLUMN device_fingerprint TEXT;
  END IF;
  
  -- Add session_id if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'audit_log' AND column_name = 'session_id') THEN
    ALTER TABLE audit_log ADD COLUMN session_id UUID REFERENCES user_sessions(id);
  END IF;
  
  -- Add compliance flags if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'audit_log' AND column_name = 'compliance_required') THEN
    ALTER TABLE audit_log ADD COLUMN compliance_required BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_audit_log_chama ON audit_log(chama_id) WHERE chama_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action) WHERE action IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id) WHERE entity_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_compliance ON audit_log(compliance_required) WHERE compliance_required = TRUE;

-- CBK compliance documentation
CREATE TABLE IF NOT EXISTS cbk_compliance_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type VARCHAR(50) NOT NULL, -- 'license', 'report', 'notification', 'correspondence'
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  submission_date DATE,
  expiry_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'expired', 'renewed'
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cbk_compliance_docs_type ON cbk_compliance_docs(doc_type);
CREATE INDEX idx_cbk_compliance_docs_status ON cbk_compliance_docs(status);

COMMIT;

