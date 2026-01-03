-- ============================================================================
-- Migration: External Investment Integrations
-- Description: Tables for external investment partner APIs, NAV updates, and statement reconciliation
-- ============================================================================

BEGIN;

-- ============================================================================
-- External Investment Partners Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS external_investment_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Partner Details
  name VARCHAR(255) NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('bank', 'investment_platform', 'asset_manager', 'central_bank', 'other')),
  description TEXT,
  
  -- API Configuration
  api_base_url TEXT NOT NULL,
  api_key TEXT, -- Encrypted in production
  api_secret TEXT, -- Encrypted in production
  auth_type TEXT DEFAULT 'api_key' CHECK (auth_type IN ('api_key', 'oauth2', 'basic_auth', 'bearer_token')),
  auth_config JSONB DEFAULT '{}'::jsonb, -- OAuth2 tokens, refresh tokens, etc.
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  
  -- Rate Limiting
  rate_limit_per_minute INTEGER DEFAULT 60,
  last_api_call_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_partners_type ON external_investment_partners(provider_type);
CREATE INDEX IF NOT EXISTS idx_external_partners_active ON external_investment_partners(is_active);

-- ============================================================================
-- NAV (Net Asset Value) Updates Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS nav_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES investment_products(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES external_investment_partners(id) ON DELETE SET NULL,
  
  -- NAV Data
  nav_value DECIMAL(15,4) NOT NULL, -- NAV per unit/share
  nav_date DATE NOT NULL,
  total_units DECIMAL(15,2), -- Total units outstanding
  total_assets DECIMAL(15,2), -- Total assets under management
  
  -- Update Source
  update_source TEXT DEFAULT 'api' CHECK (update_source IN ('api', 'manual', 'reconciliation')),
  external_reference TEXT, -- Reference from external system
  
  -- Validation
  is_validated BOOLEAN DEFAULT false,
  validation_notes TEXT,
  
  -- Metadata
  raw_data JSONB, -- Raw response from API
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(product_id, nav_date)
);

CREATE INDEX IF NOT EXISTS idx_nav_updates_product ON nav_updates(product_id);
CREATE INDEX IF NOT EXISTS idx_nav_updates_date ON nav_updates(nav_date);
CREATE INDEX IF NOT EXISTS idx_nav_updates_partner ON nav_updates(partner_id);

-- ============================================================================
-- External Investment Statements Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS external_investment_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES external_investment_partners(id) ON DELETE CASCADE,
  
  -- Statement Details
  statement_period_start DATE NOT NULL,
  statement_period_end DATE NOT NULL,
  statement_date DATE NOT NULL,
  
  -- Financial Data
  opening_balance DECIMAL(15,2) NOT NULL,
  closing_balance DECIMAL(15,2) NOT NULL,
  interest_earned DECIMAL(15,2) DEFAULT 0,
  fees_charged DECIMAL(15,2) DEFAULT 0,
  transactions_count INTEGER DEFAULT 0,
  
  -- External Reference
  external_statement_id TEXT, -- ID from external system
  external_statement_url TEXT, -- Link to statement document
  statement_document_url TEXT, -- Our stored copy
  
  -- Reconciliation Status
  reconciliation_status TEXT DEFAULT 'pending' CHECK (reconciliation_status IN ('pending', 'matched', 'discrepancy', 'resolved')),
  reconciliation_notes TEXT,
  reconciled_by UUID REFERENCES users(id),
  reconciled_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  raw_statement_data JSONB, -- Raw statement data from API
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_statements_investment ON external_investment_statements(investment_id);
CREATE INDEX IF NOT EXISTS idx_external_statements_partner ON external_investment_statements(partner_id);
CREATE INDEX IF NOT EXISTS idx_external_statements_period ON external_investment_statements(statement_period_start, statement_period_end);
CREATE INDEX IF NOT EXISTS idx_external_statements_reconciliation ON external_investment_statements(reconciliation_status);

-- ============================================================================
-- Statement Reconciliation Discrepancies Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS statement_reconciliation_discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL REFERENCES external_investment_statements(id) ON DELETE CASCADE,
  investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  
  -- Discrepancy Details
  discrepancy_type TEXT NOT NULL CHECK (discrepancy_type IN ('balance_mismatch', 'missing_transaction', 'extra_transaction', 'amount_mismatch', 'fee_discrepancy', 'interest_discrepancy')),
  expected_value DECIMAL(15,2),
  actual_value DECIMAL(15,2),
  difference DECIMAL(15,2),
  
  -- Description
  description TEXT NOT NULL,
  affected_period_start DATE,
  affected_period_end DATE,
  
  -- Resolution
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'ignored')),
  resolution_notes TEXT,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_discrepancies_statement ON statement_reconciliation_discrepancies(statement_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_discrepancies_investment ON statement_reconciliation_discrepancies(investment_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_discrepancies_status ON statement_reconciliation_discrepancies(status);

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_external_investment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_external_partners_updated_at
  BEFORE UPDATE ON external_investment_partners
  FOR EACH ROW
  EXECUTE FUNCTION update_external_investment_updated_at();

CREATE TRIGGER update_nav_updates_updated_at
  BEFORE UPDATE ON nav_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_external_investment_updated_at();

CREATE TRIGGER update_external_statements_updated_at
  BEFORE UPDATE ON external_investment_statements
  FOR EACH ROW
  EXECUTE FUNCTION update_external_investment_updated_at();

CREATE TRIGGER update_reconciliation_discrepancies_updated_at
  BEFORE UPDATE ON statement_reconciliation_discrepancies
  FOR EACH ROW
  EXECUTE FUNCTION update_external_investment_updated_at();

COMMIT;

