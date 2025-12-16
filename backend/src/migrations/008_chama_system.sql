-- Migration 008: Chama (Group) System
-- Digital savings groups with contributions, payouts, and rotation

-- Enable UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CHAMAS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS chamas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    target_amount DECIMAL(15,2) DEFAULT 0,
    contribution_amount DECIMAL(15,2) NOT NULL,
    contribution_frequency TEXT NOT NULL DEFAULT 'monthly', -- weekly, monthly, custom
    max_members INT DEFAULT 50,
    status TEXT NOT NULL DEFAULT 'active', -- active, inactive, closed
    settings JSONB DEFAULT '{
        "rotation_mode": "sequential",
        "auto_payout": true,
        "late_penalty_enabled": false,
        "late_penalty_percentage": 5,
        "min_contribution_percentage": 100,
        "allow_partial_contributions": false
    }'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    
    CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'closed')),
    CONSTRAINT valid_frequency CHECK (contribution_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'custom')),
    CONSTRAINT positive_contribution CHECK (contribution_amount > 0)
);

CREATE INDEX idx_chamas_admin ON chamas(admin_user_id);
CREATE INDEX idx_chamas_status ON chamas(status);
CREATE INDEX idx_chamas_created_at ON chamas(created_at);

-- ============================================================================
-- CHAMA MEMBERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS chama_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member', -- admin, treasurer, member
    status TEXT NOT NULL DEFAULT 'active', -- active, suspended, left
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    payout_position INT, -- Position in rotation queue (1, 2, 3, etc.)
    total_contributed DECIMAL(15,2) DEFAULT 0,
    total_received DECIMAL(15,2) DEFAULT 0,
    missed_contributions INT DEFAULT 0,
    last_contribution_at TIMESTAMPTZ,
    notes TEXT,
    
    CONSTRAINT unique_chama_user UNIQUE(chama_id, user_id),
    CONSTRAINT valid_role CHECK (role IN ('admin', 'treasurer', 'member')),
    CONSTRAINT valid_member_status CHECK (status IN ('active', 'suspended', 'left'))
);

CREATE INDEX idx_chama_members_chama ON chama_members(chama_id);
CREATE INDEX idx_chama_members_user ON chama_members(user_id);
CREATE INDEX idx_chama_members_status ON chama_members(status);
CREATE INDEX idx_chama_members_payout_position ON chama_members(chama_id, payout_position);

-- ============================================================================
-- CHAMA INVITES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS chama_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_phone TEXT, -- Can invite by phone even if not registered
    invitee_email TEXT,
    invitee_user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Set when user registers
    status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, rejected, expired
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
    
    CONSTRAINT valid_invite_status CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    CONSTRAINT invite_has_contact CHECK (invitee_phone IS NOT NULL OR invitee_email IS NOT NULL OR invitee_user_id IS NOT NULL)
);

CREATE INDEX idx_chama_invites_chama ON chama_invites(chama_id);
CREATE INDEX idx_chama_invites_user ON chama_invites(invitee_user_id);
CREATE INDEX idx_chama_invites_status ON chama_invites(status);
CREATE INDEX idx_chama_invites_phone ON chama_invites(invitee_phone);

-- ============================================================================
-- CONTRIBUTION CYCLES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS contribution_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    cycle_number INT NOT NULL,
    expected_amount DECIMAL(15,2) NOT NULL,
    collected_amount DECIMAL(15,2) DEFAULT 0,
    fees_collected DECIMAL(15,2) DEFAULT 0,
    start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active', -- active, completed, cancelled
    payout_recipient_id UUID REFERENCES chama_members(id), -- Who receives payout this cycle
    payout_amount DECIMAL(15,2),
    payout_executed_at TIMESTAMPTZ,
    notes TEXT,
    
    CONSTRAINT unique_chama_cycle UNIQUE(chama_id, cycle_number),
    CONSTRAINT valid_cycle_status CHECK (status IN ('active', 'completed', 'cancelled')),
    CONSTRAINT positive_cycle_number CHECK (cycle_number > 0),
    CONSTRAINT valid_date_range CHECK (due_date >= start_date)
);

CREATE INDEX idx_contribution_cycles_chama ON contribution_cycles(chama_id);
CREATE INDEX idx_contribution_cycles_status ON contribution_cycles(chama_id, status);
CREATE INDEX idx_contribution_cycles_due_date ON contribution_cycles(due_date);

