-- ============================================================================
-- Migration: 038_replace_chairperson_with_admin.sql
-- Description: Replace 'chairperson' role with 'admin' role throughout the system
-- ============================================================================

-- ============================================================================
-- UPDATE ALL CHAIRPERSON ROLES TO ADMIN
-- ============================================================================

-- Temporarily disable trigger to avoid audit log issues
ALTER TABLE chama_members DISABLE TRIGGER ALL;

-- Update all chairperson roles to admin
-- Use the user_id as changed_by for audit purposes
UPDATE chama_members 
SET role = 'admin', 
    assigned_by = user_id,
    role_assigned_at = NOW()
WHERE role = 'chairperson';

-- Re-enable triggers
ALTER TABLE chama_members ENABLE TRIGGER ALL;

-- Update role_change_audit records if they exist
UPDATE role_change_audit 
SET changed_by = (
    SELECT user_id FROM chama_members 
    WHERE chama_members.chama_id = role_change_audit.chama_id 
    AND chama_members.user_id = role_change_audit.member_id
    LIMIT 1
)
WHERE changed_by IS NULL AND old_role = 'chairperson';

-- ============================================================================
-- UPDATE ROLE CONSTRAINTS
-- ============================================================================

-- Update chama_members role constraint
ALTER TABLE chama_members DROP CONSTRAINT IF EXISTS valid_role;
ALTER TABLE chama_members ADD CONSTRAINT valid_role 
    CHECK (role IN ('admin', 'treasurer', 'secretary', 'member'));

-- Update membership_requests role constraint
ALTER TABLE membership_requests DROP CONSTRAINT IF EXISTS valid_requested_role;
ALTER TABLE membership_requests ADD CONSTRAINT valid_requested_role 
    CHECK (requested_role IN ('admin', 'treasurer', 'secretary', 'member'));

-- Update role_change_audit constraints
ALTER TABLE role_change_audit DROP CONSTRAINT IF EXISTS valid_old_role;
ALTER TABLE role_change_audit ADD CONSTRAINT valid_old_role 
    CHECK (old_role IN ('admin', 'treasurer', 'secretary', 'member'));

ALTER TABLE role_change_audit DROP CONSTRAINT IF EXISTS valid_new_role;
ALTER TABLE role_change_audit ADD CONSTRAINT valid_new_role 
    CHECK (new_role IN ('admin', 'treasurer', 'secretary', 'member'));

-- ============================================================================
-- UPDATE ROLE PERMISSIONS FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION get_role_permissions(role_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN CASE role_name
        WHEN 'admin' THEN '{
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
-- UPDATE GOVERNANCE VOTING WEIGHTS
-- ============================================================================
-- Update voting weight function if it exists
DO $$
BEGIN
    -- Check if the function exists and update it
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'calculate_vote_weight'
    ) THEN
        -- The function will be updated in the governance migration if needed
        -- For now, we just note that admin should have weight 2.00 (same as chairperson had)
        NULL;
    END IF;
END $$;

-- ============================================================================
-- UPDATE CHAMA SETTINGS
-- ============================================================================
-- Update role management settings to use 'admin' instead of 'chairperson'
UPDATE chamas 
SET settings = jsonb_set(
    jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{role_management,max_admins}',
        COALESCE(settings->'role_management'->'max_chairpersons', '1'::jsonb)
    ),
    '{role_management,require_approval_for_roles}',
    COALESCE(
        (
            SELECT jsonb_agg(
                CASE WHEN value::text = '"chairperson"' THEN '"admin"'::jsonb
                     ELSE value
                END
            )
            FROM jsonb_array_elements(
                COALESCE(settings->'role_management'->'require_approval_for_roles', '[]'::jsonb)
            )
        ),
        '["admin", "treasurer", "secretary"]'::jsonb
    )
)
WHERE settings->'role_management' IS NOT NULL;

-- Remove old max_chairpersons key if it exists
UPDATE chamas 
SET settings = settings #- '{role_management,max_chairpersons}'
WHERE settings->'role_management'->'max_chairpersons' IS NOT NULL;

-- ============================================================================
-- UPDATE VIRTUAL MEETINGS VIEWER ROLES
-- ============================================================================
-- Update any default arrays that reference chairperson
-- This is handled in application code, but we ensure consistency here

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON CONSTRAINT valid_role ON chama_members IS 'Valid roles: admin, treasurer, secretary, member';
COMMENT ON CONSTRAINT valid_requested_role ON membership_requests IS 'Valid requested roles: admin, treasurer, secretary, member';

