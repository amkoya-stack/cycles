"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Percent,
  Clock,
  Award,
  PieChart,
  Vote,
  AlertCircle,
} from "lucide-react";
import { apiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PortfolioSummary {
  total_investments: number;
  active_investments: number;
  matured_investments: number;
  total_invested: number;
  total_interest_earned: number;
  total_returns: number;
  expected_returns: number;
}

interface Investment {
  id: string;
  chama_id: string;
  product_id: string;
  product_name: string;
  product_type: string;
  amount: number;
  interest_rate: number;
  expected_return: number;
  investment_date: string;
  maturity_date: string;
  status: string;
  principal_returned: number;
  interest_earned: number;
  total_return: number;
  risk_rating: number;
  maturity_days: number;
}

interface InvestmentPortfolioProps {
  chamaId: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending_approval: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  matured: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
  liquidated: "bg-orange-100 text-orange-800",
};

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  treasury_bill_91: "91-Day T-Bill",
  treasury_bill_182: "182-Day T-Bill",
  treasury_bill_364: "364-Day T-Bill",
  money_market_fund: "Money Market",
  government_bond: "Govt Bond",
  fixed_deposit: "Fixed Deposit",
  investment_pool: "Investment Pool",
};

export function InvestmentPortfolio({ chamaId }: InvestmentPortfolioProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [pendingProposals, setPendingProposals] = useState<any[]>([]);

  useEffect(() => {
    fetchPortfolio();
    fetchPendingProposals();
  }, [chamaId, statusFilter, productTypeFilter]);

  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      // Fetch summary
      const summaryResponse = await fetch(
        apiUrl(`investment/portfolio/${chamaId}`),
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setSummary(summaryData);
      }

      // Fetch investments
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (productTypeFilter !== "all")
        params.append("productType", productTypeFilter);

      const investmentsResponse = await fetch(
        `${apiUrl(`investment/investments/chama/${chamaId}`)}?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (investmentsResponse.ok) {
        const investmentsData = await investmentsResponse.json();
        setInvestments(investmentsData);
      }
    } catch (error) {
      console.error("Failed to fetch portfolio:", error);
      toast({
        title: "Error",
        description: "Failed to load investment portfolio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingProposals = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      // Fetch active governance proposals of type MAKE_INVESTMENT
      const response = await fetch(
        `${apiUrl(`governance/chama/${chamaId}/proposals`)}?status=active&proposalType=make_investment`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPendingProposals(data || []);
      }
    } catch (error) {
      console.error("Failed to fetch pending proposals:", error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const calculateROI = (invested: number, returns: number) => {
    if (invested === 0) return 0;
    return ((returns / invested) * 100).toFixed(2);
  };

  const getDaysUntilMaturity = (maturityDate: string) => {
    const today = new Date();
    const maturity = new Date(maturityDate);
    const diffTime = maturity.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#083232]"></div>
        <p className="mt-4 text-gray-600">Loading portfolio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#083232]">Investment Portfolio</h1>
          <p className="text-gray-600 mt-1">View and manage your chama investments</p>
        </div>
        <Link href="/investment/marketplace">
          <Button className="bg-[#083232] hover:bg-[#2e856e]">
            Browse Marketplace
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Invested
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-[#083232]" />
                <p className="text-2xl font-bold">{formatCurrency(summary.total_invested)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Interest Earned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary.total_interest_earned)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Expected Returns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-blue-600" />
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(summary.expected_returns)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Active Investments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-[#083232]" />
                <p className="text-2xl font-bold">{summary.active_investments}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pending Proposals Alert */}
      {pendingProposals.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              Pending Investment Proposals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-yellow-700 mb-4">
              You have {pendingProposals.length} investment proposal{pendingProposals.length !== 1 ? "s" : ""} waiting for approval.
            </p>
            <div className="space-y-2 mb-4">
              {pendingProposals.slice(0, 3).map((proposal) => (
                <div
                  key={proposal.id}
                  className="p-3 bg-white rounded-lg border border-yellow-200"
                >
                  <p className="font-semibold text-sm">{proposal.title}</p>
                  {proposal.metadata?.amount && (
                    <p className="text-xs text-gray-600 mt-1">
                      Amount: {formatCurrency(proposal.metadata.amount)}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <Button
              onClick={() => {
                const currentPath = window.location.pathname;
                const slug = currentPath.split("/")[1];
                router.push(`/${slug}?tab=governance`);
              }}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              <Vote className="h-4 w-4 mr-2" />
              Vote on Proposals
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Performance Summary */}
      {summary && summary.total_invested > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Returns</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(summary.total_returns)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">ROI</p>
                <p className="text-2xl font-bold text-green-600">
                  {calculateROI(summary.total_invested, summary.total_returns)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Investments</p>
                <p className="text-2xl font-bold">{summary.total_investments}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="matured">Matured</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Product Type</label>
              <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Investments List */}
      <div className="space-y-4">
        {investments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-600">No investments found</p>
              <Link href="/investment/marketplace">
                <Button variant="outline" className="mt-4">
                  Browse Investment Products
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          investments.map((investment) => {
            const daysUntilMaturity = getDaysUntilMaturity(investment.maturity_date);
            const isMatured = daysUntilMaturity <= 0;
            const returnPercentage = calculateROI(investment.amount, investment.total_return);

            return (
              <Card key={investment.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">{investment.product_name}</CardTitle>
                        <Badge className={STATUS_COLORS[investment.status] || "bg-gray-100"}>
                          {investment.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {PRODUCT_TYPE_LABELS[investment.product_type] || investment.product_type}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Amount Invested</p>
                      <p className="font-semibold">{formatCurrency(investment.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Interest Rate</p>
                      <p className="font-semibold">{investment.interest_rate}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">
                        {isMatured ? "Matured" : "Matures In"}
                      </p>
                      <p className="font-semibold">
                        {isMatured
                          ? "Matured"
                          : `${daysUntilMaturity} day${daysUntilMaturity !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Returns</p>
                      <p className="font-semibold text-green-600">
                        {formatCurrency(investment.total_return)} ({returnPercentage}%)
                      </p>
                    </div>
                  </div>

                  {investment.status === "active" && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Expected Return</p>
                          <p className="font-semibold">
                            {formatCurrency(investment.expected_return)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Maturity Date</p>
                          <p className="font-semibold">
                            {new Date(investment.maturity_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

