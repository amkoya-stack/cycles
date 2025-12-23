-- Migration 018: Governance & Voting System
-- Democratic decision-making within chamas

-- Create enums for proposal and voting types
DROP TYPE IF EXISTS proposal_type CASCADE;
CREATE TYPE proposal_type AS ENUM (
  'use_funds',              -- Withdraw/use chama funds
  'accept_member',          -- Accept new member request
  'reject_member',          -- Reject member request
  'change_contribution',    -- Change contribution amount/frequency
  'make_investment',        -- Make group investment
  'expel_member',           -- Remove member from chama
  'update_constitution',    -- Update chama rules/constitution
  'change_role',            -- Change member role
  'approve_loan',           -- Approve large loan to member
  'dissolve_chama',         -- Dissolve the chama
  'other'                   -- Custom proposal
);

DROP TYPE IF EXISTS voting_type CASCADE;
CREATE TYPE voting_type AS ENUM (
  'simple_majority',            -- 50%+1
  'supermajority_66',          -- 66% required
  'supermajority_75',          -- 75% required
  'unanimous',                 -- 100% required
  'weighted_by_role',          -- Chair=2 votes, etc.
  'weighted_by_contribution',   -- Based on contribution history
  'weighted_by_reputation'     -- Based on reputation score (bronze=1, silver=2, gold=3, etc.)
);

DROP TYPE IF EXISTS vote_choice CASCADE;
CREATE TYPE vote_choice AS ENUM (
  'for',       -- Vote in favor
  'against',   -- Vote against
  'abstain'    -- Abstain from voting
);

DROP TYPE IF EXISTS proposal_status CASCADE;
CREATE TYPE proposal_status AS ENUM (
  'draft',      -- Being created
  'active',     -- Open for voting
  'passed',     -- Vote passed but not executed
  'failed',     -- Vote failed
  'executed',   -- Vote passed and executed
  'cancelled'   -- Cancelled by creator/admin
);

DROP TYPE IF EXISTS voting_result CASCADE;
CREATE TYPE voting_result AS ENUM (
  'passed',
  'failed',
  'tied'
);

-- Proposals table
DROP TABLE IF EXISTS voting_results CASCADE;
DROP TABLE IF EXISTS proposal_discussions CASCADE;
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS proposals CASCADE;

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Proposal details
  proposal_type proposal_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,  -- Type-specific data (amount, member_id, etc.)
  
  -- Voting configuration
  voting_type voting_type NOT NULL DEFAULT 'simple_majority',
  required_percentage DECIMAL(5,2) DEFAULT 50.01,  -- Percentage needed to pass
  anonymous BOOLEAN DEFAULT false,                  -- Hide voter identities
  allow_vote_change BOOLEAN DEFAULT true,           -- Allow changing vote before deadline
  deadline TIMESTAMP NOT NULL,                      -- Voting deadline
  
  -- Status
  status proposal_status NOT NULL DEFAULT 'draft',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  
  -- Indexes
  CONSTRAINT valid_percentage CHECK (required_percentage >= 0 AND required_percentage <= 100)
);

DROP INDEX IF EXISTS idx_proposals_chama;
CREATE INDEX idx_proposals_chama ON proposals(chama_id);
DROP INDEX IF EXISTS idx_proposals_status;
CREATE INDEX idx_proposals_status ON proposals(status);
DROP INDEX IF EXISTS idx_proposals_deadline;
CREATE INDEX idx_proposals_deadline ON proposals(deadline);
DROP INDEX IF EXISTS idx_proposals_type;
CREATE INDEX idx_proposals_type ON proposals(proposal_type);
DROP INDEX IF EXISTS idx_proposals_created_by;
CREATE INDEX idx_proposals_created_by ON proposals(created_by);

-- Votes table
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Vote details
  vote vote_choice NOT NULL,
  weight DECIMAL(10,2) DEFAULT 1.00,  -- Vote weight (for weighted voting)
  delegate_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- Proxy voter
  reason TEXT,  -- Optional reason/comment
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- One vote per user per proposal
  CONSTRAINT unique_vote_per_user UNIQUE (proposal_id, user_id)
);

DROP INDEX IF EXISTS idx_votes_proposal;
CREATE INDEX idx_votes_proposal ON votes(proposal_id);
DROP INDEX IF EXISTS idx_votes_user;
CREATE INDEX idx_votes_user ON votes(user_id);
DROP INDEX IF EXISTS idx_votes_delegate;
CREATE INDEX idx_votes_delegate ON votes(delegate_id);

