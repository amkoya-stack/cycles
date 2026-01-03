-- ============================================================================
-- Migration: Add INVESTMENT Account Type
-- Description: Add INVESTMENT account type for investment fund tracking
-- ============================================================================

BEGIN;

-- Add INVESTMENT account type
INSERT INTO account_types (code, name, category, normality, description, is_system)
VALUES (
    'INVESTMENT',
    'Investment Account',
    'asset',
    'debit',
    'Investment funds held for chamas and users',
    true
)
ON CONFLICT (code) DO NOTHING;

COMMENT ON COLUMN account_types.code IS 'Unique code for account type (e.g., USER_WALLET, CHAMA_WALLET, ESCROW, INVESTMENT)';

COMMIT;

