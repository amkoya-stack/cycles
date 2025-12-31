-- ============================================================================
-- Migration: 037_add_repayment_frequency_external.sql
-- Description: Add repayment_frequency column to external_loan_applications
-- ============================================================================

-- Add repayment_frequency column to external_loan_applications
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'external_loan_applications' 
        AND column_name = 'repayment_frequency'
    ) THEN
        ALTER TABLE external_loan_applications 
        ADD COLUMN repayment_frequency VARCHAR(10) DEFAULT 'monthly' 
        CHECK (repayment_frequency IN ('daily', 'weekly', 'biweekly', 'monthly'));
    END IF;
END $$;

-- Update existing records to have default value
UPDATE external_loan_applications 
SET repayment_frequency = 'monthly' 
WHERE repayment_frequency IS NULL;

-- Make it NOT NULL after setting defaults
ALTER TABLE external_loan_applications 
ALTER COLUMN repayment_frequency SET NOT NULL;

COMMENT ON COLUMN external_loan_applications.repayment_frequency IS 'Frequency of loan repayments: daily, weekly, biweekly, or monthly';

