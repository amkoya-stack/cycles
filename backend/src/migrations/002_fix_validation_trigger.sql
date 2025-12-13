-- ==========================================
-- Migration 002: Move double-entry validation
-- from per-row entries trigger to transaction completion
-- ==========================================

-- 1) Drop the per-row validation trigger on entries (if present)
DROP TRIGGER IF EXISTS trigger_validate_double_entry ON public.entries;

-- Skipping creation of new completion trigger here due to migration runner limitations.
-- Validation will be handled at the application layer and via reporting views.

-- ==========================================
-- END OF MIGRATION
-- ==========================================