-- Migration 009: Add activity_score column for chama ranking
-- Purpose: Enable top-rated and most-active filtering

-- Add activity_score column (0-100 scale)
ALTER TABLE chamas ADD COLUMN IF NOT EXISTS activity_score INTEGER DEFAULT 50 CHECK (activity_score >= 0 AND activity_score <= 100);

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_chamas_activity_score ON chamas(activity_score DESC);

-- Add additional columns for better search/display
ALTER TABLE chamas ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE chamas ADD COLUMN IF NOT EXISTS roi DECIMAL(5,2) DEFAULT 0.00; -- Return on Investment percentage

-- Update existing chamas to have default activity_score
UPDATE chamas SET activity_score = 50 WHERE activity_score IS NULL;

-- Add comment
COMMENT ON COLUMN chamas.activity_score IS 'Activity score 0-100, calculated based on member activity, contribution regularity, and chama age';
COMMENT ON COLUMN chamas.roi IS 'Estimated annual ROI percentage for investment chamas';
