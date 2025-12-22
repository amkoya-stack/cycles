-- Migration: 019_chama_wallet_operations
-- Description: Add transaction codes and support for chama wallet deposits and inter-chama transfers
-- Date: 2025-12-21

-- Add new transaction codes for chama wallet operations
INSERT INTO transaction_codes (code, name, description, fee_percentage) VALUES
('CHAMA_DEPOSIT', 'Chama Deposit', 'External deposit directly to chama wallet', 0.00),
('CHAMA_TRANSFER', 'Chama Transfer', 'Transfer between chama wallets', 0.00)
ON CONFLICT (code) DO NOTHING;

-- Create a table to track chama wallet deposits with external references
CREATE TABLE IF NOT EXISTS chama_deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id),
    amount DECIMAL(15, 2) NOT NULL,
    source_type VARCHAR(50) NOT NULL, -- 'mpesa', 'bank', 'cash', 'other'
    source_reference VARCHAR(255), -- External reference (M-Pesa code, bank ref, etc.)
    source_details JSONB DEFAULT '{}'::jsonb, -- Additional source info (bank name, account number, etc.)
    deposited_by UUID NOT NULL REFERENCES users(id), -- Who made the deposit
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create a table to track inter-chama transfers
CREATE TABLE IF NOT EXISTS chama_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    destination_chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id),
    amount DECIMAL(15, 2) NOT NULL,
    reason TEXT,
    initiated_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, completed, rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT different_chamas CHECK (source_chama_id != destination_chama_id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_chama_deposits_chama_id ON chama_deposits(chama_id);
CREATE INDEX IF NOT EXISTS idx_chama_deposits_status ON chama_deposits(status);
CREATE INDEX IF NOT EXISTS idx_chama_transfers_source ON chama_transfers(source_chama_id);
CREATE INDEX IF NOT EXISTS idx_chama_transfers_destination ON chama_transfers(destination_chama_id);
CREATE INDEX IF NOT EXISTS idx_chama_transfers_status ON chama_transfers(status);