-- ============================================================================
-- CONTRIBUTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES contribution_cycles(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES chama_members(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id), -- Link to ledger
    amount DECIMAL(15,2) NOT NULL,
    fee_amount DECIMAL(15,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed', -- pending, completed, failed
    contributed_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    
    CONSTRAINT positive_amount CHECK (amount > 0),
    CONSTRAINT positive_fee CHECK (fee_amount >= 0),
    CONSTRAINT valid_contribution_status CHECK (status IN ('pending', 'completed', 'failed'))
);

CREATE INDEX idx_contributions_chama ON contributions(chama_id);
CREATE INDEX idx_contributions_cycle ON contributions(cycle_id);
CREATE INDEX idx_contributions_member ON contributions(member_id);
CREATE INDEX idx_contributions_user ON contributions(user_id);
CREATE INDEX idx_contributions_status ON contributions(status);
CREATE INDEX idx_contributions_date ON contributions(contributed_at);

-- ============================================================================
-- PAYOUTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES contribution_cycles(id) ON DELETE CASCADE,
    recipient_member_id UUID NOT NULL REFERENCES chama_members(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id), -- Link to ledger
    amount DECIMAL(15,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed
    scheduled_at TIMESTAMPTZ NOT NULL,
    executed_at TIMESTAMPTZ,
    failed_reason TEXT,
    notes TEXT,
    
    CONSTRAINT positive_payout_amount CHECK (amount > 0),
    CONSTRAINT valid_payout_status CHECK (status IN ('pending', 'completed', 'failed'))
);

CREATE INDEX idx_payouts_chama ON payouts(chama_id);
CREATE INDEX idx_payouts_cycle ON payouts(cycle_id);
CREATE INDEX idx_payouts_recipient ON payouts(recipient_member_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_payouts_scheduled ON payouts(scheduled_at);

-- ============================================================================
-- CHAMA TRANSACTIONS VIEW (Simplified query for UI)
-- ============================================================================
CREATE OR REPLACE VIEW chama_transaction_summary AS
SELECT 
    c.id as contribution_id,
    c.chama_id,
    c.cycle_id,
    c.user_id,
    u.email as user_email,
    u.phone as user_phone,
    'contribution' as transaction_type,
    c.amount,
    c.fee_amount,
    c.status,
    c.contributed_at as transaction_date,
    cy.cycle_number,
    cy.due_date
FROM contributions c
JOIN users u ON c.user_id = u.id
JOIN contribution_cycles cy ON c.cycle_id = cy.id

UNION ALL

SELECT 
    p.id as payout_id,
    p.chama_id,
    p.cycle_id,
    p.recipient_user_id as user_id,
    u.email as user_email,
    u.phone as user_phone,
    'payout' as transaction_type,
    p.amount,
    0 as fee_amount,
    p.status,
    p.executed_at as transaction_date,
    cy.cycle_number,
    cy.due_date
FROM payouts p
JOIN users u ON p.recipient_user_id = u.id
JOIN contribution_cycles cy ON p.cycle_id = cy.id
ORDER BY transaction_date DESC;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get chama balance from ledger
CREATE OR REPLACE FUNCTION get_chama_balance(chama_uuid UUID)
RETURNS DECIMAL(15,2) AS $$
DECLARE
    balance DECIMAL(15,2);
BEGIN
    SELECT COALESCE(ABS(a.balance), 0) INTO balance
    FROM accounts a
    WHERE a.chama_id = chama_uuid
    AND a.status = 'active'
    LIMIT 1;
    
    RETURN COALESCE(balance, 0);
END;
$$ LANGUAGE plpgsql;

-- Get next payout recipient (sequential rotation)
CREATE OR REPLACE FUNCTION get_next_payout_recipient(chama_uuid UUID)
RETURNS UUID AS $$
DECLARE
    next_member_id UUID;
    max_position INT;
    last_position INT;
BEGIN
    -- Get the last payout position
    SELECT COALESCE(MAX(cm.payout_position), 0) INTO last_position
    FROM payouts p
    JOIN chama_members cm ON p.recipient_member_id = cm.id
    WHERE p.chama_id = chama_uuid
    AND p.status = 'completed';
    
    -- Get max position in chama
    SELECT MAX(payout_position) INTO max_position
    FROM chama_members
    WHERE chama_id = chama_uuid
    AND status = 'active'
    AND payout_position IS NOT NULL;
    
    -- Get next member (wrap around if needed)
    IF last_position >= max_position THEN
        -- Start from beginning
        SELECT id INTO next_member_id
        FROM chama_members
        WHERE chama_id = chama_uuid
        AND status = 'active'
        AND payout_position = 1
        LIMIT 1;
    ELSE
        -- Get next in sequence
        SELECT id INTO next_member_id
        FROM chama_members
        WHERE chama_id = chama_uuid
        AND status = 'active'
        AND payout_position = last_position + 1
        LIMIT 1;
    END IF;
    
    RETURN next_member_id;
END;
$$ LANGUAGE plpgsql;

-- Calculate member contribution rate
CREATE OR REPLACE FUNCTION calculate_contribution_rate(member_uuid UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    expected_count INT;
    actual_count INT;
    rate DECIMAL(5,2);
BEGIN
    -- Get total cycles for member's chama
    SELECT COUNT(*) INTO expected_count
    FROM contribution_cycles cy
    JOIN chama_members cm ON cy.chama_id = cm.chama_id
    WHERE cm.id = member_uuid
    AND cy.status = 'completed';
    
    -- Get actual contributions
    SELECT COUNT(*) INTO actual_count
    FROM contributions
    WHERE member_id = member_uuid
    AND status = 'completed';
    
    IF expected_count > 0 THEN
        rate := (actual_count::DECIMAL / expected_count::DECIMAL) * 100;
    ELSE
        rate := 0;
    END IF;
    
    RETURN rate;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on chama tables
ALTER TABLE chamas ENABLE ROW LEVEL SECURITY;
ALTER TABLE chama_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chama_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Chamas: Users can only see chamas they're members of
CREATE POLICY chamas_member_access ON chamas
    FOR ALL
    USING (
        id IN (
            SELECT chama_id FROM chama_members 
            WHERE user_id = current_setting('app.current_user_id', true)::UUID
            AND status = 'active'
        )
        OR current_setting('app.current_user_id', true) = 'system'
    );

-- Chama Members: Users see members of their chamas
CREATE POLICY chama_members_access ON chama_members
    FOR ALL
    USING (
        chama_id IN (
            SELECT chama_id FROM chama_members 
            WHERE user_id = current_setting('app.current_user_id', true)::UUID
            AND status = 'active'
        )
        OR current_setting('app.current_user_id', true) = 'system'
    );

-- Invites: Users see their own invites or invites they sent
CREATE POLICY chama_invites_access ON chama_invites
    FOR ALL
    USING (
        invitee_user_id = current_setting('app.current_user_id', true)::UUID
        OR invited_by = current_setting('app.current_user_id', true)::UUID
        OR current_setting('app.current_user_id', true) = 'system'
    );

-- Contributions: Users see contributions in their chamas
CREATE POLICY contributions_access ON contributions
    FOR ALL
    USING (
        chama_id IN (
            SELECT chama_id FROM chama_members 
            WHERE user_id = current_setting('app.current_user_id', true)::UUID
            AND status = 'active'
        )
        OR current_setting('app.current_user_id', true) = 'system'
    );

-- Cycles: Users see cycles of their chamas
CREATE POLICY cycles_access ON contribution_cycles
    FOR ALL
    USING (
        chama_id IN (
            SELECT chama_id FROM chama_members 
            WHERE user_id = current_setting('app.current_user_id', true)::UUID
            AND status = 'active'
        )
        OR current_setting('app.current_user_id', true) = 'system'
    );

-- Payouts: Users see payouts in their chamas
CREATE POLICY payouts_access ON payouts
    FOR ALL
    USING (
        chama_id IN (
            SELECT chama_id FROM chama_members 
            WHERE user_id = current_setting('app.current_user_id', true)::UUID
            AND status = 'active'
        )
        OR current_setting('app.current_user_id', true) = 'system'
    );

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Composite indexes for common queries
CREATE INDEX idx_contributions_chama_cycle_member ON contributions(chama_id, cycle_id, member_id);
CREATE INDEX idx_payouts_chama_cycle_status ON payouts(chama_id, cycle_id, status);
CREATE INDEX idx_chama_members_chama_status_role ON chama_members(chama_id, status, role);

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE chamas IS 'Digital savings groups (chamas) with contribution and payout functionality';
COMMENT ON TABLE chama_members IS 'Members of each chama with roles and contribution tracking';
COMMENT ON TABLE chama_invites IS 'Pending invitations to join chamas';
COMMENT ON TABLE contribution_cycles IS 'Contribution periods with due dates and collection tracking';
COMMENT ON TABLE contributions IS 'Individual member contributions per cycle';
COMMENT ON TABLE payouts IS 'Scheduled and executed payouts to members';

COMMENT ON FUNCTION get_chama_balance IS 'Gets current balance of chama wallet from ledger';
COMMENT ON FUNCTION get_next_payout_recipient IS 'Determines next member in rotation to receive payout';
COMMENT ON FUNCTION calculate_contribution_rate IS 'Calculates member contribution compliance percentage';
