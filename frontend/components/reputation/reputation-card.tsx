import React from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "./badge";
import { TrendingUp, Calendar, Target, Award, AlertCircle } from "lucide-react";

interface ReputationCardProps {
  reputation: {
    totalScore: number;
    tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
    contributionScore: number;
    loanRepaymentScore: number;
    meetingAttendanceScore: number;
    votingParticipationScore: number;
    disputePenalty: number;
    contributionConsistencyRate: number;
    loanRepaymentRate: number;
    contributionStreakMonths: number;
    earlyPaymentCount: number;
  };
  badges?: Array<{
    id: string;
    badge: {
      tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
      name: string;
      description: string;
    };
  }>;
  rank?: number;
  totalMembers?: number;
  size?: "compact" | "full";
}

const tierThresholds = {
  bronze: 0,
  silver: 200,
  gold: 400,
  platinum: 600,
  diamond: 800,
};

const tierNames: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
};

export function ReputationCard({
  reputation,
  badges = [],
  rank,
  totalMembers,
  size = "full",
}: ReputationCardProps) {
  if (!reputation) {
    return null;
  }

  const currentThreshold = tierThresholds[reputation.tier];
  const nextTier = getNextTier(reputation.tier);
  const nextThreshold = nextTier ? tierThresholds[nextTier] : 1000;
  const progressToNextTier =
    ((reputation.totalScore - currentThreshold) /
      (nextThreshold - currentThreshold)) *
    100;

  if (size === "compact") {
    return (
      <Card className="w-full p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge
              tier={reputation.tier}
              name={tierNames[reputation.tier]}
              size="md"
              showLabel={false}
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[#083232]">
                  {reputation.totalScore} Points
                </h3>
                {rank && (
                  <span className="text-sm text-gray-500">
                    #{rank} of {totalMembers}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">
                {tierNames[reputation.tier]} Member
              </p>
            </div>
          </div>

          {badges.length > 0 && (
            <div className="flex items-center gap-2">
              <Award size={16} className="text-[#2e856e]" />
              <span className="text-sm font-medium">{badges.length}</span>
            </div>
          )}
        </div>

        {nextTier && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>{tierNames[reputation.tier]}</span>
              <span>{tierNames[nextTier]}</span>
            </div>
            <Progress value={progressToNextTier} className="h-2" />
            <p className="text-xs text-gray-500 mt-1 text-center">
              {nextThreshold - reputation.totalScore} points to{" "}
              {tierNames[nextTier]}
            </p>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="w-full p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <Badge
            tier={reputation.tier}
            name={tierNames[reputation.tier]}
            size="lg"
            showLabel={true}
          />
          <div>
            <h2 className="text-2xl font-bold text-[#083232]">
              {reputation.totalScore} Points
            </h2>
            {rank && (
              <p className="text-sm text-gray-600">
                Ranked #{rank} out of {totalMembers} members
              </p>
            )}
          </div>
        </div>

        {badges.length > 0 && (
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <Award size={20} className="text-[#2e856e]" />
              <span className="text-2xl font-bold text-[#083232]">
                {badges.length}
              </span>
            </div>
            <p className="text-sm text-gray-600">Badges Earned</p>
          </div>
        )}
      </div>

      {/* Progress to next tier */}
      {nextTier && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span className="font-medium">
              {tierNames[reputation.tier]} ({currentThreshold}+)
            </span>
            <span className="font-medium">
              {tierNames[nextTier]} ({nextThreshold}+)
            </span>
          </div>
          <Progress value={progressToNextTier} className="h-3" />
          <p className="text-sm text-gray-600 mt-2 text-center">
            {nextThreshold - reputation.totalScore} more points to reach{" "}
            {tierNames[nextTier]} tier
          </p>
        </div>
      )}

      {/* Score breakdown */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[#083232] mb-3">
          Score Breakdown
        </h3>

        {/* Contribution Score */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-700">
              Contribution Consistency (40%)
            </span>
            <span className="font-semibold text-[#083232]">
              {reputation.contributionScore}/400
            </span>
          </div>
          <Progress
            value={(reputation.contributionScore / 400) * 100}
            className="h-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            {reputation.contributionConsistencyRate.toFixed(1)}% on-time rate
          </p>
        </div>

        {/* Loan Repayment Score */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-700">Loan Repayment (30%)</span>
            <span className="font-semibold text-[#083232]">
              {reputation.loanRepaymentScore}/300
            </span>
          </div>
          <Progress
            value={(reputation.loanRepaymentScore / 300) * 100}
            className="h-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            {reputation.loanRepaymentRate.toFixed(1)}% on-time repayments
          </p>
        </div>

        {/* Meeting Attendance Score */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-700">Meeting Attendance (10%)</span>
            <span className="font-semibold text-[#083232]">
              {reputation.meetingAttendanceScore}/100
            </span>
          </div>
          <Progress value={reputation.meetingAttendanceScore} className="h-2" />
        </div>

        {/* Voting Participation Score */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-700">Voting Participation (10%)</span>
            <span className="font-semibold text-[#083232]">
              {reputation.votingParticipationScore}/100
            </span>
          </div>
          <Progress
            value={reputation.votingParticipationScore}
            className="h-2"
          />
        </div>

        {/* Dispute Penalty */}
        {reputation.disputePenalty > 0 && (
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 text-[#f64d52]">
              <AlertCircle size={16} />
              <span className="text-sm font-medium">
                Dispute Penalty: -{reputation.disputePenalty} points
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Achievement highlights */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-[#2e856e] mb-1">
            <Calendar size={16} />
            <span className="text-2xl font-bold">
              {reputation.contributionStreakMonths}
            </span>
          </div>
          <p className="text-xs text-gray-600">Month Streak</p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-[#2e856e] mb-1">
            <TrendingUp size={16} />
            <span className="text-2xl font-bold">
              {reputation.earlyPaymentCount}
            </span>
          </div>
          <p className="text-xs text-gray-600">Early Payments</p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-[#2e856e] mb-1">
            <Target size={16} />
            <span className="text-2xl font-bold">
              {reputation.contributionConsistencyRate.toFixed(0)}%
            </span>
          </div>
          <p className="text-xs text-gray-600">Consistency</p>
        </div>
      </div>
    </Card>
  );
}

function getNextTier(
  currentTier: string
): "bronze" | "silver" | "gold" | "platinum" | "diamond" | null {
  const tiers: Array<"bronze" | "silver" | "gold" | "platinum" | "diamond"> = [
    "bronze",
    "silver",
    "gold",
    "platinum",
    "diamond",
  ];
  const currentIndex = tiers.indexOf(
    currentTier as "bronze" | "silver" | "gold" | "platinum" | "diamond"
  );
  return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
}
