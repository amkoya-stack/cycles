-- Migration 025: Add pinning support to governance proposals
-- Allow polls/governance proposals to be pinned like community posts

-- Add pinned fields to proposals table
ALTER TABLE proposals 
ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP NULL;

-- Create index for better performance on pinned proposals
DROP INDEX IF EXISTS idx_proposals_pinned;
CREATE INDEX idx_proposals_pinned ON proposals(pinned);

-- Create composite index for ordering (pinned first, then by created_at)
DROP INDEX IF EXISTS idx_proposals_order;
CREATE INDEX idx_proposals_order ON proposals(pinned DESC NULLS LAST, created_at DESC);

-- Add update trigger for pinned_at timestamp
CREATE OR REPLACE FUNCTION update_proposal_pinned_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pinned = true AND OLD.pinned = false THEN
    NEW.pinned_at = NOW();
  ELSIF NEW.pinned = false AND OLD.pinned = true THEN
    NEW.pinned_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_proposal_pinned_at ON proposals;
CREATE TRIGGER trigger_update_proposal_pinned_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_proposal_pinned_at();