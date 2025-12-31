-- ============================================================================
-- Migration: 036_inter_chama_lending.sql
-- Description: Create tables for Inter-Chama Lending (Phase 12C)
-- Features: Chama-to-chama loans, formal agreements, voting on both sides
-- ============================================================================

-- ============================================================================
-- INTER-CHAMA LOAN REQUESTS TABLE
-- One chama requests a loan from another chama
-- ============================================================================
CREATE TABLE IF NOT EXISTS inter_chama_loan_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Requesting and lending chamas
    requesting_chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    lending_chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),  -- Admin/treasurer who created request
    
    -- Loan request details
    amount_requested DECIMAL(15, 2) NOT NULL,
    purpose TEXT NOT NULL,
    proposed_interest_rate DECIMAL(5, 2),
    proposed_repayment_period_months INTEGER NOT NULL,
    proposed_collateral TEXT,  -- Description of collateral (e.g., future contributions)
    collateral_value DECIMAL(15, 2),
    
    -- Status workflow
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft',           -- Not yet submitted
        'submitted',       -- Submitted to lending chama
        'under_review',    -- Being reviewed by lending chama
        'negotiating',     -- Terms being negotiated
        'pending_vote_requesting',  -- Requires vote from requesting chama
        'pending_vote_lending',     -- Requires vote from lending chama
        'approved',        -- Approved by both sides
        'rejected',        -- Rejected by lending chama
        'withdrawn',       -- Withdrawn by requesting chama
        'expired'          -- Request expired
    )),
    
    -- Negotiated terms (may differ from proposed)
    final_interest_rate DECIMAL(5, 2),
    final_repayment_period_months INTEGER,
    final_collateral TEXT,
    final_collateral_value DECIMAL(15, 2),
    
    -- Approval details
    approved_by_requesting_chama UUID REFERENCES users(id),
    approved_at_requesting_chama TIMESTAMP WITH TIME ZONE,
    approved_by_lending_chama UUID REFERENCES users(id),
    approved_at_lending_chama TIMESTAMP WITH TIME ZONE,
    
    -- Rejection details
    rejected_by UUID REFERENCES users(id),
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    rejected_by_side VARCHAR(10) CHECK (rejected_by_side IN ('requesting', 'lending')),
    
    -- Voting integration
    requires_vote_requesting BOOLEAN DEFAULT FALSE,
    vote_proposal_id_requesting UUID,
    requires_vote_lending BOOLEAN DEFAULT FALSE,
    vote_proposal_id_lending UUID,
    
    -- Chama reputation at time of request (for eligibility)
    requesting_chama_reputation_tier VARCHAR(20),
    requesting_chama_reputation_score INTEGER,
    lending_chama_reputation_tier VARCHAR(20),
    lending_chama_reputation_score INTEGER,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure requesting and lending chamas are different
    CONSTRAINT different_chamas CHECK (requesting_chama_id != lending_chama_id)
);

-- Indexes for inter_chama_loan_requests
CREATE INDEX IF NOT EXISTS idx_inter_chama_requests_requesting ON inter_chama_loan_requests(requesting_chama_id);
CREATE INDEX IF NOT EXISTS idx_inter_chama_requests_lending ON inter_chama_loan_requests(lending_chama_id);
CREATE INDEX IF NOT EXISTS idx_inter_chama_requests_status ON inter_chama_loan_requests(status);
CREATE INDEX IF NOT EXISTS idx_inter_chama_requests_created ON inter_chama_loan_requests(created_at DESC);

-- ============================================================================
-- INTER-CHAMA LOANS TABLE
-- Active loans between chamas
-- ============================================================================
CREATE TABLE IF NOT EXISTS inter_chama_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_request_id UUID NOT NULL REFERENCES inter_chama_loan_requests(id) ON DELETE CASCADE,
    
    -- Chamas involved
    requesting_chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    lending_chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    
    -- Loan terms (final negotiated terms)
    principal_amount DECIMAL(15, 2) NOT NULL,
    interest_rate DECIMAL(5, 2) NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL,  -- principal + interest
    repayment_period_months INTEGER NOT NULL,
    repayment_frequency VARCHAR(10) NOT NULL DEFAULT 'monthly' CHECK (repayment_frequency IN (
        'daily', 'weekly', 'biweekly', 'monthly'
    )),
    
    -- Important dates
    disbursed_at TIMESTAMP WITH TIME ZONE,
    first_payment_date DATE NOT NULL,
    maturity_date DATE NOT NULL,
    grace_period_days INTEGER DEFAULT 7,
    
    -- Loan status
    status VARCHAR(20) NOT NULL DEFAULT 'pending_disbursement' CHECK (status IN (
        'pending_disbursement',  -- Approved but not yet disbursed
        'active',                -- Loan is active
        'paid_off',              -- Fully repaid
        'defaulted',             -- Requesting chama defaulted
        'written_off',           -- Written off as bad debt
        'cancelled'              -- Cancelled before disbursement
    )),
    defaulted_at TIMESTAMP WITH TIME ZONE,
    paid_off_at TIMESTAMP WITH TIME ZONE,
    
    -- Payment tracking
    amount_disbursed DECIMAL(15, 2) DEFAULT 0,
    total_paid DECIMAL(15, 2) DEFAULT 0,
    total_interest_paid DECIMAL(15, 2) DEFAULT 0,
    total_principal_paid DECIMAL(15, 2) DEFAULT 0,
    outstanding_balance DECIMAL(15, 2) NOT NULL,
    overdue_amount DECIMAL(15, 2) DEFAULT 0,
    late_fee_penalty DECIMAL(15, 2) DEFAULT 0,
    
    -- Collateral
    collateral_type VARCHAR(50),  -- 'future_contributions', 'chama_assets', 'external'
    collateral_description TEXT,
    collateral_value DECIMAL(15, 2),
    collateral_metadata JSONB,
    
    -- Agreement
    agreement_document_id UUID,
    agreement_signed_at TIMESTAMP WITH TIME ZONE,
    signed_by_requesting UUID REFERENCES users(id),
    signed_by_lending UUID REFERENCES users(id),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for inter_chama_loans
