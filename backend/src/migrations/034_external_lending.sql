-- ============================================================================
-- Migration: 034_external_lending.sql
-- Description: Create tables for Chama → Non-Members lending (Phase 12B)
-- Features: Loan marketplace, escrow, risk sharing
-- ============================================================================

-- ============================================================================
-- EXTERNAL LOAN LISTINGS TABLE
-- Chamas can list loans they're offering to non-members
-- ============================================================================
CREATE TABLE IF NOT EXISTS external_loan_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    
    -- Listing details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    min_amount DECIMAL(15, 2) NOT NULL,
    max_amount DECIMAL(15, 2) NOT NULL,
    interest_rate_min DECIMAL(5, 2) NOT NULL,
    interest_rate_max DECIMAL(5, 2) NOT NULL,
    min_repayment_period_months INTEGER NOT NULL,
    max_repayment_period_months INTEGER NOT NULL,
    
    -- Eligibility requirements
    min_borrower_reputation_tier VARCHAR(20),  -- 'bronze', 'silver', 'gold', etc.
    requires_employment_verification BOOLEAN DEFAULT FALSE,
    requires_income_proof BOOLEAN DEFAULT FALSE,
    min_monthly_income DECIMAL(15, 2),
    
    -- Risk sharing
    allows_risk_sharing BOOLEAN DEFAULT FALSE,  -- Can other chamas co-fund?
    max_co_funders INTEGER DEFAULT 0,           -- 0 = unlimited
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN (
        'draft',      -- Not yet published
        'active',     -- Accepting applications
        'paused',     -- Temporarily not accepting
        'closed',     -- No longer accepting
        'archived'    -- Archived listing
    )),
    
    -- Statistics
    total_applications INTEGER DEFAULT 0,
    total_approved INTEGER DEFAULT 0,
    total_funded DECIMAL(15, 2) DEFAULT 0,
    average_interest_rate DECIMAL(5, 2),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for external_loan_listings
CREATE INDEX IF NOT EXISTS idx_external_listings_chama ON external_loan_listings(chama_id);
CREATE INDEX IF NOT EXISTS idx_external_listings_status ON external_loan_listings(status);
CREATE INDEX IF NOT EXISTS idx_external_listings_amount_range ON external_loan_listings(min_amount, max_amount);
CREATE INDEX IF NOT EXISTS idx_external_listings_interest_rate ON external_loan_listings(interest_rate_min, interest_rate_max);
CREATE INDEX IF NOT EXISTS idx_external_listings_created ON external_loan_listings(created_at DESC);

-- ============================================================================
-- EXTERNAL LOAN APPLICATIONS TABLE
-- Non-members applying for loans from chamas
-- ============================================================================
CREATE TABLE IF NOT EXISTS external_loan_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES external_loan_listings(id) ON DELETE CASCADE,
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    borrower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Application details
    amount_requested DECIMAL(15, 2) NOT NULL,
    purpose TEXT NOT NULL,
    proposed_interest_rate DECIMAL(5, 2),  -- Borrower's proposed rate (within listing range)
    proposed_repayment_period_months INTEGER NOT NULL,
    
    -- Borrower information (for non-members)
    employment_status VARCHAR(20),  -- 'employed', 'self_employed', 'unemployed', 'student'
    monthly_income DECIMAL(15, 2),
    employment_details JSONB,       -- Company, position, etc.
    income_proof_document_id UUID,   -- Link to uploaded document
    borrower_reputation_score INTEGER,  -- If they've borrowed before
    
    -- Status workflow
    status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN (
        'submitted',       -- Submitted for review
        'under_review',    -- Being reviewed by chama
        'pending_vote',    -- Requires chama voting
        'approved',        -- Approved by chama
        'terms_negotiated', -- Terms agreed, awaiting escrow
        'escrow_pending',   -- Funds in escrow, awaiting acceptance
        'escrow_released', -- Funds released to borrower
        'rejected',        -- Application rejected
        'withdrawn',       -- Withdrawn by borrower
        'expired'          -- Application expired
    )),
    
    -- Approval details
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    final_interest_rate DECIMAL(5, 2),
    final_repayment_period_months INTEGER,
    
    -- Rejection details
    rejected_by UUID REFERENCES users(id),
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Voting integration
    requires_vote BOOLEAN DEFAULT FALSE,
    vote_proposal_id UUID,
    
    -- Escrow
    escrow_account_id UUID,  -- Link to escrow account
    escrow_amount DECIMAL(15, 2),
    escrow_released_at TIMESTAMP WITH TIME ZONE,
    
    -- Risk sharing
    is_risk_shared BOOLEAN DEFAULT FALSE,
    primary_chama_id UUID REFERENCES chamas(id),  -- Original chama
    co_funder_chamas JSONB,  -- Array of {chama_id, amount, percentage}
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for external_loan_applications
CREATE INDEX IF NOT EXISTS idx_external_apps_listing ON external_loan_applications(listing_id);
CREATE INDEX IF NOT EXISTS idx_external_apps_chama ON external_loan_applications(chama_id);
CREATE INDEX IF NOT EXISTS idx_external_apps_borrower ON external_loan_applications(borrower_id);
CREATE INDEX IF NOT EXISTS idx_external_apps_status ON external_loan_applications(status);
CREATE INDEX IF NOT EXISTS idx_external_apps_escrow ON external_loan_applications(escrow_account_id);

