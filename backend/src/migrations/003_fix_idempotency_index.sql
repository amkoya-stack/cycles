-- ==========================================
-- Migration 003: Fix idempotency unique index
-- Only enforce uniqueness for completed transactions
-- ==========================================

DROP INDEX IF EXISTS uniq_transactions_code_external_ref;

CREATE UNIQUE INDEX uniq_transactions_code_external_ref
ON transactions (transaction_code_id, external_reference)
WHERE external_reference IS NOT NULL AND status = 'completed';

-- ==========================================
-- END OF MIGRATION
-- ==========================================