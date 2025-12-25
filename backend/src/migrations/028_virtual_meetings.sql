-- Migration 028: Virtual Meeting System
-- Audio/video meetings with Livekit integration for chama members

-- Meeting status enum
DO $$ BEGIN
  CREATE TYPE meeting_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Meeting type enum
DO $$ BEGIN
  CREATE TYPE meeting_type AS ENUM ('audio', 'video', 'screen_share');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Participant status enum
DO $$ BEGIN
  CREATE TYPE participant_status AS ENUM ('invited', 'joined', 'left', 'removed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- MEETINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
  host_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Meeting details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  agenda_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  
  -- Scheduling
  scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
  scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_start TIMESTAMP WITH TIME ZONE,
  actual_end TIMESTAMP WITH TIME ZONE,
  
  -- Meeting configuration
  meeting_type meeting_type DEFAULT 'audio',
  status meeting_status DEFAULT 'scheduled',
  is_recording_enabled BOOLEAN DEFAULT false,
  require_approval BOOLEAN DEFAULT false,
  max_participants INT DEFAULT 100,
  
  -- Livekit integration
  livekit_room_name VARCHAR(255) UNIQUE,
  livekit_room_id VARCHAR(255),
  
  -- Settings
  settings JSONB DEFAULT '{
    "allow_screen_share": true,
    "allow_chat": true,
    "allow_reactions": true,
    "allow_raise_hand": true,
    "mute_on_join": false,
    "waiting_room_enabled": false,
    "record_automatically": false,
    "late_threshold_minutes": 5
  }'::jsonb,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cancellation_reason TEXT,
  
  CONSTRAINT valid_schedule CHECK (scheduled_end > scheduled_start),
  CONSTRAINT valid_actual_times CHECK (actual_end IS NULL OR actual_end >= actual_start)
);

