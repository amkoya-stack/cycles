-- ============================================================================
-- Migration: 033_lending_system.sql
-- Description: Create tables for the Chama→Member lending system (Phase 12A)
-- ============================================================================

-- ============================================================================
-- LOAN APPLICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS loan_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    applicant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Loan request details
    amount_requested DECIMAL(15, 2) NOT NULL,
    purpose TEXT NOT NULL,
    proposed_interest_rate DECIMAL(5, 2),
    proposed_repayment_period_months INTEGER NOT NULL,
    
    -- Status workflow
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft',           -- Not yet submitted
        'submitted',       -- Submitted for review
        'under_review',    -- Being reviewed by admin/treasurer
        'pending_vote',    -- Requires group voting
        'approved',        -- Approved for disbursement
        'rejected',        -- Application rejected
        'withdrawn',       -- Withdrawn by applicant
        'expired'          -- Application expired
    )),
    
    -- Approval details
    approval_method VARCHAR(20) CHECK (approval_method IN (
        'auto_approve',    -- Automatic approval based on reputation
        'treasurer',       -- Approved by treasurer
        'admin',           -- Approved by admin
        'group_vote'       -- Approved by group voting
    )),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Rejection details
    rejected_by UUID REFERENCES users(id),
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Voting integration
    requires_vote BOOLEAN DEFAULT FALSE,
    vote_proposal_id UUID,  -- Optional reference to governance proposal (if voting system is enabled)
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for loan_applications
CREATE INDEX IF NOT EXISTS idx_loan_applications_chama ON loan_applications(chama_id);
CREATE INDEX IF NOT EXISTS idx_loan_applications_applicant ON loan_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_loan_applications_status ON loan_applications(status);
CREATE INDEX IF NOT EXISTS idx_loan_applications_created ON loan_applications(created_at DESC);

-- ============================================================================
-- LOANS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_application_id UUID REFERENCES loan_applications(id),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    borrower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Loan terms
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
        'defaulted',             -- Borrower defaulted
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
    
    -- Collateral (optional)
    collateral_type VARCHAR(50),  -- 'contribution_history', 'chama_shares', 'external'
    collateral_value DECIMAL(15, 2),
    collateral_metadata JSONB,
    
    -- Agreement
    agreement_document_id UUID,
    agreement_signed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for loans
CREATE INDEX IF NOT EXISTS idx_loans_chama ON loans(chama_id);
CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_maturity ON loans(maturity_date);
CREATE INDEX IF NOT EXISTS idx_loans_application ON loans(loan_application_id);

-- ============================================================================
-- LOAN REPAYMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS loan_repayments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    
    -- Installment details
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    amount_due DECIMAL(15, 2) NOT NULL,
    principal_amount DECIMAL(15, 2) NOT NULL,
    interest_amount DECIMAL(15, 2) NOT NULL,
    late_fee DECIMAL(15, 2) DEFAULT 0,
    
    -- Payment status
    status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',   -- Not yet due
        'paid',      -- Fully paid
        'overdue',   -- Past due date
        'waived',    -- Waived by admin
        'partial'    -- Partially paid
    )),
    
    -- Payment details
    amount_paid DECIMAL(15, 2) DEFAULT 0,
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_method VARCHAR(30),  -- 'wallet', 'contribution_auto_deduct', 'manual'
    payment_reference VARCHAR(100),
    
    -- Auto-deduction tracking
    auto_deducted BOOLEAN DEFAULT FALSE,
    contribution_id UUID,  -- Link to contribution if auto-deducted
    ledger_transaction_id UUID,
    
    -- Notes
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(loan_id, installment_number)
);

-- Indexes for loan_repayments
CREATE INDEX IF NOT EXISTS idx_loan_repayments_loan ON loan_repayments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_due_date ON loan_repayments(due_date);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_status ON loan_repayments(status);

-- ============================================================================
-- LOAN AGREEMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS loan_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    
    -- Document storage
    document_url TEXT,
    document_hash VARCHAR(64),  -- SHA-256 hash for verification
    agreement_text TEXT,        -- Plain text version
    
    -- Signatures
    borrower_signature TEXT,
    borrower_signed_at TIMESTAMP WITH TIME ZONE,
    chama_signature TEXT,       -- Signed by treasurer/admin
    chama_signed_by UUID REFERENCES users(id),
    chama_signed_at TIMESTAMP WITH TIME ZONE,
    
    -- Witnesses (optional)
    witness_1_id UUID REFERENCES users(id),
    witness_1_signed_at TIMESTAMP WITH TIME ZONE,
    witness_2_id UUID REFERENCES users(id),
    witness_2_signed_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending_borrower', 'pending_chama', 
        'pending_witnesses', 'fully_signed', 'void'
    )),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_agreements_loan ON loan_agreements(loan_id);

