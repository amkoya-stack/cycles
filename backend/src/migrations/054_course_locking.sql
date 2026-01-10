-- Migration 054: Add course locking by reputation tier or price
-- Allow courses to be locked behind reputation requirements or paid access

-- Add lock type enum
DO $$ BEGIN
  CREATE TYPE course_lock_type AS ENUM ('none', 'reputation', 'price', 'both');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add locking fields to classroom_courses
ALTER TABLE classroom_courses
ADD COLUMN IF NOT EXISTS lock_type course_lock_type DEFAULT 'none',
ADD COLUMN IF NOT EXISTS required_reputation_tier VARCHAR(50) CHECK (required_reputation_tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
ADD COLUMN IF NOT EXISTS unlock_price DECIMAL(10, 2) CHECK (unlock_price IS NULL OR unlock_price >= 5);

-- Add index for filtering locked courses
CREATE INDEX IF NOT EXISTS idx_classroom_courses_lock_type ON classroom_courses(lock_type) WHERE lock_type != 'none';
CREATE INDEX IF NOT EXISTS idx_classroom_courses_reputation_tier ON classroom_courses(required_reputation_tier) WHERE required_reputation_tier IS NOT NULL;

-- Table to track course purchases/unlocks
CREATE TABLE IF NOT EXISTS course_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES classroom_courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Unlock method
  unlock_method VARCHAR(20) NOT NULL CHECK (unlock_method IN ('reputation', 'purchase')),
  
  -- Payment info (if purchased)
  payment_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  amount_paid DECIMAL(10, 2),
  
  -- Reputation at time of unlock (if unlocked via reputation)
  reputation_tier VARCHAR(50),
  reputation_score DECIMAL(10, 2),
  
  -- Metadata
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_user_course_unlock UNIQUE (course_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_course_unlocks_user ON course_unlocks(user_id);
CREATE INDEX IF NOT EXISTS idx_course_unlocks_course ON course_unlocks(course_id);
CREATE INDEX IF NOT EXISTS idx_course_unlocks_user_course ON course_unlocks(user_id, course_id);

-- Enable RLS
ALTER TABLE course_unlocks ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own unlocks
DROP POLICY IF EXISTS view_own_unlocks ON course_unlocks;
CREATE POLICY view_own_unlocks ON course_unlocks
FOR SELECT
USING (user_id = current_setting('app.user_id')::UUID);

-- RLS: System can insert unlocks (handled by service layer)
DROP POLICY IF EXISTS insert_course_unlocks ON course_unlocks;
CREATE POLICY insert_course_unlocks ON course_unlocks
FOR INSERT
WITH CHECK (user_id = current_setting('app.user_id')::UUID);

