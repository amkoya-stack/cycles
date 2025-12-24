-- Migration 027: Invite System Enhancements
-- Adds shareable invite links and member invite permissions

-- Add invite token support to chama_invites table
ALTER TABLE chama_invites
  ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days');

-- Create index on invite_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_chama_invites_token 
  ON chama_invites(invite_token) 
  WHERE invite_token IS NOT NULL;

-- Add member invite permission settings to chamas table
-- These are also stored in settings JSONB for consistency, but having dedicated columns
-- allows for faster queries and better database constraints
ALTER TABLE chamas
  ADD COLUMN IF NOT EXISTS members_can_invite BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS invite_requires_approval BOOLEAN DEFAULT false;

-- Create index for efficient permission checks
CREATE INDEX IF NOT EXISTS idx_chama_members_can_invite
  ON chamas(members_can_invite)
  WHERE members_can_invite = true;

-- Add comment explaining the new fields
COMMENT ON COLUMN chamas.members_can_invite IS 'When true, regular members can invite new members. When false, only admins/chairpersons can invite.';
COMMENT ON COLUMN chamas.invite_requires_approval IS 'When true, invites sent by members require admin approval before being sent. Currently not enforced.';
COMMENT ON COLUMN chama_invites.invite_token IS 'Unique token for shareable invite links. Generated as 32-byte random hex string.';
COMMENT ON COLUMN chama_invites.expires_at IS 'Expiration timestamp for invite. Defaults to 7 days from creation.';

