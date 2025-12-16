-- Migration 011: Enhanced Contribution System (Phase 5A)
-- Late penalties, flexible contributions, payment methods, reminders

-- ============================================================================
-- CONTRIBUTION TYPES & PENALTIES
-- ============================================================================

-- Add contribution_type to chamas settings
COMMENT ON COLUMN chamas.settings IS 'Chama settings including: rotation_mode, auto_payout, late_penalty_enabled, late_penalty_percentage, min_contribution_percentage, allow_partial_contributions, contribution_type (fixed, flexible, income_based), min_amount, max_amount';

-- Update default settings to include new contribution options
UPDATE chamas SET settings = settings || '{
    "contribution_type": "fixed",
    "min_amount": null,
    "max_amount": null,
    "income_percentage": null,
    "payment_methods_enabled": ["wallet", "mpesa", "scheduled"],
    "auto_debit_enabled": false,
    "reminder_days_before": [3, 1, 0],
    "reminder_channels": ["sms", "email", "push"]
}'::JSONB WHERE settings->>'contribution_type' IS NULL;

-- ============================================================================
-- PENALTIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS contribution_penalties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES contribution_cycles(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES chama_members(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    days_late INT NOT NULL,
    penalty_rate DECIMAL(5,2) NOT NULL, -- Percentage
    status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, waived, cancelled
    reason TEXT,
    waived_by UUID REFERENCES users(id),
    waived_at TIMESTAMPTZ,
    waiver_reason TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT positive_penalty CHECK (amount >= 0),
    CONSTRAINT positive_days_late CHECK (days_late > 0),
    CONSTRAINT valid_penalty_status CHECK (status IN ('pending', 'paid', 'waived', 'cancelled'))
);

CREATE INDEX idx_penalties_chama ON contribution_penalties(chama_id);
CREATE INDEX idx_penalties_cycle ON contribution_penalties(cycle_id);
CREATE INDEX idx_penalties_member ON contribution_penalties(member_id);
CREATE INDEX idx_penalties_status ON contribution_penalties(status);
CREATE INDEX idx_penalties_created ON contribution_penalties(created_at);

-- ============================================================================
-- PENALTY WAIVERS TABLE (Voting system)
-- ============================================================================
CREATE TABLE IF NOT EXISTS penalty_waiver_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    penalty_id UUID NOT NULL REFERENCES contribution_penalties(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    votes_needed INT NOT NULL,
    votes_received INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    
    CONSTRAINT valid_waiver_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE TABLE IF NOT EXISTS penalty_waiver_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    waiver_request_id UUID NOT NULL REFERENCES penalty_waiver_requests(id) ON DELETE CASCADE,
    voter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote TEXT NOT NULL CHECK (vote IN ('approve', 'reject')),
    comment TEXT,
    voted_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_voter_waiver UNIQUE(waiver_request_id, voter_id)
);

CREATE INDEX idx_waiver_requests_penalty ON penalty_waiver_requests(penalty_id);
CREATE INDEX idx_waiver_requests_status ON penalty_waiver_requests(status);
CREATE INDEX idx_waiver_votes_request ON penalty_waiver_votes(waiver_request_id);

-- ============================================================================
-- CONTRIBUTION REMINDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS contribution_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES contribution_cycles(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES chama_members(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL, -- before_due, due_date, overdue
    days_offset INT NOT NULL, -- 3 for "3 days before", 0 for "due date", -1 for "1 day overdue"
    channel TEXT NOT NULL, -- sms, email, push, whatsapp
    status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, skipped
    scheduled_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    failed_reason TEXT,
    
    CONSTRAINT valid_reminder_type CHECK (reminder_type IN ('before_due', 'due_date', 'overdue')),
    CONSTRAINT valid_reminder_channel CHECK (channel IN ('sms', 'email', 'push', 'whatsapp')),
    CONSTRAINT valid_reminder_status CHECK (status IN ('pending', 'sent', 'failed', 'skipped'))
);

CREATE INDEX idx_reminders_chama ON contribution_reminders(chama_id);
CREATE INDEX idx_reminders_cycle ON contribution_reminders(cycle_id);
CREATE INDEX idx_reminders_member ON contribution_reminders(member_id);
CREATE INDEX idx_reminders_status ON contribution_reminders(status);
CREATE INDEX idx_reminders_scheduled ON contribution_reminders(scheduled_at);

-- ============================================================================
-- SCHEDULED AUTO-DEBIT TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS contribution_auto_debits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES chama_members(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT true,
    payment_method TEXT NOT NULL DEFAULT 'wallet', -- wallet, mpesa
    mpesa_phone TEXT,
    amount_type TEXT NOT NULL DEFAULT 'fixed', -- fixed, cycle_amount
    fixed_amount DECIMAL(15,2),
    auto_debit_day INT, -- Day of cycle period (e.g., day 1 of week/month)
    last_executed_at TIMESTAMPTZ,
    next_execution_at TIMESTAMPTZ,
    failures_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_payment_method CHECK (payment_method IN ('wallet', 'mpesa')),
    CONSTRAINT valid_amount_type CHECK (amount_type IN ('fixed', 'cycle_amount')),
    CONSTRAINT valid_auto_debit_day CHECK (auto_debit_day >= 1 AND auto_debit_day <= 31)
);

CREATE INDEX idx_auto_debits_member ON contribution_auto_debits(member_id);
CREATE INDEX idx_auto_debits_enabled ON contribution_auto_debits(enabled);
CREATE INDEX idx_auto_debits_next_execution ON contribution_auto_debits(next_execution_at);

-- ============================================================================
-- CONTRIBUTION RECEIPTS (Extended metadata)
-- ============================================================================
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'wallet' CHECK (payment_method IN ('wallet', 'mpesa_direct', 'auto_debit'));
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS mpesa_receipt TEXT;
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS auto_debit_id UUID REFERENCES contribution_auto_debits(id);
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ;
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS receipt_email TEXT;
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS receipt_sms TEXT;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Calculate late penalty amount
CREATE OR REPLACE FUNCTION calculate_late_penalty(
    p_contribution_amount DECIMAL(15,2),
    p_days_late INT,
    p_penalty_rate DECIMAL(5,2)
)
RETURNS DECIMAL(15,2) AS $$
BEGIN
    IF p_days_late <= 0 THEN
        RETURN 0;
    END IF;
    
    -- Simple calculation: amount * (penalty_rate/100) * days_late
    -- You can adjust formula as needed
    RETURN ROUND(p_contribution_amount * (p_penalty_rate / 100) * p_days_late, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get member's pending penalties
CREATE OR REPLACE FUNCTION get_member_pending_penalties(p_member_id UUID)
RETURNS DECIMAL(15,2) AS $$
DECLARE
    total_penalties DECIMAL(15,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total_penalties
    FROM contribution_penalties
    WHERE member_id = p_member_id
    AND status = 'pending';
    
    RETURN total_penalties;
END;
$$ LANGUAGE plpgsql;

-- Check if member has contributed to cycle
CREATE OR REPLACE FUNCTION has_contributed_to_cycle(
    p_member_id UUID,
    p_cycle_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    contribution_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM contributions
        WHERE member_id = p_member_id
        AND cycle_id = p_cycle_id
        AND status = 'completed'
    ) INTO contribution_exists;
    
    RETURN contribution_exists;
END;
$$ LANGUAGE plpgsql;

-- Get cycle contribution summary
CREATE OR REPLACE FUNCTION get_cycle_contribution_summary(p_cycle_id UUID)
RETURNS TABLE(
    total_members INT,
    contributed_members INT,
    pending_members INT,
    total_collected DECIMAL(15,2),
    expected_amount DECIMAL(15,2),
    completion_rate DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT cm.id)::INT as total_members,
        COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN cm.id END)::INT as contributed_members,
        COUNT(DISTINCT CASE WHEN c.id IS NULL OR c.status != 'completed' THEN cm.id END)::INT as pending_members,
        COALESCE(SUM(CASE WHEN c.status = 'completed' THEN c.amount ELSE 0 END), 0) as total_collected,
        cy.expected_amount as expected_amount,
        CASE 
            WHEN COUNT(DISTINCT cm.id) > 0 THEN 
                ROUND((COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN cm.id END)::DECIMAL / COUNT(DISTINCT cm.id)::DECIMAL) * 100, 2)
            ELSE 0 
        END as completion_rate
    FROM contribution_cycles cy
    JOIN chama_members cm ON cy.chama_id = cm.chama_id AND cm.status = 'active'
    LEFT JOIN contributions c ON c.cycle_id = cy.id AND c.member_id = cm.id
    WHERE cy.id = p_cycle_id
    GROUP BY cy.id, cy.expected_amount;
END;
$$ LANGUAGE plpgsql;

-- Schedule reminders for a cycle
CREATE OR REPLACE FUNCTION schedule_cycle_reminders(p_cycle_id UUID)
RETURNS INT AS $$
DECLARE
    cycle_record RECORD;
    member_record RECORD;
    reminder_config JSONB;
    days_before INT;
    reminder_count INT := 0;
BEGIN
    -- Get cycle info
    SELECT cy.*, ch.settings 
    INTO cycle_record
    FROM contribution_cycles cy
    JOIN chamas ch ON cy.chama_id = ch.chama_id
    WHERE cy.id = p_cycle_id;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    reminder_config := cycle_record.settings;
    
    -- Schedule reminders for each active member
    FOR member_record IN 
        SELECT cm.*, u.id as user_id
        FROM chama_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.chama_id = cycle_record.chama_id
        AND cm.status = 'active'
    LOOP
        -- Skip if member already contributed
        IF has_contributed_to_cycle(member_record.id, p_cycle_id) THEN
            CONTINUE;
        END IF;
        
        -- Schedule "before due" reminders
        FOREACH days_before IN ARRAY ARRAY(SELECT jsonb_array_elements_text(reminder_config->'reminder_days_before')::INT)
        LOOP
            INSERT INTO contribution_reminders (
                chama_id, cycle_id, member_id, user_id,
                reminder_type, days_offset, channel,
                scheduled_at
            )
            SELECT 
                cycle_record.chama_id,
                p_cycle_id,
                member_record.id,
                member_record.user_id,
                'before_due',
                days_before,
                channel,
                (cycle_record.due_date - days_before * INTERVAL '1 day')::TIMESTAMPTZ
            FROM jsonb_array_elements_text(reminder_config->'reminder_channels') AS channel
            ON CONFLICT DO NOTHING;
            
            reminder_count := reminder_count + 1;
        END LOOP;
        
        -- Schedule due date reminder
        INSERT INTO contribution_reminders (
            chama_id, cycle_id, member_id, user_id,
            reminder_type, days_offset, channel,
            scheduled_at
        )
        SELECT 
            cycle_record.chama_id,
            p_cycle_id,
            member_record.id,
            member_record.user_id,
            'due_date',
            0,
            channel,
            cycle_record.due_date::TIMESTAMPTZ
        FROM jsonb_array_elements_text(reminder_config->'reminder_channels') AS channel
        ON CONFLICT DO NOTHING;
        
        reminder_count := reminder_count + 1;
    END LOOP;
    
    RETURN reminder_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-calculate penalties on cycle completion
CREATE OR REPLACE FUNCTION create_late_penalties()
RETURNS TRIGGER AS $$
DECLARE
    member_record RECORD;
    chama_settings JSONB;
    penalty_enabled BOOLEAN;
    penalty_rate DECIMAL(5,2);
    days_late INT;
    penalty_amount DECIMAL(15,2);
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Get chama settings
        SELECT settings INTO chama_settings
        FROM chamas
        WHERE id = NEW.chama_id;
        
        penalty_enabled := (chama_settings->>'late_penalty_enabled')::BOOLEAN;
        penalty_rate := (chama_settings->>'late_penalty_percentage')::DECIMAL;
        
        IF penalty_enabled AND penalty_rate > 0 THEN
            -- Check each member for late contributions
            FOR member_record IN 
                SELECT cm.*, u.id as user_id
                FROM chama_members cm
                JOIN users u ON cm.user_id = u.id
                WHERE cm.chama_id = NEW.chama_id
                AND cm.status = 'active'
            LOOP
                -- Check if member contributed late or didn't contribute
                IF NOT has_contributed_to_cycle(member_record.id, NEW.id) THEN
                    days_late := EXTRACT(DAY FROM (NEW.completed_at::DATE - NEW.due_date));
                    
                    IF days_late > 0 THEN
                        penalty_amount := calculate_late_penalty(
                            NEW.expected_amount / (SELECT COUNT(*) FROM chama_members WHERE chama_id = NEW.chama_id AND status = 'active'),
                            days_late,
                            penalty_rate
                        );
                        
                        INSERT INTO contribution_penalties (
                            chama_id, cycle_id, member_id, user_id,
                            amount, days_late, penalty_rate,
                            reason
                        ) VALUES (
                            NEW.chama_id, NEW.id, member_record.id, member_record.user_id,
                            penalty_amount, days_late, penalty_rate,
                            'Missed contribution for cycle ' || NEW.cycle_number
                        );
                    END IF;
                END IF;
            END LOOP;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_late_penalties
    AFTER UPDATE ON contribution_cycles
    FOR EACH ROW
    EXECUTE FUNCTION create_late_penalties();

-- Update member contribution stats
CREATE OR REPLACE FUNCTION update_member_contribution_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' THEN
        UPDATE chama_members
        SET 
            total_contributed = total_contributed + NEW.amount,
            last_contribution_at = NEW.contributed_at
        WHERE id = NEW.member_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_member_stats
    AFTER INSERT OR UPDATE ON contributions
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION update_member_contribution_stats();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Member contribution dashboard view
CREATE OR REPLACE VIEW member_contribution_dashboard AS
SELECT 
    cm.id as member_id,
    cm.chama_id,
    cm.user_id,
    u.full_name,
    u.email,
    u.phone,
    cm.total_contributed,
    cm.total_received,
    cm.missed_contributions,
    cm.last_contribution_at,
    COALESCE(penalties.pending_penalties, 0) as pending_penalties,
    COALESCE(contributions.total_contributions, 0) as total_contributions,
    COALESCE(contributions.on_time_contributions, 0) as on_time_contributions,
    CASE 
        WHEN COALESCE(contributions.total_contributions, 0) > 0 
        THEN ROUND((COALESCE(contributions.on_time_contributions, 0)::DECIMAL / contributions.total_contributions::DECIMAL) * 100, 2)
        ELSE 0 
    END as on_time_rate
FROM chama_members cm
JOIN users u ON cm.user_id = u.id
LEFT JOIN (
    SELECT 
        member_id,
        SUM(amount) as pending_penalties
    FROM contribution_penalties
    WHERE status = 'pending'
    GROUP BY member_id
) penalties ON cm.id = penalties.member_id
LEFT JOIN (
    SELECT 
        member_id,
        COUNT(*) as total_contributions,
        COUNT(CASE WHEN contributed_at::DATE <= cy.due_date THEN 1 END) as on_time_contributions
    FROM contributions c
    JOIN contribution_cycles cy ON c.cycle_id = cy.id
    WHERE c.status = 'completed'
    GROUP BY member_id
) contributions ON cm.id = contributions.member_id
WHERE cm.status = 'active';

-- Cycle contribution status view
CREATE OR REPLACE VIEW cycle_contribution_status AS
SELECT 
    cy.id as cycle_id,
    cy.chama_id,
    cy.cycle_number,
    cy.start_date,
    cy.due_date,
    cy.status as cycle_status,
    cy.expected_amount,
    cy.collected_amount,
    COUNT(DISTINCT cm.id) as total_members,
    COUNT(DISTINCT c.id) as contributed_count,
    COUNT(DISTINCT cm.id) - COUNT(DISTINCT c.id) as pending_count,
    ROUND((COUNT(DISTINCT c.id)::DECIMAL / NULLIF(COUNT(DISTINCT cm.id), 0)) * 100, 2) as completion_percentage,
    ARRAY_AGG(DISTINCT cm.user_id) FILTER (WHERE c.id IS NULL) as pending_member_ids
FROM contribution_cycles cy
JOIN chama_members cm ON cy.chama_id = cm.chama_id AND cm.status = 'active'
LEFT JOIN contributions c ON c.cycle_id = cy.id AND c.member_id = cm.id AND c.status = 'completed'
GROUP BY cy.id, cy.chama_id, cy.cycle_number, cy.start_date, cy.due_date, cy.status, cy.expected_amount, cy.collected_amount;

-- Migration 011 completed: Enhanced contribution system with penalties, reminders, auto-debits, and flexible payment methods
