-- Migration 021: Add transfer_funds proposal type for governance-controlled transfers
-- Chama fund transfers require majority approval before execution

-- Add the new proposal type
ALTER TYPE proposal_type ADD VALUE IF NOT EXISTS 'transfer_funds';

-- Add governance fields to chama_transfers table
ALTER TABLE chama_transfers 
ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES proposals(id),
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);

-- Create index for proposal lookups
CREATE INDEX IF NOT EXISTS idx_chama_transfers_proposal ON chama_transfers(proposal_id);

-- Comment explaining the governance flow
COMMENT ON COLUMN chama_transfers.proposal_id IS 'Links transfer to governance proposal for approval';
COMMENT ON COLUMN chama_transfers.requires_approval IS 'Whether this transfer required voting (true for inter-chama)';
COMMENT ON COLUMN chama_transfers.approved_at IS 'When the proposal passed and transfer was approved';
COMMENT ON COLUMN chama_transfers.approved_by IS 'User who executed the approved proposal';
