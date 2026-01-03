-- ============================================================================
-- Migration: Investment Module
-- Description: Creates tables for investment products, investments, shares, dividends, and pools
-- ============================================================================

BEGIN;

-- ============================================================================
-- Investment Product Types
-- ============================================================================
DROP TYPE IF EXISTS investment_product_type CASCADE;
CREATE TYPE investment_product_type AS ENUM (
  'treasury_bill_91',      -- 91-day Treasury Bill
  'treasury_bill_182',     -- 182-day Treasury Bill
  'treasury_bill_364',     -- 364-day Treasury Bill
  'money_market_fund',     -- Money Market Fund
  'government_bond',       -- Government Bond
  'fixed_deposit',         -- Fixed Deposit
  'investment_pool'        -- Chama Investment Pool (pooled funds)
);

DROP TYPE IF EXISTS investment_status CASCADE;
CREATE TYPE investment_status AS ENUM (
  'pending_approval',       -- Proposal created, awaiting vote
  'approved',              -- Vote passed, ready to invest
  'active',                -- Investment is active
  'matured',               -- Investment has matured
  'cancelled',             -- Investment was cancelled
  'liquidated'             -- Investment was liquidated early
);

DROP TYPE IF EXISTS dividend_status CASCADE;
CREATE TYPE dividend_status AS ENUM (
  'pending',               -- Dividend calculated but not distributed
  'distributed',           -- Dividend distributed to members
  'reinvested'             -- Dividend reinvested
);

-- ============================================================================
-- Investment Products Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS investment_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Product Details
  product_type investment_product_type NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Financial Details
  minimum_investment DECIMAL(15,2) NOT NULL DEFAULT 0,
  maximum_investment DECIMAL(15,2), -- NULL = no limit
  interest_rate DECIMAL(5,2) NOT NULL, -- Annual interest rate in percentage
  risk_rating INTEGER CHECK (risk_rating >= 1 AND risk_rating <= 5), -- 1=lowest, 5=highest
  
  -- Maturity Details
  maturity_days INTEGER NOT NULL, -- Days until maturity
  compounding_frequency TEXT, -- 'monthly', 'quarterly', 'annually', 'at_maturity'
  
  -- Product Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  -- External Integration (for future API integrations)
  external_product_id TEXT, -- ID from external platform
  external_provider TEXT, -- 'central_bank', 'bank_name', 'platform_name'
  nav_update_url TEXT, -- URL for NAV updates (for funds)
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investment_products_type ON investment_products(product_type);
CREATE INDEX IF NOT EXISTS idx_investment_products_active ON investment_products(is_active);
CREATE INDEX IF NOT EXISTS idx_investment_products_featured ON investment_products(is_featured);

-- ============================================================================
-- Investment Pools Table (for pooled investments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS investment_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES investment_products(id) ON DELETE CASCADE,
  
  -- Pool Details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  target_amount DECIMAL(15,2) NOT NULL, -- Target amount to pool
  current_amount DECIMAL(15,2) DEFAULT 0, -- Current amount pooled
  minimum_contribution DECIMAL(15,2) NOT NULL, -- Minimum per participant
  
  -- Pool Status
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'invested', 'matured')),
  closing_date TIMESTAMP WITH TIME ZONE, -- When pool closes for new contributions
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investment_pools_product ON investment_pools(product_id);
CREATE INDEX IF NOT EXISTS idx_investment_pools_status ON investment_pools(status);

