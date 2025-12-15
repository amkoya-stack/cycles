-- Add social media and website fields to users table

BEGIN;

-- Add social media columns if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS facebook TEXT,
ADD COLUMN IF NOT EXISTS twitter TEXT,
ADD COLUMN IF NOT EXISTS linkedin TEXT;

COMMIT;
