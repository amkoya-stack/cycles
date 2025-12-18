-- Migration 014: Reputation & Badges System
-- Gamified trust system for lending eligibility

-- ==========================================
-- BADGES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  tier VARCHAR(20) CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  icon_url TEXT,
  points_required INTEGER DEFAULT 0,
  criteria JSONB, -- Specific criteria for special badges
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default tier badges
INSERT INTO badges (code, name, description, tier, points_required, criteria) VALUES
  ('BRONZE_MEMBER', 'Bronze Member', 'Starter badge for new members', 'bronze', 0, '{"type": "tier"}'),
  ('SILVER_MEMBER', 'Silver Member', 'Consistent contributor', 'silver', 200, '{"type": "tier"}'),
  ('GOLD_MEMBER', 'Gold Member', 'Reliable and active member', 'gold', 400, '{"type": "tier"}'),
  ('PLATINUM_MEMBER', 'Platinum Member', 'Exemplary member with excellent track record', 'platinum', 600, '{"type": "tier"}'),
  ('DIAMOND_MEMBER', 'Diamond Member', 'Elite member with outstanding reputation', 'diamond', 800, '{"type": "tier"}'),
  
  -- Special achievement badges
  ('EARLY_BIRD', 'Early Bird', 'Consistently makes early payments', 'gold', 0, '{"type": "achievement", "criteria": "early_payment_count >= 10"}'),
  ('PERFECT_ATTENDANCE', 'Perfect Attendance', 'Never missed a meeting for 6 months', 'gold', 0, '{"type": "achievement", "criteria": "perfect_attendance_months >= 6"}'),
  ('ZERO_DEFAULTS', 'Zero Defaults', 'Never defaulted on a loan', 'platinum', 0, '{"type": "achievement", "criteria": "loan_default_count = 0 AND completed_loans >= 3"}'),
  ('STREAK_MASTER', 'Streak Master', 'Never missed a contribution for 12 months', 'platinum', 0, '{"type": "achievement", "criteria": "contribution_streak_months >= 12"}'),
  ('TOP_CONTRIBUTOR', 'Top Contributor', 'In top 10% of contributors', 'diamond', 0, '{"type": "achievement", "criteria": "contribution_percentile >= 90"}')
ON CONFLICT (code) DO NOTHING;

-- ==========================================
-- REPUTATION SCORES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS reputation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chama_id UUID REFERENCES chamas(id) ON DELETE CASCADE,
  
  -- Total score (0-1000 scale)
  total_score INTEGER DEFAULT 0,
  
  -- Score breakdown
  contribution_score INTEGER DEFAULT 0, -- 40% weight (0-400)
  loan_repayment_score INTEGER DEFAULT 0, -- 30% weight (0-300)
  meeting_attendance_score INTEGER DEFAULT 0, -- 10% weight (0-100)
  voting_participation_score INTEGER DEFAULT 0, -- 10% weight (0-100)
  dispute_penalty INTEGER DEFAULT 0, -- 10% negative (0-100)
  
  -- Tier level
  tier VARCHAR(20) DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  
  -- Tracking metrics
  contribution_consistency_rate DECIMAL(5,2) DEFAULT 0, -- Percentage of on-time contributions
  loan_repayment_rate DECIMAL(5,2) DEFAULT 0, -- Percentage of on-time loan repayments
  meeting_attendance_rate DECIMAL(5,2) DEFAULT 0, -- Percentage of meetings attended
  voting_rate DECIMAL(5,2) DEFAULT 0, -- Percentage of votes participated in
  dispute_count INTEGER DEFAULT 0,
  
  -- Streak tracking
  contribution_streak_months INTEGER DEFAULT 0,
  early_payment_count INTEGER DEFAULT 0,
  perfect_attendance_months INTEGER DEFAULT 0,
  
  -- Loan history
  completed_loans INTEGER DEFAULT 0,
  loan_default_count INTEGER DEFAULT 0,
  
  last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, chama_id)
);

CREATE INDEX idx_reputation_scores_user ON reputation_scores(user_id);
CREATE INDEX idx_reputation_scores_chama ON reputation_scores(chama_id);
CREATE INDEX idx_reputation_scores_total ON reputation_scores(total_score DESC);
CREATE INDEX idx_reputation_scores_tier ON reputation_scores(tier);

-- ==========================================
-- BADGE AWARDS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS badge_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chama_id UUID REFERENCES chamas(id) ON DELETE CASCADE,
  
  awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata about the award
  award_reason TEXT,
  awarded_by_system BOOLEAN DEFAULT true,
  
  UNIQUE(badge_id, user_id, chama_id)
);

CREATE INDEX idx_badge_awards_user ON badge_awards(user_id);
CREATE INDEX idx_badge_awards_chama ON badge_awards(chama_id);
CREATE INDEX idx_badge_awards_active ON badge_awards(is_active) WHERE is_active = true;

