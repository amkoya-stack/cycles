import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "./badge";
import { Trophy, Medal, Award } from "lucide-react";

interface LeaderboardEntry {
  userId: string;
  fullName: string;
  totalScore: number;
  tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
  contributionConsistencyRate: number;
  loanRepaymentRate: number;
  contributionStreakMonths: number;
  activeBadgesCount: number;
  rank: number;
}

interface LeaderboardProps {
  chamaId: string;
  currentUserId?: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export function Leaderboard({ chamaId, currentUserId }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, [chamaId]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("accessToken");

      const response = await fetch(
        `${API_BASE_URL}/reputation/${chamaId}/leaderboard?limit=50`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch leaderboard");
      }

      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
      setError("Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1)
      return <Trophy className="text-[#FFD700]" size={24} strokeWidth={2.5} />;
    if (rank === 2)
      return <Medal className="text-[#C0C0C0]" size={24} strokeWidth={2.5} />;
    if (rank === 3)
      return <Medal className="text-[#CD7F32]" size={24} strokeWidth={2.5} />;
    return <span className="text-lg font-bold text-gray-500">#{rank}</span>;
  };

  if (loading) {
    return (
      <Card className="w-full p-6">
        <div className="text-center py-8 text-gray-500">
          Loading leaderboard...
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full p-6">
        <div className="text-center py-8 text-[#f64d52]">{error}</div>
      </Card>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <Card className="w-full p-6">
        <div className="text-center py-8 text-gray-500">
          <Trophy className="mx-auto mb-2 text-gray-400" size={48} />
          <p>No reputation data yet</p>
          <p className="text-sm mt-1">
            Leaderboard will appear as members earn reputation
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full p-6">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="text-[#083232]" size={28} />
        <h2 className="text-2xl font-bold text-[#083232]">Leaderboard</h2>
      </div>

      {/* Top 3 Podium */}
      {leaderboard.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 mb-8 pb-8 border-b">
          {/* 2nd Place */}
          <div className="text-center pt-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#C0C0C0]/20 to-[#A8A8A8]/10 border-2 border-[#C0C0C0] rounded-full mb-3">
              <Medal className="text-[#C0C0C0]" size={32} />
            </div>
            <Badge
              tier={leaderboard[1].tier}
              name=""
              size="sm"
              showLabel={false}
            />
            <h3 className="font-bold text-sm mt-2 truncate px-2">
              {leaderboard[1].fullName}
            </h3>
            <p className="text-xl font-bold text-[#083232] mt-1">
              {leaderboard[1].totalScore}
            </p>
            <p className="text-xs text-gray-500">points</p>
          </div>

          {/* 1st Place */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#FFD700]/30 to-[#FFA500]/20 border-4 border-[#FFD700] rounded-full mb-3 shadow-[0_0_30px_rgba(255,215,0,0.4)]">
              <Trophy className="text-[#FFD700]" size={40} />
            </div>
            <Badge
              tier={leaderboard[0].tier}
              name=""
              size="md"
              showLabel={false}
            />
            <h3 className="font-bold text-base mt-2 truncate px-2">
              {leaderboard[0].fullName}
            </h3>
            <p className="text-2xl font-bold text-[#083232] mt-1">
              {leaderboard[0].totalScore}
            </p>
            <p className="text-xs text-gray-500">points</p>
            {leaderboard[0].activeBadgesCount > 0 && (
              <div className="flex items-center gap-1 justify-center mt-2">
                <Award size={14} className="text-[#2e856e]" />
                <span className="text-xs text-gray-600">
                  {leaderboard[0].activeBadgesCount} badges
                </span>
              </div>
            )}
          </div>

          {/* 3rd Place */}
          <div className="text-center pt-12">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-[#CD7F32]/20 to-[#8B4513]/10 border-2 border-[#CD7F32] rounded-full mb-3">
              <Medal className="text-[#CD7F32]" size={28} />
            </div>
            <Badge
              tier={leaderboard[2].tier}
              name=""
              size="sm"
              showLabel={false}
            />
            <h3 className="font-bold text-sm mt-2 truncate px-2">
              {leaderboard[2].fullName}
            </h3>
            <p className="text-xl font-bold text-[#083232] mt-1">
              {leaderboard[2].totalScore}
            </p>
            <p className="text-xs text-gray-500">points</p>
          </div>
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="space-y-2">
        {leaderboard.map((entry) => {
          const isCurrentUser = currentUserId === entry.userId;

          return (
            <div
              key={entry.userId}
              className={`flex items-center gap-4 p-4 rounded-lg transition-colors
                ${
                  isCurrentUser
                    ? "bg-[#2e856e]/10 border-2 border-[#2e856e]"
                    : "bg-gray-50 hover:bg-gray-100"
                }`}
            >
              {/* Rank */}
              <div className="w-12 flex items-center justify-center">
                {getRankIcon(entry.rank)}
              </div>

              {/* Badge */}
              <div className="flex-shrink-0">
                <Badge tier={entry.tier} name="" size="sm" showLabel={false} />
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-[#083232] truncate">
                  {entry.fullName}
                  {isCurrentUser && (
                    <span className="ml-2 text-xs text-[#2e856e] font-normal">
                      (You)
                    </span>
                  )}
                </h4>
                <div className="flex items-center gap-4 text-xs text-gray-600 mt-1">
                  <span>
                    {entry.contributionConsistencyRate.toFixed(0)}% consistency
                  </span>
                  <span>•</span>
                  <span>{entry.contributionStreakMonths}mo streak</span>
                  {entry.activeBadgesCount > 0 && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Award size={12} className="text-[#2e856e]" />
                        {entry.activeBadgesCount}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Score */}
              <div className="text-right">
                <p className="text-xl font-bold text-[#083232]">
                  {entry.totalScore}
                </p>
                <p className="text-xs text-gray-500">points</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