-- ============================================================================
-- ESCROW ACCOUNTS TABLE
-- Hold funds until loan terms are accepted and released
-- ============================================================================
CREATE TABLE IF NOT EXISTS escrow_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_loan_application_id UUID NOT NULL REFERENCES external_loan_applications(id) ON DELETE CASCADE,
    
    -- Escrow details
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    
    -- Source (which chama(s) funded this)
    funded_by_chamas JSONB NOT NULL,  -- Array of {chama_id, amount, funded_at}
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',         -- Funds being collected
        'funded',          -- All funds collected, awaiting release
        'released',        -- Funds released to borrower
        'refunded',        -- Funds refunded to chamas (application rejected/withdrawn)
        'disputed'         -- Dispute raised
    )),
    
    -- Release details
    released_at TIMESTAMP WITH TIME ZONE,
    released_to_user_id UUID REFERENCES users(id),
    release_transaction_id UUID,  -- Link to ledger transaction
    
    -- Refund details
    refunded_at TIMESTAMP WITH TIME ZONE,
    refund_transaction_ids JSONB,  -- Array of transaction IDs for refunds
    
    -- Dispute details
    dispute_raised_at TIMESTAMP WITH TIME ZONE,
    dispute_raised_by UUID REFERENCES users(id),
    dispute_reason TEXT,
    dispute_resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for escrow_accounts
CREATE INDEX IF NOT EXISTS idx_escrow_application ON escrow_accounts(external_loan_application_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_accounts(status);

-- ============================================================================
-- RISK SHARING AGREEMENTS TABLE
-- Multiple chamas co-funding a single loan
-- ============================================================================
CREATE TABLE IF NOT EXISTS risk_sharing_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_loan_application_id UUID NOT NULL REFERENCES external_loan_applications(id) ON DELETE CASCADE,
    
    -- Agreement details
    total_loan_amount DECIMAL(15, 2) NOT NULL,
    primary_chama_id UUID NOT NULL REFERENCES chamas(id),
    primary_chama_amount DECIMAL(15, 2) NOT NULL,
    primary_chama_percentage DECIMAL(5, 2) NOT NULL,
    
    -- Co-funders
    co_funders JSONB NOT NULL,  -- Array of {chama_id, amount, percentage, agreed_at}
    
    -- Terms
    profit_sharing_method VARCHAR(20) DEFAULT 'proportional' CHECK (profit_sharing_method IN (
        'proportional',  -- Share profits/losses based on funding percentage
        'equal',        -- Equal share regardless of funding amount
        'tiered'        -- Tiered sharing (e.g., primary gets more)
    )),
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Agreement being negotiated
        'agreed',       -- All parties agreed
        'active',       -- Loan active, agreement in effect
        'completed',    -- Loan paid off, profits distributed
        'defaulted',    -- Loan defaulted, losses distributed
        'cancelled'     -- Agreement cancelled
    )),
    
    -- Voting
    requires_vote BOOLEAN DEFAULT TRUE,
    primary_chama_voted BOOLEAN DEFAULT FALSE,
    all_co_funders_voted BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for risk_sharing_agreements
CREATE INDEX IF NOT EXISTS idx_risk_sharing_application ON risk_sharing_agreements(external_loan_application_id);
CREATE INDEX IF NOT EXISTS idx_risk_sharing_primary ON risk_sharing_agreements(primary_chama_id);
CREATE INDEX IF NOT EXISTS idx_risk_sharing_status ON risk_sharing_agreements(status);

