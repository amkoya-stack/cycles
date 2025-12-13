-- ==========================================
-- Migration 004: Deferred Double-Entry Validation
-- Ensures debits = credits per transaction at commit time
-- ==========================================

-- Queue table to collect touched transaction_ids per backend PID
CREATE TABLE IF NOT EXISTS entry_balance_check_queue (
  pid INTEGER NOT NULL,
  transaction_id UUID NOT NULL
);

-- Avoid duplicate enqueues per PID + transaction
CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_balance_queue_pid_tx
  ON entry_balance_check_queue(pid, transaction_id);

-- Enqueue function: record affected transaction_id for current backend
CREATE OR REPLACE FUNCTION enqueue_entry_balance_check()
RETURNS TRIGGER AS $fn$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO entry_balance_check_queue(pid, transaction_id)
    VALUES (pg_backend_pid(), NEW.transaction_id)
    ON CONFLICT (pid, transaction_id) DO NOTHING;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO entry_balance_check_queue(pid, transaction_id)
    VALUES (pg_backend_pid(), OLD.transaction_id)
    ON CONFLICT (pid, transaction_id) DO NOTHING;
  END IF;
  RETURN NULL;
END;
$fn$ LANGUAGE plpgsql;

-- Replace enqueue trigger
DROP TRIGGER IF EXISTS trigger_enqueue_entry_balance_check ON entries;
CREATE TRIGGER trigger_enqueue_entry_balance_check
AFTER INSERT OR UPDATE OR DELETE ON entries
FOR EACH ROW
EXECUTE FUNCTION enqueue_entry_balance_check();

-- Validation function: check all enqueued transactions for this backend
CREATE OR REPLACE FUNCTION validate_enqueued_transactions()
RETURNS TRIGGER AS $fn$
DECLARE
  rec RECORD;
  debit_sum DECIMAL(15, 2);
  credit_sum DECIMAL(15, 2);
BEGIN
  FOR rec IN (
    SELECT DISTINCT transaction_id
    FROM entry_balance_check_queue
    WHERE pid = pg_backend_pid()
  ) LOOP
    SELECT 
      COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END), 0)
    INTO debit_sum, credit_sum
    FROM entries
    WHERE transaction_id = rec.transaction_id;

    IF debit_sum <> credit_sum THEN
      RAISE EXCEPTION 'Double-entry validation failed for transaction %: debits (%) must equal credits (%)', rec.transaction_id, debit_sum, credit_sum;
    END IF;
  END LOOP;

  -- Cleanup this backend's queue rows
  DELETE FROM entry_balance_check_queue WHERE pid = pg_backend_pid();

  RETURN NULL;
END;
$fn$ LANGUAGE plpgsql;

-- Replace constraint trigger (deferred)
DROP TRIGGER IF EXISTS constraint_validate_double_entry ON entries;
CREATE CONSTRAINT TRIGGER constraint_validate_double_entry
AFTER INSERT OR UPDATE OR DELETE ON entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_enqueued_transactions();

-- ==========================================
-- END OF MIGRATION
-- ==========================================