CREATE INDEX IF NOT EXISTS idx_inter_chama_loans_requesting ON inter_chama_loans(requesting_chama_id);
CREATE INDEX IF NOT EXISTS idx_inter_chama_loans_lending ON inter_chama_loans(lending_chama_id);
CREATE INDEX IF NOT EXISTS idx_inter_chama_loans_status ON inter_chama_loans(status);
CREATE INDEX IF NOT EXISTS idx_inter_chama_loans_maturity ON inter_chama_loans(maturity_date);
CREATE INDEX IF NOT EXISTS idx_inter_chama_loans_request ON inter_chama_loans(loan_request_id);

-- ============================================================================
-- INTER-CHAMA LOAN REPAYMENTS TABLE
-- Tracks repayments for inter-chama loans
-- ============================================================================
CREATE TABLE IF NOT EXISTS inter_chama_loan_repayments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inter_chama_loan_id UUID NOT NULL REFERENCES inter_chama_loans(id) ON DELETE CASCADE,
    
    -- Installment details
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    amount_due DECIMAL(15, 2) NOT NULL,
    principal_amount DECIMAL(15, 2) NOT NULL,
    interest_amount DECIMAL(15, 2) NOT NULL,
    late_fee DECIMAL(15, 2) DEFAULT 0,
    
    -- Payment status
    status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'paid', 'overdue', 'waived', 'partial'
    )),
    
    -- Payment details
    amount_paid DECIMAL(15, 2) DEFAULT 0,
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_method VARCHAR(30),  -- 'chama_wallet', 'contribution_deduction', 'manual'
    payment_reference VARCHAR(100),
    ledger_transaction_id UUID,
    
    -- Notes
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(inter_chama_loan_id, installment_number)
);

-- Indexes for inter_chama_loan_repayments
CREATE INDEX IF NOT EXISTS idx_inter_chama_repayments_loan ON inter_chama_loan_repayments(inter_chama_loan_id);
CREATE INDEX IF NOT EXISTS idx_inter_chama_repayments_due_date ON inter_chama_loan_repayments(due_date);
CREATE INDEX IF NOT EXISTS idx_inter_chama_repayments_status ON inter_chama_loan_repayments(status);

-- ============================================================================
-- INTER-CHAMA LOAN AGREEMENTS TABLE
-- Formal agreements between chamas
-- ============================================================================
CREATE TABLE IF NOT EXISTS inter_chama_loan_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inter_chama_loan_id UUID NOT NULL REFERENCES inter_chama_loans(id) ON DELETE CASCADE,
    
    -- Document storage
    document_url TEXT,
    document_hash VARCHAR(64),  -- SHA-256 hash for verification
    agreement_text TEXT,        -- Plain text version
    
    -- Signatures
    requesting_chama_signature TEXT,
    requesting_chama_signed_by UUID REFERENCES users(id),
    requesting_chama_signed_at TIMESTAMP WITH TIME ZONE,
    lending_chama_signature TEXT,
    lending_chama_signed_by UUID REFERENCES users(id),
    lending_chama_signed_at TIMESTAMP WITH TIME ZONE,
    
    -- Witnesses (optional)
    witness_1_id UUID REFERENCES users(id),
    witness_1_signed_at TIMESTAMP WITH TIME ZONE,
    witness_2_id UUID REFERENCES users(id),
    witness_2_signed_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending_requesting', 'pending_lending', 
        'pending_witnesses', 'fully_signed', 'void'
    )),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inter_chama_agreements_loan ON inter_chama_loan_agreements(inter_chama_loan_id);

