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
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { apiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

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
  userRole?: string | null;
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

export function InvestmentPortfolio({ chamaId, userRole }: InvestmentPortfolioProps) {
  // Check if user is authorized (admin or treasurer)
  const isAuthorized = userRole === "admin" || userRole === "treasurer" || userRole === "chairperson";
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadingInvestments, setLoadingInvestments] = useState(false);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productTypeFilter, setProductTypeFilter] = useState<string[]>([]);
  const [expandedInvestmentId, setExpandedInvestmentId] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    if (initialLoad) {
    fetchPortfolio();
      setInitialLoad(false);
    } else {
      fetchInvestmentsOnly();
    }
  }, [chamaId, statusFilter, productTypeFilter]);

  const fetchInvestmentsOnly = async () => {
    try {
      setLoadingInvestments(true);
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      // Fetch investments only (no summary)
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (productTypeFilter.length > 0) {
        params.append("productType", productTypeFilter.join(","));
      }

      const investmentsResponse = await fetch(
        `${apiUrl(`investment/investments/chama/${chamaId}`)}?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (investmentsResponse.ok) {
        const contentType = investmentsResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const text = await investmentsResponse.text();
          if (text.trim()) {
            try {
              const investmentsData = JSON.parse(text);
              setInvestments(Array.isArray(investmentsData) ? investmentsData : []);
            } catch (e) {
              console.error("Failed to parse investments JSON:", e, "Response:", text);
              setInvestments([]);
            }
          } else {
            setInvestments([]);
          }
        }
      } else {
        console.error("Investments response not OK:", investmentsResponse.status, investmentsResponse.statusText);
        setInvestments([]);
      }
    } catch (error) {
      console.error("Failed to fetch investments:", error);
    } finally {
      setLoadingInvestments(false);
    }
  };

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
        const contentType = summaryResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const text = await summaryResponse.text();
          if (text.trim()) {
            try {
              const summaryData = JSON.parse(text);
              setSummary(summaryData);
            } catch (e) {
              console.error("Failed to parse summary JSON:", e, "Response:", text);
            }
          } else {
            // Empty response - set default summary
            setSummary({
              total_investments: 0,
              active_investments: 0,
              matured_investments: 0,
              total_invested: 0,
              total_interest_earned: 0,
              total_returns: 0,
              expected_returns: 0,
            });
          }
        }
      } else {
        console.error("Summary response not OK:", summaryResponse.status, summaryResponse.statusText);
      }

      // Fetch investments
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (productTypeFilter.length > 0) {
        params.append("productType", productTypeFilter.join(","));
      }

      const investmentsResponse = await fetch(
        `${apiUrl(`investment/investments/chama/${chamaId}`)}?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (investmentsResponse.ok) {
        const contentType = investmentsResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const text = await investmentsResponse.text();
          if (text.trim()) {
            try {
              const investmentsData = JSON.parse(text);
              setInvestments(Array.isArray(investmentsData) ? investmentsData : []);
            } catch (e) {
              console.error("Failed to parse investments JSON:", e, "Response:", text);
              setInvestments([]);
            }
          } else {
            // Empty response - set empty array
            setInvestments([]);
          }
        }
      } else {
        console.error("Investments response not OK:", investmentsResponse.status, investmentsResponse.statusText);
        setInvestments([]);
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
      {/* Mobile View */}
      <div className="md:hidden">
        {/* Summary Stats - Mobile */}
        {summary && (
          <div className="bg-white border-b border-gray-200">
            {/* Total Invested - Prominent */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-gray-700" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Total Invested</span>
                </div>
                <span className="text-xl font-bold text-[#083232]">
                  {formatCurrency(summary.total_invested)}
                </span>
              </div>
            </div>
            
            {/* Other Stats - Grid */}
            <div className="px-4 py-3 grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                </div>
                <p className="text-[10px] text-gray-500 mb-0.5">Interest</p>
                <p className="text-sm font-semibold text-green-600">
                  {formatCurrency(summary.total_interest_earned)}
                </p>
              </div>
              <div className="text-center">
                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-1.5">
                  <PieChart className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <p className="text-[10px] text-gray-500 mb-0.5">Expected</p>
                <p className="text-sm font-semibold text-blue-600">
                  {formatCurrency(summary.expected_returns)}
                </p>
              </div>
              <div className="text-center">
                <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-1.5">
                  <Award className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <p className="text-[10px] text-gray-500 mb-0.5">Active</p>
                <p className="text-sm font-semibold text-purple-600">
                  {summary.active_investments}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filters - Mobile */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          {/* Status Filters */}
          <div className="px-4 pt-3 pb-2 border-b border-gray-100">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2 px-1">Status</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
              {["all", "pending_approval", "approved", "active", "matured"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all ${
                    statusFilter === status
                      ? "bg-[#083232] text-white shadow-sm"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {status.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}
                </button>
              ))}
            </div>
          </div>
          
          {/* Product Type Filters */}
          <div className="px-4 pb-3 pt-2">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2 px-1">Product Type</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
              {Object.keys(PRODUCT_TYPE_LABELS).map((type) => {
                const isSelected = productTypeFilter.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => {
                      if (isSelected) {
                        setProductTypeFilter(productTypeFilter.filter((t) => t !== type));
                      } else {
                        setProductTypeFilter([...productTypeFilter, type]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {PRODUCT_TYPE_LABELS[type] || type}
                  </button>
                );
              })}
              {productTypeFilter.length > 0 && (
                <button
                  onClick={() => setProductTypeFilter([])}
                  className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Investments List - Mobile */}
        <div className="pb-20">
          {loading && initialLoad ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#083232] border-t-transparent mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading investments...</p>
            </div>
          ) : investments.length === 0 ? (
            <div className="text-center py-12 px-4">
              <PieChart className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 mb-4">No investments found</p>
              {isAuthorized && (
                <Link href="/investment/marketplace">
                  <Button variant="outline" size="sm" className="text-xs">
                    Browse Marketplace
                  </Button>
                </Link>
              )}
              {!isAuthorized && (
                <p className="text-xs text-gray-500 mt-2">Only admins and authorized members can browse investments</p>
              )}
            </div>
          ) : (
            <div className="space-y-0">
              {investments.map((investment) => {
                const isExpanded = expandedInvestmentId === investment.id;
                const daysUntilMaturity = getDaysUntilMaturity(investment.maturity_date);
                const isMatured = daysUntilMaturity <= 0;
                const returnPercentage = calculateROI(investment.amount, investment.total_return);
                
                const getStatusColor = (status: string) => {
                  if (status === "active") return "border-l-green-500";
                  if (status === "matured") return "border-l-gray-400";
                  if (status === "pending_approval" || status === "approved") return "border-l-yellow-500";
                  if (status === "cancelled" || status === "liquidated") return "border-l-red-500";
                  return "border-l-gray-300";
                };

                return (
                  <div
                    key={investment.id}
                    className={`bg-white border-l-4 ${getStatusColor(investment.status)} border-b border-gray-200`}
                  >
                    <button
                      onClick={() => setExpandedInvestmentId(isExpanded ? null : investment.id)}
                      className="w-full px-4 py-3 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900 truncate">
                              {investment.product_name}
                            </span>
                            <Badge className={`text-xs ${STATUS_COLORS[investment.status] || "bg-gray-100"}`}>
                              {investment.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">
                              {formatCurrency(investment.amount)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {investment.interest_rate}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-1">
                            {PRODUCT_TYPE_LABELS[investment.product_type] || investment.product_type}
                          </p>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-gray-400 ml-2 transition-transform flex-shrink-0 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-3 border-t border-gray-200 pt-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Amount Invested</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatCurrency(investment.amount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Interest Rate</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {investment.interest_rate}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">
                              {isMatured ? "Matured" : "Matures In"}
                            </p>
                            <p className="text-sm font-semibold text-gray-900">
                              {isMatured
                                ? "Matured"
                                : `${daysUntilMaturity} day${daysUntilMaturity !== 1 ? "s" : ""}`}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Returns</p>
                            <p className="text-sm font-semibold text-green-600">
                              {formatCurrency(investment.total_return)} ({returnPercentage}%)
                            </p>
                          </div>
                        </div>
                        {investment.status === "active" && (
                          <div className="pt-3 border-t border-gray-200">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Expected Return</p>
                                <p className="text-sm font-semibold text-gray-900">
                                  {formatCurrency(investment.expected_return)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Maturity Date</p>
                                <p className="text-sm font-semibold text-gray-900">
                                  {new Date(investment.maturity_date).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#083232]">Investment Portfolio</h1>
          <p className="text-gray-600 mt-1">View and manage your chama investments</p>
        </div>
        {isAuthorized && (
          <Link href="/investment/marketplace">
            <Button className="bg-[#083232] hover:bg-[#2e856e]">
              Browse Marketplace
            </Button>
          </Link>
        )}
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
              <div className="flex flex-wrap gap-2">
                {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => {
                  const isSelected = productTypeFilter.includes(value);
                  return (
                    <button
                      key={value}
                      onClick={() => {
                        if (isSelected) {
                          setProductTypeFilter(productTypeFilter.filter((t) => t !== value));
                        } else {
                          setProductTypeFilter([...productTypeFilter, value]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                {productTypeFilter.length > 0 && (
                  <button
                    onClick={() => setProductTypeFilter([])}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    Clear All
                  </button>
                )}
              </div>
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
              {isAuthorized && (
                <Link href="/investment/marketplace">
                  <Button variant="outline" className="mt-4">
                    Browse Investment Products
                  </Button>
                </Link>
              )}
              {!isAuthorized && (
                <p className="text-sm text-gray-500 mt-4">Only admins and authorized members can browse investments</p>
              )}
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
    </div>
  );
}

