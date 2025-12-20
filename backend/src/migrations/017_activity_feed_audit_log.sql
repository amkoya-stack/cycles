-- Migration 017: Activity Feed & Audit Log System
-- Purpose: Track all chama activities with full audit trail and notification support

-- =============================================
-- Activity Types Enum
-- =============================================
DO $$ BEGIN
  CREATE TYPE activity_category AS ENUM (
    'financial',      -- Contributions, payouts, loans, investments
    'governance',     -- Votes, proposals, settings changes
    'membership',     -- Joins, leaves, role changes
    'document',       -- Document uploads, deletions
    'system'          -- Automated system actions
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE activity_type AS ENUM (
    -- Financial
    'contribution_made',
    'payout_disbursed',
    'loan_issued',
    'loan_repaid',
    'investment_made',
    'investment_returned',
    'fine_applied',
    'fee_charged',
    
    -- Governance
    'vote_created',
    'vote_closed',
    'vote_cast',
    'proposal_created',
    'proposal_approved',
    'proposal_rejected',
    'settings_changed',
    
    -- Membership
    'member_joined',
    'member_left',
    'member_removed',
    'role_changed',
    'member_invited',
    'invite_accepted',
    'invite_rejected',
    
    -- Document
    'document_uploaded',
    'document_deleted',
    'document_shared',
    
    -- System
    'rotation_created',
    'rotation_updated',
    'cycle_completed',
    'reminder_sent',
    'reputation_calculated'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('push', 'email', 'sms', 'in_app');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- Activity Logs Table
-- =============================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Null for system actions
  
  -- Activity Details
  category activity_category NOT NULL,
  activity_type activity_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}', -- Flexible data storage (amounts, IDs, etc.)
  entity_type VARCHAR(100), -- e.g., 'contribution', 'vote', 'member'
  entity_id UUID, -- ID of the related entity
  
  -- Audit Information
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT activity_logs_chama_fkey FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE,
  CONSTRAINT activity_logs_user_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for activity logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_chama_created 
  ON activity_logs(chama_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user 
  ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_category 
  ON activity_logs(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type 
  ON activity_logs(activity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity 
  ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created 
  ON activity_logs(created_at DESC);

-- GIN index for metadata JSONB searches
CREATE INDEX IF NOT EXISTS idx_activity_logs_metadata 
  ON activity_logs USING gin(metadata);

-- =============================================
-- Detailed Audit Trail Table
-- =============================================
CREATE TABLE IF NOT EXISTS audit_trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_log_id UUID REFERENCES activity_logs(id) ON DELETE CASCADE,
  
  -- Change Details
  field_name VARCHAR(100), -- What was changed
  old_value JSONB, -- Previous value
  new_value JSONB, -- New value
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT audit_trails_activity_fkey FOREIGN KEY (activity_log_id) 
    REFERENCES activity_logs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_trails_activity 
  ON audit_trails(activity_log_id);
CREATE INDEX IF NOT EXISTS idx_audit_trails_field 
  ON audit_trails(field_name);

-- =============================================
-- Notification Queue Table
-- =============================================
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Recipient
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chama_id UUID REFERENCES chamas(id) ON DELETE CASCADE,
  
  -- Notification Details
  channel notification_channel NOT NULL,
  priority notification_priority DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  
  -- Related Activity
  activity_log_id UUID REFERENCES activity_logs(id) ON DELETE SET NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed, cancelled
  sent_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Scheduling
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT notification_queue_user_fkey FOREIGN KEY (user_id) 
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT notification_queue_chama_fkey FOREIGN KEY (chama_id) 
    REFERENCES chamas(id) ON DELETE CASCADE,
  CONSTRAINT notification_queue_activity_fkey FOREIGN KEY (activity_log_id) 
    REFERENCES activity_logs(id) ON DELETE SET NULL
);

-- Indexes for notification queue
CREATE INDEX IF NOT EXISTS idx_notification_queue_user 
  ON notification_queue(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status 
  ON notification_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_queue_channel 
  ON notification_queue(channel, status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_priority 
  ON notification_queue(priority, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_queue_activity 
  ON notification_queue(activity_log_id);

-- =============================================
-- Notification Preferences Table
-- =============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chama_id UUID REFERENCES chamas(id) ON DELETE CASCADE, -- Null for global preferences
  
  -- Channel Preferences
  push_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false, -- Off by default due to cost
  
  -- Activity Type Preferences (JSONB for flexibility)
  activity_preferences JSONB DEFAULT $json${"financial": {"push": true, "email": true, "sms": false}, "governance": {"push": true, "email": true, "sms": false}, "membership": {"push": true, "email": false, "sms": false}, "document": {"push": false, "email": false, "sms": false}, "system": {"push": false, "email": false, "sms": false}}$json$::jsonb,
  
  -- Digest Preferences
  daily_digest BOOLEAN DEFAULT false,
  weekly_digest BOOLEAN DEFAULT true,
  digest_time TIME DEFAULT '08:00:00', -- 8 AM
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT notification_preferences_user_fkey FOREIGN KEY (user_id) 
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT notification_preferences_chama_fkey FOREIGN KEY (chama_id) 
    REFERENCES chamas(id) ON DELETE CASCADE,
  UNIQUE(user_id, chama_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user 
  ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_chama 
  ON notification_preferences(chama_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_digest 
  ON notification_preferences(daily_digest, weekly_digest);

-- =============================================
-- Helper Functions
-- =============================================

-- Function to create activity log with audit trail
CREATE OR REPLACE FUNCTION create_activity_log(
  p_chama_id UUID,
  p_user_id UUID,
  p_category activity_category,
  p_activity_type activity_type,
  p_title VARCHAR(255),
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_entity_type VARCHAR(100) DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_device_info JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO activity_logs (
    chama_id, user_id, category, activity_type, title, description,
    metadata, entity_type, entity_id, ip_address, user_agent, device_info
  ) VALUES (
    p_chama_id, p_user_id, p_category, p_activity_type, p_title, p_description,
    p_metadata, p_entity_type, p_entity_id, p_ip_address, p_user_agent, p_device_info
  ) RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql;

-- Function to add audit trail entry
CREATE OR REPLACE FUNCTION add_audit_trail(
  p_activity_log_id UUID,
  p_field_name VARCHAR(100),
  p_old_value JSONB,
  p_new_value JSONB
) RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO audit_trails (
    activity_log_id, field_name, old_value, new_value
  ) VALUES (
    p_activity_log_id, p_field_name, p_old_value, p_new_value
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- Function to queue notification
CREATE OR REPLACE FUNCTION queue_notification(
  p_user_id UUID,
  p_chama_id UUID,
  p_channel notification_channel,
  p_priority notification_priority,
  p_title VARCHAR(255),
  p_message TEXT,
  p_activity_log_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_preference_enabled BOOLEAN;
BEGIN
  -- Check user preferences
  SELECT 
    CASE p_channel
      WHEN 'push' THEN push_enabled
      WHEN 'email' THEN email_enabled
      WHEN 'sms' THEN sms_enabled
      ELSE true
    END INTO v_preference_enabled
  FROM notification_preferences
  WHERE user_id = p_user_id 
    AND (chama_id = p_chama_id OR chama_id IS NULL)
  ORDER BY chama_id DESC NULLS LAST
  LIMIT 1;
  
  -- If no preference found, default to enabled (except SMS)
  IF v_preference_enabled IS NULL THEN
    v_preference_enabled := (p_channel != 'sms');
  END IF;
  
  -- Only queue if enabled
  IF v_preference_enabled THEN
    INSERT INTO notification_queue (
      user_id, chama_id, channel, priority, title, message,
      activity_log_id, metadata, scheduled_for
    ) VALUES (
      p_user_id, p_chama_id, p_channel, p_priority, p_title, p_message,
      p_activity_log_id, p_metadata, p_scheduled_for
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notification_queue_updated ON notification_queue;
CREATE TRIGGER notification_queue_updated
  BEFORE UPDATE ON notification_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_timestamp();

DROP TRIGGER IF EXISTS notification_preferences_updated ON notification_preferences;
CREATE TRIGGER notification_preferences_updated
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_timestamp();

-- =============================================
-- Row Level Security (RLS)
-- =============================================

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Activity Logs: Users can see activities for chamas they're members of
DROP POLICY IF EXISTS activity_logs_member_select ON activity_logs;
CREATE POLICY activity_logs_member_select ON activity_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chama_members cm
      WHERE cm.chama_id = activity_logs.chama_id
        AND cm.user_id = current_setting('app.current_user_id', true)::uuid
        AND cm.status = 'active'
    )
  );

-- Audit Trails: Same as activity logs
DROP POLICY IF EXISTS audit_trails_member_select ON audit_trails;
CREATE POLICY audit_trails_member_select ON audit_trails
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM activity_logs al
      JOIN chama_members cm ON cm.chama_id = al.chama_id
      WHERE al.id = audit_trails.activity_log_id
        AND cm.user_id = current_setting('app.current_user_id', true)::uuid
        AND cm.status = 'active'
    )
  );

-- Notification Queue: Users can only see their own notifications
DROP POLICY IF EXISTS notification_queue_user_select ON notification_queue;
CREATE POLICY notification_queue_user_select ON notification_queue
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Notification Preferences: Users can only manage their own preferences
DROP POLICY IF EXISTS notification_preferences_user_all ON notification_preferences;
CREATE POLICY notification_preferences_user_all ON notification_preferences
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- System context bypass (for ledger service and system operations)
DROP POLICY IF EXISTS activity_logs_system_all ON activity_logs;
CREATE POLICY activity_logs_system_all ON activity_logs
  FOR ALL
  USING (current_setting('app.current_user_id', true) = 'system');

DROP POLICY IF EXISTS audit_trails_system_all ON audit_trails;
CREATE POLICY audit_trails_system_all ON audit_trails
  FOR ALL
  USING (current_setting('app.current_user_id', true) = 'system');

DROP POLICY IF EXISTS notification_queue_system_all ON notification_queue;
CREATE POLICY notification_queue_system_all ON notification_queue
  FOR ALL
  USING (current_setting('app.current_user_id', true) = 'system');

-- =============================================
-- Sample Data & Comments
-- =============================================

COMMENT ON TABLE activity_logs IS 'Tracks all chama activities with full context';
COMMENT ON TABLE audit_trails IS 'Detailed before/after values for activity changes';
COMMENT ON TABLE notification_queue IS 'Queue for push, email, and SMS notifications';
COMMENT ON TABLE notification_preferences IS 'User notification preferences per chama';

COMMENT ON COLUMN activity_logs.metadata IS 'Flexible JSONB storage for activity-specific data (amounts, counts, etc.)';
COMMENT ON COLUMN activity_logs.entity_type IS 'Type of entity (contribution, vote, member, etc.)';
COMMENT ON COLUMN activity_logs.entity_id IS 'ID of the related entity for deep linking';

COMMENT ON FUNCTION create_activity_log IS 'Helper function to create activity log with all context';
COMMENT ON FUNCTION add_audit_trail IS 'Helper function to add audit trail entry';
COMMENT ON FUNCTION queue_notification IS 'Helper function to queue notification with preference check';
