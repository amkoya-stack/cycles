-- ============================================================================
-- Migration: 035_add_escrow_account_type.sql
-- Description: Add ESCROW account type for external lending escrow system
-- ============================================================================

-- Add ESCROW account type
INSERT INTO account_types (code, name, category, normality, description, is_system)
VALUES (
    'ESCROW',
    'Escrow Account',
    'liability',
    'credit',
    'Funds held in escrow for external loans until terms are accepted',
    true
)
ON CONFLICT (code) DO NOTHING;

-- Add comment
COMMENT ON TYPE account_category IS 'Account categories: asset, liability, equity, revenue, expense';
COMMENT ON COLUMN account_types.code IS 'Unique code for account type (e.g., USER_WALLET, CHAMA_WALLET, ESCROW)';

