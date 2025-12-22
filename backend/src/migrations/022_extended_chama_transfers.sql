-- Migration 022: Extended Chama Transfers
-- Allows chama funds to be transferred to various destinations:
-- - chama: Another chama wallet
-- - user: A user's wallet on the platform
-- - mpesa: M-Pesa number (external)
-- - bank: Bank account (external)

-- Create enum for transfer destination types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transfer_destination_type') THEN
        CREATE TYPE transfer_destination_type AS ENUM ('chama', 'user', 'mpesa', 'bank');
    END IF;
END$$;

-- Add new columns to chama_transfers for extended destination support
ALTER TABLE chama_transfers
ADD COLUMN IF NOT EXISTS destination_type transfer_destination_type DEFAULT 'chama',
ADD COLUMN IF NOT EXISTS destination_user_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS destination_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS destination_bank_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS destination_account_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS destination_account_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(100);

-- Make destination_chama_id nullable (only required for chama-to-chama transfers)
ALTER TABLE chama_transfers ALTER COLUMN destination_chama_id DROP NOT NULL;

-- Drop the constraint that requires different chamas (since we can now transfer to non-chama destinations)
ALTER TABLE chama_transfers DROP CONSTRAINT IF EXISTS different_chamas;

-- Add a new constraint: if destination_type is 'chama', destination_chama_id must be set and different from source
ALTER TABLE chama_transfers ADD CONSTRAINT valid_chama_transfer
    CHECK (
        destination_type != 'chama' OR 
        (destination_chama_id IS NOT NULL AND destination_chama_id != source_chama_id)
    );

-- Add constraint: if destination_type is 'user', destination_user_id must be set
ALTER TABLE chama_transfers ADD CONSTRAINT valid_user_transfer
    CHECK (
        destination_type != 'user' OR destination_user_id IS NOT NULL
    );

-- Add constraint: if destination_type is 'mpesa', destination_phone must be set
ALTER TABLE chama_transfers ADD CONSTRAINT valid_mpesa_transfer
    CHECK (
        destination_type != 'mpesa' OR destination_phone IS NOT NULL
    );

-- Add constraint: if destination_type is 'bank', bank details must be set
ALTER TABLE chama_transfers ADD CONSTRAINT valid_bank_transfer
    CHECK (
        destination_type != 'bank' OR 
        (destination_bank_name IS NOT NULL AND destination_account_number IS NOT NULL)
    );

-- Index for user destination transfers
CREATE INDEX IF NOT EXISTS idx_chama_transfers_destination_user ON chama_transfers(destination_user_id);

-- Index for destination type filtering
CREATE INDEX IF NOT EXISTS idx_chama_transfers_destination_type ON chama_transfers(destination_type);

-- Comments for documentation
COMMENT ON COLUMN chama_transfers.destination_type IS 'Type of transfer destination: chama, user, mpesa, or bank';
COMMENT ON COLUMN chama_transfers.destination_user_id IS 'User ID for user wallet transfers';
COMMENT ON COLUMN chama_transfers.destination_phone IS 'Phone number for M-Pesa transfers';
COMMENT ON COLUMN chama_transfers.destination_bank_name IS 'Bank name for bank transfers';
COMMENT ON COLUMN chama_transfers.destination_account_number IS 'Account number for bank transfers';
COMMENT ON COLUMN chama_transfers.destination_account_name IS 'Account holder name for bank transfers';
COMMENT ON COLUMN chama_transfers.recipient_name IS 'Display name of the recipient (for any transfer type)';