-- Proposal discussions
CREATE TABLE IF NOT EXISTS proposal_discussions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Discussion content
  comment TEXT NOT NULL,
  parent_id UUID REFERENCES proposal_discussions(id) ON DELETE CASCADE,  -- For threaded replies
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DROP INDEX IF EXISTS idx_proposal_discussions_proposal;
CREATE INDEX idx_proposal_discussions_proposal ON proposal_discussions(proposal_id);
DROP INDEX IF EXISTS idx_proposal_discussions_user;
CREATE INDEX idx_proposal_discussions_user ON proposal_discussions(user_id);
DROP INDEX IF EXISTS idx_proposal_discussions_parent;
CREATE INDEX idx_proposal_discussions_parent ON proposal_discussions(parent_id);

-- Voting results (calculated and stored when proposal closes)
CREATE TABLE IF NOT EXISTS voting_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE UNIQUE,
  
  -- Vote counts
  total_eligible_voters INTEGER NOT NULL,
  total_votes_cast INTEGER NOT NULL,
  votes_for INTEGER NOT NULL DEFAULT 0,
  votes_against INTEGER NOT NULL DEFAULT 0,
  votes_abstain INTEGER NOT NULL DEFAULT 0,
  
  -- Weighted votes (if applicable)
  weighted_votes_for DECIMAL(10,2) DEFAULT 0,
  weighted_votes_against DECIMAL(10,2) DEFAULT 0,
  weighted_votes_abstain DECIMAL(10,2) DEFAULT 0,
  
  -- Result
  result voting_result NOT NULL,
  percentage_for DECIMAL(5,2),
  percentage_against DECIMAL(5,2),
  
  -- Execution
  executed BOOLEAN DEFAULT false,
  executed_at TIMESTAMP,
  execution_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

DROP INDEX IF EXISTS idx_voting_results_proposal;
CREATE INDEX idx_voting_results_proposal ON voting_results(proposal_id);
DROP INDEX IF EXISTS idx_voting_results_result;
CREATE INDEX idx_voting_results_result ON voting_results(result);

