-- Transaction limits system

CREATE TABLE IF NOT EXISTS transaction_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Daily limits
  daily_deposit_limit NUMERIC(15, 2) DEFAULT 100000.00, -- KES 100,000
  daily_withdrawal_limit NUMERIC(15, 2) DEFAULT 70000.00, -- KES 70,000
  daily_transfer_limit NUMERIC(15, 2) DEFAULT 50000.00, -- KES 50,000
  
  -- Monthly limits
  monthly_deposit_limit NUMERIC(15, 2) DEFAULT 1000000.00, -- KES 1,000,000
  monthly_withdrawal_limit NUMERIC(15, 2) DEFAULT 700000.00, -- KES 700,000
  monthly_transfer_limit NUMERIC(15, 2) DEFAULT 500000.00, -- KES 500,000
  
  -- Single transaction limits
  max_single_deposit NUMERIC(15, 2) DEFAULT 150000.00, -- KES 150,000
  max_single_withdrawal NUMERIC(15, 2) DEFAULT 150000.00, -- KES 150,000
  max_single_transfer NUMERIC(15, 2) DEFAULT 100000.00, -- KES 100,000
  
  -- Minimum limits
  min_deposit NUMERIC(15, 2) DEFAULT 10.00, -- KES 10
  min_withdrawal NUMERIC(15, 2) DEFAULT 50.00, -- KES 50
  min_transfer NUMERIC(15, 2) DEFAULT 10.00, -- KES 10
  
  -- Flags
  is_custom BOOLEAN DEFAULT false, -- True if limits are customized for this user
  is_suspended BOOLEAN DEFAULT false, -- True if user transactions are suspended
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_limits UNIQUE (user_id)
);

CREATE INDEX idx_transaction_limits_user ON transaction_limits(user_id);
CREATE INDEX idx_transaction_limits_suspended ON transaction_limits(is_suspended);

-- Function to get or create default limits for a user
CREATE OR REPLACE FUNCTION get_or_create_user_limits(p_user_id UUID)
RETURNS transaction_limits AS $$
DECLARE
  v_limits transaction_limits;
BEGIN
  SELECT * INTO v_limits FROM transaction_limits WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO transaction_limits (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_limits;
  END IF;
  
  RETURN v_limits;
END;
$$ LANGUAGE plpgsql;

-- Table to track daily usage (resets every day)
CREATE TABLE IF NOT EXISTS daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Daily totals
  total_deposits NUMERIC(15, 2) DEFAULT 0,
  total_withdrawals NUMERIC(15, 2) DEFAULT 0,
  total_transfers NUMERIC(15, 2) DEFAULT 0,
  
  -- Transaction counts
  deposit_count INTEGER DEFAULT 0,
  withdrawal_count INTEGER DEFAULT 0,
  transfer_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_date UNIQUE (user_id, usage_date)
);

CREATE INDEX idx_daily_usage_user_date ON daily_usage(user_id, usage_date);

-- Table to track monthly usage
CREATE TABLE IF NOT EXISTS monthly_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  usage_month DATE NOT NULL, -- First day of the month
  
  -- Monthly totals
  total_deposits NUMERIC(15, 2) DEFAULT 0,
  total_withdrawals NUMERIC(15, 2) DEFAULT 0,
  total_transfers NUMERIC(15, 2) DEFAULT 0,
  
  -- Transaction counts
  deposit_count INTEGER DEFAULT 0,
  withdrawal_count INTEGER DEFAULT 0,
  transfer_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_month UNIQUE (user_id, usage_month)
);

CREATE INDEX idx_monthly_usage_user_month ON monthly_usage(user_id, usage_month);

-- Function to update usage after transaction
CREATE OR REPLACE FUNCTION update_transaction_usage(
  p_user_id UUID,
  p_transaction_type TEXT,
  p_amount NUMERIC
) RETURNS void AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_this_month DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
BEGIN
  -- Update daily usage
  INSERT INTO daily_usage (user_id, usage_date, 
    total_deposits, total_withdrawals, total_transfers,
    deposit_count, withdrawal_count, transfer_count)
  VALUES (
    p_user_id, v_today,
    CASE WHEN p_transaction_type = 'deposit' THEN p_amount ELSE 0 END,
    CASE WHEN p_transaction_type = 'withdrawal' THEN p_amount ELSE 0 END,
    CASE WHEN p_transaction_type = 'transfer' THEN p_amount ELSE 0 END,
    CASE WHEN p_transaction_type = 'deposit' THEN 1 ELSE 0 END,
    CASE WHEN p_transaction_type = 'withdrawal' THEN 1 ELSE 0 END,
    CASE WHEN p_transaction_type = 'transfer' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, usage_date) DO UPDATE SET
    total_deposits = daily_usage.total_deposits + 
      CASE WHEN p_transaction_type = 'deposit' THEN p_amount ELSE 0 END,
    total_withdrawals = daily_usage.total_withdrawals + 
      CASE WHEN p_transaction_type = 'withdrawal' THEN p_amount ELSE 0 END,
    total_transfers = daily_usage.total_transfers + 
      CASE WHEN p_transaction_type = 'transfer' THEN p_amount ELSE 0 END,
    deposit_count = daily_usage.deposit_count + 
      CASE WHEN p_transaction_type = 'deposit' THEN 1 ELSE 0 END,
    withdrawal_count = daily_usage.withdrawal_count + 
      CASE WHEN p_transaction_type = 'withdrawal' THEN 1 ELSE 0 END,
    transfer_count = daily_usage.transfer_count + 
      CASE WHEN p_transaction_type = 'transfer' THEN 1 ELSE 0 END,
    updated_at = NOW();
  
  -- Update monthly usage
  INSERT INTO monthly_usage (user_id, usage_month,
    total_deposits, total_withdrawals, total_transfers,
    deposit_count, withdrawal_count, transfer_count)
  VALUES (
    p_user_id, v_this_month,
    CASE WHEN p_transaction_type = 'deposit' THEN p_amount ELSE 0 END,
    CASE WHEN p_transaction_type = 'withdrawal' THEN p_amount ELSE 0 END,
    CASE WHEN p_transaction_type = 'transfer' THEN p_amount ELSE 0 END,
    CASE WHEN p_transaction_type = 'deposit' THEN 1 ELSE 0 END,
    CASE WHEN p_transaction_type = 'withdrawal' THEN 1 ELSE 0 END,
    CASE WHEN p_transaction_type = 'transfer' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, usage_month) DO UPDATE SET
    total_deposits = monthly_usage.total_deposits + 
      CASE WHEN p_transaction_type = 'deposit' THEN p_amount ELSE 0 END,
    total_withdrawals = monthly_usage.total_withdrawals + 
      CASE WHEN p_transaction_type = 'withdrawal' THEN p_amount ELSE 0 END,
    total_transfers = monthly_usage.total_transfers + 
      CASE WHEN p_transaction_type = 'transfer' THEN p_amount ELSE 0 END,
    deposit_count = monthly_usage.deposit_count + 
      CASE WHEN p_transaction_type = 'deposit' THEN 1 ELSE 0 END,
    withdrawal_count = monthly_usage.withdrawal_count + 
      CASE WHEN p_transaction_type = 'withdrawal' THEN 1 ELSE 0 END,
    transfer_count = monthly_usage.transfer_count + 
      CASE WHEN p_transaction_type = 'transfer' THEN 1 ELSE 0 END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE transaction_limits IS 'User transaction limits (daily, monthly, per-transaction)';
COMMENT ON TABLE daily_usage IS 'Daily transaction usage tracking';
COMMENT ON TABLE monthly_usage IS 'Monthly transaction usage tracking';
