-- Migration 010: Community Posts System
-- Description: Create tables for community posts, replies, and likes

-- Community Posts Table
CREATE TABLE IF NOT EXISTS community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT content_not_empty CHECK (LENGTH(TRIM(content)) > 0)
);

-- Community Replies Table (supports nested replies)
CREATE TABLE IF NOT EXISTS community_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    parent_reply_id UUID REFERENCES community_replies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT reply_content_not_empty CHECK (LENGTH(TRIM(content)) > 0)
);

-- Community Likes Table (for both posts and replies)
CREATE TABLE IF NOT EXISTS community_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
    reply_id UUID REFERENCES community_replies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT like_target CHECK (
        (post_id IS NOT NULL AND reply_id IS NULL) OR
        (post_id IS NULL AND reply_id IS NOT NULL)
    ),
    CONSTRAINT unique_post_like UNIQUE (post_id, user_id),
    CONSTRAINT unique_reply_like UNIQUE (reply_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_community_posts_chama ON community_posts(chama_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_user ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_replies_post ON community_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_community_replies_parent ON community_replies(parent_reply_id);
CREATE INDEX IF NOT EXISTS idx_community_replies_user ON community_replies(user_id);

CREATE INDEX IF NOT EXISTS idx_community_likes_post ON community_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_community_likes_reply ON community_likes(reply_id);
CREATE INDEX IF NOT EXISTS idx_community_likes_user ON community_likes(user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_community_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_community_posts_updated_at
    BEFORE UPDATE ON community_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_community_updated_at();

CREATE TRIGGER update_community_replies_updated_at
    BEFORE UPDATE ON community_replies
    FOR EACH ROW
    EXECUTE FUNCTION update_community_updated_at();

-- Row Level Security (optional - can enable if needed)
-- Ensures users can only delete their own posts/replies
-- ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE community_replies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE community_likes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE community_posts IS 'Community discussion posts within chamas';
COMMENT ON TABLE community_replies IS 'Threaded replies to community posts';
COMMENT ON TABLE community_likes IS 'Likes for posts and replies';
