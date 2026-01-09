-- Migration 048: Add chat_enabled to notification_preferences
-- Allows users to control whether other members can send them chat messages

-- Add chat_enabled column to notification_preferences table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notification_preferences' 
        AND column_name = 'chat_enabled'
    ) THEN
        ALTER TABLE notification_preferences 
        ADD COLUMN chat_enabled BOOLEAN DEFAULT true;
        
        -- Create index for faster lookups
        CREATE INDEX IF NOT EXISTS idx_notification_preferences_chat_enabled 
        ON notification_preferences(user_id, chama_id, chat_enabled);
        
        -- Set existing records to enabled by default
        UPDATE notification_preferences 
        SET chat_enabled = true 
        WHERE chat_enabled IS NULL;
    END IF;
END $$;


