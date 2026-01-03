-- ==========================================
-- PHASE 14: DISPUTE RESOLUTION MODULE
-- Migration: 044_dispute_resolution_module.sql
-- ==========================================

-- Dispute Types Enum
CREATE TYPE dispute_type AS ENUM (
  'payment_dispute',
  'payout_dispute',
  'membership_dispute',
  'loan_default',
  'rule_violation'
);

-- Dispute Status Enum
CREATE TYPE dispute_status AS ENUM (
  'filed',
  'under_review',
  'discussion',
  'voting',
  'resolved',
  'escalated',
  'closed',
  'dismissed'
);

-- Resolution Type Enum
CREATE TYPE resolution_type AS ENUM (
  'mediation',
  'refund',
  'repayment_plan',
  'member_suspension',
  'member_expulsion',
  'chama_dissolution',
  'no_action',
  'other'
);

-- Disputes Table
CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
  filed_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filed_against_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  dispute_type dispute_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status dispute_status NOT NULL DEFAULT 'filed',
  resolution_type resolution_type,
  resolution_details JSONB,
  priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, critical
  amount_disputed DECIMAL(15, 2), -- For payment/payout disputes
  related_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  related_loan_id UUID REFERENCES loans(id) ON DELETE SET NULL,
  related_contribution_id UUID REFERENCES contributions(id) ON DELETE SET NULL,
  related_payout_id UUID REFERENCES payouts(id) ON DELETE SET NULL,
  evidence_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  vote_count INTEGER DEFAULT 0,
  votes_for INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  votes_abstain INTEGER DEFAULT 0,
  required_votes INTEGER, -- For voting resolution
  voting_deadline TIMESTAMP,
  discussion_deadline TIMESTAMP,
  resolved_at TIMESTAMP,
  resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  escalated_at TIMESTAMP,
  escalated_to_platform BOOLEAN DEFAULT FALSE,
  platform_resolution TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

-- Dispute Evidence Table
CREATE TABLE dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  submitted_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  evidence_type VARCHAR(50) NOT NULL, -- document, screenshot, chat_log, transaction_record, other
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT, -- URL to uploaded file (S3, etc.)
  file_type VARCHAR(50), -- pdf, image, text, etc.
  file_size INTEGER, -- bytes
  external_reference VARCHAR(255), -- Reference to external system
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

-- Dispute Comments Table (Discussion Thread)
CREATE TABLE dispute_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES dispute_comments(id) ON DELETE CASCADE, -- For threaded replies
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE, -- Internal admin notes
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

-- Dispute Votes Table
CREATE TABLE dispute_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type VARCHAR(20) NOT NULL, -- for, against, abstain
  comment TEXT, -- Optional explanation
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(dispute_id, user_id) -- One vote per user per dispute
);

-- Dispute Resolutions Table (Historical record)
CREATE TABLE dispute_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  resolution_type resolution_type NOT NULL,
  resolution_details JSONB NOT NULL,
  resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  implementation_status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed
  implementation_notes TEXT,
  completed_at TIMESTAMP,
  metadata JSONB
);

-- Dispute Escalations Table
CREATE TABLE dispute_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  escalated_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  escalation_reason TEXT NOT NULL,
  escalated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  platform_reviewed_at TIMESTAMP,
  platform_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  platform_decision TEXT,
  platform_action_taken JSONB,
  status VARCHAR(50) DEFAULT 'pending', -- pending, reviewed, action_taken, dismissed
  metadata JSONB
);

-- Indexes for Performance
CREATE INDEX idx_disputes_chama_id ON disputes(chama_id);
CREATE INDEX idx_disputes_filed_by ON disputes(filed_by_user_id);
CREATE INDEX idx_disputes_filed_against ON disputes(filed_against_user_id);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_type ON disputes(dispute_type);
CREATE INDEX idx_disputes_created_at ON disputes(created_at DESC);
CREATE INDEX idx_disputes_escalated ON disputes(escalated_to_platform) WHERE escalated_to_platform = TRUE;

CREATE INDEX idx_dispute_evidence_dispute_id ON dispute_evidence(dispute_id);
CREATE INDEX idx_dispute_evidence_submitted_by ON dispute_evidence(submitted_by_user_id);

CREATE INDEX idx_dispute_comments_dispute_id ON dispute_comments(dispute_id);
CREATE INDEX idx_dispute_comments_user_id ON dispute_comments(user_id);
CREATE INDEX idx_dispute_comments_parent ON dispute_comments(parent_comment_id);

