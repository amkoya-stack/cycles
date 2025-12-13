-- ==========================================
-- Migration 001: Create Ledger System Tables
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. LEDGER TABLE
-- Represents the entire collection of accounts and transactions
-- ==========================================
CREATE TABLE ledgers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    currency VARCHAR(3) DEFAULT 'KES' NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Note: Do not reference other tables in CHECK constraints (Postgres limitation).
-- Balance sign validation is enforced in application/service and triggers.
-- ==========================================
-- 2. ACCOUNT TYPES TABLE
-- Defines the types of accounts in the system
-- ==========================================
CREATE TYPE account_normality AS ENUM ('debit', 'credit');
CREATE TYPE account_category AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

CREATE TABLE account_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category account_category NOT NULL,
    normality account_normality NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert system account types
INSERT INTO account_types (code, name, category, normality, description, is_system) VALUES
('CASH', 'Platform Cash Account', 'asset', 'debit', 'Platform funds held in partner banks', true),
('USER_WALLET', 'User Wallet Balance', 'liability', 'credit', 'User wallet balance held on behalf of users', true),
('CHAMA_WALLET', 'Chama Wallet Balance', 'liability', 'credit', 'Chama wallet balance held on behalf of groups', true),
('REVENUE_FEES', 'Fee Revenue', 'revenue', 'credit', 'Revenue from transaction fees', true),
('EQUITY', 'Founders Equity', 'equity', 'credit', 'Founder equity in the platform', true),
('EXPENSE_OPERATIONAL', 'Operational Expenses', 'expense', 'debit', 'Operating expenses (salaries, bills, etc)', true),
('EXPENSE_TAX', 'Tax Expenses', 'expense', 'debit', 'Tax payments', true),
('PENDING_DEPOSITS', 'Pending Deposits', 'liability', 'credit', 'Deposits awaiting confirmation', true),
('PENDING_WITHDRAWALS', 'Pending Withdrawals', 'asset', 'debit', 'Withdrawals awaiting processing', true);

-- ==========================================
-- 3. ACCOUNTS TABLE
-- Individual account instances
-- ==========================================
CREATE TYPE account_status AS ENUM ('active', 'frozen', 'closed');

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ledger_id UUID NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
    account_type_id UUID NOT NULL REFERENCES account_types(id),
    account_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    
    -- Link to user or chama (NULL for system accounts)
    user_id UUID,
    chama_id UUID,
    
    -- Account properties
    balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    available_balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    status account_status DEFAULT 'active',
    
    -- Metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_chama_id ON accounts(chama_id);
CREATE INDEX idx_accounts_type ON accounts(account_type_id);
CREATE INDEX idx_accounts_status ON accounts(status);

-- Create system accounts (one-time setup)
INSERT INTO accounts (ledger_id, account_type_id, account_number, name) 
SELECT 
    l.id,
    at.id,
    at.code,
    at.name
FROM ledgers l
CROSS JOIN account_types at
WHERE at.is_system = true AND at.code IN ('CASH', 'REVENUE_FEES', 'EQUITY', 'EXPENSE_OPERATIONAL', 'EXPENSE_TAX');

