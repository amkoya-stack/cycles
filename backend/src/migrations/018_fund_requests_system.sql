-- Migration: 018_fund_requests_system.sql
-- Create fund request system for wallet functionality

-- Fund requests table
CREATE TABLE IF NOT EXISTS fund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE, -- null for chama requests
  chama_id UUID REFERENCES chamas(id) ON DELETE CASCADE,    -- null for individual requests
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  request_type VARCHAR(10) NOT NULL CHECK (request_type IN ('member', 'chama')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'expired')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '7 days',
  
  -- Ensure either recipient_id or chama_id is set based on request_type
  CONSTRAINT fund_request_recipient_check CHECK (
    (request_type = 'member' AND recipient_id IS NOT NULL AND chama_id IS NULL) OR
    (request_type = 'chama' AND chama_id IS NOT NULL AND recipient_id IS NULL)
  )
);

-- Notifications table for fund requests
CREATE TABLE IF NOT EXISTS fund_request_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_request_id UUID NOT NULL REFERENCES fund_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('request_received', 'request_approved', 'request_declined')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fund_requests_requester_id ON fund_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_fund_requests_recipient_id ON fund_requests(recipient_id);
CREATE INDEX IF NOT EXISTS idx_fund_requests_chama_id ON fund_requests(chama_id);
CREATE INDEX IF NOT EXISTS idx_fund_requests_status ON fund_requests(status);
CREATE INDEX IF NOT EXISTS idx_fund_requests_created_at ON fund_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_fund_request_notifications_user_id ON fund_request_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_fund_request_notifications_is_read ON fund_request_notifications(is_read);

-- Update trigger for fund_requests
CREATE OR REPLACE FUNCTION update_fund_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fund_request_updated_at
  BEFORE UPDATE ON fund_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_fund_request_updated_at();

-- Function to automatically create notifications
CREATE OR REPLACE FUNCTION create_fund_request_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notification for new fund request
  IF TG_OP = 'INSERT' THEN
    -- Notify recipient(s)
    IF NEW.request_type = 'member' THEN
      INSERT INTO fund_request_notifications (fund_request_id, user_id, notification_type, title, message)
      VALUES (
        NEW.id,
        NEW.recipient_id,
        'request_received',
        'Fund Request Received',
        (SELECT full_name FROM users WHERE id = NEW.requester_id) || ' has requested ' || NEW.amount || ' KES from you'
      );
    ELSIF NEW.request_type = 'chama' THEN
      -- Notify all chama admins and treasurers
      INSERT INTO fund_request_notifications (fund_request_id, user_id, notification_type, title, message)
      SELECT 
        NEW.id,
        cm.user_id,
        'request_received',
        'Chama Fund Request Received',
        (SELECT full_name FROM users WHERE id = NEW.requester_id) || ' has requested ' || NEW.amount || ' KES from ' || (SELECT name FROM chamas WHERE id = NEW.chama_id)
      FROM chama_members cm 
      WHERE cm.chama_id = NEW.chama_id 
        AND cm.status = 'active' 
        AND cm.role IN ('admin', 'treasurer');
    END IF;
  END IF;
  
  -- Create notification for status changes
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO fund_request_notifications (fund_request_id, user_id, notification_type, title, message)
      VALUES (
        NEW.id,
        NEW.requester_id,
        'request_approved',
        'Fund Request Approved',
        'Your request for ' || NEW.amount || ' KES has been approved!'
      );
    ELSIF NEW.status = 'declined' THEN
      INSERT INTO fund_request_notifications (fund_request_id, user_id, notification_type, title, message)
      VALUES (
        NEW.id,
        NEW.requester_id,
        'request_declined',
        'Fund Request Declined',
        'Your request for ' || NEW.amount || ' KES has been declined'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fund_request_notification_trigger
  AFTER INSERT OR UPDATE ON fund_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_fund_request_notification();

-- Function to expire old fund requests
CREATE OR REPLACE FUNCTION expire_old_fund_requests()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE fund_requests 
  SET status = 'expired', updated_at = CURRENT_TIMESTAMP
  WHERE status = 'pending' 
    AND expires_at < CURRENT_TIMESTAMP;
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE fund_requests IS 'Fund requests between users or from chama funds';
COMMENT ON TABLE fund_request_notifications IS 'Notifications for fund request activities';