CREATE INDEX idx_dispute_votes_dispute_id ON dispute_votes(dispute_id);
CREATE INDEX idx_dispute_votes_user_id ON dispute_votes(user_id);

CREATE INDEX idx_dispute_resolutions_dispute_id ON dispute_resolutions(dispute_id);
CREATE INDEX idx_dispute_resolutions_status ON dispute_resolutions(implementation_status);

CREATE INDEX idx_dispute_escalations_dispute_id ON dispute_escalations(dispute_id);
CREATE INDEX idx_dispute_escalations_status ON dispute_escalations(status);

-- Function to update dispute vote counts
CREATE OR REPLACE FUNCTION update_dispute_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE disputes
  SET
    vote_count = (
      SELECT COUNT(*) FROM dispute_votes WHERE dispute_id = NEW.dispute_id
    ),
    votes_for = (
      SELECT COUNT(*) FROM dispute_votes WHERE dispute_id = NEW.dispute_id AND vote_type = 'for'
    ),
    votes_against = (
      SELECT COUNT(*) FROM dispute_votes WHERE dispute_id = NEW.dispute_id AND vote_type = 'against'
    ),
    votes_abstain = (
      SELECT COUNT(*) FROM dispute_votes WHERE dispute_id = NEW.dispute_id AND vote_type = 'abstain'
    ),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.dispute_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update vote counts
CREATE TRIGGER trigger_update_dispute_vote_counts
AFTER INSERT OR UPDATE OR DELETE ON dispute_votes
FOR EACH ROW
EXECUTE FUNCTION update_dispute_vote_counts();

-- Function to update dispute comment count
CREATE OR REPLACE FUNCTION update_dispute_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE disputes
  SET
    comment_count = (
      SELECT COUNT(*) FROM dispute_comments WHERE dispute_id = NEW.dispute_id
    ),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.dispute_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update comment count
CREATE TRIGGER trigger_update_dispute_comment_count
AFTER INSERT OR UPDATE OR DELETE ON dispute_comments
FOR EACH ROW
EXECUTE FUNCTION update_dispute_comment_count();

-- Function to update dispute evidence count
CREATE OR REPLACE FUNCTION update_dispute_evidence_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE disputes
  SET
    evidence_count = (
      SELECT COUNT(*) FROM dispute_evidence WHERE dispute_id = NEW.dispute_id
    ),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.dispute_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update evidence count
CREATE TRIGGER trigger_update_dispute_evidence_count
AFTER INSERT OR UPDATE OR DELETE ON dispute_evidence
FOR EACH ROW
EXECUTE FUNCTION update_dispute_evidence_count();

-- View for dispute summary
CREATE VIEW v_dispute_summary AS
SELECT
  d.id,
  d.chama_id,
  c.name as chama_name,
  d.filed_by_user_id,
  u1.full_name as filed_by_name,
  d.filed_against_user_id,
  u2.full_name as filed_against_name,
  d.dispute_type,
  d.title,
  d.status,
  d.priority,
  d.amount_disputed,
  d.evidence_count,
  d.comment_count,
  d.vote_count,
  d.votes_for,
  d.votes_against,
  d.votes_abstain,
  d.escalated_to_platform,
  d.created_at,
  d.resolved_at,
  CASE
    WHEN d.status = 'resolved' THEN 'resolved'
    WHEN d.status = 'closed' THEN 'closed'
    WHEN d.status = 'dismissed' THEN 'dismissed'
    WHEN d.escalated_to_platform = TRUE THEN 'escalated'
    WHEN d.status = 'voting' AND d.voting_deadline < NOW() THEN 'voting_expired'
    WHEN d.status = 'discussion' AND d.discussion_deadline < NOW() THEN 'discussion_expired'
    ELSE 'active'
  END as current_state
FROM disputes d
LEFT JOIN chamas c ON d.chama_id = c.id
LEFT JOIN users u1 ON d.filed_by_user_id = u1.id
LEFT JOIN users u2 ON d.filed_against_user_id = u2.id;

-- Add dispute history to chama reputation calculation (will be used by reputation service)
COMMENT ON TABLE disputes IS 'Dispute resolution system for handling conflicts in chamas';
COMMENT ON TABLE dispute_evidence IS 'Evidence submitted for disputes (documents, screenshots, etc.)';
COMMENT ON TABLE dispute_comments IS 'Discussion thread for disputes';
COMMENT ON TABLE dispute_votes IS 'Votes cast on dispute resolutions';
COMMENT ON TABLE dispute_resolutions IS 'Historical record of dispute resolutions';
COMMENT ON TABLE dispute_escalations IS 'Platform escalations for unresolved disputes';

