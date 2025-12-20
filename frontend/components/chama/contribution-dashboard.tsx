"use client";

import { useState, useEffect } from "react";
import { contributionApi, CycleSummary } from "@/lib/contribution-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar, TrendingUp, Users, AlertCircle } from "lucide-react";

interface ContributionDashboardProps {
  cycleId: string;
  chamaId?: string;
  isAdmin?: boolean;
  onContributeClick: () => void;
}

export function ContributionDashboard({
  cycleId,
  chamaId,
  isAdmin = false,
  onContributeClick,
}: ContributionDashboardProps) {
  const { toast } = useToast();
  const [summary, setSummary] = useState<CycleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    loadCycleSummary();
  }, [cycleId]);

  const loadCycleSummary = async () => {
    try {
      setLoading(true);
      console.log("Loading cycle summary for cycleId:", cycleId);
      const data = await contributionApi.getCycleSummary(cycleId);
      console.log("Cycle summary loaded:", data);
      setSummary(data);
    } catch (error) {
      console.error("Failed to load cycle summary:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualComplete = async () => {
    if (!chamaId) {
      toast({
        title: "Error",
        description: "Chama ID not provided",
        variant: "destructive",
      });
      return;
    }

    try {
      setCompleting(true);
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const res = await fetch(
        `${API_URL}/api/chama/${chamaId}/cycles/${cycleId}/complete`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to complete cycle");
      }

      const result = await res.json();

      toast({
        title: "Success",
        description: result.payoutProcessed
          ? `Cycle completed and payout of KSh ${result.amount} processed to ${result.recipientName}`
          : "Cycle marked as completed",
      });

      // Refresh the cycle summary
      await loadCycleSummary();
    } catch (error: any) {
      console.error("Error completing cycle:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to complete cycle",
        variant: "destructive",
      });
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#083232]"></div>
      </div>
    );
  }

  if (!summary) {
    return (
      <Card className="border-[#f64d52]">
        <CardContent className="pt-6">
          <p className="text-center text-gray-600">
            Failed to load cycle information
          </p>
        </CardContent>
      </Card>
    );
  }

  const { cycle, summary: stats, members } = summary;
  const daysUntilDue = Math.ceil(
    (new Date(cycle.dueDate).getTime() - new Date().getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const isOverdue = daysUntilDue < 0;
  const isDueSoon = daysUntilDue <= 3 && daysUntilDue >= 0;

  console.log("ContributionDashboard - Debug:", {
    isAdmin,
    completionRate: stats.completionRate,
    cycleStatus: cycle.status,
    payoutExecutedAt: cycle.payout_executed_at,
    shouldShowButton:
      isAdmin && stats.completionRate === 1 && !cycle.payout_executed_at,
  });

  return (
    <div className="space-y-4">
      {/* Cycle Header */}
      <Card className="bg-[#083232] text-white border-2 border-[#2e856e]">
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">
            Cycle {cycle.cycleNumber}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm opacity-90">Expected Amount</p>
              <p className="text-2xl md:text-3xl font-bold">
                KES {cycle.expectedAmount.toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <div>
                <p className="text-sm opacity-90">Due Date</p>
                <p className="text-base md:text-lg font-semibold">
                  {new Date(cycle.dueDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          {isOverdue ? (
            <Badge className="bg-[#f64d52] hover:bg-[#f64d52]/90">
              <AlertCircle className="h-4 w-4 mr-1" />
              {Math.abs(daysUntilDue)} day(s) overdue
            </Badge>
          ) : isDueSoon ? (
            <Badge className="bg-yellow-500 hover:bg-yellow-600">
              <AlertCircle className="h-4 w-4 mr-1" />
              Due in {daysUntilDue} day(s)
            </Badge>
          ) : (
            <Badge className="bg-white/20 hover:bg-white/30">
              {daysUntilDue} days remaining
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Progress Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#083232]/10 rounded-full">
                <TrendingUp className="h-6 w-6 text-[#083232]" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Collected</p>
                <p className="text-xl md:text-2xl font-bold text-[#083232]">
                  KES {cycle.collectedAmount.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#2e856e]/10 rounded-full">
                <Users className="h-6 w-6 text-[#2e856e]" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Contributed</p>
                <p className="text-xl md:text-2xl font-bold text-[#2e856e]">
                  {stats.contributedMembers}/{stats.totalMembers}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-gray-600 mb-2">Completion Rate</p>
              <Progress value={stats.completionRate * 100} className="h-3" />
              <p className="text-right text-sm font-semibold mt-1">
                {(stats.completionRate * 100).toFixed(0)}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Member List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Members ({stats.totalMembers})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {members.map((member) => (
              <div
                key={member.memberId}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      member.hasContributed ? "bg-[#2e856e]" : "bg-gray-300"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm md:text-base truncate">
                      {member.fullName}
                    </p>
                    {member.hasContributed && member.contributedAt && (
                      <p className="text-xs text-gray-500">
                        {new Date(member.contributedAt).toLocaleDateString(
                          "en-GB",
                          {
                            day: "numeric",
                            month: "short",
                          }
                        )}
                      </p>
                    )}
                  </div>
                </div>
                {member.hasContributed ? (
                  <Badge className="bg-[#2e856e] text-white">
                    KES {member.contributedAmount?.toLocaleString()}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-600">
                    Pending
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Admin Manual Completion Button */}
      {isAdmin && stats.completionRate === 1 && !cycle?.payout_executed_at && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center mt-0.5">
                  <span className="text-white text-xs font-bold">!</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900 mb-1">
                    {cycle?.status === "completed"
                      ? "Payout pending - funds ready"
                      : "All members have contributed"}
                  </p>
                  <p className="text-xs text-amber-700">
                    {cycle?.status === "completed"
                      ? `KES ${stats.totalCollected.toLocaleString()} is in the chama wallet, ready to be paid out to the designated recipient.`
                      : "Click below to mark this cycle as completed and process the payout to the designated recipient."}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleManualComplete}
                disabled={completing}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                size="lg"
              >
                {completing
                  ? "Processing..."
                  : cycle?.status === "completed"
                  ? "Process Payout Now"
                  : "Complete Cycle & Process Payout"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contribute Button */}
      <Button
        onClick={onContributeClick}
        className="w-full bg-[#f64d52] hover:bg-[#f64d52]/90 text-white text-lg py-6"
        size="lg"
      >
        Contribute Now
      </Button>
    </div>
  );
}