-- ==========================================
-- 4. TRANSACTION CODES TABLE
-- Defines transaction types and their accounting rules
-- ==========================================
CREATE TABLE transaction_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    fee_percentage DECIMAL(5, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert transaction codes
INSERT INTO transaction_codes (code, name, description, fee_percentage) VALUES
('DEPOSIT', 'Deposit', 'User deposits money into wallet', 0.00),
('WITHDRAWAL', 'Withdrawal', 'User withdraws money from wallet', 0.00),
('TRANSFER', 'Transfer', 'Transfer between users', 0.00),
('CONTRIBUTION', 'Chama Contribution', 'User contributes to chama', 4.50),
('PAYOUT', 'Chama Payout', 'Chama pays out to member', 0.00),
('LOAN_DISBURSEMENT', 'Loan Disbursement', 'Loan given to member', 0.00),
('LOAN_REPAYMENT', 'Loan Repayment', 'Loan payment from member', 0.00),
('FEE', 'Platform Fee', 'Platform service fee', 0.00),
('REFUND', 'Refund', 'Transaction refund', 0.00),
('PENALTY', 'Penalty', 'Late payment or violation penalty', 0.00);

-- ==========================================
-- 5. TRANSACTIONS TABLE (JOURNALS)
-- Records of financial transactions
-- ==========================================
CREATE TYPE transaction_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'reversed');

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ledger_id UUID NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
    transaction_code_id UUID NOT NULL REFERENCES transaction_codes(id),
    
    -- Transaction details
    reference VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    amount DECIMAL(15, 2) NOT NULL,
    fee_amount DECIMAL(15, 2) DEFAULT 0.00,
    total_amount DECIMAL(15, 2) NOT NULL,
    
    -- Status tracking
    status transaction_status DEFAULT 'pending',
    
    -- External references
    external_reference VARCHAR(255), -- M-Pesa ref, bank ref, etc.
    
    -- User context
    initiated_by UUID, -- user_id who initiated
    
    -- Metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Audit trail
    ip_address INET,
    user_agent TEXT,
    
    CONSTRAINT check_amounts CHECK (total_amount >= 0 AND amount >= 0 AND fee_amount >= 0)
);

-- Create indexes
CREATE INDEX idx_transactions_reference ON transactions(reference);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_initiated_by ON transactions(initiated_by);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_external_ref ON transactions(external_reference);

-- Ensure idempotency for external-sourced transactions
-- Only enforce uniqueness when external_reference is provided
CREATE UNIQUE INDEX uniq_transactions_code_external_ref
ON transactions (transaction_code_id, external_reference)
WHERE external_reference IS NOT NULL;

-- ==========================================
-- 6. ENTRIES TABLE (DOUBLE-ENTRY RECORDS)
-- Individual debit/credit entries for each transaction
-- ==========================================
CREATE TYPE entry_direction AS ENUM ('debit', 'credit');

CREATE TABLE entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id),
    
    -- Entry details
    direction entry_direction NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
    
    -- Balance snapshot at time of entry
    balance_before DECIMAL(15, 2) NOT NULL,
    balance_after DECIMAL(15, 2) NOT NULL,
    
    -- Description
    description TEXT,
    
    -- Metadata
    metadata JSONB,
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure entries balance
    CONSTRAINT check_balance_calculation CHECK (
        (direction = 'debit' AND balance_after = balance_before + amount) OR
        (direction = 'credit' AND balance_after = balance_before - amount) OR
        (direction = 'debit' AND balance_after = balance_before - amount) OR
        (direction = 'credit' AND balance_after = balance_before + amount)
    )
);

-- Create indexes
CREATE INDEX idx_entries_transaction ON entries(transaction_id);
CREATE INDEX idx_entries_account ON entries(account_id);
CREATE INDEX idx_entries_created_at ON entries(created_at DESC);

-- ==========================================
-- 7. BALANCE AUDIT TABLE
-- Periodic snapshots of account balances for verification
-- ==========================================
CREATE TABLE balance_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ledger_id UUID NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
    
    -- Totals
    total_debit_accounts DECIMAL(15, 2) NOT NULL,
    total_credit_accounts DECIMAL(15, 2) NOT NULL,
    difference DECIMAL(15, 2) NOT NULL,
    
    -- Account counts
    active_accounts_count INTEGER NOT NULL,
    
    -- Status
    is_balanced BOOLEAN NOT NULL,
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_balanced CHECK (is_balanced = (difference = 0))
);

-- ==========================================
-- 8. TRANSACTION LOCKS TABLE
-- Prevent concurrent modifications to same accounts
-- ==========================================
CREATE TABLE transaction_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP,
    
    CONSTRAINT unique_active_lock UNIQUE (account_id, transaction_id)
);

CREATE INDEX idx_transaction_locks_account ON transaction_locks(account_id) WHERE released_at IS NULL;

