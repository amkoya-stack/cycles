"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SpacesMeetingModal } from "@/components/chama/spaces-meeting-modal";
import { FloatingMeetingIndicator } from "@/components/chama/floating-meeting-indicator";
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
  Mic,
  X,
  ArrowLeft,
  Clock,
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  onMeetingCreated?: () => void;
}

export function CommunityPosts({
  chamaId,
  userId,
  onMeetingCreated,
}: CommunityPostsProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    fullName: string;
    avatar?: string;
  } | null>(null);
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
  const [pollType, setPollType] = useState("");
  const [pollOptions, setPollOptions] = useState(["Option 1", "Option 2"]);
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [showSchedulerDialog, setShowSchedulerDialog] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [whoCanSpeak, setWhoCanSpeak] = useState("everyone");
  const [recordSpace, setRecordSpace] = useState(false);
  const [startNow, setStartNow] = useState(true);
  const [scheduledTime, setScheduledTime] = useState("");
  const [schedulerMonth, setSchedulerMonth] = useState("December");
  const [schedulerDay, setSchedulerDay] = useState("28");
  const [schedulerYear, setSchedulerYear] = useState("2025");
  const [schedulerHour, setSchedulerHour] = useState("20");
  const [schedulerMinute, setSchedulerMinute] = useState("00");
  const [pollDescription, setPollDescription] = useState("");
  const [pollDeadlineHours, setPollDeadlineHours] = useState(24); // Default 24 hours
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [creatingMeeting, setCreatingMeeting] = useState(false);
  const [showSpacesModal, setShowSpacesModal] = useState(false);
  const [meetingMinimized, setMeetingMinimized] = useState(false);
  const [meetingParticipantCount, setMeetingParticipantCount] = useState(0);
  const [activeMeetingId, setActiveMeetingId] = useState("");
  const [activeMeetingTitle, setActiveMeetingTitle] = useState("");
  const [livekitToken, setLivekitToken] = useState("");
  const [livekitUrl, setLivekitUrl] = useState("");
  const [isHostOfMeeting, setIsHostOfMeeting] = useState(false);

  // Poll duration presets in hours
  const pollDurationPresets = [
    { label: "2h", hours: 2 },
    { label: "12h", hours: 12 },
    { label: "24h", hours: 24 },
    { label: "3d", hours: 72 },
    { label: "7d", hours: 168 },
  ];

  // Poll type options
  const pollTypes = [
    "Use chama funds (withdrawal)",
    "Accept/reject new member",
    "Change contribution amount/frequency",
    "Make group investment",
    "Expel member",
    "Update constitution",
    "Change member roles",
    "Approve large loans",
    "Dissolve chama",
    "General poll",
  ];

  const getAuthToken = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("accessToken");
    }
    return null;
  };

  // Fetch current user profile
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const token = getAuthToken();
        const response = await fetch(`${API_URL}/auth/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setCurrentUser({
            fullName: userData.full_name || "You",
            avatar: userData.profile_photo_url,
          });
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    fetchCurrentUser();
  }, []);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAuthToken();

      if (!token) {
        window.location.href = "/auth/login";
        return;
      }

      // Fetch regular posts
      const postsResponse = await fetch(
        `${API_URL}/chama/${chamaId}/community/posts`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (postsResponse.status === 401) {
        // Unauthorized - redirect to login
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/auth/login";
        return;
      }

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
              pinned: p.pinned || false,
              pinnedAt: p.pinned_at,
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
      const post = posts.find((p) => p.id === postId);

      let response;
      if (post?.isPoll && post?.proposalId) {
        // Handle governance proposal (poll) pinning
        response = await fetch(
          `${API_URL}/governance/proposals/${post.proposalId}/pin`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } else {
        // Handle regular community post pinning
        response = await fetch(
          `${API_URL}/chama/${chamaId}/community/posts/${postId}/pin`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }

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

  const isPollExpired = (deadlineString?: string) => {
    if (!deadlineString) return false;
    const deadline = new Date(deadlineString);
    const now = new Date();
    return now.getTime() > deadline.getTime();
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
            <AvatarImage
              src={reply.author.avatar}
              alt={reply.author.fullName}
            />
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
    <div className="space-y-2 md:space-y-3">
      {/* Create New Post */}
      <Card className="p-2.5 md:p-3">
        <div className="flex gap-2">
          <Avatar className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0">
            <AvatarImage
              src={currentUser?.avatar}
              alt={currentUser?.fullName || "You"}
            />
            <AvatarFallback className="bg-[#083232] text-white text-xs md:text-sm">
              {currentUser?.fullName ? getInitials(currentUser.fullName) : "Y"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="Share something with the community..."
              className="min-h-[70px] md:min-h-[80px] mb-2 text-sm"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-0.5 md:gap-1 relative">
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
                      className="h-9 w-9 md:h-8 md:w-8 p-0 text-gray-500 hover:text-[#083232] hover:bg-gray-100 touch-manipulation"
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
                      className="h-9 w-9 md:h-8 md:w-8 p-0 text-gray-500 hover:text-[#083232] hover:bg-gray-100 touch-manipulation"
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
                      className="h-9 w-9 md:h-8 md:w-8 p-0 text-gray-500 hover:text-[#083232] hover:bg-gray-100 touch-manipulation"
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
                          Poll Type
                        </label>
                        <Select value={pollType} onValueChange={setPollType}>
                          <SelectTrigger className="mt-1 h-9">
                            <SelectValue placeholder="Select poll type" />
                          </SelectTrigger>
                          <SelectContent>
                            {pollTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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
                                  className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 cursor-pointer"
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
                        disabled={
                          !pollQuestion.trim() || !pollType || creatingPoll
                        }
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

                {/* Voice Recording/Meeting */}
                <Dialog
                  open={showMeetingDialog}
                  onOpenChange={setShowMeetingDialog}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-500 hover:text-[#083232] hover:bg-gray-100"
                        >
                          <Mic className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Create a meeting</p>
                    </TooltipContent>
                  </Tooltip>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-semibold">
                        Create a Meeting
                      </DialogTitle>
                      <button
                        onClick={() => setShowMeetingDialog(false)}
                        className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 hover:cursor-pointer cursor-pointer"
                        style={{ cursor: "pointer !important" }}
                      >
                        <X className="h-4 w-4 cursor-pointer" />
                        <span className="sr-only">Close</span>
                      </button>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      {/* Meeting Title */}
                      <div className="space-y-2">
                        <Label
                          htmlFor="meeting-title"
                          className="text-sm font-semibold"
                        >
                          Meeting Title
                        </Label>
                        <Input
                          id="meeting-title"
                          placeholder="Enter meeting title..."
                          value={meetingTitle}
                          onChange={(e) => setMeetingTitle(e.target.value)}
                          className="w-full"
                        />
                      </div>

                      {/* Who Can Speak */}
                      <div className="space-y-3">
                        <Label
                          htmlFor="who-can-speak"
                          className="text-sm font-semibold"
                        >
                          Who can speak?
                        </Label>
                        <Select
                          value={whoCanSpeak}
                          onValueChange={setWhoCanSpeak}
                        >
                          <SelectTrigger id="who-can-speak">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="everyone">
                              Every member
                            </SelectItem>
                            <SelectItem value="selected">
                              Selected few
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Record Meeting Toggle */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <Label className="text-sm font-semibold">
                          Record Meeting
                        </Label>
                        <Switch
                          checked={recordSpace}
                          onCheckedChange={setRecordSpace}
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          onClick={async () => {
                            if (!meetingTitle.trim() || creatingMeeting) return;

                            setCreatingMeeting(true);
                            try {
                              console.log("Creating meeting...");
                              const now = new Date();
                              const end = new Date(
                                now.getTime() + 2 * 60 * 60 * 1000
                              );

                              const response = await fetch(
                                `${API_URL}/meetings`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${localStorage.getItem(
                                      "accessToken"
                                    )}`,
                                  },
                                  body: JSON.stringify({
                                    chamaId,
                                    title: meetingTitle,
                                    description: "",
                                    scheduledStart: now.toISOString(),
                                    scheduledEnd: end.toISOString(),
                                    meetingType: "audio",
                                    isRecordingEnabled: recordSpace,
                                    requireApproval: whoCanSpeak === "selected",
                                    maxParticipants: 100,
                                  }),
                                }
                              );

                              console.log("Meeting response:", response.status);

                              if (response.ok) {
                                const meeting = await response.json();
                                console.log("Meeting created:", meeting);

                                // Get Livekit token to join
                                // Backend will fetch user details from database
                                const joinResponse = await fetch(
                                  `${API_URL}/meetings/${meeting.id}/join`,
                                  {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                      Authorization: `Bearer ${localStorage.getItem(
                                        "accessToken"
                                      )}`,
                                    },
                                    body: JSON.stringify({}), // Empty - backend uses JWT user
                                  }
                                );

                                console.log(
                                  "Join response:",
                                  joinResponse.status
                                );

                                if (joinResponse.ok) {
                                  const joinData = await joinResponse.json();
                                  console.log("Join data:", joinData);

                                  setActiveMeetingId(meeting.id);
                                  setActiveMeetingTitle(meetingTitle);
                                  setLivekitToken(joinData.token);
                                  setLivekitUrl(joinData.wsUrl || joinData.url);
                                  setIsHostOfMeeting(true);
                                  setShowMeetingDialog(false);
                                  setShowSpacesModal(true);
                                  console.log("Opening spaces modal");
                                } else {
                                  const joinError = await joinResponse.json();
                                  console.error("Join error:", joinError);
                                  alert(
                                    joinError.message ||
                                      "Failed to join meeting"
                                  );
                                }
                              } else {
                                const error = await response.json();
                                console.error("Meeting creation error:", error);
                                alert(
                                  error.message || "Failed to create meeting"
                                );
                              }
                            } catch (error: any) {
                              console.error("Error:", error);
                              alert(
                                error.message || "Failed to create meeting"
                              );
                            } finally {
                              setCreatingMeeting(false);
                            }

                            // Reset form
                            setMeetingTitle("");
                            setWhoCanSpeak("everyone");
                            setRecordSpace(false);
                            setStartNow(true);
                            setScheduledTime("");
                          }}
                          disabled={!meetingTitle.trim() || creatingMeeting}
                          className="flex-1 bg-[#083232] hover:bg-[#2e856e] text-white font-semibold h-10"
                        >
                          {creatingMeeting
                            ? "Creating..."
                            : "Start Meeting Now"}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setShowMeetingDialog(false);
                            setShowSchedulerDialog(true);
                          }}
                          className="h-10 w-10 border-[#083232] hover:bg-gray-50"
                        >
                          <Clock className="h-4 w-4 text-[#083232]" />
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Scheduler Dialog */}
                <Dialog
                  open={showSchedulerDialog}
                  onOpenChange={setShowSchedulerDialog}
                >
                  <DialogContent className="max-w-[440px] [&>[data-slot='dialog-close']]:hidden">
                    <DialogHeader>
                      <button
                        onClick={() => {
                          setShowSchedulerDialog(false);
                          setShowMeetingDialog(true);
                        }}
                        className="absolute left-4 top-4 rounded-sm opacity-80 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer"
                        style={{ cursor: "pointer" }}
                        aria-label="Back to meeting"
                        title="Back"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <DialogTitle className="text-base font-semibold text-center">
                        Schedule Meeting
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                      {/* Date Section */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Date</Label>
                        <div className="flex gap-1">
                          {/* Month */}
                          <div className="w-[211.2px]">
                            <Label
                              htmlFor="month"
                              className="text-xs text-gray-600"
                            >
                              Month
                            </Label>
                            <Select
                              value={schedulerMonth}
                              onValueChange={setSchedulerMonth}
                            >
                              <SelectTrigger
                                id="month"
                                className="mt-1 w-full h-[57.6px]"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[
                                  "January",
                                  "February",
                                  "March",
                                  "April",
                                  "May",
                                  "June",
                                  "July",
                                  "August",
                                  "September",
                                  "October",
                                  "November",
                                  "December",
                                ].map((month) => (
                                  <SelectItem key={month} value={month}>
                                    {month}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Day */}
                          <div className="w-[92.4px]">
                            <Label
                              htmlFor="day"
                              className="text-xs text-gray-600"
                            >
                              Day
                            </Label>
                            <Select
                              value={schedulerDay}
                              onValueChange={setSchedulerDay}
                            >
                              <SelectTrigger
                                id="day"
                                className="mt-1 w-full h-[57.6px]"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 31 }, (_, i) =>
                                  (i + 1).toString()
                                ).map((day) => (
                                  <SelectItem key={day} value={day}>
                                    {day}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Year */}
                          <div className="w-[112.4px]">
                            <Label
                              htmlFor="year"
                              className="text-xs text-gray-600"
                            >
                              Year
                            </Label>
                            <Select
                              value={schedulerYear}
                              onValueChange={setSchedulerYear}
                            >
                              <SelectTrigger
                                id="year"
                                className="mt-1 w-full h-[57.6px]"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from(
                                  { length: 5 },
                                  (_, i) => new Date().getFullYear() + i
                                ).map((year) => (
                                  <SelectItem
                                    key={year}
                                    value={year.toString()}
                                  >
                                    {year}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Time Section */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Time</Label>
                        <div className="flex gap-1">
                          {/* Hour */}
                          <div className="w-[160px]">
                            <Label
                              htmlFor="hour"
                              className="text-xs text-gray-600"
                            >
                              Hour
                            </Label>
                            <Select
                              value={schedulerHour}
                              onValueChange={setSchedulerHour}
                            >
                              <SelectTrigger
                                id="hour"
                                className="mt-1 w-full h-[57.6px]"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 24 }, (_, i) =>
                                  i.toString().padStart(2, "0")
                                ).map((hour) => (
                                  <SelectItem key={hour} value={hour}>
                                    {hour}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Minute */}
                          <div className="w-[160px]">
                            <Label
                              htmlFor="minute"
                              className="text-xs text-gray-600"
                            >
                              Minute
                            </Label>
                            <Select
                              value={schedulerMinute}
                              onValueChange={setSchedulerMinute}
                            >
                              <SelectTrigger
                                id="minute"
                                className="mt-1 w-full h-[57.6px]"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 60 }, (_, i) =>
                                  i.toString().padStart(2, "0")
                                ).map((minute) => (
                                  <SelectItem key={minute} value={minute}>
                                    {minute}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Confirm Button */}
                      <Button
                        onClick={async () => {
                          if (!meetingTitle.trim()) return;

                          try {
                            // Build the scheduled date
                            const monthIndex = [
                              "January",
                              "February",
                              "March",
                              "April",
                              "May",
                              "June",
                              "July",
                              "August",
                              "September",
                              "October",
                              "November",
                              "December",
                            ].indexOf(schedulerMonth);
                            const scheduledDate = new Date(
                              parseInt(schedulerYear),
                              monthIndex,
                              parseInt(schedulerDay),
                              parseInt(schedulerHour),
                              parseInt(schedulerMinute)
                            );
                            const endDate = new Date(
                              scheduledDate.getTime() + 2 * 60 * 60 * 1000
                            );

                            const response = await fetch(
                              `${API_URL}/meetings`,
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${localStorage.getItem(
                                    "accessToken"
                                  )}`,
                                },
                                body: JSON.stringify({
                                  chamaId,
                                  title: meetingTitle,
                                  description: "",
                                  scheduledStart: scheduledDate.toISOString(),
                                  scheduledEnd: endDate.toISOString(),
                                  meetingType: "audio",
                                  isRecordingEnabled: recordSpace,
                                  requireApproval: whoCanSpeak === "selected",
                                  maxParticipants: 100,
                                }),
                              }
                            );

                            if (response.ok) {
                              alert("Meeting scheduled successfully!");
                              setShowSchedulerDialog(false);
                              setShowMeetingDialog(false);
                              // Reset form
                              setMeetingTitle("");
                              setWhoCanSpeak("everyone");
                              setRecordSpace(false);
                              // Notify parent to refresh meetings
                              onMeetingCreated?.();
                            } else {
                              const error = await response.json();
                              alert(
                                error.message || "Failed to schedule meeting"
                              );
                            }
                          } catch (error: any) {
                            alert(
                              error.message || "Failed to schedule meeting"
                            );
                          }
                        }}
                        disabled={!meetingTitle.trim()}
                        className="w-full bg-[#083232] hover:bg-[#2e856e] text-white font-semibold h-10"
                      >
                        Confirm Schedule
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <Button
                onClick={handleCreatePost}
                disabled={!newPostContent.trim() || submitting}
                className="bg-[#083232] hover:bg-[#2e856e] h-9 md:h-8 text-sm px-3 md:px-2 touch-manipulation"
                size="sm"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 md:w-3 md:h-3 mr-1.5 md:mr-2 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5 md:w-3 md:h-3 mr-1.5 md:mr-2" />
                )}
                Post
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Posts Feed */}
      {posts.length === 0 ? (
        <Card className="p-6 md:p-8 text-center">
          <MessageSquare className="w-8 h-8 md:w-10 md:h-10 text-gray-400 mx-auto mb-2 md:mb-3" />
          <p className="text-xs md:text-sm text-gray-600">
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
              className={`p-2.5 md:p-3 ${
                post.pinned ? "border-2 border-[#083232]" : ""
              }`}
            >
              {post.pinned && (
                <div className="flex items-center gap-1 text-xs text-[#083232] font-medium mb-1.5 md:mb-2">
                  <Pin className="w-3 h-3 fill-current" />
                  <span>Pinned</span>
                </div>
              )}
              <div className="flex gap-2">
                <Avatar className="w-8 h-8 md:w-9 md:h-9 flex-shrink-0">
                  <AvatarImage
                    src={post.author.avatar}
                    alt={post.author.fullName}
                  />
                  <AvatarFallback className="bg-[#2e856e] text-white text-xs md:text-sm">
                    {getInitials(post.author.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="mb-1.5 md:mb-2">
                    <div className="flex items-center gap-1.5 md:gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm md:text-base">
                        {post.author.fullName}
                      </span>
                      <span className="text-xs md:text-sm text-gray-500">
                        {formatTimeAgo(post.createdAt)}
                      </span>
                      {post.edited && (
                        <span className="text-xs text-gray-400">(edited)</span>
                      )}
                      {post.isPoll && (
                        <span
                          className={`text-xs px-1.5 md:px-2 py-0.5 rounded ${
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
                              const pollExpired = isPollExpired(
                                post.pollDeadline
                              );
                              const canVote =
                                !hasVoted &&
                                post.pollStatus === "active" &&
                                !pollExpired;

                              return (
                                <div
                                  key={idx}
                                  className={`px-2 md:px-2.5 py-2 md:py-1.5 rounded-lg border transition-all touch-manipulation ${
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
                                          disabled={pollExpired}
                                          onChange={() =>
                                            post.proposalId &&
                                            handleVotePoll(
                                              post.proposalId,
                                              option,
                                              post.isGovernanceProposal || false
                                            )
                                          }
                                          className="w-4 h-4 md:w-3.5 md:h-3.5 text-[#083232] border-gray-300 focus:ring-[#083232] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                        />
                                      ) : isSelected ? (
                                        <CheckCircle2 className="w-4 h-4 md:w-3.5 md:h-3.5 text-[#083232]" />
                                      ) : (
                                        <Circle className="w-4 h-4 md:w-3.5 md:h-3.5 text-gray-300" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm md:text-sm">
                                          {option}
                                        </span>
                                        {hasAnyVotes && (
                                          <span className="text-xs text-gray-500 shrink-0">
                                            {optionVotes} ({percentage}%)
                                          </span>
                                        )}
                                      </div>
                                      {hasAnyVotes && (
                                        <div className="w-full bg-gray-200 rounded-full h-1 md:h-1 mt-1.5 md:mt-1">
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
                    <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-gray-600 pb-2 md:pb-3 border-b pt-2">
                      <button
                        onClick={() => togglePostLike(post.id)}
                        className={`flex items-center gap-1 hover:text-[#083232] transition-colors touch-manipulation py-1 ${
                          post.likedByMe ? "text-[#f64d52]" : ""
                        }`}
                      >
                        <ThumbsUp
                          className={`w-4 h-4 md:w-3.5 md:h-3.5 ${
                            post.likedByMe ? "fill-current" : ""
                          }`}
                        />
                        <span>{post.likesCount}</span>
                      </button>
                      <button
                        onClick={() => setReplyingTo(post.id)}
                        className="flex items-center gap-1 hover:text-[#083232] transition-colors touch-manipulation py-1"
                      >
                        <MessageSquare className="w-4 h-4 md:w-3.5 md:h-3.5" />
                        <span className="hidden sm:inline">Reply</span>
                      </button>
                      {totalReplies > 0 && (
                        <button
                          onClick={() => toggleExpanded(post.id)}
                          className="hover:text-[#083232] transition-colors touch-manipulation py-1 text-xs"
                        >
                          {isExpanded ? "Hide" : "View"} {totalReplies}{" "}
                          <span className="hidden sm:inline">
                            {totalReplies === 1 ? "reply" : "replies"}
                          </span>
                        </button>
                      )}
                      <div className="flex items-center gap-1.5 md:gap-2 ml-auto">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleTogglePin(post.id)}
                              className={`hover:text-[#083232] transition-colors touch-manipulation p-1.5 ${
                                post.pinned ? "text-[#083232]" : ""
                              }`}
                            >
                              <Pin
                                className={`w-4 h-4 md:w-3.5 md:h-3.5 ${
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
                            className="flex items-center gap-1 hover:text-[#f64d52] transition-colors touch-manipulation p-1.5"
                          >
                            <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
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

      {/* Floating Meeting Indicator */}
      {meetingMinimized && showSpacesModal && (
        <FloatingMeetingIndicator
          isVisible={meetingMinimized}
          meetingTitle={activeMeetingTitle}
          participantCount={meetingParticipantCount}
          onClick={() => setMeetingMinimized(false)}
        />
      )}

      {/* Spaces Meeting Modal */}
      {showSpacesModal && (
        <SpacesMeetingModal
          isOpen={!meetingMinimized}
          onClose={() => {
            setShowSpacesModal(false);
            setMeetingMinimized(false);
          }}
          onMinimize={() => setMeetingMinimized(true)}
          onParticipantCountChange={setMeetingParticipantCount}
          meetingId={activeMeetingId}
          meetingTitle={activeMeetingTitle}
          isHost={isHostOfMeeting}
          livekitToken={livekitToken}
          livekitUrl={livekitUrl}
        />
      )}
    </div>
  );
}