-- ============================================================================
-- ADD LENDING SETTINGS TO CHAMAS TABLE
-- ============================================================================
DO $$
BEGIN
    -- Add lending_enabled column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chamas' AND column_name = 'lending_enabled') THEN
        ALTER TABLE chamas ADD COLUMN lending_enabled BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add lending_settings column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chamas' AND column_name = 'lending_settings') THEN
        ALTER TABLE chamas ADD COLUMN lending_settings JSONB DEFAULT '{
            "autoApproveEnabled": false,
            "autoApproveMaxAmount": 10000,
            "autoApproveMinReputationTier": "silver",
            "defaultInterestRate": 10,
            "maxLoanAmount": 100000,
            "minRepaymentPeriodMonths": 1,
            "maxRepaymentPeriodMonths": 12,
            "requiresVoteForAmountsAbove": 50000,
            "gracePeriodDays": 7,
            "lateFeeRate": 5,
            "allowEarlyRepayment": true
        }'::jsonb;
    END IF;
END $$;

-- ============================================================================
-- TRIGGERS FOR AUTO-UPDATE
-- ============================================================================

-- Loan applications updated_at trigger
CREATE OR REPLACE FUNCTION update_loan_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_loan_applications_updated_at ON loan_applications;
CREATE TRIGGER trigger_update_loan_applications_updated_at
    BEFORE UPDATE ON loan_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_loan_applications_updated_at();

-- Loans updated_at trigger
CREATE OR REPLACE FUNCTION update_loans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_loans_updated_at ON loans;
CREATE TRIGGER trigger_update_loans_updated_at
    BEFORE UPDATE ON loans
    FOR EACH ROW
    EXECUTE FUNCTION update_loans_updated_at();

-- Loan repayments updated_at trigger
CREATE OR REPLACE FUNCTION update_loan_repayments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_loan_repayments_updated_at ON loan_repayments;
CREATE TRIGGER trigger_update_loan_repayments_updated_at
    BEFORE UPDATE ON loan_repayments
    FOR EACH ROW
    EXECUTE FUNCTION update_loan_repayments_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get chama lending summary
CREATE OR REPLACE FUNCTION get_chama_lending_summary(p_chama_id UUID)
RETURNS TABLE (
    total_loans_issued BIGINT,
    active_loans BIGINT,
    total_lent DECIMAL(15, 2),
    total_recovered DECIMAL(15, 2),
    outstanding_portfolio DECIMAL(15, 2),
    defaulted_amount DECIMAL(15, 2),
    default_rate DECIMAL(5, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_loans_issued,
        COUNT(*) FILTER (WHERE l.status = 'active')::BIGINT as active_loans,
        COALESCE(SUM(l.amount_disbursed), 0) as total_lent,
        COALESCE(SUM(l.total_paid), 0) as total_recovered,
        COALESCE(SUM(l.outstanding_balance) FILTER (WHERE l.status = 'active'), 0) as outstanding_portfolio,
        COALESCE(SUM(l.outstanding_balance) FILTER (WHERE l.status = 'defaulted'), 0) as defaulted_amount,
        CASE 
            WHEN COUNT(*) > 0 
            THEN (COUNT(*) FILTER (WHERE l.status = 'defaulted')::DECIMAL / COUNT(*)::DECIMAL * 100)
            ELSE 0
        END as default_rate
    FROM loans l
    WHERE l.chama_id = p_chama_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check for overdue repayments and update status
CREATE OR REPLACE FUNCTION check_overdue_loan_repayments()
RETURNS void AS $$
BEGIN
    -- Mark pending repayments as overdue if past due date
    UPDATE loan_repayments
    SET status = 'overdue', updated_at = NOW()
    WHERE status = 'pending' 
      AND due_date < CURRENT_DATE;
    
    -- Calculate overdue amounts on loans
    UPDATE loans l
    SET 
        overdue_amount = (
            SELECT COALESCE(SUM(lr.amount_due - lr.amount_paid), 0)
            FROM loan_repayments lr
            WHERE lr.loan_id = l.id AND lr.status = 'overdue'
        ),
        updated_at = NOW()
    WHERE l.status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Function to calculate late fees
CREATE OR REPLACE FUNCTION calculate_late_fees(p_chama_id UUID)
RETURNS void AS $$
DECLARE
    v_late_fee_rate DECIMAL(5, 2);
BEGIN
    -- Get late fee rate from chama settings
    SELECT COALESCE((lending_settings->>'lateFeeRate')::DECIMAL, 5)
    INTO v_late_fee_rate
    FROM chamas
    WHERE id = p_chama_id;
    
    -- Apply late fees to overdue repayments that haven't had fees applied
    UPDATE loan_repayments lr
    SET 
        late_fee = (lr.amount_due - lr.amount_paid) * (v_late_fee_rate / 100),
        updated_at = NOW()
    FROM loans l
    WHERE lr.loan_id = l.id
      AND l.chama_id = p_chama_id
      AND lr.status = 'overdue'
      AND lr.late_fee = 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
-- (Add appropriate permissions based on your setup)

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE loan_applications IS 'Stores loan application requests from chama members';
COMMENT ON TABLE loans IS 'Stores approved and active loans';
COMMENT ON TABLE loan_repayments IS 'Tracks individual loan repayment installments';
COMMENT ON TABLE loan_agreements IS 'Stores loan agreement documents and signatures';
COMMENT ON COLUMN chamas.lending_enabled IS 'Whether the chama has enabled the lending feature';
COMMENT ON COLUMN chamas.lending_settings IS 'JSON configuration for lending rules and limits';

