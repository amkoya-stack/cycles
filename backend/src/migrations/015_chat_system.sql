-- Chat System for Chama Members
-- Allows private messaging between chama members only

-- Conversations table (represents a chat between two users)
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    participant_1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique conversation per user pair within a chama
    UNIQUE(chama_id, participant_1_id, participant_2_id),
    
    -- Ensure participant_1_id < participant_2_id for consistent ordering
    CHECK (participant_1_id != participant_2_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_chama ON conversations(chama_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(participant_1_id, participant_2_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(sender_id, is_read) WHERE is_read = FALSE;

-- Function to get conversation between two users in a chama
CREATE OR REPLACE FUNCTION get_or_create_conversation(
    p_chama_id UUID,
    p_user1_id UUID, 
    p_user2_id UUID
) RETURNS UUID AS $$
DECLARE
    conversation_uuid UUID;
    ordered_user1 UUID;
    ordered_user2 UUID;
BEGIN
    -- Ensure consistent ordering (smaller UUID first)
    IF p_user1_id < p_user2_id THEN
        ordered_user1 := p_user1_id;
        ordered_user2 := p_user2_id;
    ELSE
        ordered_user1 := p_user2_id;
        ordered_user2 := p_user1_id;
    END IF;
    
    -- Try to find existing conversation
    SELECT id INTO conversation_uuid 
    FROM conversations 
    WHERE chama_id = p_chama_id 
      AND participant_1_id = ordered_user1 
      AND participant_2_id = ordered_user2;
    
    -- Create if doesn't exist
    IF conversation_uuid IS NULL THEN
        INSERT INTO conversations (chama_id, participant_1_id, participant_2_id)
        VALUES (p_chama_id, ordered_user1, ordered_user2)
        RETURNING id INTO conversation_uuid;
    END IF;
    
    RETURN conversation_uuid;
END;
$$ LANGUAGE plpgsql;

-- Update conversations.updated_at when new message is added
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_update_conversation_timestamp ON messages;
CREATE TRIGGER messages_update_conversation_timestamp
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- Comments for clarity
COMMENT ON TABLE conversations IS 'Private conversations between chama members';
COMMENT ON TABLE messages IS 'Messages within conversations';
COMMENT ON FUNCTION get_or_create_conversation IS 'Gets existing conversation or creates new one between two users in a chama';