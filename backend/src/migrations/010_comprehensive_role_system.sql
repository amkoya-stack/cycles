-- ============================================================================
-- Migration 010: Comprehensive Role System & Membership Management
-- ============================================================================

-- Update role constraints to include the four roles
ALTER TABLE chama_members DROP CONSTRAINT IF EXISTS valid_role;
ALTER TABLE chama_members ADD CONSTRAINT valid_role 
    CHECK (role IN ('chairperson', 'treasurer', 'secretary', 'member'));

-- Add new fields for enhanced membership management
ALTER TABLE chama_members ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{
    "view": true,
    "contribute": true,
    "vote": true,
    "financial_operations": false,
    "assign_roles": false,
    "expel_members": false,
    "document_management": false,
    "meeting_minutes": false,
    "approve_withdrawals": false
}'::JSONB;

-- Add role assignment tracking
ALTER TABLE chama_members ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id);
ALTER TABLE chama_members ADD COLUMN IF NOT EXISTS role_assigned_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- ROLE PERMISSIONS FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION get_role_permissions(role_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN CASE role_name
        WHEN 'chairperson' THEN '{
            "view": true,
            "contribute": true,
            "vote": true,
            "financial_operations": true,
            "assign_roles": true,
            "expel_members": true,
            "document_management": true,
            "meeting_minutes": true,
            "approve_withdrawals": true,
            "full_control": true
        }'::JSONB
        WHEN 'treasurer' THEN '{
            "view": true,
            "contribute": true,
            "vote": true,
            "financial_operations": true,
            "assign_roles": false,
            "expel_members": false,
            "document_management": false,
            "meeting_minutes": false,
            "approve_withdrawals": true
        }'::JSONB
        WHEN 'secretary' THEN '{
            "view": true,
            "contribute": true,
            "vote": true,
            "financial_operations": false,
            "assign_roles": false,
            "expel_members": false,
            "document_management": true,
            "meeting_minutes": true,
            "approve_withdrawals": false
        }'::JSONB
        WHEN 'member' THEN '{
            "view": true,
            "contribute": true,
            "vote": true,
            "financial_operations": false,
            "assign_roles": false,
            "expel_members": false,
            "document_management": false,
            "meeting_minutes": false,
            "approve_withdrawals": false
        }'::JSONB
        ELSE '{}'::JSONB
    END;
END;
$$;

-- ============================================================================
-- UPDATE EXISTING ADMIN ROLES TO CHAIRPERSON
-- ============================================================================
UPDATE chama_members SET role = 'chairperson' WHERE role = 'admin';

-- ============================================================================
-- MEMBERSHIP REQUESTS TABLE (Enhanced)
-- ============================================================================
CREATE TABLE IF NOT EXISTS membership_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL DEFAULT 'join', -- join, rejoin, role_change
    requested_role TEXT DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, withdrawn
    message TEXT, -- Optional message from requester
    admin_response TEXT, -- Optional response from admin
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    responded_by UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
    
    CONSTRAINT unique_pending_request UNIQUE(chama_id, requester_id, request_type),
    CONSTRAINT valid_request_type CHECK (request_type IN ('join', 'rejoin', 'role_change')),
    CONSTRAINT valid_request_status CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    CONSTRAINT valid_requested_role CHECK (requested_role IN ('chairperson', 'treasurer', 'secretary', 'member'))
);

CREATE INDEX idx_membership_requests_chama ON membership_requests(chama_id);
CREATE INDEX idx_membership_requests_requester ON membership_requests(requester_id);
CREATE INDEX idx_membership_requests_status ON membership_requests(status);

-- ============================================================================
-- ROLE CHANGE AUDIT TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS role_change_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    old_role TEXT NOT NULL,
    new_role TEXT NOT NULL,
    reason TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_old_role CHECK (old_role IN ('chairperson', 'treasurer', 'secretary', 'member')),
    CONSTRAINT valid_new_role CHECK (new_role IN ('chairperson', 'treasurer', 'secretary', 'member'))
);

