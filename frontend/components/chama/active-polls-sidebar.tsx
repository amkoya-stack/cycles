/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Clock, Users } from "lucide-react";

interface ActivePollsSidebarProps {
  chamaId: string;
}

interface Poll {
  id: string;
  title: string;
  status: string;
  deadline: string;
  created_at: string;
  total_votes: number;
  metadata?: {
    isPoll?: boolean;
    options?: string[];
  };
}

export function ActivePollsSidebar({ chamaId }: ActivePollsSidebarProps) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

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
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(
        `http://localhost:3001/api/governance/chama/${chamaId}/proposals`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Filter for polls created in the last week
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const recentPollsRaw = Array.isArray(data)
          ? data.filter((p: any) => {
              const isPoll = p.metadata?.isPoll === true;
              const createdAt = new Date(p.created_at);
              const isRecent = createdAt >= oneWeekAgo;
              return isPoll && isRecent;
            })
          : [];

        // Fetch full details for each poll to get vote counts
        const pollsWithVotes = await Promise.all(
          recentPollsRaw.map(async (poll: any) => {
            try {
              const detailsResponse = await fetch(
                `http://localhost:3001/api/governance/proposals/${poll.id}`,
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                }
              );

              if (detailsResponse.ok) {
                const details = await detailsResponse.json();
                return {
                  ...poll,
                  total_votes: details.votes?.length || 0,
                };
              }
            } catch (err) {
              console.error(
                `Failed to fetch details for poll ${poll.id}:`,
                err
              );
            }

            return {
              ...poll,
              total_votes: 0,
            };
          })
        );

        setPolls(pollsWithVotes);
      }
    } catch (error) {
      console.error("Error fetching polls:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (deadline: string) => {
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

  if (loading) {
    return null;
  }

  // On mobile, don't show if there are no polls
  if (isMobile && polls.length === 0) {
    return null;
  }

  return (
    <Card className="p-3 md:p-4">
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
          {polls.map((poll) => (
            <div
              key={poll.id}
              className="p-2.5 md:p-3 rounded-lg border border-gray-200 hover:border-[#083232] transition-colors cursor-pointer hover:bg-gray-50 touch-manipulation"
            >
              <h4 className="font-medium text-xs md:text-sm text-gray-900 line-clamp-2 mb-1.5 md:mb-2">
                {poll.title}
              </h4>

              <div className="flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-1 text-gray-600">
                  <Users className="w-3 h-3" />
                  <span>{poll.total_votes || 0} votes</span>
                </div>

                {poll.status === "active" ? (
                  <div className="flex items-center gap-1 text-orange-600 shrink-0">
                    <Clock className="w-3 h-3" />
                    <span>{formatTimeRemaining(poll.deadline)}</span>
                  </div>
                ) : (
                  <Badge variant="outline" className="text-xs h-4 md:h-5 px-1.5 md:px-2 shrink-0">
                    {poll.status}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {polls.length > 0 && (
        <p className="text-xs text-gray-400 text-center mt-3 md:mt-4">
          Showing polls from the last 7 days
        </p>
      )}
    </Card>
  );
}