-- Indexes for meetings
CREATE INDEX IF NOT EXISTS idx_meetings_chama ON meetings(chama_id, scheduled_start DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_host ON meetings(host_user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_meetings_livekit_room ON meetings(livekit_room_name);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON meetings(scheduled_start) WHERE status = 'scheduled';

-- ============================================================================
-- MEETING PARTICIPANTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Invitation
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Participation
  status participant_status DEFAULT 'invited',
  joined_at TIMESTAMP WITH TIME ZONE,
  left_at TIMESTAMP WITH TIME ZONE,
  
  -- Attendance tracking
  is_host BOOLEAN DEFAULT false,
  is_late BOOLEAN DEFAULT false, -- Joined after late_threshold_minutes
  duration_seconds INT DEFAULT 0, -- Total time in meeting
  
  -- Permissions during meeting
  can_share_screen BOOLEAN DEFAULT true,
  can_unmute BOOLEAN DEFAULT true,
  is_muted BOOLEAN DEFAULT false,
  
  -- Interaction tracking
  hand_raised_count INT DEFAULT 0,
  messages_sent INT DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(meeting_id, user_id)
);

-- Indexes for participants
CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user ON meeting_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_status ON meeting_participants(status);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_attendance ON meeting_participants(meeting_id, status, joined_at);

-- ============================================================================
-- MEETING ATTENDANCE LOG TABLE (Detailed join/leave tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS meeting_attendance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES meeting_participants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Event details
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('joined', 'left', 'removed', 'reconnected')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Connection info
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  
  CONSTRAINT meeting_attendance_log_meeting_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  CONSTRAINT meeting_attendance_log_participant_fkey FOREIGN KEY (participant_id) REFERENCES meeting_participants(id) ON DELETE CASCADE,
  CONSTRAINT meeting_attendance_log_user_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for attendance log
CREATE INDEX IF NOT EXISTS idx_attendance_log_meeting ON meeting_attendance_log(meeting_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_log_participant ON meeting_attendance_log(participant_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_log_user ON meeting_attendance_log(user_id, timestamp);

-- ============================================================================
-- MEETING RECORDINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS meeting_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  
  -- Recording details
  recording_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL, -- Path to recording file
  file_size_bytes BIGINT,
  duration_seconds INT,
  
  -- Livekit recording info
  livekit_egress_id VARCHAR(255),
  livekit_recording_id VARCHAR(255),
  
  -- Access control
  is_public BOOLEAN DEFAULT false, -- Public to all chama members
  allowed_viewer_roles TEXT[] DEFAULT ARRAY['admin', 'chairperson', 'treasurer', 'secretary'], -- Who can view
  
  -- Processing status
  status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed', 'deleted')),
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT meeting_recordings_meeting_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

-- Indexes for recordings
CREATE INDEX IF NOT EXISTS idx_meeting_recordings_meeting ON meeting_recordings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_recordings_status ON meeting_recordings(status);
CREATE INDEX IF NOT EXISTS idx_meeting_recordings_livekit ON meeting_recordings(livekit_egress_id);

-- ============================================================================
-- MEETING REMINDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS meeting_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Reminder configuration
  reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
  reminder_type VARCHAR(20) NOT NULL CHECK (reminder_type IN ('1_day', '1_hour', '5_min', 'custom')),
  
  -- Delivery
  sent_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  
  -- Channels
  send_push BOOLEAN DEFAULT true,
  send_email BOOLEAN DEFAULT true,
  send_sms BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT meeting_reminders_meeting_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  CONSTRAINT meeting_reminders_user_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for reminders
CREATE INDEX IF NOT EXISTS idx_meeting_reminders_meeting ON meeting_reminders(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_reminders_user ON meeting_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_reminders_time ON meeting_reminders(reminder_time, status) WHERE status = 'pending';

-- ============================================================================
-- MEETING CHAT MESSAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS meeting_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Message details
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'reaction', 'poll', 'hand_raised', 'system')),
  
  -- Metadata
  metadata JSONB DEFAULT '{}', -- For reactions emoji, poll data, etc.
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT meeting_chat_messages_meeting_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  CONSTRAINT meeting_chat_messages_user_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for chat messages
CREATE INDEX IF NOT EXISTS idx_meeting_chat_meeting ON meeting_chat_messages(meeting_id, created_at);
CREATE INDEX IF NOT EXISTS idx_meeting_chat_user ON meeting_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_chat_type ON meeting_chat_messages(message_type);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to automatically update meeting status based on time
CREATE OR REPLACE FUNCTION update_meeting_status()
RETURNS void AS $$
BEGIN
  -- Mark meetings as in_progress if current time is between scheduled times
  UPDATE meetings
  SET status = 'in_progress'
  WHERE status = 'scheduled'
    AND NOW() >= scheduled_start
    AND NOW() < scheduled_end;
  
  -- Mark meetings as completed if current time is past scheduled end
  UPDATE meetings
  SET status = 'completed'
  WHERE status = 'in_progress'
    AND NOW() >= scheduled_end;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate participant duration
CREATE OR REPLACE FUNCTION calculate_participant_duration(p_participant_id UUID)
RETURNS INT AS $$
DECLARE
  total_duration INT := 0;
  join_time TIMESTAMP;
  leave_time TIMESTAMP;
BEGIN
  -- Sum all join->leave intervals
  FOR join_time, leave_time IN
    SELECT 
      j.timestamp as join_ts,
      COALESCE(l.timestamp, NOW()) as leave_ts
    FROM meeting_attendance_log j
    LEFT JOIN LATERAL (
      SELECT timestamp 
      FROM meeting_attendance_log 
      WHERE participant_id = j.participant_id 
        AND event_type = 'left' 
        AND timestamp > j.timestamp
      ORDER BY timestamp ASC
      LIMIT 1
    ) l ON true
    WHERE j.participant_id = p_participant_id
      AND j.event_type = 'joined'
    ORDER BY j.timestamp
  LOOP
    total_duration := total_duration + EXTRACT(EPOCH FROM (leave_time - join_time))::INT;
  END LOOP;
  
  RETURN total_duration;
END;
$$ LANGUAGE plpgsql;

-- Function to check if participant is late
CREATE OR REPLACE FUNCTION check_participant_late(
  p_participant_id UUID,
  p_meeting_id UUID,
  p_joined_at TIMESTAMP
)
RETURNS BOOLEAN AS $$
DECLARE
  scheduled_start TIMESTAMP;
  late_threshold INT;
  is_late BOOLEAN;
BEGIN
  -- Get meeting details
  SELECT m.scheduled_start, (m.settings->>'late_threshold_minutes')::INT
  INTO scheduled_start, late_threshold
  FROM meetings m
  WHERE m.id = p_meeting_id;
  
  -- Default threshold if not set
  late_threshold := COALESCE(late_threshold, 5);
  
  -- Check if joined after threshold
  is_late := p_joined_at > (scheduled_start + (late_threshold || ' minutes')::INTERVAL);
  
  RETURN is_late;
END;
$$ LANGUAGE plpgsql;

-- Function to create default reminders for meeting
CREATE OR REPLACE FUNCTION create_meeting_reminders(p_meeting_id UUID)
RETURNS void AS $$
DECLARE
  meeting_record RECORD;
  participant_record RECORD;
BEGIN
  -- Get meeting details
  SELECT * INTO meeting_record FROM meetings WHERE id = p_meeting_id;
  
  -- Create reminders for all participants
  FOR participant_record IN
    SELECT user_id FROM meeting_participants WHERE meeting_id = p_meeting_id
  LOOP
    -- 1 day before
    INSERT INTO meeting_reminders (meeting_id, user_id, reminder_time, reminder_type)
    VALUES (
      p_meeting_id,
      participant_record.user_id,
      meeting_record.scheduled_start - INTERVAL '1 day',
      '1_day'
    );
    
    -- 1 hour before
    INSERT INTO meeting_reminders (meeting_id, user_id, reminder_time, reminder_type)
    VALUES (
      p_meeting_id,
      participant_record.user_id,
      meeting_record.scheduled_start - INTERVAL '1 hour',
      '1_hour'
    );
    
    -- 5 minutes before
    INSERT INTO meeting_reminders (meeting_id, user_id, reminder_time, reminder_type)
    VALUES (
      p_meeting_id,
      participant_record.user_id,
      meeting_record.scheduled_start - INTERVAL '5 minutes',
      '5_min'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update meeting updated_at timestamp
CREATE OR REPLACE FUNCTION update_meeting_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS meetings_updated ON meetings;
CREATE TRIGGER meetings_updated
  BEFORE UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_timestamp();

-- Update participant duration when they leave
CREATE OR REPLACE FUNCTION update_participant_on_leave()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_type = 'left' THEN
    UPDATE meeting_participants
    SET 
      duration_seconds = calculate_participant_duration(NEW.participant_id),
      left_at = NEW.timestamp,
      status = 'left'
    WHERE id = NEW.participant_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attendance_log_update_participant ON meeting_attendance_log;
CREATE TRIGGER attendance_log_update_participant
  AFTER INSERT ON meeting_attendance_log
  FOR EACH ROW
  EXECUTE FUNCTION update_participant_on_leave();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendance_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_chat_messages ENABLE ROW LEVEL SECURITY;

-- Meetings: Users can see meetings for chamas they're members of
DROP POLICY IF EXISTS meetings_member_select ON meetings;
CREATE POLICY meetings_member_select ON meetings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chama_members cm
      WHERE cm.chama_id = meetings.chama_id
        AND cm.user_id = current_setting('app.current_user_id', true)::uuid
        AND cm.status = 'active'
    )
  );

-- Participants: Can see participants of meetings they're invited to
DROP POLICY IF EXISTS participants_select ON meeting_participants;
CREATE POLICY participants_select ON meeting_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meeting_participants mp
      WHERE mp.meeting_id = meeting_participants.meeting_id
        AND mp.user_id = current_setting('app.current_user_id', true)::uuid
    )
  );

