-- Migration 013: Rotation and Payout System
-- Creates tables for managing member rotation order and payout distributions

-- ============================================================================
-- ROTATION ORDERS TABLE
-- ============================================================================
-- Manages the rotation sequence for a chama
CREATE TABLE IF NOT EXISTS rotation_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    rotation_type VARCHAR(50) NOT NULL CHECK (rotation_type IN ('sequential', 'random', 'merit_based', 'custom')),
    cycle_duration_months INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    current_position INTEGER,
    total_positions INTEGER,
    start_date TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rotation_orders_chama ON rotation_orders(chama_id);
CREATE INDEX IF NOT EXISTS idx_rotation_orders_status ON rotation_orders(status) WHERE status = 'active';

-- ============================================================================
-- ROTATION POSITIONS TABLE
-- ============================================================================
-- Tracks each member's position in the rotation order
CREATE TABLE IF NOT EXISTS rotation_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rotation_order_id UUID NOT NULL REFERENCES rotation_orders(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES chama_members(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    cycle_assigned UUID REFERENCES contribution_cycles(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'current', 'completed', 'skipped')),
    merit_score DECIMAL(5, 2),
    assigned_at TIMESTAMP,
    completed_at TIMESTAMP,
    skipped_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rotation_order_id, position),
    UNIQUE(rotation_order_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_rotation_positions_order ON rotation_positions(rotation_order_id);
CREATE INDEX IF NOT EXISTS idx_rotation_positions_member ON rotation_positions(member_id);
CREATE INDEX IF NOT EXISTS idx_rotation_positions_status ON rotation_positions(rotation_order_id, status);
CREATE INDEX IF NOT EXISTS idx_rotation_positions_position ON rotation_positions(rotation_order_id, position);

-- ============================================================================
-- PAYOUTS TABLE ENHANCEMENTS
-- ============================================================================
-- Payouts table already exists from migration 008
-- Add rotation_position_id link if not exists
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS rotation_position_id UUID REFERENCES rotation_positions(id);

-- Add indexes that may be missing
CREATE INDEX IF NOT EXISTS idx_payouts_rotation_position ON payouts(rotation_position_id);

-- ============================================================================
-- PAYOUT DISTRIBUTIONS TABLE
-- ============================================================================
-- Links contributions to the payouts they fund
CREATE TABLE IF NOT EXISTS payout_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id UUID NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
    contribution_id UUID NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(payout_id, contribution_id)
);

CREATE INDEX IF NOT EXISTS idx_payout_distributions_payout ON payout_distributions(payout_id);
CREATE INDEX IF NOT EXISTS idx_payout_distributions_contribution ON payout_distributions(contribution_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp on rotation_orders
CREATE OR REPLACE FUNCTION update_rotation_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rotation_orders_updated_at
    BEFORE UPDATE ON rotation_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_rotation_orders_updated_at();

-- Update updated_at timestamp on rotation_positions
CREATE OR REPLACE FUNCTION update_rotation_positions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rotation_positions_updated_at
    BEFORE UPDATE ON rotation_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_rotation_positions_updated_at();

-- Note: payouts already has updated_at trigger from migration 008

-- Automatically update rotation order position when a position is completed
CREATE OR REPLACE FUNCTION update_rotation_order_position()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE rotation_orders
        SET current_position = NEW.position
        WHERE id = NEW.rotation_order_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_rotation_order_position
    AFTER UPDATE ON rotation_positions
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION update_rotation_order_position();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for active rotation status
CREATE OR REPLACE VIEW v_active_rotations AS
SELECT 
    ro.id as rotation_id,
    ro.chama_id,
    c.name as chama_name,
    ro.rotation_type,
    ro.current_position,
    ro.total_positions,
    rp_current.member_id as current_recipient_id,
    u_current.full_name as current_recipient_name,
    rp_next.member_id as next_recipient_id,
    u_next.full_name as next_recipient_name,
    rp_next.position as next_position,
    ro.start_date,
    ro.created_at
FROM rotation_orders ro
JOIN chamas c ON ro.chama_id = c.id
LEFT JOIN rotation_positions rp_current ON ro.id = rp_current.rotation_order_id 
    AND rp_current.position = ro.current_position
LEFT JOIN chama_members cm_current ON rp_current.member_id = cm_current.id
LEFT JOIN users u_current ON cm_current.user_id = u_current.id
LEFT JOIN rotation_positions rp_next ON ro.id = rp_next.rotation_order_id 
    AND rp_next.position = COALESCE(ro.current_position, 0) + 1
LEFT JOIN chama_members cm_next ON rp_next.member_id = cm_next.id
LEFT JOIN users u_next ON cm_next.user_id = u_next.id
WHERE ro.status = 'active';

-- View for payout summary by chama
CREATE OR REPLACE VIEW v_payout_summary AS
SELECT 
    p.chama_id,
    COUNT(*) as total_payouts,
    COUNT(*) FILTER (WHERE p.status = 'completed') as completed_payouts,
    COUNT(*) FILTER (WHERE p.status = 'pending') as pending_payouts,
    COUNT(*) FILTER (WHERE p.status = 'failed') as failed_payouts,
    SUM(p.amount) as total_amount,
    SUM(p.amount) FILTER (WHERE p.status = 'completed') as total_paid,
    MAX(p.executed_at) as last_payout_date
FROM payouts p
GROUP BY p.chama_id;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE rotation_orders IS 'Manages rotation sequences for chamas';
COMMENT ON TABLE rotation_positions IS 'Tracks member positions in rotation order';
COMMENT ON TABLE payout_distributions IS 'Links contributions to payouts for auditability';

COMMENT ON COLUMN rotation_orders.rotation_type IS 'Type: sequential, random, merit_based, or custom';
COMMENT ON COLUMN rotation_orders.current_position IS 'Current position in rotation (1-indexed)';
COMMENT ON COLUMN rotation_positions.merit_score IS 'Score for merit-based rotations (0-100)';
COMMENT ON COLUMN payouts.rotation_position_id IS 'Link to rotation position for this payout';
COMMENT ON COLUMN payouts.transaction_id IS 'Link to ledger transaction for double-entry accounting';
