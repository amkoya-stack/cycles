"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Paperclip,
  Image,
  Smile,
  BarChart3,
  Trash2,
  Pin,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
  pinned?: boolean;
  pinnedAt?: string;
  createdAt: string;
  updatedAt: string;
  author: Author;
  likesCount: number;
  repliesCount: number;
  likedByMe: boolean;
  replies: Reply[];
  // Poll data (if this is a governance proposal poll)
  isPoll?: boolean;
  pollOptions?: string[];
  proposalId?: string;
  votes?: { [key: string]: number };
  userVote?: string;
  pollStatus?: string;
  pollDeadline?: string;
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPollDialog, setShowPollDialog] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["Option 1", "Option 2"]);
  const [pollDescription, setPollDescription] = useState("");
  const [creatingPoll, setCreatingPoll] = useState(false);

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

      // Fetch regular posts
      const postsResponse = await fetch(
        `${API_URL}/chama/${chamaId}/community/posts`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!postsResponse.ok) {
        throw new Error("Failed to fetch posts");
      }

      const postsData = await postsResponse.json();
      const regularPosts = postsData.posts || [];

      // Fetch active polls (governance proposals with isPoll metadata)
      const pollsResponse = await fetch(
        `${API_URL}/governance/chama/${chamaId}/proposals?status=active`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      let polls: any[] = [];
      if (pollsResponse.ok) {
        const pollsData = await pollsResponse.json();
        // Filter for proposals that are polls
        polls = (pollsData.proposals || [])
          .filter((p: any) => p.metadata?.isPoll)
          .map((p: any) => ({
            id: `poll-${p.id}`,
            proposalId: p.id,
            chamaId: p.chamaId,
            userId: p.createdBy,
            content: p.title,
            isPoll: true,
            pollOptions: p.metadata.options || [],
            pollStatus: p.status,
            pollDeadline: p.deadline,
            votes: p.voteBreakdown || {},
            userVote: p.userVote,
            edited: false,
            pinned: false,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            author: {
              id: p.createdBy,
              fullName: p.creatorName || "Unknown",
              avatar: p.creatorAvatar,
            },
            likesCount: 0,
            repliesCount: 0,
            likedByMe: false,
            replies: [],
          }));
      }

      // Merge posts and polls, sort by created date
      const allItems = [...regularPosts, ...polls].sort((a, b) => {
        // Pinned posts first
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        // Then by creation date
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setPosts(allItems);
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

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const token = getAuthToken();

      const response = await fetch(
        `${API_URL}/chama/${chamaId}/community/posts/${postId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete post");
      }

      setPosts((prev) => prev.filter((post) => post.id !== postId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete post");
    }
  };

  const handleTogglePin = async (postId: string) => {
    try {
      const token = getAuthToken();

      const response = await fetch(
        `${API_URL}/chama/${chamaId}/community/posts/${postId}/pin`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to pin/unpin post");
      }

      const { pinned } = await response.json();

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, pinned, pinnedAt: pinned ? new Date().toISOString() : undefined } : post
        )
      );
    } catch (err) {
      console.error("Failed to toggle pin:", err);
      setError(err instanceof Error ? err.message : "Failed to pin/unpin post");
    }
  };

  const handleVotePoll = async (proposalId: string, option: string) => {
    try {
      const token = getAuthToken();

      const response = await fetch(
        `${API_URL}/governance/proposals/${proposalId}/vote`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            vote: "for",
            reason: option, // Store selected option in reason field
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to vote on poll");
      }

      // Refresh posts to show updated vote counts
      await fetchPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote on poll");
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!confirm("Are you sure you want to delete this reply?")) return;

    try {
      const token = getAuthToken();

      const response = await fetch(
        `${API_URL}/chama/${chamaId}/community/replies/${replyId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete reply");
      }

      // Refresh posts to update reply counts and remove the deleted reply
      await fetchPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete reply");
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setSelectedFiles(Array.from(files));
      // TODO: Upload files to server and attach to post
      alert(`Selected ${files.length} file(s). File upload coming soon!`);
    }
  };

  const handleMediaSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setSelectedMedia(Array.from(files));
      // TODO: Upload media to server and attach to post
      alert(`Selected ${files.length} media file(s). Media upload coming soon!`);
    }
  };

  const insertEmoji = (emoji: string) => {
    setNewPostContent(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const addPollOption = () => {
    setPollOptions([...pollOptions, `Option ${pollOptions.length + 1}`]);
  };

  const updatePollOption = (index: number, value: string) => {
    const updated = [...pollOptions];
    updated[index] = value;
    setPollOptions(updated);
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const handleCreatePoll = async () => {
    if (!pollQuestion.trim() || creatingPoll) return;
    
    const validOptions = pollOptions.filter(opt => opt.trim());
    if (validOptions.length < 2) {
      alert("Please provide at least 2 options");
      return;
    }

    try {
      setCreatingPoll(true);
      const token = getAuthToken();

      const response = await fetch(`${API_URL}/governance/proposals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chamaId,
          proposalType: "other",
          title: pollQuestion.trim(),
          description: pollDescription.trim() || "Community poll",
          metadata: {
            isPoll: true,
            options: validOptions,
          },
          votingType: "simple_majority",
          anonymous: false,
          allowVoteChange: true,
          deadlineHours: 168, // 7 days
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create poll");
      }

      // Reset form
      setPollQuestion("");
      setPollDescription("");
      setPollOptions(["Option 1", "Option 2"]);
      setShowPollDialog(false);
      
      // Refresh posts to show poll
      await fetchPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create poll");
    } finally {
      setCreatingPoll(false);
    }
  };

  const commonEmojis = ['😊', '😂', '❤️', '👍', '🎉', '🔥', '💯', '🙏', '👏', '✨', '💪', '🤝', '👌', '🙌', '💰', '📈'];

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
              {reply.author.id === userId && (
                <button
                  onClick={() => handleDeleteReply(reply.id)}
                  className="hover:text-[#f64d52] transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 relative">
                {/* File Attachment */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 w-8 p-0 text-gray-500 hover:text-[#083232] hover:bg-gray-100"
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Attach files</p>
                  </TooltipContent>
                </Tooltip>

                {/* Media Upload */}
                <input
                  ref={mediaInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleMediaSelect}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => mediaInputRef.current?.click()}
                      className="h-8 w-8 p-0 text-gray-500 hover:text-[#083232] hover:bg-gray-100"
                    >
                      <Image className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Add photos/videos</p>
                  </TooltipContent>
                </Tooltip>

                {/* Emoji Picker */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="h-8 w-8 p-0 text-gray-500 hover:text-[#083232] hover:bg-gray-100"
                    >
                      <Smile className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Add emoji</p>
                  </TooltipContent>
                </Tooltip>

                {/* Emoji Picker Popup */}
                {showEmojiPicker && (
                  <div className="absolute top-10 left-0 z-50 bg-white border rounded-lg shadow-lg p-2">
                    <div className="grid grid-cols-8 gap-1">
                      {commonEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => insertEmoji(emoji)}
                          className="text-xl hover:bg-gray-100 rounded p-1 transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Poll Creation */}
                <Dialog open={showPollDialog} onOpenChange={setShowPollDialog}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-500 hover:text-[#083232] hover:bg-gray-100"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Create a poll</p>
                    </TooltipContent>
                  </Tooltip>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create a Poll</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <label className="text-sm font-medium">Question</label>
                        <Input
                          value={pollQuestion}
                          onChange={(e) => setPollQuestion(e.target.value)}
                          placeholder="What would you like to ask?"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Description (optional)</label>
                        <Textarea
                          value={pollDescription}
                          onChange={(e) => setPollDescription(e.target.value)}
                          placeholder="Add more context..."
                          className="mt-1 min-h-[60px]"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Options</label>
                        {pollOptions.map((option, index) => (
                          <div key={index} className="flex gap-2 mt-2">
                            <Input
                              value={option}
                              onChange={(e) => updatePollOption(index, e.target.value)}
                              placeholder={`Option ${index + 1}`}
                            />
                            {pollOptions.length > 2 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removePollOption(index)}
                                className="px-3"
                              >
                                ✕
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={addPollOption}
                        >
                          + Add Option
                        </Button>
                      </div>
                      <Button
                        className="w-full bg-[#083232] hover:bg-[#2e856e]"
                        onClick={handleCreatePoll}
                        disabled={!pollQuestion.trim() || creatingPoll}
                      >
                        {creatingPoll ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Poll"
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
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
            <Card key={post.id} className={`p-3 ${post.pinned ? 'border-2 border-[#083232]' : ''}`}>
              {post.pinned && (
                <div className="flex items-center gap-1 text-xs text-[#083232] font-medium mb-2">
                  <Pin className="w-3 h-3 fill-current" />
                  <span>Pinned Post</span>
                </div>
              )}
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
                      {post.isPoll && (
                        <span className="text-xs bg-[#083232] text-white px-2 py-0.5 rounded">
                          Poll
                        </span>
                      )}
                    </div>
                    {post.isPoll ? (
                      <div className="space-y-3">
                        <p className="text-gray-900 font-medium">{post.content}</p>
                        <div className="space-y-2">
                          {post.pollOptions?.map((option: string, idx: number) => {
                            const totalVotes = Object.values(post.votes || {}).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
                            const optionVotes = (post.votes?.[option] as number) || 0;
                            const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                            const isSelected = post.userVote === option;

                            return (
                              <button
                                key={idx}
                                onClick={() => !post.userVote && post.proposalId && handleVotePoll(post.proposalId, option)}
                                disabled={!!post.userVote || post.pollStatus !== 'active'}
                                className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                                  isSelected
                                    ? 'border-[#083232] bg-[#083232]/5'
                                    : 'border-gray-200 hover:border-[#2e856e]'
                                } ${post.userVote || post.pollStatus !== 'active' ? 'cursor-default' : 'cursor-pointer'}`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium">{option}</span>
                                  {post.userVote && (
                                    <span className="text-xs text-gray-600">
                                      {percentage}% ({optionVotes} {optionVotes === 1 ? 'vote' : 'votes'})
                                    </span>
                                  )}
                                </div>
                                {post.userVote && (
                                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                    <div
                                      className="bg-[#083232] h-2 rounded-full transition-all"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {post.pollDeadline && (
                          <p className="text-xs text-gray-500">
                            {post.pollStatus === 'active' 
                              ? `Ends ${formatTimeAgo(post.pollDeadline)}`
                              : `Ended ${formatTimeAgo(post.pollDeadline)}`}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {post.content}
                      </p>
                    )}
                  </div>

                  {!post.isPoll && (
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
                      <div className="flex items-center gap-2 ml-auto">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleTogglePin(post.id)}
                              className={`hover:text-[#083232] transition-colors ${
                                post.pinned ? "text-[#083232]" : ""
                              }`}
                            >
                              <Pin className={`w-4 h-4 ${post.pinned ? "fill-current" : ""}`} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p>{post.pinned ? "Unpin post" : "Pin post"}</p>
                          </TooltipContent>
                        </Tooltip>
                        {post.author.id === userId && (
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="flex items-center gap-1 hover:text-[#f64d52] transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

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