-- ==========================================
-- 9. FUNCTIONS AND TRIGGERS
-- ==========================================

-- Function to update account balance
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update account balance based on entry direction and account normality
    UPDATE accounts a
    SET 
        balance = NEW.balance_after,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.account_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update balance after entry insert
CREATE TRIGGER trigger_update_account_balance
AFTER INSERT ON entries
FOR EACH ROW
EXECUTE FUNCTION update_account_balance();

-- Function to validate double-entry balance
CREATE OR REPLACE FUNCTION validate_double_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
    debit_sum DECIMAL(15, 2);
    credit_sum DECIMAL(15, 2);
BEGIN
    -- Calculate sum of debits and credits for this transaction
    SELECT 
        COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END), 0)
    INTO debit_sum, credit_sum
    FROM entries
    WHERE transaction_id = NEW.transaction_id;
    
    -- Ensure debits equal credits
    IF debit_sum != credit_sum THEN
        RAISE EXCEPTION 'Double-entry validation failed: debits (%) must equal credits (%)', debit_sum, credit_sum;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate balance on entry insert
CREATE TRIGGER trigger_validate_double_entry
AFTER INSERT ON entries
FOR EACH ROW
EXECUTE FUNCTION validate_double_entry_balance();

-- Function to update transaction status
CREATE OR REPLACE FUNCTION update_transaction_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for transaction updates
CREATE TRIGGER trigger_transaction_timestamp
BEFORE UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_transaction_timestamp();

-- ==========================================
-- 10. VIEWS FOR REPORTING
-- ==========================================

-- View: Account balances with type information
CREATE VIEW v_account_balances AS
SELECT 
    a.id,
    a.account_number,
    a.name,
    a.balance,
    a.available_balance,
    at.name AS account_type,
    at.category,
    at.normality,
    a.user_id,
    a.chama_id,
    a.status,
    a.created_at
FROM accounts a
JOIN account_types at ON a.account_type_id = at.id;

-- View: Transaction summary
CREATE VIEW v_transaction_summary AS
SELECT 
    t.id,
    t.reference,
    t.description,
    t.amount,
    t.fee_amount,
    t.total_amount,
    t.status,
    tc.name AS transaction_type,
    tc.code AS transaction_code,
    t.created_at,
    t.completed_at,
    COUNT(e.id) AS entry_count
FROM transactions t
JOIN transaction_codes tc ON t.transaction_code_id = tc.id
LEFT JOIN entries e ON t.id = e.transaction_id
GROUP BY t.id, tc.name, tc.code;

-- View: Ledger balance check
CREATE VIEW v_ledger_balance_check AS
SELECT 
    l.id AS ledger_id,
    l.name AS ledger_name,
    COALESCE(SUM(CASE WHEN at.normality = 'debit' THEN a.balance ELSE 0 END), 0) AS total_debit_balance,
    COALESCE(SUM(CASE WHEN at.normality = 'credit' THEN a.balance ELSE 0 END), 0) AS total_credit_balance,
    COALESCE(SUM(CASE WHEN at.normality = 'debit' THEN a.balance ELSE 0 END), 0) - 
    COALESCE(SUM(CASE WHEN at.normality = 'credit' THEN a.balance ELSE 0 END), 0) AS difference,
    CASE 
        WHEN COALESCE(SUM(CASE WHEN at.normality = 'debit' THEN a.balance ELSE 0 END), 0) = 
             COALESCE(SUM(CASE WHEN at.normality = 'credit' THEN a.balance ELSE 0 END), 0)
        THEN true 
        ELSE false 
    END AS is_balanced
FROM ledgers l
LEFT JOIN accounts a ON l.id = a.ledger_id AND a.status = 'active'
LEFT JOIN account_types at ON a.account_type_id = at.id
GROUP BY l.id, l.name;

-- ==========================================
-- 11. GRANT PERMISSIONS (adjust as needed)
-- ==========================================
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO your_app_user;

-- ==========================================
-- END OF MIGRATION
-- ==========================================