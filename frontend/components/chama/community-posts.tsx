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
  Circle,
  CheckCircle2,
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
  // Governance proposal specific
  isGovernanceProposal?: boolean;
  proposalType?: string;
  description?: string;
  metadata?: {
    amount?: number;
    recipientName?: string;
    destinationType?: string;
    reason?: string;
    [key: string]: unknown;
  };
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
  const [pollDeadlineHours, setPollDeadlineHours] = useState(24); // Default 24 hours
  const [creatingPoll, setCreatingPoll] = useState(false);

  // Poll duration presets in hours
  const pollDurationPresets = [
    { label: "2h", hours: 2 },
    { label: "12h", hours: 12 },
    { label: "24h", hours: 24 },
    { label: "3d", hours: 72 },
    { label: "7d", hours: 168 },
  ];

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
      // Note: fetching both active and draft status since new polls might be in draft
      const pollsResponse = await fetch(
        `${API_URL}/governance/chama/${chamaId}/proposals`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      let polls: any[] = [];
      if (pollsResponse.ok) {
        const pollsData = await pollsResponse.json();
        console.log("Raw governance proposals response:", pollsData);
        console.log("Is array?", Array.isArray(pollsData));
        console.log(
          "Number of proposals:",
          Array.isArray(pollsData) ? pollsData.length : 0
        );

        // The response is an array directly, not wrapped in an object
        const proposals = Array.isArray(pollsData) ? pollsData : [];

        // Filter for proposals that are polls OR governance proposals requiring votes
        // and created within the last week
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        // Governance proposal types that should show in community feed for voting
        const votableProposalTypes = [
          "transfer_funds",
          "accept_member",
          "reject_member",
          "remove_member",
          "change_settings",
          "emergency_action",
          "custom",
        ];

        const pollPromises = proposals
          .filter((p: any) => {
            const isPoll = p.metadata?.isPoll === true;
            const isVotableProposal = votableProposalTypes.includes(
              p.proposal_type?.toLowerCase()
            );
            const createdAt = new Date(p.created_at);
            const isRecent = createdAt >= oneWeekAgo;
            const isActive = p.status === "active" || p.status === "draft";

            console.log(`Proposal ${p.id}:`, {
              title: p.title,
              type: p.proposal_type,
              isPoll,
              isVotableProposal,
              createdAt: p.created_at,
              isRecent,
              isActive,
              status: p.status,
            });

            // Show if it's a poll OR a votable governance proposal that's still active
            return (isPoll || (isVotableProposal && isActive)) && isRecent;
          })
          .map(async (p: any) => {
            const isPoll = p.metadata?.isPoll === true;
            console.log("✅ Processing proposal:", {
              id: p.id,
              title: p.title,
              type: p.proposal_type,
              isPoll,
              options: p.metadata?.options,
            });

            // Fetch vote breakdown for this poll/proposal
            let voteBreakdown: { [key: string]: number } = {};
            let userVotedOption: string | null = null;
            let votesFor = 0;
            let votesAgainst = 0;

            try {
              const votesResponse = await fetch(
                `${API_URL}/governance/proposals/${p.id}`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              if (votesResponse.ok) {
                const proposalDetails = await votesResponse.json();
                console.log("Proposal details:", proposalDetails);

                // For governance proposals, count for/against votes from voting_results
                votesFor = proposalDetails.votes_for || 0;
                votesAgainst = proposalDetails.votes_against || 0;

                // Count votes from the votes array (for active proposals)
                if (proposalDetails.votes && proposalDetails.votes.length > 0) {
                  proposalDetails.votes.forEach((vote: any) => {
                    if (isPoll && vote.reason) {
                      // For polls, the option is stored in reason
                      voteBreakdown[vote.reason] =
                        (voteBreakdown[vote.reason] || 0) + 1;
                    } else if (!isPoll) {
                      // For governance proposals, count for/against from votes array
                      if (vote.vote === "for") {
                        votesFor++;
                      } else if (vote.vote === "against") {
                        votesAgainst++;
                      }
                    }
                    // Check if current user voted
                    if (vote.user_id === userId) {
                      userVotedOption = isPoll ? vote.reason : vote.vote;
                    }
                  });

                  // Reset votesFor/votesAgainst if we counted from votes array
                  // (to avoid double counting with voting_results)
                  if (!isPoll && proposalDetails.votes.length > 0) {
                    // We already counted above, reset the initial values
                    const forCount = proposalDetails.votes.filter(
                      (v: any) => v.vote === "for"
                    ).length;
                    const againstCount = proposalDetails.votes.filter(
                      (v: any) => v.vote === "against"
                    ).length;
                    votesFor = forCount;
                    votesAgainst = againstCount;
                  }
                }

                // Check user_vote from proposal details (it's an object with vote, reason, etc)
                if (proposalDetails.user_vote) {
                  if (isPoll) {
                    // For polls, the selected option is in reason field
                    userVotedOption =
                      proposalDetails.user_vote.reason ||
                      proposalDetails.user_vote;
                  } else {
                    // For governance proposals, it's for/against in vote field
                    userVotedOption =
                      proposalDetails.user_vote.vote ||
                      proposalDetails.user_vote;
                  }
                }

                console.log("Vote breakdown:", voteBreakdown);
                console.log("Votes for:", votesFor, "against:", votesAgainst);
                console.log("User voted for:", userVotedOption);
              }
            } catch (err) {
              console.error("Failed to fetch vote breakdown:", err);
            }

            // For governance proposals (not polls), use "Approve"/"Reject" as options
            const pollOptions = isPoll
              ? p.metadata?.options || []
              : ["Approve", "Reject"];

            // For governance proposals, set up vote breakdown for Approve/Reject
            if (!isPoll) {
              voteBreakdown = {
                Approve: votesFor,
                Reject: votesAgainst,
              };
              // Map user vote to option name
              if (userVotedOption === "for") userVotedOption = "Approve";
              else if (userVotedOption === "against")
                userVotedOption = "Reject";
            }

            return {
              id: `poll-${p.id}`,
              proposalId: p.id,
              chamaId: p.chama_id,
              userId: p.created_by,
              content: p.title,
              description: p.description,
              proposalType: p.proposal_type,
              isPoll: true, // Treat all as polls for UI rendering
              isGovernanceProposal: !isPoll, // Flag to differentiate
              pollOptions: pollOptions,
              pollStatus: p.status,
              pollDeadline: p.deadline || p.voting_deadline,
              votes: voteBreakdown,
              userVote: userVotedOption,
              edited: false,
              pinned: false,
              createdAt: p.created_at,
              updatedAt: p.updated_at,
              metadata: p.metadata,
              author: {
                id: p.created_by,
                fullName: p.creator_name || "Unknown",
                avatar: p.creator_avatar,
              },
              likesCount: 0,
              repliesCount: 0,
              likedByMe: false,
              replies: [],
            };
          });

        polls = await Promise.all(pollPromises);

        console.log("✅ Total polls found:", polls.length);
        console.log("✅ Poll objects:", polls);
      } else {
        console.error(
          "Failed to fetch polls:",
          pollsResponse.status,
          await pollsResponse.text()
        );
      }

      // Merge posts and polls, sort by created date
      const allItems = [...regularPosts, ...polls].sort((a, b) => {
        // Pinned posts first
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        // Then by creation date
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
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
          post.id === postId
            ? {
                ...post,
                pinned,
                pinnedAt: pinned ? new Date().toISOString() : undefined,
              }
            : post
        )
      );
    } catch (err) {
      console.error("Failed to toggle pin:", err);
      setError(err instanceof Error ? err.message : "Failed to pin/unpin post");
    }
  };

  const handleVotePoll = async (
    proposalId: string,
    option: string,
    isGovernanceProposal: boolean = false
  ) => {
    try {
      const token = getAuthToken();

      // For governance proposals, map Approve/Reject to for/against
      // For regular polls, always vote "for" with the option in reason
      let voteValue = "for";
      let reason = option;

      if (isGovernanceProposal) {
        if (option === "Approve") {
          voteValue = "for";
          reason = "Approved the proposal";
        } else if (option === "Reject") {
          voteValue = "against";
          reason = "Rejected the proposal";
        }
      }

      const response = await fetch(
        `${API_URL}/governance/proposals/${proposalId}/vote`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            vote: voteValue,
            reason: reason,
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

  const handleDeletePoll = async (proposalId: string) => {
    if (!confirm("Are you sure you want to delete this poll?")) return;

    try {
      const token = getAuthToken();

      const response = await fetch(
        `${API_URL}/governance/proposals/${proposalId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message || `Failed to delete poll (${response.status})`;
        throw new Error(errorMessage);
      }

      // Remove poll from feed
      setPosts((prev) => prev.filter((post) => post.proposalId !== proposalId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete poll");
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
      alert(
        `Selected ${files.length} media file(s). Media upload coming soon!`
      );
    }
  };

  const insertEmoji = (emoji: string) => {
    setNewPostContent((prev) => prev + emoji);
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

    const validOptions = pollOptions.filter((opt) => opt.trim());
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
          deadlineHours: pollDeadlineHours,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create poll");
      }

      // Reset form
      setPollQuestion("");
      setPollDescription("");
      setPollOptions(["Option 1", "Option 2"]);
      setPollDeadlineHours(24);
      setShowPollDialog(false);

      // Refresh posts to show poll
      await fetchPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create poll");
    } finally {
      setCreatingPoll(false);
    }
  };

  const commonEmojis = [
    "😊",
    "😂",
    "❤️",
    "👍",
    "🎉",
    "🔥",
    "💯",
    "🙏",
    "👏",
    "✨",
    "💪",
    "🤝",
    "👌",
    "🙌",
    "💰",
    "📈",
  ];

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

  const formatTimeUntil = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((date.getTime() - now.getTime()) / 1000);

    if (seconds < 0) return "ended";
    if (seconds < 60) return "in less than a minute";
    if (seconds < 3600) return `in ${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `in ${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `in ${Math.floor(seconds / 86400)}d`;
    return `on ${date.toLocaleDateString()}`;
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
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="text-base">
                        Create Poll
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Question
                        </label>
                        <Input
                          value={pollQuestion}
                          onChange={(e) => setPollQuestion(e.target.value)}
                          placeholder="What would you like to ask?"
                          className="mt-1 h-9 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Duration
                        </label>
                        <div className="flex gap-1.5 mt-1">
                          {pollDurationPresets.map((preset) => (
                            <button
                              key={preset.hours}
                              onClick={() => setPollDeadlineHours(preset.hours)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                pollDeadlineHours === preset.hours
                                  ? "border-[#083232] bg-[#083232] text-white"
                                  : "border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Options
                        </label>
                        <div className="space-y-1.5 mt-1">
                          {pollOptions.map((option, index) => (
                            <div key={index} className="flex gap-1.5">
                              <Input
                                value={option}
                                onChange={(e) =>
                                  updatePollOption(index, e.target.value)
                                }
                                placeholder={`Option ${index + 1}`}
                                className="h-8 text-sm"
                              />
                              {pollOptions.length > 2 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removePollOption(index)}
                                  className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                                >
                                  ✕
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                        {pollOptions.length < 5 && (
                          <button
                            className="text-xs text-[#083232] hover:underline mt-1.5"
                            onClick={addPollOption}
                          >
                            + Add option
                          </button>
                        )}
                      </div>
                      <Button
                        className="w-full bg-[#083232] hover:bg-[#2e856e] h-9 text-sm"
                        onClick={handleCreatePoll}
                        disabled={!pollQuestion.trim() || creatingPoll}
                      >
                        {creatingPoll ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
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
            <Card
              key={post.id}
              className={`p-3 ${
                post.pinned ? "border-2 border-[#083232]" : ""
              }`}
            >
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
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            post.isGovernanceProposal
                              ? "bg-amber-500 text-white"
                              : "bg-[#083232] text-white"
                          }`}
                        >
                          {post.isGovernanceProposal
                            ? `Vote: ${
                                post.proposalType === "transfer_funds"
                                  ? "Transfer"
                                  : post.proposalType === "accept_member"
                                  ? "New Member"
                                  : post.proposalType === "remove_member"
                                  ? "Remove Member"
                                  : "Proposal"
                              }`
                            : "Poll"}
                        </span>
                      )}
                    </div>
                    {post.isPoll ? (
                      <div className="space-y-3">
                        <p className="text-gray-900 font-medium">
                          {post.content}
                        </p>
                        {/* Show description for governance proposals */}
                        {post.isGovernanceProposal && post.description && (
                          <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            {post.description}
                          </p>
                        )}
                        {/* Show transfer details if available */}
                        {post.proposalType === "transfer_funds" &&
                          post.metadata && (
                            <div className="text-xs text-gray-500 bg-amber-50 p-2 rounded border border-amber-200">
                              <strong>Transfer Details:</strong>
                              <br />
                              Amount: KES{" "}
                              {post.metadata.amount?.toLocaleString() || "N/A"}
                              <br />
                              To: {post.metadata.recipientName || "N/A"} (
                              {post.metadata.destinationType || "N/A"})
                              <br />
                              Reason: {post.metadata.reason || "N/A"}
                            </div>
                          )}
                        <div className="space-y-2">
                          {post.pollOptions?.map(
                            (option: string, idx: number) => {
                              const totalVotes = Object.values(
                                post.votes || {}
                              ).reduce(
                                (a: number, b: any) =>
                                  a + (typeof b === "number" ? b : 0),
                                0
                              );
                              const optionVotes =
                                (post.votes?.[option] as number) || 0;
                              const percentage =
                                totalVotes > 0
                                  ? Math.round((optionVotes / totalVotes) * 100)
                                  : 0;
                              const isSelected = post.userVote === option;
                              const hasVoted = !!post.userVote;
                              const hasAnyVotes = totalVotes > 0;
                              const canVote =
                                !hasVoted && post.pollStatus === "active";

                              return (
                                <div
                                  key={idx}
                                  className={`px-2.5 py-1.5 rounded-lg border transition-all ${
                                    isSelected
                                      ? "border-[#083232] bg-[#083232]/5"
                                      : hasVoted
                                      ? "border-gray-100 bg-gray-50"
                                      : "border-gray-200 hover:border-gray-300"
                                  }`}
                                >
                                  <label
                                    className={`flex items-center gap-2 ${
                                      canVote
                                        ? "cursor-pointer"
                                        : "cursor-default"
                                    }`}
                                  >
                                    <div className="shrink-0">
                                      {canVote ? (
                                        <input
                                          type="radio"
                                          name={`poll-${post.id}`}
                                          value={option}
                                          onChange={() =>
                                            post.proposalId &&
                                            handleVotePoll(
                                              post.proposalId,
                                              option,
                                              post.isGovernanceProposal || false
                                            )
                                          }
                                          className="w-3.5 h-3.5 text-[#083232] border-gray-300 focus:ring-[#083232] cursor-pointer"
                                        />
                                      ) : isSelected ? (
                                        <CheckCircle2 className="w-4 h-4 text-[#083232]" />
                                      ) : (
                                        <Circle className="w-4 h-4 text-gray-300" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm">
                                          {option}
                                        </span>
                                        {hasAnyVotes && (
                                          <span className="text-xs text-gray-500">
                                            {optionVotes} ({percentage}%)
                                          </span>
                                        )}
                                      </div>
                                      {hasAnyVotes && (
                                        <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                                          <div
                                            className="bg-[#083232] h-1 rounded-full transition-all"
                                            style={{ width: `${percentage}%` }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </label>
                                </div>
                              );
                            }
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <p>
                            {post.pollStatus === "active" && post.pollDeadline
                              ? `Ends ${formatTimeUntil(post.pollDeadline)}`
                              : post.pollDeadline
                              ? `Ended ${formatTimeAgo(post.pollDeadline)}`
                              : ""}
                          </p>
                          <p>
                            {Object.values(post.votes || {}).reduce(
                              (a: number, b: any) =>
                                a + (typeof b === "number" ? b : 0),
                              0
                            )}{" "}
                            {Object.values(post.votes || {}).reduce(
                              (a: number, b: any) =>
                                a + (typeof b === "number" ? b : 0),
                              0
                            ) === 1
                              ? "vote"
                              : "votes"}
                          </p>
                        </div>
                        {/* Delete button for poll creator */}
                        {post.author.id === userId && (
                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() =>
                                post.proposalId &&
                                handleDeletePoll(post.proposalId)
                              }
                              className="flex items-center gap-1 text-sm text-gray-600 hover:text-[#f64d52] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Delete poll</span>
                            </button>
                          </div>
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
                              <Pin
                                className={`w-4 h-4 ${
                                  post.pinned ? "fill-current" : ""
                                }`}
                              />
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
