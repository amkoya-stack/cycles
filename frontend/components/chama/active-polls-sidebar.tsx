/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Clock, Users, ChevronDown, ChevronUp, CheckCircle2, Circle } from "lucide-react";
import { apiUrl } from "@/lib/api-config";

interface ActivePollsSidebarProps {
  chamaId: string;
  userId?: string;
  onPollVoted?: () => void;
}

interface Poll {
  id: string;
  proposalId?: string;
  title: string;
  status: string;
  deadline: string;
  created_at: string;
  total_votes: number;
  pollOptions?: string[];
  votes?: { [key: string]: number };
  userVote?: string;
  isGovernanceProposal?: boolean;
  proposalType?: string;
  metadata?: {
    isPoll?: boolean;
    options?: string[];
  };
}

export function ActivePollsSidebar({ chamaId, userId, onPollVoted }: ActivePollsSidebarProps) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedPolls, setExpandedPolls] = useState<Set<string>>(new Set());

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    fetchActivePolls();
  }, [chamaId]);

  const fetchActivePolls = async () => {
    try {
      setLoading(true);
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        setLoading(false);
        return;
      }

      const response = await fetch(
        apiUrl(`governance/chama/${chamaId}/proposals`),
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Filter for polls - same logic as CommunityPosts component
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

        const proposals = Array.isArray(data) ? data : [];

        const recentPollsRaw = proposals.filter((p: any) => {
          const isPoll = p.metadata?.isPoll === true;
          const isVotableProposal = votableProposalTypes.includes(
            p.proposal_type?.toLowerCase()
          );
          const createdAt = new Date(p.created_at);
          const isRecent = createdAt >= oneWeekAgo;
          const isActive = p.status === "active" || p.status === "draft";

          // Show if it's a poll OR a votable governance proposal that's still active
          return (isPoll || (isVotableProposal && isActive)) && isRecent;
        });

        // Fetch full details for each poll to get vote counts
        const pollsWithVotes = await Promise.all(
          recentPollsRaw.map(async (poll: any) => {
            try {
              const detailsResponse = await fetch(
                apiUrl(`governance/proposals/${poll.id}`),
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                }
              );

              if (detailsResponse.ok) {
                const details = await detailsResponse.json();
                
                // Count total votes and get vote breakdown
                let totalVotes = 0;
                let voteBreakdown: { [key: string]: number } = {};
                let userVotedOption: string | null = null;
                let votesFor = 0;
                let votesAgainst = 0;

                const isPoll = poll.metadata?.isPoll === true;

                if (details.votes && Array.isArray(details.votes)) {
                  totalVotes = details.votes.length;
                  
                  // Count votes by option
                  details.votes.forEach((vote: any) => {
                    if (isPoll && vote.reason) {
                      voteBreakdown[vote.reason] = (voteBreakdown[vote.reason] || 0) + 1;
                    } else if (!isPoll) {
                      if (vote.vote === "for") votesFor++;
                      else if (vote.vote === "against") votesAgainst++;
                    }
                    if (vote.user_id === userId) {
                      userVotedOption = isPoll ? vote.reason : vote.vote;
                    }
                  });
                } else if (details.votes_for !== undefined && details.votes_against !== undefined) {
                  votesFor = details.votes_for || 0;
                  votesAgainst = details.votes_against || 0;
                  totalVotes = votesFor + votesAgainst;
                }

                // Check user_vote from proposal details
                if (details.user_vote) {
                  if (isPoll) {
                    userVotedOption = details.user_vote.reason || details.user_vote;
                  } else {
                    userVotedOption = details.user_vote.vote || details.user_vote;
                  }
                }

                // For governance proposals, set up vote breakdown
                if (!isPoll) {
                  voteBreakdown = {
                    Approve: votesFor,
                    Reject: votesAgainst,
                  };
                  if (userVotedOption === "for") userVotedOption = "Approve";
                  else if (userVotedOption === "against") userVotedOption = "Reject";
                }

                // Get poll options
                const pollOptions = isPoll
                  ? poll.metadata?.options || []
                  : ["Approve", "Reject"];

                return {
                  ...poll,
                  proposalId: poll.id,
                  id: `poll-${poll.id}`,
                  total_votes: totalVotes,
                  deadline: poll.deadline || poll.voting_deadline,
                  pollOptions,
                  votes: voteBreakdown,
                  userVote: userVotedOption || undefined,
                  isGovernanceProposal: !isPoll,
                  proposalType: poll.proposal_type,
                };
              }
            } catch (err) {
              console.error(
                `Failed to fetch details for poll ${poll.id}:`,
                err
              );
            }

            const isPoll = poll.metadata?.isPoll === true;
            const pollOptions = isPoll
              ? poll.metadata?.options || []
              : ["Approve", "Reject"];

            return {
              ...poll,
              proposalId: poll.id,
              id: `poll-${poll.id}`,
              total_votes: 0,
              deadline: poll.deadline || poll.voting_deadline,
              pollOptions,
              votes: {},
              isGovernanceProposal: !isPoll,
              proposalType: poll.proposal_type,
            };
          })
        );

        // Sort by created_at (newest first)
        pollsWithVotes.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA;
        });

        setPolls(pollsWithVotes);
      }
    } catch (error) {
      console.error("Error fetching polls:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (deadline: string) => {
    if (!deadline) return "No deadline";
    const now = new Date();
    const end = new Date(deadline);
    const diff = end.getTime() - now.getTime();

    if (diff < 0) return "Ended";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d left`;
    if (hours > 0) return `${hours}h left`;
    return "Ending soon";
  };

  const isPollExpired = (deadline?: string) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  const handleVotePoll = async (proposalId: string, option: string, isGovernanceProposal: boolean = false) => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      // Check if user has already voted - prevent duplicate votes
      const currentPoll = polls.find((p) => p.proposalId === proposalId);
      if (currentPoll?.userVote) {
        // User has already voted, don't allow another vote
        return;
      }

      // Notify parent to refresh feed IMMEDIATELY (before optimistic update)
      onPollVoted?.();

      // Optimistically update the poll to show user has voted (prevent double voting)
      setPolls((prev) =>
        prev.map((poll) => {
          if (poll.proposalId === proposalId) {
            // Immediately mark as voted to prevent duplicate votes
            return {
              ...poll,
              userVote: option,
              // Optimistically increment vote count
              votes: {
                ...poll.votes,
                [option]: ((poll.votes?.[option] as number) || 0) + 1,
              },
              total_votes: (poll.total_votes || 0) + 1,
            };
          }
          return poll;
        })
      );

      // For governance proposals, map Approve/Reject to for/against
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
        apiUrl(`governance/proposals/${proposalId}/vote`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            vote: voteValue,
            reason: reason,
          }),
        }
      );

      if (!response.ok) {
        // Revert optimistic update on error
        setPolls((prev) =>
          prev.map((poll) => {
            if (poll.proposalId === proposalId) {
              return {
                ...poll,
                userVote: undefined,
                votes: {
                  ...poll.votes,
                  [option]: Math.max(((poll.votes?.[option] as number) || 0) - 1, 0),
                },
                total_votes: Math.max((poll.total_votes || 0) - 1, 0),
              };
            }
            return poll;
          })
        );
        throw new Error("Failed to vote on poll");
      }

      // Refresh polls to show updated vote counts from server
      await fetchActivePolls();
    } catch (err) {
      console.error("Error voting on poll:", err);
    }
  };

  const togglePollExpanded = (pollId: string) => {
    setExpandedPolls((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(pollId)) {
        newSet.delete(pollId);
      } else {
        newSet.add(pollId);
      }
      return newSet;
    });
  };

  // On mobile, don't show if there are no polls
  // On desktop (lg screens), always show the sidebar
  if (isMobile && polls.length === 0) {
    return null;
  }

  const content = (
    <>
      <div className="flex items-center gap-2 mb-3 md:mb-4">
        <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-[#083232]" />
        <h3 className="font-semibold text-sm md:text-base text-[#083232]">Active Polls</h3>
      </div>

      {polls.length === 0 ? (
        <div className="text-center py-6 md:py-8">
          <BarChart3 className="w-6 h-6 md:w-8 md:h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-xs md:text-sm text-gray-500">No active polls</p>
          <p className="text-xs text-gray-400 mt-1">Create one in the feed!</p>
        </div>
      ) : (
        <div className="space-y-2 md:space-y-3">
          {polls.map((poll) => {
            const isExpanded = expandedPolls.has(poll.id);
            const hasVoted = !!poll.userVote;
            const pollExpired = isPollExpired(poll.deadline);
            const canVote = !hasVoted && poll.status === "active" && !pollExpired;
            const pollOptions = poll.pollOptions || [];

            return (
              <div
                key={poll.id}
                className="rounded-lg border border-gray-200 hover:border-[#083232] transition-colors"
              >
                <div
                  className="p-2.5 md:p-3 cursor-pointer hover:bg-gray-50 touch-manipulation"
                  onClick={() => {
                    // Scroll to the poll in the feed
                    const pollId = poll.id.startsWith("poll-") ? poll.id : `poll-${poll.id}`;
                    const pollElement = document.querySelector(`[data-poll-id="${pollId}"]`);
                    if (pollElement) {
                      pollElement.scrollIntoView({ behavior: "smooth", block: "center" });
                      pollElement.classList.add("ring-2", "ring-[#083232]", "ring-offset-2", "rounded-lg");
                      setTimeout(() => {
                        pollElement.classList.remove("ring-2", "ring-[#083232]", "ring-offset-2", "rounded-lg");
                      }, 2000);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5 md:mb-2">
                    <h4 className="font-medium text-xs md:text-sm text-gray-900 line-clamp-2 flex-1">
                      {poll.title}
                    </h4>
                    {pollOptions.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePollExpanded(poll.id);
                        }}
                        className="shrink-0 text-gray-400 hover:text-[#083232] transition-colors p-0.5"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Users className="w-3 h-3" />
                      <span>{poll.total_votes || 0} votes</span>
                    </div>

                    {poll.status === "active" && poll.deadline ? (
                      <div className="flex items-center gap-1 text-orange-600 shrink-0">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeRemaining(poll.deadline)}</span>
                      </div>
                    ) : poll.status === "active" ? (
                      <Badge variant="outline" className="text-xs h-4 md:h-5 px-1.5 md:px-2 shrink-0 bg-green-50 text-green-700 border-green-200">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs h-4 md:h-5 px-1.5 md:px-2 shrink-0">
                        {poll.status}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Voting Options */}
                {isExpanded && pollOptions.length > 0 && (
                  <div className="px-2.5 md:px-3 pb-2.5 md:pb-3 pt-0 border-t border-gray-100">
                    <div className="space-y-1.5 mt-2">
                      {pollOptions.map((option: string, idx: number) => {
                        const totalVotes = Object.values(poll.votes || {}).reduce(
                          (a: number, b: any) => a + (typeof b === "number" ? b : 0),
                          0
                        );
                        const optionVotes = (poll.votes?.[option] as number) || 0;
                        const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                        const isSelected = poll.userVote === option;
                        const hasAnyVotes = totalVotes > 0;

                        return (
                          <div
                            key={idx}
                            className={`px-2 py-1.5 rounded border transition-all text-xs ${
                              isSelected
                                ? "border-[#083232] bg-[#083232]/5"
                                : hasVoted
                                ? "border-gray-100 bg-gray-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <label
                              className={`flex items-center gap-2 ${
                                canVote ? "cursor-pointer" : "cursor-default"
                              }`}
                            >
                              <div className="shrink-0">
                                {canVote ? (
                                  <input
                                    type="radio"
                                    name={`sidebar-poll-${poll.id}`}
                                    value={option}
                                    checked={isSelected}
                                    disabled={pollExpired}
                                    onChange={(e) => {
                                      e.target.checked = true;
                                      if (poll.proposalId) {
                                        handleVotePoll(
                                          poll.proposalId,
                                          option,
                                          poll.isGovernanceProposal || false
                                        );
                                      }
                                    }}
                                    className="w-3 h-3 text-[#083232] border-gray-300 focus:ring-[#083232] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                  />
                                ) : isSelected ? (
                                  <CheckCircle2 className="w-3 h-3 text-[#083232]" />
                                ) : (
                                  <Circle className="w-3 h-3 text-gray-300" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs">{option}</span>
                                  {hasAnyVotes && (
                                    <span className="text-xs text-gray-500 shrink-0">
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
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {polls.length > 0 && (
        <p className="text-xs text-gray-400 text-center mt-3 md:mt-4">
          Showing polls from the last 7 days
        </p>
      )}
    </>
  );

  if (loading) {
    const loadingContent = (
      <>
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-[#083232]" />
          <h3 className="font-semibold text-sm md:text-base text-[#083232]">Active Polls</h3>
        </div>
        <div className="text-center py-6">
          <p className="text-xs md:text-sm text-gray-500">Loading polls...</p>
        </div>
      </>
    );

    if (isMobile) {
      return <div className="p-3">{loadingContent}</div>;
    }
    return <Card className="p-3 md:p-4">{loadingContent}</Card>;
  }

  if (isMobile) {
    return <div className="p-3">{content}</div>;
  }

  return <Card className="p-3 md:p-4">{content}</Card>;
}