-- Function to calculate vote weights based on voting type
CREATE OR REPLACE FUNCTION calculate_vote_weight(
  p_voting_type voting_type,
  p_user_id UUID,
  p_chama_id UUID
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
  v_weight DECIMAL(10,2) := 1.00;
  v_role VARCHAR(50);
  v_total_contributions DECIMAL(15,2);
  v_all_contributions DECIMAL(15,2);
BEGIN
  -- Get member role
  SELECT role INTO v_role
  FROM chama_members
  WHERE user_id = p_user_id AND chama_id = p_chama_id AND status = 'active';
  
  CASE p_voting_type
    WHEN 'simple_majority', 'supermajority_66', 'supermajority_75', 'unanimous' THEN
      v_weight := 1.00;
      
    WHEN 'weighted_by_role' THEN
      -- Chairperson = 2x, Secretary/Treasurer = 1.5x, others = 1x
      CASE v_role
        WHEN 'chairperson' THEN v_weight := 2.00;
        WHEN 'secretary', 'treasurer' THEN v_weight := 1.50;
        ELSE v_weight := 1.00;
      END CASE;
      
    WHEN 'weighted_by_contribution' THEN
      -- Weight based on contribution percentage
      -- Get user's total contributions
      SELECT COALESCE(SUM(amount), 0) INTO v_total_contributions
      FROM contributions
      WHERE user_id = p_user_id AND chama_id = p_chama_id AND status = 'completed';
      
      -- Get all contributions for the chama
      SELECT COALESCE(SUM(amount), 0) INTO v_all_contributions
      FROM contributions
      WHERE chama_id = p_chama_id AND status = 'completed';
      
      -- Calculate weight as percentage (minimum 0.1, maximum 10.0)
      IF v_all_contributions > 0 THEN
        v_weight := GREATEST(0.1, LEAST(10.0, (v_total_contributions / v_all_contributions) * 100));
      ELSE
        v_weight := 1.00;
      END IF;
      
    WHEN 'weighted_by_reputation' THEN
      -- Weight based on reputation tier (Bronze=1, Silver=2, Gold=3, Platinum=4, Diamond=5)
      DECLARE
        v_reputation_tier VARCHAR(20);
      BEGIN
        SELECT 
          CASE 
            WHEN u.reputation_score >= 1000 THEN 'diamond'
            WHEN u.reputation_score >= 750 THEN 'platinum' 
            WHEN u.reputation_score >= 500 THEN 'gold'
            WHEN u.reputation_score >= 250 THEN 'silver'
            ELSE 'bronze'
          END INTO v_reputation_tier
        FROM users u 
        WHERE u.id = p_user_id;
        
        CASE v_reputation_tier
          WHEN 'diamond' THEN v_weight := 5.00;
          WHEN 'platinum' THEN v_weight := 4.00;
          WHEN 'gold' THEN v_weight := 3.00;
          WHEN 'silver' THEN v_weight := 2.00;
          ELSE v_weight := 1.00; -- bronze or no reputation
        END CASE;
      END;
  END CASE;
  
  RETURN v_weight;
END;
$$;

-- Function to close proposal and calculate results
CREATE OR REPLACE FUNCTION close_proposal_and_calculate_results(
  p_proposal_id UUID
)
RETURNS voting_result
LANGUAGE plpgsql
AS $$
DECLARE
  v_chama_id UUID;
  v_voting_type voting_type;
  v_required_percentage DECIMAL(5,2);
  v_total_eligible INTEGER;
  v_total_cast INTEGER;
  v_votes_for INTEGER;
  v_votes_against INTEGER;
  v_votes_abstain INTEGER;
  v_weighted_for DECIMAL(10,2);
  v_weighted_against DECIMAL(10,2);
  v_weighted_abstain DECIMAL(10,2);
  v_total_weight DECIMAL(10,2);
  v_percentage_for DECIMAL(5,2);
  v_percentage_against DECIMAL(5,2);
  v_result voting_result;
BEGIN
  -- Get proposal details
  SELECT chama_id, voting_type, required_percentage
  INTO v_chama_id, v_voting_type, v_required_percentage
  FROM proposals
  WHERE id = p_proposal_id;
  
  -- Count eligible voters (active members)
  SELECT COUNT(*) INTO v_total_eligible
  FROM chama_members
  WHERE chama_id = v_chama_id AND status = 'active';
  
  -- Count votes
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE vote = 'for'),
    COUNT(*) FILTER (WHERE vote = 'against'),
    COUNT(*) FILTER (WHERE vote = 'abstain'),
    COALESCE(SUM(weight) FILTER (WHERE vote = 'for'), 0),
    COALESCE(SUM(weight) FILTER (WHERE vote = 'against'), 0),
    COALESCE(SUM(weight) FILTER (WHERE vote = 'abstain'), 0),
    COALESCE(SUM(weight), 0)
  INTO v_total_cast, v_votes_for, v_votes_against, v_votes_abstain,
       v_weighted_for, v_weighted_against, v_weighted_abstain, v_total_weight
  FROM votes
  WHERE proposal_id = p_proposal_id;
  
  -- Calculate percentages based on voting type
  IF v_voting_type IN ('weighted_by_role', 'weighted_by_contribution', 'weighted_by_reputation') THEN
    -- Use weighted votes
    IF v_total_weight > 0 THEN
      v_percentage_for := (v_weighted_for / v_total_weight) * 100;
      v_percentage_against := (v_weighted_against / v_total_weight) * 100;
    ELSE
      v_percentage_for := 0;
      v_percentage_against := 0;
    END IF;
  ELSE
    -- Use simple vote counts
    IF v_total_cast > 0 THEN
      v_percentage_for := (v_votes_for::DECIMAL / v_total_cast) * 100;
      v_percentage_against := (v_votes_against::DECIMAL / v_total_cast) * 100;
    ELSE
      v_percentage_for := 0;
      v_percentage_against := 0;
    END IF;
  END IF;
  
  -- Determine result
  IF v_voting_type = 'unanimous' THEN
    -- All voters must vote for
    IF v_votes_for = v_total_eligible AND v_votes_against = 0 THEN
      v_result := 'passed';
    ELSE
      v_result := 'failed';
    END IF;
  ELSIF v_percentage_for >= v_required_percentage THEN
    v_result := 'passed';
  ELSIF v_percentage_for = v_percentage_against THEN
    v_result := 'tied';
  ELSE
    v_result := 'failed';
  END IF;
  
  -- Store results
  INSERT INTO voting_results (
    proposal_id,
    total_eligible_voters,
    total_votes_cast,
    votes_for,
    votes_against,
    votes_abstain,
    weighted_votes_for,
    weighted_votes_against,
    weighted_votes_abstain,
    result,
    percentage_for,
    percentage_against
  ) VALUES (
    p_proposal_id,
    v_total_eligible,
    v_total_cast,
    v_votes_for,
    v_votes_against,
    v_votes_abstain,
    v_weighted_for,
    v_weighted_against,
    v_weighted_abstain,
    v_result,
    v_percentage_for,
    v_percentage_against
  )
  ON CONFLICT (proposal_id) DO UPDATE SET
    total_eligible_voters = EXCLUDED.total_eligible_voters,
    total_votes_cast = EXCLUDED.total_votes_cast,
    votes_for = EXCLUDED.votes_for,
    votes_against = EXCLUDED.votes_against,
    votes_abstain = EXCLUDED.votes_abstain,
    weighted_votes_for = EXCLUDED.weighted_votes_for,
    weighted_votes_against = EXCLUDED.weighted_votes_against,
    weighted_votes_abstain = EXCLUDED.weighted_votes_abstain,
    result = EXCLUDED.result,
    percentage_for = EXCLUDED.percentage_for,
    percentage_against = EXCLUDED.percentage_against;
  
  -- Update proposal status
  UPDATE proposals
  SET 
    status = CASE 
      WHEN v_result = 'passed' THEN 'passed'::proposal_status
      ELSE 'failed'::proposal_status
    END,
    closed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_proposal_id;
  
  RETURN v_result;
