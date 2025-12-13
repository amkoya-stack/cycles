-- ==========================================
-- Migration 007: M-Pesa Integration & Callbacks
-- ==========================================

-- M-Pesa callback tracking table
CREATE TABLE IF NOT EXISTS mpesa_callbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- M-Pesa identifiers
    checkout_request_id VARCHAR(255) UNIQUE NOT NULL,
    merchant_request_id VARCHAR(255),
    mpesa_receipt_number VARCHAR(255), -- Filled after success
    
    -- Transaction linking
    transaction_id UUID REFERENCES transactions(id),
    user_id UUID REFERENCES users(id),
    phone_number VARCHAR(20) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    
    -- Request/Response data
    result_code INTEGER,
    result_desc TEXT,
    callback_metadata JSONB, -- Full callback payload
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, completed, failed, cancelled
    transaction_type VARCHAR(20) NOT NULL, -- deposit, withdrawal
    
    -- Timestamps
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    callback_received_at TIMESTAMP,
    processed_at TIMESTAMP,
    
    -- Metadata
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX idx_mpesa_callbacks_checkout_request ON mpesa_callbacks(checkout_request_id);
CREATE INDEX idx_mpesa_callbacks_mpesa_receipt ON mpesa_callbacks(mpesa_receipt_number);
CREATE INDEX idx_mpesa_callbacks_transaction ON mpesa_callbacks(transaction_id);
CREATE INDEX idx_mpesa_callbacks_user ON mpesa_callbacks(user_id);
CREATE INDEX idx_mpesa_callbacks_status ON mpesa_callbacks(status);
CREATE INDEX idx_mpesa_callbacks_initiated ON mpesa_callbacks(initiated_at DESC);

-- ==========================================
-- M-Pesa Reconciliation Tracking
-- ==========================================

CREATE TABLE IF NOT EXISTS mpesa_reconciliation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reconciliation run details
    reconciliation_run_id UUID REFERENCES reconciliation_runs(id),
    mpesa_callback_id UUID REFERENCES mpesa_callbacks(id),
    ledger_transaction_id UUID REFERENCES transactions(id),
    
    -- Mismatch details
    status VARCHAR(20) NOT NULL, -- matched, missing_callback, missing_ledger, amount_mismatch
    expected_amount DECIMAL(15, 2),
    actual_amount DECIMAL(15, 2),
    difference DECIMAL(15, 2),
    
    -- Resolution
    resolution_status VARCHAR(20) DEFAULT 'pending', -- pending, resolved, escalated
    resolution_notes TEXT,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE INDEX idx_mpesa_reconciliation_run ON mpesa_reconciliation(reconciliation_run_id);
CREATE INDEX idx_mpesa_reconciliation_callback ON mpesa_reconciliation(mpesa_callback_id);
CREATE INDEX idx_mpesa_reconciliation_status ON mpesa_reconciliation(status);

-- ==========================================
-- Add M-Pesa specific fields to accounts
-- ==========================================

ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS mpesa_linked_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS mpesa_paybill VARCHAR(10),
ADD COLUMN IF NOT EXISTS mpesa_account_number VARCHAR(50);

-- ==========================================
-- Helper functions for M-Pesa operations
-- ==========================================

-- Function to get pending M-Pesa callbacks
CREATE OR REPLACE FUNCTION get_pending_mpesa_callbacks(hours_old INTEGER DEFAULT 24)
RETURNS SETOF mpesa_callbacks AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM mpesa_callbacks
    WHERE status = 'pending'
    AND initiated_at < NOW() - (hours_old || ' hours')::INTERVAL
    ORDER BY initiated_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to match M-Pesa callback to ledger transaction
CREATE OR REPLACE FUNCTION match_mpesa_to_ledger(
    p_checkout_request_id VARCHAR(255)
) RETURNS TABLE (
    callback_found BOOLEAN,
    transaction_found BOOLEAN,
    amounts_match BOOLEAN,
    callback_amount DECIMAL(15, 2),
    ledger_amount DECIMAL(15, 2)
) AS $$
DECLARE
    v_callback mpesa_callbacks%ROWTYPE;
    v_transaction transactions%ROWTYPE;
BEGIN
    -- Get callback
    SELECT * INTO v_callback 
    FROM mpesa_callbacks 
    WHERE checkout_request_id = p_checkout_request_id;
    
    callback_found := FOUND;
    
    IF callback_found THEN
        -- Get linked transaction
        SELECT * INTO v_transaction
        FROM transactions
        WHERE id = v_callback.transaction_id;
        
        transaction_found := FOUND;
        callback_amount := v_callback.amount;
        
        IF transaction_found THEN
            -- Get total amount from entries
            SELECT SUM(amount) INTO ledger_amount
            FROM entries
            WHERE transaction_id = v_transaction.id
            AND direction = 'credit';
            
            amounts_match := ABS(callback_amount - COALESCE(ledger_amount, 0)) < 0.01;
        END IF;
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- END OF MIGRATION
-- ==========================================
