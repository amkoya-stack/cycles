/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface Post {
  id: string;
  chamaId: string;
  userId: string;
  content: string;
  edited: boolean;
  pinned?: boolean;
  pinnedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    fullName: string;
    avatar?: string;
  };
  likesCount: number;
  repliesCount: number;
  likedByMe: boolean;
  replies: Reply[];
}

export interface Reply {
  id: string;
  postId: string;
  parentReplyId: string | null;
  userId: string;
  content: string;
  edited: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    fullName: string;
    avatar?: string;
  };
  likesCount: number;
  likedByMe: boolean;
  replies: Reply[];
}

@Injectable()
export class CommunityService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Verify user is a member of the chama
   */
  private async verifyMembership(
    chamaId: string,
    userId: string,
  ): Promise<void> {
    const result = await this.db.query(
      `SELECT id FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [chamaId, userId],
    );
    if (result.rowCount === 0) {
      throw new ForbiddenException('You are not a member of this chama');
    }
  }

  /**
   * Create a new post
   */
  async createPost(
    chamaId: string,
    userId: string,
    content: string,
  ): Promise<Post> {
    await this.verifyMembership(chamaId, userId);

    const result = await this.db.query(
      `INSERT INTO community_posts (chama_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, chama_id, user_id, content, edited, created_at, updated_at`,
      [chamaId, userId, content.trim()],
    );

    const post = result.rows[0];

    // Get author info
    const authorResult = await this.db.query(
      `SELECT id, full_name, profile_photo_url FROM users WHERE id = $1`,
      [userId],
    );
    const author = authorResult.rows[0];

    return {
      id: post.id,
      chamaId: post.chama_id,
      userId: post.user_id,
      content: post.content,
      edited: post.edited,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      author: {
        id: author.id,
        fullName: author.full_name,
        avatar: author.profile_photo_url,
      },
      likesCount: 0,
      repliesCount: 0,
      likedByMe: false,
      replies: [],
    };
  }

  /**
   * Get all posts for a chama with replies (nested up to 3 levels)
   */
  async getPosts(
    chamaId: string,
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ posts: Post[]; total: number }> {
    await this.verifyMembership(chamaId, userId);

    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await this.db.query(
      `SELECT COUNT(*) FROM community_posts WHERE chama_id = $1`,
      [chamaId],
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get posts with author info, likes count, and replies count
    const postsResult = await this.db.query(
      `SELECT 
        p.id, p.chama_id, p.user_id, p.content, p.edited, p.pinned, p.pinned_at, p.created_at, p.updated_at,
        u.id as author_id, u.full_name as author_name, u.profile_photo_url as author_avatar,
        (SELECT COUNT(*) FROM community_likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM community_replies WHERE post_id = p.id) as replies_count,
        EXISTS(SELECT 1 FROM community_likes WHERE post_id = p.id AND user_id = $2) as liked_by_me
       FROM community_posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.chama_id = $1
       ORDER BY p.pinned DESC NULLS LAST, p.created_at DESC
       LIMIT $3 OFFSET $4`,
      [chamaId, userId, limit, offset],
    );

    const posts: Post[] = [];

    for (const row of postsResult.rows) {
      // Get replies for this post (with nesting)
      const replies = await this.getRepliesForPost(row.id, userId);

      posts.push({
        id: row.id,
        chamaId: row.chama_id,
        userId: row.user_id,
        content: row.content,
        edited: row.edited,
        pinned: row.pinned,
        pinnedAt: row.pinned_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        author: {
          id: row.author_id,
          fullName: row.author_name,
          avatar: row.author_avatar,
        },
        likesCount: parseInt(row.likes_count, 10),
        repliesCount: parseInt(row.replies_count, 10),
        likedByMe: row.liked_by_me,
        replies,
      });
    }

    return { posts, total };
  }

  /**
   * Get nested replies for a post
   */
  private async getRepliesForPost(
    postId: string,
    userId: string,
  ): Promise<Reply[]> {
    // Get all replies for this post
    const repliesResult = await this.db.query(
      `SELECT 
        r.id, r.post_id, r.parent_reply_id, r.user_id, r.content, r.edited, r.created_at, r.updated_at,
        u.id as author_id, u.full_name as author_name, u.profile_photo_url as author_avatar,
        (SELECT COUNT(*) FROM community_likes WHERE reply_id = r.id) as likes_count,
        EXISTS(SELECT 1 FROM community_likes WHERE reply_id = r.id AND user_id = $2) as liked_by_me
       FROM community_replies r
       JOIN users u ON r.user_id = u.id
       WHERE r.post_id = $1
       ORDER BY r.created_at ASC`,
      [postId, userId],
    );

    // Build nested structure
    const repliesMap = new Map<string, Reply>();
    const topLevelReplies: Reply[] = [];

    // First pass: create all reply objects
    for (const row of repliesResult.rows) {
      const reply: Reply = {
        id: row.id,
        postId: row.post_id,
        parentReplyId: row.parent_reply_id,
        userId: row.user_id,
        content: row.content,
        edited: row.edited,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        author: {
          id: row.author_id,
          fullName: row.author_name,
          avatar: row.author_avatar,
        },
        likesCount: parseInt(row.likes_count, 10),
        likedByMe: row.liked_by_me,
        replies: [],
      };
      repliesMap.set(row.id, reply);
    }

    // Second pass: build tree structure (max 3 levels)
    for (const row of repliesResult.rows) {
      const reply = repliesMap.get(row.id)!;
      if (row.parent_reply_id) {
        const parent = repliesMap.get(row.parent_reply_id);
        if (parent) {
          parent.replies.push(reply);
        } else {
          // Parent not found, treat as top-level
          topLevelReplies.push(reply);
        }
      } else {
        topLevelReplies.push(reply);
      }
    }

    return topLevelReplies;
  }

  /**
   * Create a reply to a post or another reply
   */
  async createReply(
    chamaId: string,
    postId: string,
    userId: string,
    content: string,
    parentReplyId?: string,
  ): Promise<Reply> {
    await this.verifyMembership(chamaId, userId);

    // Verify post exists and belongs to this chama
    const postResult = await this.db.query(
      `SELECT id FROM community_posts WHERE id = $1 AND chama_id = $2`,
      [postId, chamaId],
    );
    if (postResult.rowCount === 0) {
      throw new NotFoundException('Post not found');
    }

    // If replying to another reply, verify it exists and check nesting depth
    if (parentReplyId) {
      const parentResult = await this.db.query(
        `SELECT id, parent_reply_id FROM community_replies WHERE id = $1 AND post_id = $2`,
        [parentReplyId, postId],
      );
      if (parentResult.rowCount === 0) {
        throw new NotFoundException('Parent reply not found');
      }

      // Check nesting depth (max 3 levels)
      const depth = await this.getReplyDepth(parentReplyId);
      if (depth >= 2) {
        // Depth 2 means we're at level 3, can't nest further
        throw new BadRequestException('Maximum reply nesting depth reached');
      }
    }

    const result = await this.db.query(
      `INSERT INTO community_replies (post_id, parent_reply_id, user_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, post_id, parent_reply_id, user_id, content, edited, created_at, updated_at`,
      [postId, parentReplyId || null, userId, content.trim()],
    );

    const reply = result.rows[0];

    // Get author info
    const authorResult = await this.db.query(
      `SELECT id, full_name, profile_photo_url FROM users WHERE id = $1`,
      [userId],
    );
    const author = authorResult.rows[0];

    return {
      id: reply.id,
      postId: reply.post_id,
      parentReplyId: reply.parent_reply_id,
      userId: reply.user_id,
      content: reply.content,
      edited: reply.edited,
      createdAt: reply.created_at,
      updatedAt: reply.updated_at,
      author: {
        id: author.id,
        fullName: author.full_name,
        avatar: author.profile_photo_url,
      },
      likesCount: 0,
      likedByMe: false,
      replies: [],
    };
  }

  /**
   * Get the nesting depth of a reply
   */
  private async getReplyDepth(replyId: string): Promise<number> {
    let depth = 0;
    let currentId: string | null = replyId;

    while (currentId) {
      const result = await this.db.query(
        `SELECT parent_reply_id FROM community_replies WHERE id = $1`,
        [currentId],
      );
      if (result.rowCount === 0) break;
      currentId = result.rows[0].parent_reply_id;
      if (currentId) depth++;
    }

    return depth;
  }

  /**
   * Toggle like on a post
   */
  async togglePostLike(
    chamaId: string,
    postId: string,
    userId: string,
  ): Promise<{ liked: boolean; likesCount: number }> {
    await this.verifyMembership(chamaId, userId);

    // Verify post exists and belongs to this chama
    const postResult = await this.db.query(
      `SELECT id FROM community_posts WHERE id = $1 AND chama_id = $2`,
      [postId, chamaId],
    );
    if (postResult.rowCount === 0) {
      throw new NotFoundException('Post not found');
    }

    // Check if already liked
    const existingLike = await this.db.query(
      `SELECT id FROM community_likes WHERE post_id = $1 AND user_id = $2`,
      [postId, userId],
    );

    let liked: boolean;

    if (existingLike.rowCount > 0) {
      // Unlike
      await this.db.query(
        `DELETE FROM community_likes WHERE post_id = $1 AND user_id = $2`,
        [postId, userId],
      );
      liked = false;
    } else {
      // Like
      await this.db.query(
        `INSERT INTO community_likes (post_id, user_id) VALUES ($1, $2)`,
        [postId, userId],
      );
      liked = true;
    }

    // Get updated count
    const countResult = await this.db.query(
      `SELECT COUNT(*) FROM community_likes WHERE post_id = $1`,
      [postId],
    );

    return {
      liked,
      likesCount: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Toggle like on a reply
   */
  async toggleReplyLike(
    chamaId: string,
    replyId: string,
    userId: string,
  ): Promise<{ liked: boolean; likesCount: number }> {
    await this.verifyMembership(chamaId, userId);

    // Verify reply exists and belongs to a post in this chama
    const replyResult = await this.db.query(
      `SELECT r.id FROM community_replies r
       JOIN community_posts p ON r.post_id = p.id
       WHERE r.id = $1 AND p.chama_id = $2`,
      [replyId, chamaId],
    );
    if (replyResult.rowCount === 0) {
      throw new NotFoundException('Reply not found');
    }

    // Check if already liked
    const existingLike = await this.db.query(
      `SELECT id FROM community_likes WHERE reply_id = $1 AND user_id = $2`,
      [replyId, userId],
    );

    let liked: boolean;

    if (existingLike.rowCount > 0) {
      // Unlike
      await this.db.query(
        `DELETE FROM community_likes WHERE reply_id = $1 AND user_id = $2`,
        [replyId, userId],
      );
      liked = false;
    } else {
      // Like
      await this.db.query(
        `INSERT INTO community_likes (reply_id, user_id) VALUES ($1, $2)`,
        [replyId, userId],
      );
      liked = true;
    }

    // Get updated count
    const countResult = await this.db.query(
      `SELECT COUNT(*) FROM community_likes WHERE reply_id = $1`,
      [replyId],
    );

    return {
      liked,
      likesCount: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Update a post (only by author)
   */
  async updatePost(
    chamaId: string,
    postId: string,
    userId: string,
    content: string,
  ): Promise<Post> {
    await this.verifyMembership(chamaId, userId);

    // Verify post exists and user is author
    const postResult = await this.db.query(
      `SELECT id, user_id FROM community_posts WHERE id = $1 AND chama_id = $2`,
      [postId, chamaId],
    );
    if (postResult.rowCount === 0) {
      throw new NotFoundException('Post not found');
    }
    if (postResult.rows[0].user_id !== userId) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    await this.db.query(
      `UPDATE community_posts SET content = $1, edited = true WHERE id = $2`,
      [content.trim(), postId],
    );

    // Return updated post (refetch to get all data)
    const { posts } = await this.getPosts(chamaId, userId, 1, 1);
    const updatedPost = posts.find((p) => p.id === postId);
    if (!updatedPost) {
      throw new NotFoundException('Post not found after update');
    }
    return updatedPost;
  }

  /**
   * Delete a post (only by author or admin)
   */
  async deletePost(
    chamaId: string,
    postId: string,
    userId: string,
  ): Promise<void> {
    await this.verifyMembership(chamaId, userId);

    // Check if user is author or admin
    const postResult = await this.db.query(
      `SELECT p.user_id, m.role FROM community_posts p
       JOIN chama_members m ON m.chama_id = p.chama_id AND m.user_id = $3
       WHERE p.id = $1 AND p.chama_id = $2`,
      [postId, chamaId, userId],
    );
    if (postResult.rowCount === 0) {
      throw new NotFoundException('Post not found');
    }

    const { user_id: authorId, role } = postResult.rows[0];
    const isAdmin = ['chairperson', 'secretary', 'treasurer'].includes(role);

    if (authorId !== userId && !isAdmin) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.db.query(`DELETE FROM community_posts WHERE id = $1`, [postId]);
  }

  /**
   * Delete a reply (only by author or admin)
   */
  async deleteReply(
    chamaId: string,
    replyId: string,
    userId: string,
  ): Promise<void> {
    await this.verifyMembership(chamaId, userId);

    // Check if user is author or admin
    const replyResult = await this.db.query(
      `SELECT r.user_id, m.role FROM community_replies r
       JOIN community_posts p ON r.post_id = p.id
       JOIN chama_members m ON m.chama_id = p.chama_id AND m.user_id = $3
       WHERE r.id = $1 AND p.chama_id = $2`,
      [replyId, chamaId, userId],
    );
    if (replyResult.rowCount === 0) {
      throw new NotFoundException('Reply not found');
    }

    const { user_id: authorId, role } = replyResult.rows[0];
    const isAdmin = ['chairperson', 'secretary', 'treasurer'].includes(role);

    if (authorId !== userId && !isAdmin) {
      throw new ForbiddenException('You can only delete your own replies');
    }

    await this.db.query(`DELETE FROM community_replies WHERE id = $1`, [
      replyId,
    ]);
  }

  /**
   * Toggle pin status of a post (admin only)
   */
  async togglePin(
    chamaId: string,
    postId: string,
    userId: string,
  ): Promise<{ pinned: boolean }> {
    await this.verifyMembership(chamaId, userId);

    // Check if user is admin
    const memberResult = await this.db.query(
      `SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2`,
      [chamaId, userId],
    );

    if (memberResult.rowCount === 0) {
      throw new ForbiddenException('You are not a member of this chama');
    }

    const { role } = memberResult.rows[0];
    const isAdmin = ['chairperson', 'secretary', 'treasurer'].includes(role);

    if (!isAdmin) {
      throw new ForbiddenException('Only admins can pin/unpin posts');
    }

    // Check if post exists
    const postResult = await this.db.query(
      `SELECT pinned FROM community_posts WHERE id = $1 AND chama_id = $2`,
      [postId, chamaId],
    );

    if (postResult.rowCount === 0) {
      throw new NotFoundException('Post not found');
    }

    const currentPinned = postResult.rows[0].pinned;
    const newPinned = !currentPinned;

    // Toggle pin status
    await this.db.query(
      `UPDATE community_posts 
       SET pinned = $1, pinned_at = CASE WHEN $1 = TRUE THEN NOW() ELSE NULL END
       WHERE id = $2`,
      [newPinned, postId],
    );

    return { pinned: newPinned };
  }
}