-- Recordings: Based on access control settings
DROP POLICY IF EXISTS recordings_select ON meeting_recordings;
CREATE POLICY recordings_select ON meeting_recordings
  FOR SELECT
  USING (
    is_public = true
    OR EXISTS (
      SELECT 1 FROM meeting_participants mp
      JOIN chama_members cm ON mp.user_id = cm.user_id
      WHERE mp.meeting_id = meeting_recordings.meeting_id
        AND mp.user_id = current_setting('app.current_user_id', true)::uuid
        AND (
          meeting_recordings.is_public = true
          OR cm.role = ANY(meeting_recordings.allowed_viewer_roles)
        )
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE meetings IS 'Virtual meetings (audio/video) for chama members using Livekit';
COMMENT ON TABLE meeting_participants IS 'Participants invited to or attending meetings';
COMMENT ON TABLE meeting_attendance_log IS 'Detailed log of join/leave events for attendance tracking';
COMMENT ON TABLE meeting_recordings IS 'Recordings of meetings stored in document vault';
COMMENT ON TABLE meeting_reminders IS 'Scheduled reminders for upcoming meetings';
COMMENT ON TABLE meeting_chat_messages IS 'Chat messages, reactions, and interactions during meetings';

COMMENT ON COLUMN meetings.settings IS 'JSONB settings including late_threshold_minutes (default 5) for marking participants late';
COMMENT ON COLUMN meeting_participants.is_late IS 'Marked true if joined after late_threshold_minutes from scheduled start';
COMMENT ON COLUMN meeting_participants.duration_seconds IS 'Total time participant spent in meeting (calculated from attendance log)';