-- ==========================================
-- REPUTATION EVENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS reputation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chama_id UUID REFERENCES chamas(id) ON DELETE CASCADE,
  
  event_type VARCHAR(50) NOT NULL, -- 'contribution', 'loan_repayment', 'meeting_attendance', 'voting', 'dispute'
  event_subtype VARCHAR(50), -- 'on_time', 'early', 'late', 'missed', 'defaulted'
  
  points_change INTEGER NOT NULL, -- Positive or negative
  score_before INTEGER,
  score_after INTEGER,
  
  description TEXT,
  metadata JSONB, -- Additional context about the event
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reputation_events_user ON reputation_events(user_id);
CREATE INDEX idx_reputation_events_chama ON reputation_events(chama_id);
CREATE INDEX idx_reputation_events_type ON reputation_events(event_type);
CREATE INDEX idx_reputation_events_created ON reputation_events(created_at DESC);

-- ==========================================
-- CHAMA REPUTATION TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS chama_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID UNIQUE NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
  
  -- Overall chama score (0-1000)
  total_score INTEGER DEFAULT 500,
  
  -- Score breakdown
  member_retention_score INTEGER DEFAULT 0, -- 30% weight
  loan_default_score INTEGER DEFAULT 0, -- 30% weight
  investment_performance_score INTEGER DEFAULT 0, -- 20% weight
  activity_level_score INTEGER DEFAULT 0, -- 20% weight
  
  -- Metrics
  member_retention_rate DECIMAL(5,2) DEFAULT 0, -- % of members who stay > 6 months
  loan_default_rate DECIMAL(5,2) DEFAULT 0, -- % of loans that defaulted
  avg_roi DECIMAL(5,2) DEFAULT 0, -- Average return on investment
  activity_score INTEGER DEFAULT 0, -- Based on meetings, contributions, transactions
  
  -- Member stats
  total_members INTEGER DEFAULT 0,
  active_members INTEGER DEFAULT 0, -- Contributed in last 30 days
  departed_members INTEGER DEFAULT 0,
  
  -- Financial stats
  total_loans_issued INTEGER DEFAULT 0,
  total_loans_defaulted INTEGER DEFAULT 0,
  total_amount_disbursed DECIMAL(15,2) DEFAULT 0,
  total_amount_recovered DECIMAL(15,2) DEFAULT 0,
  
  -- Activity stats
  total_meetings INTEGER DEFAULT 0,
  total_contributions INTEGER DEFAULT 0,
  days_since_last_activity INTEGER DEFAULT 0,
  
  last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chama_reputation_score ON chama_reputation(total_score DESC);

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Update reputation_scores updated_at timestamp
CREATE OR REPLACE FUNCTION update_reputation_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reputation_scores_updated_at
  BEFORE UPDATE ON reputation_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_reputation_scores_updated_at();

-- Update chama_reputation updated_at timestamp
CREATE OR REPLACE FUNCTION update_chama_reputation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chama_reputation_updated_at
  BEFORE UPDATE ON chama_reputation
  FOR EACH ROW
  EXECUTE FUNCTION update_chama_reputation_updated_at();

-- ==========================================
-- VIEWS
-- ==========================================

-- Leaderboard view for chama members
CREATE OR REPLACE VIEW chama_leaderboard AS
SELECT 
  rs.chama_id,
  rs.user_id,
  u.full_name,
  u.email,
  rs.total_score,
  rs.tier,
  rs.contribution_consistency_rate,
  rs.loan_repayment_rate,
  rs.contribution_streak_months,
  COUNT(ba.id) FILTER (WHERE ba.is_active = true) as active_badges_count,
  RANK() OVER (PARTITION BY rs.chama_id ORDER BY rs.total_score DESC) as rank
FROM reputation_scores rs
JOIN users u ON rs.user_id = u.id
LEFT JOIN badge_awards ba ON ba.user_id = rs.user_id AND ba.chama_id = rs.chama_id AND ba.is_active = true
GROUP BY rs.chama_id, rs.user_id, u.full_name, u.email, rs.total_score, rs.tier, 
         rs.contribution_consistency_rate, rs.loan_repayment_rate, rs.contribution_streak_months;

-- User badge summary view
CREATE OR REPLACE VIEW user_badges_summary AS
SELECT 
  ba.user_id,
  ba.chama_id,
  COUNT(*) as total_badges,
  COUNT(*) FILTER (WHERE b.tier = 'bronze') as bronze_badges,
  COUNT(*) FILTER (WHERE b.tier = 'silver') as silver_badges,
  COUNT(*) FILTER (WHERE b.tier = 'gold') as gold_badges,
  COUNT(*) FILTER (WHERE b.tier = 'platinum') as platinum_badges,
  COUNT(*) FILTER (WHERE b.tier = 'diamond') as diamond_badges,
  MAX(ba.awarded_at) as last_badge_awarded_at
FROM badge_awards ba
JOIN badges b ON ba.badge_id = b.id
WHERE ba.is_active = true
GROUP BY ba.user_id, ba.chama_id;

COMMENT ON TABLE reputation_scores IS 'Individual user reputation scores within each chama';
COMMENT ON TABLE badges IS 'Available badges and their criteria';
COMMENT ON TABLE badge_awards IS 'Badges awarded to users';
COMMENT ON TABLE reputation_events IS 'Historical log of reputation-affecting events';
COMMENT ON TABLE chama_reputation IS 'Overall reputation score for each chama';