-- ============================================================================
-- ADD INTER-CHAMA LENDING SETTINGS TO CHAMAS TABLE
-- ============================================================================
DO $$
BEGIN
    -- Add inter_chama_lending_enabled column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chamas' AND column_name = 'inter_chama_lending_enabled') THEN
        ALTER TABLE chamas ADD COLUMN inter_chama_lending_enabled BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add inter_chama_lending_settings column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chamas' AND column_name = 'inter_chama_lending_settings') THEN
        ALTER TABLE chamas ADD COLUMN inter_chama_lending_settings JSONB DEFAULT '{
            "minLoanAmount": 50000,
            "maxLoanAmount": 1000000,
            "defaultInterestRate": 8,
            "minRepaymentPeriodMonths": 3,
            "maxRepaymentPeriodMonths": 24,
            "requiresVoteForAmountsAbove": 200000,
            "minReputationTierForBorrowing": "silver",
            "minReputationTierForLending": "gold",
            "allowCollateral": true,
            "gracePeriodDays": 14
        }'::jsonb;
    END IF;
END $$;

-- ============================================================================
-- TRIGGERS FOR AUTO-UPDATE
-- ============================================================================

-- Inter-chama loan requests updated_at trigger
CREATE OR REPLACE FUNCTION update_inter_chama_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inter_chama_requests_updated_at ON inter_chama_loan_requests;
CREATE TRIGGER trigger_update_inter_chama_requests_updated_at
    BEFORE UPDATE ON inter_chama_loan_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_inter_chama_requests_updated_at();

-- Inter-chama loans updated_at trigger
CREATE OR REPLACE FUNCTION update_inter_chama_loans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inter_chama_loans_updated_at ON inter_chama_loans;
CREATE TRIGGER trigger_update_inter_chama_loans_updated_at
    BEFORE UPDATE ON inter_chama_loans
    FOR EACH ROW
    EXECUTE FUNCTION update_inter_chama_loans_updated_at();

-- Inter-chama loan repayments updated_at trigger
CREATE OR REPLACE FUNCTION update_inter_chama_repayments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inter_chama_repayments_updated_at ON inter_chama_loan_repayments;
CREATE TRIGGER trigger_update_inter_chama_repayments_updated_at
    BEFORE UPDATE ON inter_chama_loan_repayments
    FOR EACH ROW
    EXECUTE FUNCTION update_inter_chama_repayments_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get inter-chama lending summary for a chama
CREATE OR REPLACE FUNCTION get_inter_chama_lending_summary(p_chama_id UUID)
RETURNS TABLE (
    total_loans_received BIGINT,
    total_loans_given BIGINT,
    active_loans_received BIGINT,
    active_loans_given BIGINT,
    total_borrowed DECIMAL(15, 2),
    total_lent DECIMAL(15, 2),
    outstanding_borrowed DECIMAL(15, 2),
    outstanding_lent DECIMAL(15, 2),
    defaulted_amount DECIMAL(15, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) FILTER (WHERE requesting_chama_id = p_chama_id)::BIGINT as total_loans_received,
        COUNT(*) FILTER (WHERE lending_chama_id = p_chama_id)::BIGINT as total_loans_given,
        COUNT(*) FILTER (WHERE requesting_chama_id = p_chama_id AND status = 'active')::BIGINT as active_loans_received,
        COUNT(*) FILTER (WHERE lending_chama_id = p_chama_id AND status = 'active')::BIGINT as active_loans_given,
        COALESCE(SUM(amount_disbursed) FILTER (WHERE requesting_chama_id = p_chama_id), 0)::DECIMAL as total_borrowed,
        COALESCE(SUM(amount_disbursed) FILTER (WHERE lending_chama_id = p_chama_id), 0)::DECIMAL as total_lent,
        COALESCE(SUM(outstanding_balance) FILTER (WHERE requesting_chama_id = p_chama_id AND status = 'active'), 0)::DECIMAL as outstanding_borrowed,
        COALESCE(SUM(outstanding_balance) FILTER (WHERE lending_chama_id = p_chama_id AND status = 'active'), 0)::DECIMAL as outstanding_lent,
        COALESCE(SUM(outstanding_balance) FILTER (WHERE requesting_chama_id = p_chama_id AND status = 'defaulted'), 0)::DECIMAL as defaulted_amount
    FROM inter_chama_loans
    WHERE requesting_chama_id = p_chama_id OR lending_chama_id = p_chama_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE inter_chama_loan_requests IS 'Loan requests from one chama to another';
COMMENT ON TABLE inter_chama_loans IS 'Active loans between chamas';
COMMENT ON TABLE inter_chama_loan_repayments IS 'Repayment installments for inter-chama loans';
COMMENT ON TABLE inter_chama_loan_agreements IS 'Formal loan agreements between chamas';
COMMENT ON COLUMN chamas.inter_chama_lending_enabled IS 'Whether the chama has enabled inter-chama lending';
COMMENT ON COLUMN chamas.inter_chama_lending_settings IS 'JSON configuration for inter-chama lending rules';