-- ============================================================================
-- ADD EXTERNAL LENDING SETTINGS TO CHAMAS TABLE
-- ============================================================================
DO $$
BEGIN
    -- Add external_lending_enabled column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chamas' AND column_name = 'external_lending_enabled') THEN
        ALTER TABLE chamas ADD COLUMN external_lending_enabled BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add external_lending_settings column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chamas' AND column_name = 'external_lending_settings') THEN
        ALTER TABLE chamas ADD COLUMN external_lending_settings JSONB DEFAULT '{
            "minListingAmount": 1000,
            "maxListingAmount": 500000,
            "defaultInterestRate": 12,
            "requiresVoteForAmountsAbove": 50000,
            "allowRiskSharing": true,
            "maxCoFunders": 5,
            "escrowRequired": true,
            "escrowHoldPeriodDays": 7
        }'::jsonb;
    END IF;
END $$;

-- ============================================================================
-- TRIGGERS FOR AUTO-UPDATE
-- ============================================================================

-- External loan listings updated_at trigger
CREATE OR REPLACE FUNCTION update_external_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_external_listings_updated_at ON external_loan_listings;
CREATE TRIGGER trigger_update_external_listings_updated_at
    BEFORE UPDATE ON external_loan_listings
    FOR EACH ROW
    EXECUTE FUNCTION update_external_listings_updated_at();

-- External loan applications updated_at trigger
CREATE OR REPLACE FUNCTION update_external_apps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_external_apps_updated_at ON external_loan_applications;
CREATE TRIGGER trigger_update_external_apps_updated_at
    BEFORE UPDATE ON external_loan_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_external_apps_updated_at();

-- Escrow accounts updated_at trigger
CREATE OR REPLACE FUNCTION update_escrow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_escrow_updated_at ON escrow_accounts;
CREATE TRIGGER trigger_update_escrow_updated_at
    BEFORE UPDATE ON escrow_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_escrow_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get marketplace listings with filters
CREATE OR REPLACE FUNCTION get_marketplace_listings(
    p_min_amount DECIMAL DEFAULT NULL,
    p_max_amount DECIMAL DEFAULT NULL,
    p_min_interest_rate DECIMAL DEFAULT NULL,
    p_max_interest_rate DECIMAL DEFAULT NULL,
    p_min_period_months INTEGER DEFAULT NULL,
    p_max_period_months INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    chama_id UUID,
    chama_name VARCHAR,
    title VARCHAR,
    description TEXT,
    min_amount DECIMAL,
    max_amount DECIMAL,
    interest_rate_min DECIMAL,
    interest_rate_max DECIMAL,
    min_repayment_period_months INTEGER,
    max_repayment_period_months INTEGER,
    allows_risk_sharing BOOLEAN,
    total_applications INTEGER,
    total_funded DECIMAL,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        el.id,
        el.chama_id,
        c.name as chama_name,
        el.title,
        el.description,
        el.min_amount,
        el.max_amount,
        el.interest_rate_min,
        el.interest_rate_max,
        el.min_repayment_period_months,
        el.max_repayment_period_months,
        el.allows_risk_sharing,
        el.total_applications,
        el.total_funded,
        el.created_at
    FROM external_loan_listings el
    JOIN chamas c ON el.chama_id = c.id
    WHERE el.status = 'active'
      AND (p_min_amount IS NULL OR el.max_amount >= p_min_amount)
      AND (p_max_amount IS NULL OR el.min_amount <= p_max_amount)
      AND (p_min_interest_rate IS NULL OR el.interest_rate_max >= p_min_interest_rate)
      AND (p_max_interest_rate IS NULL OR el.interest_rate_min <= p_max_interest_rate)
      AND (p_min_period_months IS NULL OR el.max_repayment_period_months >= p_min_period_months)
      AND (p_max_period_months IS NULL OR el.min_repayment_period_months <= p_max_period_months)
    ORDER BY el.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE external_loan_listings IS 'Chamas listing loans available to non-members';
COMMENT ON TABLE external_loan_applications IS 'Non-members applying for loans from chamas';
COMMENT ON TABLE escrow_accounts IS 'Escrow accounts holding funds until loan terms accepted';
COMMENT ON TABLE risk_sharing_agreements IS 'Agreements for multiple chamas co-funding loans';
COMMENT ON COLUMN chamas.external_lending_enabled IS 'Whether the chama has enabled external lending';
COMMENT ON COLUMN chamas.external_lending_settings IS 'JSON configuration for external lending rules';