END;
$$;

-- Trigger to update proposal updated_at
CREATE OR REPLACE FUNCTION update_proposal_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_proposal_timestamp ON proposals;
CREATE TRIGGER trigger_update_proposal_timestamp
BEFORE UPDATE ON proposals
FOR EACH ROW
EXECUTE FUNCTION update_proposal_timestamp();

-- Trigger to update vote updated_at
CREATE OR REPLACE FUNCTION update_vote_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vote_timestamp ON votes;
CREATE TRIGGER trigger_update_vote_timestamp
BEFORE UPDATE ON votes
FOR EACH ROW
EXECUTE FUNCTION update_vote_timestamp();

-- Trigger to update discussion updated_at
CREATE OR REPLACE FUNCTION update_discussion_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_discussion_timestamp ON proposal_discussions;
CREATE TRIGGER trigger_update_discussion_timestamp
BEFORE UPDATE ON proposal_discussions
FOR EACH ROW
EXECUTE FUNCTION update_discussion_timestamp();

-- Helper function to get current user ID for RLS
CREATE OR REPLACE FUNCTION app_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '')::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Row-level security policies
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_results ENABLE ROW LEVEL SECURITY;

-- Proposals: Members can see proposals for their chamas
DROP POLICY IF EXISTS proposals_member_access ON proposals;
CREATE POLICY proposals_member_access ON proposals
FOR SELECT
USING (
  app_user_id() IS NOT NULL AND
  chama_id IN (
    SELECT chama_id FROM chama_members
    WHERE user_id = app_user_id() AND status = 'active'
  )
);

-- Proposals: System context bypasses RLS
DROP POLICY IF EXISTS proposals_system_access ON proposals;
CREATE POLICY proposals_system_access ON proposals
FOR ALL
USING (current_setting('app.bypass_rls', true) = 'true');

-- Votes: Users can see their own votes, or all votes if not anonymous
DROP POLICY IF EXISTS votes_member_access ON votes;
CREATE POLICY votes_member_access ON votes
FOR SELECT
USING (
  app_user_id() IS NOT NULL AND
  (
    user_id = app_user_id() OR
    proposal_id IN (
      SELECT id FROM proposals
      WHERE anonymous = false AND chama_id IN (
        SELECT chama_id FROM chama_members
        WHERE user_id = app_user_id() AND status = 'active'
      )
    )
  )
);

DROP POLICY IF EXISTS votes_system_access ON votes;
CREATE POLICY votes_system_access ON votes
FOR ALL
USING (current_setting('app.bypass_rls', true) = 'true');

-- Discussions: Members can see discussions for their chamas
DROP POLICY IF EXISTS discussions_member_access ON proposal_discussions;
CREATE POLICY discussions_member_access ON proposal_discussions
FOR SELECT
USING (
  app_user_id() IS NOT NULL AND
  proposal_id IN (
    SELECT id FROM proposals
    WHERE chama_id IN (
      SELECT chama_id FROM chama_members
      WHERE user_id = app_user_id() AND status = 'active'
    )
  )
);

DROP POLICY IF EXISTS discussions_system_access ON proposal_discussions;
CREATE POLICY discussions_system_access ON proposal_discussions
FOR ALL
USING (current_setting('app.bypass_rls', true) = 'true');

-- Results: Members can see results for their chamas
DROP POLICY IF EXISTS results_member_access ON voting_results;
CREATE POLICY results_member_access ON voting_results
FOR SELECT
USING (
  app_user_id() IS NOT NULL AND
  proposal_id IN (
    SELECT id FROM proposals
    WHERE chama_id IN (
      SELECT chama_id FROM chama_members
      WHERE user_id = app_user_id() AND status = 'active'
    )
  )
);

DROP POLICY IF EXISTS results_system_access ON voting_results;
CREATE POLICY results_system_access ON voting_results
FOR ALL
USING (current_setting('app.bypass_rls', true) = 'true');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON proposals TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON votes TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON proposal_discussions TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON voting_results TO postgres;
