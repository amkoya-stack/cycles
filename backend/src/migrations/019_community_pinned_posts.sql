-- Migration 019: Add pinned posts support to community
-- Description: Add pinned column and pinned_at timestamp to community_posts

-- Add pinned column
ALTER TABLE community_posts 
ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP WITH TIME ZONE;

-- Add index for pinned posts (for efficient querying)
CREATE INDEX IF NOT EXISTS idx_community_posts_pinned ON community_posts(chama_id, pinned DESC, pinned_at DESC) WHERE pinned = TRUE;

-- Add index for ordering posts (pinned first, then by created_at)
CREATE INDEX IF NOT EXISTS idx_community_posts_order ON community_posts(chama_id, pinned DESC, created_at DESC);

COMMENT ON COLUMN community_posts.pinned IS 'Whether this post is pinned to the top of the feed';
COMMENT ON COLUMN community_posts.pinned_at IS 'Timestamp when the post was pinned';