CREATE INDEX idx_role_change_audit_chama ON role_change_audit(chama_id);
CREATE INDEX idx_role_change_audit_member ON role_change_audit(member_id);

-- ============================================================================
-- CHAMA SETTINGS UPDATE FOR ROLE MANAGEMENT
-- ============================================================================
-- Add default role settings to existing chamas
UPDATE chamas 
SET settings = settings || '{
    "role_management": {
        "allow_role_requests": true,
        "max_chairpersons": 1,
        "max_treasurers": 2,
        "max_secretaries": 2,
        "require_approval_for_roles": ["chairperson", "treasurer", "secretary"]
    }
}'::JSONB
WHERE settings->>'role_management' IS NULL;

-- ============================================================================
-- MEMBER ACTIVITY TRACKING
-- ============================================================================
ALTER TABLE chama_members ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE chama_members ADD COLUMN IF NOT EXISTS activity_score INT DEFAULT 0;
ALTER TABLE chama_members ADD COLUMN IF NOT EXISTS warnings_count INT DEFAULT 0;

-- ============================================================================
-- ENHANCED PERMISSIONS VIEW
-- ============================================================================
CREATE OR REPLACE VIEW member_permissions AS
SELECT 
    cm.id as membership_id,
    cm.chama_id,
    cm.user_id,
    u.full_name,
    u.email,
    u.phone,
    cm.role,
    cm.status,
    cm.joined_at,
    cm.last_activity_at,
    cm.activity_score,
    cm.total_contributed,
    cm.total_received,
    cm.missed_contributions,
    get_role_permissions(cm.role) as permissions,
    c.name as chama_name
FROM chama_members cm
JOIN users u ON cm.user_id = u.id
JOIN chamas c ON cm.chama_id = c.id
WHERE cm.status = 'active';

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC PERMISSION UPDATES
-- ============================================================================
CREATE OR REPLACE FUNCTION update_member_permissions()
RETURNS TRIGGER AS $$
BEGIN
    -- Update permissions based on new role
    NEW.permissions = get_role_permissions(NEW.role);
    NEW.role_assigned_at = NOW();
    
    -- Log role change if role changed
    IF TG_OP = 'UPDATE' AND OLD.role != NEW.role THEN
        INSERT INTO role_change_audit (chama_id, member_id, changed_by, old_role, new_role)
        VALUES (NEW.chama_id, NEW.user_id, NEW.assigned_by, OLD.role, NEW.role);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_member_permissions
    BEFORE INSERT OR UPDATE ON chama_members
    FOR EACH ROW
    EXECUTE FUNCTION update_member_permissions();

-- ============================================================================
-- AUTOMATIC ACTIVITY SCORE UPDATE
-- ============================================================================
CREATE OR REPLACE FUNCTION update_activity_score()
RETURNS void AS $$
BEGIN
    -- Update activity scores based on recent contributions, attendance, etc.
    UPDATE chama_members 
    SET activity_score = (
        CASE 
            WHEN last_contribution_at > NOW() - INTERVAL '30 days' THEN 100
            WHEN last_contribution_at > NOW() - INTERVAL '60 days' THEN 75
            WHEN last_contribution_at > NOW() - INTERVAL '90 days' THEN 50
            ELSE 25
        END
        + 
        CASE 
            WHEN last_activity_at > NOW() - INTERVAL '7 days' THEN 20
            WHEN last_activity_at > NOW() - INTERVAL '30 days' THEN 10
            ELSE 0
        END
        - (missed_contributions * 5)
        - (warnings_count * 10)
    ),
    last_activity_at = CASE 
        WHEN last_activity_at IS NULL THEN joined_at 
        ELSE last_activity_at 
    END;
END;
$$ LANGUAGE plpgsql;

-- Run initial activity score calculation
SELECT update_activity_score();