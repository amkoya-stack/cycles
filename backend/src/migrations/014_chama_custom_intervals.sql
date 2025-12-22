-- Add Custom Interval Support to Chamas Table
-- Allows chamas to have custom contribution intervals (every X days)

-- Add interval_days column to chamas table
ALTER TABLE chamas 
ADD COLUMN IF NOT EXISTS interval_days INT DEFAULT 7; -- Default to weekly (7 days)

-- Add constraint to ensure interval_days is reasonable (1-365 days)
ALTER TABLE chamas
ADD CONSTRAINT valid_chama_interval_days CHECK (interval_days >= 1 AND interval_days <= 365);

-- Update existing chamas to have appropriate interval_days based on their frequency
UPDATE chamas SET 
  interval_days = CASE 
    WHEN contribution_frequency = 'daily' THEN 1
    WHEN contribution_frequency = 'weekly' THEN 7 
    WHEN contribution_frequency = 'biweekly' THEN 14
    WHEN contribution_frequency = 'monthly' THEN 30
    ELSE 7 -- Default to weekly for custom/unknown frequencies
  END;

-- Add comment for clarity
COMMENT ON COLUMN chamas.interval_days IS 'Number of days between contributions (1=daily, 7=weekly, 30=monthly, etc.)';

-- Create index for querying by interval
CREATE INDEX IF NOT EXISTS idx_chamas_interval ON chamas(interval_days);