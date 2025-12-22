-- Multi-frequency Auto-Debit Support
-- Enhances auto-debit system to support daily, 2-day, 3-day, weekly, biweekly, monthly frequencies

-- Add new columns for frequency-specific scheduling
ALTER TABLE contribution_auto_debits 
ADD COLUMN IF NOT EXISTS frequency_type TEXT DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS day_of_week INT, -- 0=Sunday, 1=Monday, ..., 6=Saturday (for weekly)
ADD COLUMN IF NOT EXISTS interval_days INT DEFAULT 1; -- For daily, 2-day, 3-day intervals

-- Update constraints
ALTER TABLE contribution_auto_debits 
DROP CONSTRAINT IF EXISTS valid_auto_debit_day,
ADD CONSTRAINT valid_frequency_type CHECK (frequency_type IN ('daily', '2-day', '3-day', 'weekly', 'biweekly', 'monthly')),
ADD CONSTRAINT valid_day_of_week CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
ADD CONSTRAINT valid_interval_days CHECK (interval_days >= 1 AND interval_days <= 30),
ADD CONSTRAINT valid_auto_debit_day_updated CHECK (auto_debit_day IS NULL OR (auto_debit_day >= 1 AND auto_debit_day <= 31));

-- Add comment for clarity
COMMENT ON COLUMN contribution_auto_debits.frequency_type IS 'Frequency of auto-debit: daily, 2-day, 3-day, weekly, biweekly, monthly';
COMMENT ON COLUMN contribution_auto_debits.day_of_week IS 'Day of week for weekly frequency (0=Sunday, 1=Monday, etc.)';  
COMMENT ON COLUMN contribution_auto_debits.interval_days IS 'Interval in days for daily/multi-day frequencies';
COMMENT ON COLUMN contribution_auto_debits.auto_debit_day IS 'Day of month for monthly/biweekly frequencies';

-- Create index for frequency queries
CREATE INDEX IF NOT EXISTS idx_auto_debits_frequency ON contribution_auto_debits(frequency_type);