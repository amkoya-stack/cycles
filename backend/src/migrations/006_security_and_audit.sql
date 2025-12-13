-- ==========================================
-- Migration 006: Security, Audit Logging & RLS
-- ==========================================

-- ==========================================
-- 1. AUDIT LOG TABLE
-- Immutable log of all ledger operations
-- ==========================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Operation details
    table_name VARCHAR(50) NOT NULL,
    operation VARCHAR(10) NOT NULL, -- SELECT, INSERT, UPDATE, DELETE
    record_id UUID,
    
    -- User context
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    
    -- Data snapshots
    old_data JSONB,
    new_data JSONB,
    
    -- Query metadata
    query_text TEXT,
    
    -- Timestamp (immutable)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Index for fast lookups
CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_operation ON audit_log(operation, table_name);

-- Make table append-only (no updates or deletes allowed)
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log is immutable. Operation % not allowed.', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_update
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_modification();

-- ==========================================
-- 2. AUDIT LOGGING TRIGGERS
-- Auto-log critical table changes
-- ==========================================

-- Function to log transactions
CREATE OR REPLACE FUNCTION audit_transactions()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_log (table_name, operation, record_id, user_id, new_data)
        VALUES ('transactions', TG_OP, NEW.id, NEW.initiated_by, to_jsonb(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_log (table_name, operation, record_id, user_id, old_data, new_data)
        VALUES ('transactions', TG_OP, NEW.id, NEW.initiated_by, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_transactions
AFTER INSERT OR UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION audit_transactions();

-- Function to log entries
CREATE OR REPLACE FUNCTION audit_entries()
RETURNS TRIGGER AS $$
DECLARE
    txn_user_id UUID;
BEGIN
    -- Get user_id from parent transaction
    SELECT initiated_by INTO txn_user_id FROM transactions WHERE id = NEW.transaction_id;
    
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_log (table_name, operation, record_id, user_id, new_data)
        VALUES ('entries', TG_OP, NEW.id, txn_user_id, to_jsonb(NEW));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_entries
AFTER INSERT ON entries
FOR EACH ROW
EXECUTE FUNCTION audit_entries();

-- Function to log account changes
CREATE OR REPLACE FUNCTION audit_accounts()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_log (table_name, operation, record_id, user_id, new_data)
        VALUES ('accounts', TG_OP, NEW.id, NEW.user_id, to_jsonb(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_log (table_name, operation, record_id, user_id, old_data, new_data)
        VALUES ('accounts', TG_OP, NEW.id, NEW.user_id, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_accounts
AFTER INSERT OR UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION audit_accounts();

-- ==========================================
-- 3. ROW-LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on critical tables
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own transactions
CREATE POLICY transactions_user_access ON transactions
    FOR SELECT
    USING (
        initiated_by = current_setting('app.current_user_id', true)::UUID
        OR EXISTS (
            SELECT 1 FROM accounts a 
            WHERE a.user_id = current_setting('app.current_user_id', true)::UUID
            AND (a.id IN (
                SELECT account_id FROM entries WHERE transaction_id = transactions.id
            ))
        )
    );

-- Policy: Users can only see entries for their accounts
CREATE POLICY entries_user_access ON entries
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM accounts a
            WHERE a.id = entries.account_id
            AND a.user_id = current_setting('app.current_user_id', true)::UUID
        )
    );

-- Policy: Users can only see their own accounts (chama visibility will be added when chama_members table exists)
CREATE POLICY accounts_user_access ON accounts
    FOR SELECT
    USING (
        user_id = current_setting('app.current_user_id', true)::UUID
    );

-- Policy: System operations bypass RLS (for ledger service)
CREATE POLICY system_full_access ON transactions
    FOR ALL
    USING (current_setting('app.bypass_rls', true) = 'true');

CREATE POLICY system_full_access_entries ON entries
    FOR ALL
    USING (current_setting('app.bypass_rls', true) = 'true');

CREATE POLICY system_full_access_accounts ON accounts
    FOR ALL
    USING (current_setting('app.bypass_rls', true) = 'true');

-- ==========================================
-- 4. RECONCILIATION TRACKING
-- ==========================================

-- Track external reconciliation events
CREATE TABLE reconciliation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Run details
    run_type VARCHAR(50) NOT NULL, -- 'daily', 'hourly', 'manual'
    status VARCHAR(20) NOT NULL, -- 'running', 'completed', 'failed'
    
    -- Balance checks
    ledger_balance DECIMAL(15, 2),
    external_balance DECIMAL(15, 2),
    difference DECIMAL(15, 2),
    is_balanced BOOLEAN,
    
    -- Mismatches found
    mismatch_count INTEGER DEFAULT 0,
    mismatches JSONB,
    
    -- Execution info
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    
    -- Metadata
    initiated_by UUID,
    metadata JSONB
);

CREATE INDEX idx_reconciliation_runs_status ON reconciliation_runs(status);
CREATE INDEX idx_reconciliation_runs_started ON reconciliation_runs(started_at DESC);

-- Track individual account reconciliation
CREATE TABLE reconciliation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_run_id UUID NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
    
    -- Account details
    account_id UUID NOT NULL REFERENCES accounts(id),
    account_number VARCHAR(50),
    account_name VARCHAR(255),
    
    -- Balance comparison
    ledger_balance DECIMAL(15, 2) NOT NULL,
    external_balance DECIMAL(15, 2),
    difference DECIMAL(15, 2),
    
    -- Status
    status VARCHAR(20) NOT NULL, -- 'matched', 'mismatch', 'pending'
    
    -- Metadata
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reconciliation_items_run ON reconciliation_items(reconciliation_run_id);
CREATE INDEX idx_reconciliation_items_account ON reconciliation_items(account_id);
CREATE INDEX idx_reconciliation_items_status ON reconciliation_items(status);

-- ==========================================
-- 5. HELPER FUNCTIONS
-- ==========================================

-- Function to set user context for RLS
CREATE OR REPLACE FUNCTION set_user_context(p_user_id UUID)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', p_user_id::TEXT, false);
END;
$$ LANGUAGE plpgsql;

-- Function to bypass RLS for system operations
CREATE OR REPLACE FUNCTION set_system_context()
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.bypass_rls', 'true', false);
END;
$$ LANGUAGE plpgsql;

-- Function to clear context
CREATE OR REPLACE FUNCTION clear_context()
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', '', false);
    PERFORM set_config('app.bypass_rls', '', false);
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- END OF MIGRATION
-- ==========================================
