"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageSquare,
  ThumbsUp,
  Send,
  Loader2,
  RefreshCw,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

interface Author {
  id: string;
  fullName: string;
  avatar?: string;
}

interface Reply {
  id: string;
  postId: string;
  parentReplyId: string | null;
  userId: string;
  content: string;
  edited: boolean;
  createdAt: string;
  updatedAt: string;
  author: Author;
  likesCount: number;
  likedByMe: boolean;
  replies: Reply[];
}

interface Post {
  id: string;
  chamaId: string;
  userId: string;
  content: string;
  edited: boolean;
  createdAt: string;
  updatedAt: string;
  author: Author;
  likesCount: number;
  repliesCount: number;
  likedByMe: boolean;
  replies: Reply[];
}

interface CommunityPostsProps {
  chamaId: string;
  userId: string;
}

export function CommunityPosts({ chamaId, userId }: CommunityPostsProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPostContent, setNewPostContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const getAuthToken = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("accessToken");
    }
    return null;
  };

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAuthToken();

      const response = await fetch(
        `${API_URL}/chama/${chamaId}/community/posts`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch posts");
      }

      const data = await response.json();
      setPosts(data.posts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [chamaId]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleCreatePost = async () => {
    if (!newPostContent.trim() || submitting) return;

    try {
      setSubmitting(true);
      const token = getAuthToken();

      const response = await fetch(
        `${API_URL}/chama/${chamaId}/community/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: newPostContent.trim() }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create post");
      }

      const newPost = await response.json();
      setPosts([newPost, ...posts]);
      setNewPostContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (postId: string, parentReplyId?: string) => {
    if (!replyContent.trim() || submitting) return;

    try {
      setSubmitting(true);
      const token = getAuthToken();

      const response = await fetch(
        `${API_URL}/chama/${chamaId}/community/posts/${postId}/replies`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content: replyContent.trim(),
            parentReplyId: parentReplyId || undefined,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to add reply");
      }

      // Refresh posts to get updated replies
      await fetchPosts();
      setReplyContent("");
      setReplyingTo(null);

      // Expand the post to show the new reply
      setExpandedPosts((prev) => new Set([...prev, postId]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add reply");
    } finally {
      setSubmitting(false);
    }
  };

  const togglePostLike = async (postId: string) => {
    try {
      const token = getAuthToken();

      const response = await fetch(
        `${API_URL}/chama/${chamaId}/community/posts/${postId}/like`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to toggle like");
      }

      const { liked, likesCount } = await response.json();

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, likedByMe: liked, likesCount } : post
        )
      );
    } catch (err) {
      console.error("Failed to toggle like:", err);
    }
  };

  const toggleReplyLike = async (replyId: string) => {
    try {
      const token = getAuthToken();

      const response = await fetch(
        `${API_URL}/chama/${chamaId}/community/replies/${replyId}/like`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to toggle like");
      }

      const { liked, likesCount } = await response.json();

      // Update reply likes in state
      setPosts((prev) =>
        prev.map((post) => ({
          ...post,
          replies: updateReplyLikes(post.replies, replyId, liked, likesCount),
        }))
      );
    } catch (err) {
      console.error("Failed to toggle reply like:", err);
    }
  };

  const updateReplyLikes = (
    replies: Reply[],
    replyId: string,
    liked: boolean,
    likesCount: number
  ): Reply[] => {
    return replies.map((reply) => {
      if (reply.id === replyId) {
        return { ...reply, likedByMe: liked, likesCount };
      }
      if (reply.replies.length > 0) {
        return {
          ...reply,
          replies: updateReplyLikes(reply.replies, replyId, liked, likesCount),
        };
      }
      return reply;
    });
  };

  const toggleExpanded = (postId: string) => {
    setExpandedPosts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const renderReply = (reply: Reply, postId: string, depth: number = 0) => {
    const isReplying = replyingTo === reply.id;
    const maxDepth = 2; // Max nesting depth for replies

    return (
      <div
        key={reply.id}
        className={`${
          depth > 0 ? "ml-8 mt-3 pl-4 border-l-2 border-gray-200" : "mt-3"
        }`}
      >
        <div className="flex gap-3">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarFallback className="bg-[#2e856e] text-white text-xs">
              {getInitials(reply.author.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm text-gray-900">
                  {reply.author.fullName}
                </span>
                <span className="text-xs text-gray-500">
                  {formatTimeAgo(reply.createdAt)}
                </span>
                {reply.edited && (
                  <span className="text-xs text-gray-400">(edited)</span>
                )}
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {reply.content}
              </p>
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
              <button
                onClick={() => toggleReplyLike(reply.id)}
                className={`flex items-center gap-1 hover:text-[#083232] transition-colors ${
                  reply.likedByMe ? "text-[#f64d52]" : ""
                }`}
              >
                <ThumbsUp
                  className={`w-3 h-3 ${reply.likedByMe ? "fill-current" : ""}`}
                />
                <span>{reply.likesCount}</span>
              </button>
              {depth < maxDepth && (
                <button
                  onClick={() => setReplyingTo(reply.id)}
                  className="hover:text-[#083232] transition-colors"
                >
                  Reply
                </button>
              )}
            </div>

            {isReplying && (
              <div className="mt-3">
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write your reply..."
                  className="min-h-[80px] text-sm"
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    onClick={() => handleReply(postId, reply.id)}
                    disabled={submitting || !replyContent.trim()}
                    className="bg-[#083232] hover:bg-[#2e856e]"
                  >
                    {submitting ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3 mr-1" />
                    )}
                    Reply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyContent("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {reply.replies.length > 0 && (
              <div className="mt-2">
                {reply.replies.map((nestedReply) =>
                  renderReply(nestedReply, postId, depth + 1)
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="w-8 h-8 text-[#083232] mx-auto mb-3 animate-spin" />
        <p className="text-sm text-gray-600">Loading posts...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <Button
          onClick={fetchPosts}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Create New Post */}
      <Card className="p-3">
        <div className="flex gap-2">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarFallback className="bg-[#083232] text-white text-xs">
              Y
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="Share something with the community..."
              className="min-h-[80px] mb-2 text-sm"
            />
            <Button
              onClick={handleCreatePost}
              disabled={!newPostContent.trim() || submitting}
              className="bg-[#083232] hover:bg-[#2e856e]"
              size="sm"
            >
              {submitting ? (
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
              ) : (
                <Send className="w-3 h-3 mr-2" />
              )}
              Post
            </Button>
          </div>
        </div>
      </Card>

      {/* Posts Feed */}
      {posts.length === 0 ? (
        <Card className="p-8 text-center">
          <MessageSquare className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">
            No posts yet. Be the first to post!
          </p>
        </Card>
      ) : (
        posts.map((post) => {
          const isExpanded = expandedPosts.has(post.id);
          const totalReplies = post.repliesCount;
          const isReplyingToPost = replyingTo === post.id;

          return (
            <Card key={post.id} className="p-3">
              <div className="flex gap-2">
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className="bg-[#2e856e] text-white text-xs">
                    {getInitials(post.author.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">
                        {post.author.fullName}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatTimeAgo(post.createdAt)}
                      </span>
                      {post.edited && (
                        <span className="text-xs text-gray-400">(edited)</span>
                      )}
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {post.content}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 pb-3 border-b">
                    <button
                      onClick={() => togglePostLike(post.id)}
                      className={`flex items-center gap-1 hover:text-[#083232] transition-colors ${
                        post.likedByMe ? "text-[#f64d52]" : ""
                      }`}
                    >
                      <ThumbsUp
                        className={`w-4 h-4 ${
                          post.likedByMe ? "fill-current" : ""
                        }`}
                      />
                      <span>{post.likesCount}</span>
                    </button>
                    <button
                      onClick={() => setReplyingTo(post.id)}
                      className="flex items-center gap-1 hover:text-[#083232] transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Reply</span>
                    </button>
                    {totalReplies > 0 && (
                      <button
                        onClick={() => toggleExpanded(post.id)}
                        className="hover:text-[#083232] transition-colors"
                      >
                        {isExpanded ? "Hide" : "View"} {totalReplies}{" "}
                        {totalReplies === 1 ? "reply" : "replies"}
                      </button>
                    )}
                  </div>

                  {isReplyingToPost && (
                    <div className="mt-3">
                      <Textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Write your reply..."
                        className="min-h-[80px]"
                      />
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          onClick={() => handleReply(post.id)}
                          disabled={submitting || !replyContent.trim()}
                          className="bg-[#083232] hover:bg-[#2e856e]"
                        >
                          {submitting ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3 mr-1" />
                          )}
                          Reply
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyContent("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {isExpanded &&
                    post.replies.map((reply) => renderReply(reply, post.id))}
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
