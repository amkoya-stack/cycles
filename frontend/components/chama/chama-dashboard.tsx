"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  HandCoins,
  AlertCircle,
  PieChart,
  BarChart3,
  Activity,
  Award,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiUrl } from "@/lib/api-config";
// Skeleton component for loading state
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

interface ChamaDashboardProps {
  chamaId: string;
  chamaName?: string;
  chamaBalance?: number;
}

interface ChamaDashboardMetrics {
  chamaName?: string;
  activeMembers: number;
  pendingMembers: number;
  totalContributions: number;
  contributionCount: number;
  totalPayouts: number;
  totalLoansIssued: number;
  activeLoansAmount: number;
  repaidLoansAmount: number;
  defaultedLoansAmount: number;
  reputationScore: number;
  chamaCreatedAt: string;
  activeDisputes: number;
  resolvedDisputes: number;
  chamaInvestments?: {
    totalInvestments: number;
    activeInvestments: number;
    maturedInvestments: number;
    totalInvested: number;
    totalInterestEarned: number;
    totalReturns: number;
    expectedReturns: number;
  };
}

export function ChamaDashboard({
  chamaId,
  chamaName,
  chamaBalance,
}: ChamaDashboardProps) {
  const [metrics, setMetrics] = useState<ChamaDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardMetrics();
  }, [chamaId]);

  const fetchDashboardMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        setError("Authentication required");
        return;
      }

      const response = await fetch(apiUrl(`analytics/chama/${chamaId}`), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch dashboard metrics: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      setMetrics(data);
    } catch (err: any) {
      console.error("Failed to fetch chama dashboard metrics:", err);
      setError(err.message || "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 font-medium">{error}</p>
            <button
              onClick={fetchDashboardMetrics}
              className="mt-4 text-sm text-[#083232] hover:underline"
            >
              Try again
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  const totalFunds =
    (chamaBalance || 0) + (metrics.chamaInvestments?.totalInvested || 0);
  const loanRecoveryRate =
    metrics.totalLoansIssued > 0
      ? (metrics.repaidLoansAmount /
          (metrics.repaidLoansAmount + metrics.defaultedLoansAmount)) *
        100
      : 0;

  return (
    <div className="space-y-6">
      {/* Overview Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Members Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Members</p>
                <p className="text-2xl font-bold text-[#083232]">
                  {metrics.activeMembers}
                </p>
                {metrics.pendingMembers > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {metrics.pendingMembers} pending
                  </p>
                )}
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Funds Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Funds</p>
                <p className="text-2xl font-bold text-[#083232]">
                  KSh {formatAmount(totalFunds)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Wallet + Investments
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <Wallet className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contributions Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Contributions</p>
                <p className="text-2xl font-bold text-[#083232]">
                  KSh {formatAmount(metrics.totalContributions)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {metrics.contributionCount} transactions
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <HandCoins className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reputation Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Reputation Score</p>
                <p className="text-2xl font-bold text-[#083232]">
                  {metrics.reputationScore}
                </p>
                <div className="mt-2">
                  <Progress
                    value={metrics.reputationScore}
                    className="h-2"
                  />
                </div>
              </div>
              <div className="p-3 bg-yellow-100 rounded-xl">
                <Award className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loans Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#083232]" />
              Loans Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Issued</p>
                <p className="text-xl font-bold text-[#083232]">
                  {metrics.totalLoansIssued}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Loans</p>
                <p className="text-xl font-bold text-blue-600">
                  KSh {formatAmount(metrics.activeLoansAmount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Repaid</p>
                <p className="text-xl font-bold text-green-600">
                  KSh {formatAmount(metrics.repaidLoansAmount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Defaulted</p>
                <p className="text-xl font-bold text-red-600">
                  KSh {formatAmount(metrics.defaultedLoansAmount)}
                </p>
              </div>
            </div>
            {metrics.totalLoansIssued > 0 && (
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Recovery Rate</p>
                  <p className="text-sm font-semibold">
                    {loanRecoveryRate.toFixed(1)}%
                  </p>
                </div>
                <Progress value={loanRecoveryRate} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Investments Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-[#083232]" />
              Investments Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics.chamaInvestments ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Invested</p>
                    <p className="text-xl font-bold text-[#083232]">
                      KSh {formatAmount(metrics.chamaInvestments.totalInvested)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Active</p>
                    <p className="text-xl font-bold text-blue-600">
                      {metrics.chamaInvestments.activeInvestments}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Interest Earned</p>
                    <p className="text-xl font-bold text-green-600">
                      KSh{" "}
                      {formatAmount(
                        metrics.chamaInvestments.totalInterestEarned
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Expected Returns</p>
                    <p className="text-xl font-bold text-purple-600">
                      KSh{" "}
                      {formatAmount(metrics.chamaInvestments.expectedReturns)}
                    </p>
                  </div>
                </div>
                {metrics.chamaInvestments.totalInvestments > 0 && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        Total Returns
                      </span>
                      <span className="text-lg font-bold text-[#083232]">
                        KSh{" "}
                        {formatAmount(metrics.chamaInvestments.totalReturns)}
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <PieChart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No investments yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Disputes & Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#083232]" />
              Disputes & Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Active Disputes</p>
                <p className="text-xl font-bold text-orange-600">
                  {metrics.activeDisputes}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Resolved</p>
                <p className="text-xl font-bold text-green-600">
                  {metrics.resolvedDisputes}
                </p>
              </div>
            </div>
            {metrics.activeDisputes > 0 && (
              <div className="pt-4 border-t">
                <Badge variant="destructive" className="w-full justify-center">
                  {metrics.activeDisputes} Active Dispute
                  {metrics.activeDisputes !== 1 ? "s" : ""} Require Attention
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chama Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#083232]" />
              Chama Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Chama Name</p>
              <p className="text-lg font-semibold text-[#083232]">
                {metrics.chamaName || chamaName || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Created</p>
              <p className="text-sm font-medium">
                {formatDate(metrics.chamaCreatedAt)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Payouts</p>
              <p className="text-lg font-semibold text-[#083232]">
                KSh {formatAmount(metrics.totalPayouts)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

