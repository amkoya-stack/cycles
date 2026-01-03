-- ============================================================================
-- LOAN REPAYMENT REMINDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS loan_repayment_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    repayment_id UUID NOT NULL REFERENCES loan_repayments(id) ON DELETE CASCADE,
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    borrower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL, -- before_due, due_date, overdue
    days_offset INT NOT NULL, -- 3 for "3 days before", 0 for "due date", -1 for "1 day overdue"
    channel TEXT NOT NULL, -- sms, email, push, whatsapp
    status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, skipped
    scheduled_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    failed_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_loan_reminder_type CHECK (reminder_type IN ('before_due', 'due_date', 'overdue')),
    CONSTRAINT valid_loan_reminder_channel CHECK (channel IN ('sms', 'email', 'push', 'whatsapp')),
    CONSTRAINT valid_loan_reminder_status CHECK (status IN ('pending', 'sent', 'failed', 'skipped'))
);

-- Indexes for loan_repayment_reminders
CREATE INDEX IF NOT EXISTS idx_loan_reminders_loan ON loan_repayment_reminders(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_reminders_repayment ON loan_repayment_reminders(repayment_id);
CREATE INDEX IF NOT EXISTS idx_loan_reminders_chama ON loan_repayment_reminders(chama_id);
CREATE INDEX IF NOT EXISTS idx_loan_reminders_borrower ON loan_repayment_reminders(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loan_reminders_status ON loan_repayment_reminders(status);
CREATE INDEX IF NOT EXISTS idx_loan_reminders_scheduled ON loan_repayment_reminders(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_loan_reminders_pending ON loan_repayment_reminders(status, scheduled_at) WHERE status = 'pending';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_loan_reminder_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_loan_reminder_updated_at
    BEFORE UPDATE ON loan_repayment_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_loan_reminder_updated_at();