-- ============================================================================
-- Investments Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES investment_products(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES investment_pools(id) ON DELETE SET NULL, -- NULL if not pooled
  
  -- Proposal/Voting Link
  proposal_id UUID REFERENCES proposals(id) ON DELETE SET NULL, -- Link to governance proposal
  
  -- Investment Details
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  interest_rate DECIMAL(5,2) NOT NULL, -- Locked rate at time of investment
  expected_return DECIMAL(15,2), -- Calculated expected return
  
  -- Dates
  investment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  maturity_date TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_maturity_date TIMESTAMP WITH TIME ZONE, -- Actual date when matured
  
  -- Status
  status investment_status NOT NULL DEFAULT 'pending_approval',
  
  -- Returns
  principal_returned DECIMAL(15,2) DEFAULT 0,
  interest_earned DECIMAL(15,2) DEFAULT 0,
  total_return DECIMAL(15,2) DEFAULT 0,
  
  -- External Integration
  external_investment_id TEXT, -- ID from external platform
  external_statement_url TEXT, -- Link to external statement
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investments_chama ON investments(chama_id);
CREATE INDEX IF NOT EXISTS idx_investments_product ON investments(product_id);
CREATE INDEX IF NOT EXISTS idx_investments_pool ON investments(pool_id);
CREATE INDEX IF NOT EXISTS idx_investments_proposal ON investments(proposal_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);
CREATE INDEX IF NOT EXISTS idx_investments_maturity ON investments(maturity_date);
CREATE INDEX IF NOT EXISTS idx_investments_dates ON investments(investment_date, maturity_date);

-- ============================================================================
-- Investment Shares Table (for proportional ownership in pools)
-- ============================================================================
CREATE TABLE IF NOT EXISTS investment_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL if chama-only investment
  
  -- Share Details
  amount_invested DECIMAL(15,2) NOT NULL CHECK (amount_invested > 0),
  ownership_percentage DECIMAL(5,2) NOT NULL, -- Percentage of total investment
  principal_share DECIMAL(15,2) DEFAULT 0, -- Share of principal returned
  interest_share DECIMAL(15,2) DEFAULT 0, -- Share of interest earned
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investment_shares_investment ON investment_shares(investment_id);
CREATE INDEX IF NOT EXISTS idx_investment_shares_chama ON investment_shares(chama_id);
CREATE INDEX IF NOT EXISTS idx_investment_shares_user ON investment_shares(user_id);

-- ============================================================================
-- Dividends Table (interest/dividend payments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS dividends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  share_id UUID REFERENCES investment_shares(id) ON DELETE SET NULL, -- NULL if chama-level dividend
  
  -- Dividend Details
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE, -- Start of period this dividend covers
  period_end TIMESTAMP WITH TIME ZONE, -- End of period this dividend covers
  
  -- Distribution
  recipient_chama_id UUID REFERENCES chamas(id) ON DELETE SET NULL,
  recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Status
  status dividend_status NOT NULL DEFAULT 'pending',
  
  -- Distribution Details
  distributed_to_wallet BOOLEAN DEFAULT false,
  wallet_transaction_id UUID, -- Link to wallet transaction if distributed
  reinvested_investment_id UUID REFERENCES investments(id) ON DELETE SET NULL, -- If reinvested
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dividends_investment ON dividends(investment_id);
CREATE INDEX IF NOT EXISTS idx_dividends_share ON dividends(share_id);
CREATE INDEX IF NOT EXISTS idx_dividends_status ON dividends(status);
CREATE INDEX IF NOT EXISTS idx_dividends_payment_date ON dividends(payment_date);
CREATE INDEX IF NOT EXISTS idx_dividends_recipient ON dividends(recipient_chama_id, recipient_user_id);

-- ============================================================================
-- Pool Contributions Table (for tracking who contributed to a pool)
-- ============================================================================
CREATE TABLE IF NOT EXISTS pool_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES investment_pools(id) ON DELETE CASCADE,
  chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL if chama-only
  
  -- Contribution Details
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  contribution_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Wallet Transaction Link
  wallet_transaction_id UUID, -- Link to wallet transaction
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pool_contributions_pool ON pool_contributions(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_contributions_chama ON pool_contributions(chama_id);
CREATE INDEX IF NOT EXISTS idx_pool_contributions_user ON pool_contributions(user_id);

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_investment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_investment_products_updated_at
  BEFORE UPDATE ON investment_products
  FOR EACH ROW
  EXECUTE FUNCTION update_investment_updated_at();

CREATE TRIGGER update_investment_pools_updated_at
  BEFORE UPDATE ON investment_pools
  FOR EACH ROW
  EXECUTE FUNCTION update_investment_updated_at();

CREATE TRIGGER update_investments_updated_at
  BEFORE UPDATE ON investments
  FOR EACH ROW
  EXECUTE FUNCTION update_investment_updated_at();

CREATE TRIGGER update_investment_shares_updated_at
  BEFORE UPDATE ON investment_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_investment_updated_at();

CREATE TRIGGER update_dividends_updated_at
  BEFORE UPDATE ON dividends
  FOR EACH ROW
  EXECUTE FUNCTION update_investment_updated_at();

-- Function to calculate expected return
CREATE OR REPLACE FUNCTION calculate_expected_return(
  p_amount DECIMAL,
  p_interest_rate DECIMAL,
  p_maturity_days INTEGER,
  p_compounding_frequency TEXT DEFAULT 'at_maturity'
)
RETURNS DECIMAL AS $$
DECLARE
  v_years DECIMAL;
  v_return DECIMAL;
BEGIN
  v_years := p_maturity_days / 365.0;
  
  CASE p_compounding_frequency
    WHEN 'monthly' THEN
      v_return := p_amount * POWER(1 + (p_interest_rate / 100 / 12), v_years * 12) - p_amount;
    WHEN 'quarterly' THEN
      v_return := p_amount * POWER(1 + (p_interest_rate / 100 / 4), v_years * 4) - p_amount;
    WHEN 'annually' THEN
      v_return := p_amount * POWER(1 + (p_interest_rate / 100), v_years) - p_amount;
    ELSE -- 'at_maturity'
      v_return := p_amount * (p_interest_rate / 100) * v_years;
  END CASE;
  
  RETURN ROUND(v_return, 2);
END;
$$ LANGUAGE plpgsql;

COMMIT;

