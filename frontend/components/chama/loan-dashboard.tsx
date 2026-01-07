"use client";

import React, { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Bell,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Users,
  DollarSign,
  Wallet,
  Filter,
  Plus,
  MoreHorizontal,
  Percent,
  Calendar,
  HandCoins,
  Search,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiUrl } from "@/lib/api-config";
import { LoanApplicationsReview } from "./loan-applications-review";
import { LoanRepaymentPayment } from "@/components/lending/loan-repayment-payment";

interface LoanDashboardProps {
  chamaId?: string;
  chamaBalance?: number;
}

// This component will be used in the chama Loans tab
export default function LoanDashboard({
  chamaId,
  chamaBalance: initialBalance,
}: LoanDashboardProps) {
  const [activeTab, setActiveTab] = useState("Overview");
  const [totalCash, setTotalCash] = useState(0);
  const [contributions, setContributions] = useState(0);
  const [interestIncome, setInterestIncome] = useState(0);
  const [activeLoans, setActiveLoans] = useState(0);
  const [overdueLoans, setOverdueLoans] = useState(0);
  const [loansList, setLoansList] = useState<any[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [loading, setLoading] = useState(true);

  // Loans tab state
  const [allLoans, setAllLoans] = useState<any[]>([]);
  const [loadingAllLoans, setLoadingAllLoans] = useState(false);
  const [loanFilter, setLoanFilter] = useState<string>("all");
  const [loanSearch, setLoanSearch] = useState("");

  // Payments tab state
  const [repayments, setRepayments] = useState<any[]>([]);
  const [loadingRepayments, setLoadingRepayments] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [selectedRepaymentLoanId, setSelectedRepaymentLoanId] = useState<string | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  // Analytics tab state
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Applications tab state
  const [applicationsLendingType, setApplicationsLendingType] = useState<
    "internal" | "external" | "inter-chama"
  >("internal");
  const [userRole, setUserRole] = useState<string | null>(null);

  // Format amount helper
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Fetch wallet data function
  const fetchWalletData = async () => {
    if (!chamaId) {
      setLoading(false);
      return;
    }

    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        setLoading(false);
        return;
      }

      // Fetch all data in parallel
      const [balanceRes, contributionsRes, interestRes, summaryRes, chamaRes] =
        await Promise.all([
          fetch(apiUrl(`chama/${chamaId}/balance`), {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch(apiUrl(`chama/${chamaId}/contributions/total`), {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch(apiUrl(`lending/chama/${chamaId}/interest-income`), {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch(apiUrl(`lending/chama/${chamaId}/summary`), {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch(apiUrl(`chama/${chamaId}`), {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ]);

      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        setTotalCash(parseFloat(balanceData.balance || 0));
      } else if (initialBalance !== undefined) {
        // Fallback to prop if API fails
        setTotalCash(initialBalance);
      }

      if (contributionsRes.ok) {
        const contributionsData = await contributionsRes.json();
        setContributions(parseFloat(contributionsData.totalContributions || 0));
      }

      if (interestRes.ok) {
        const interestData = await interestRes.json();
        setInterestIncome(parseFloat(interestData.data?.interestIncome || 0));
      }

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setActiveLoans(summaryData.data?.activeLoans || 0);
        setOverdueLoans(summaryData.data?.overdueLoans || 0);
      }

      if (chamaRes.ok) {
        const chamaData = await chamaRes.json();
        setUserRole(chamaData.user_role || null);
      }
    } catch (error) {
      console.error("Failed to fetch wallet data:", error);
      // Use initial balance as fallback
      if (initialBalance !== undefined) {
        setTotalCash(initialBalance);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch wallet data on mount
  useEffect(() => {
    fetchWalletData();
  }, [chamaId, initialBalance]);

  // Fetch active and overdue loans
  useEffect(() => {
    const fetchLoans = async () => {
      if (!chamaId) {
        setLoadingLoans(false);
        return;
      }

      try {
        const accessToken = localStorage.getItem("accessToken");
        if (!accessToken) {
          setLoadingLoans(false);
          return;
        }

        // Fetch all loans and filter for active/overdue
        const response = await fetch(
          apiUrl(`lending/chama/${chamaId}/loans?limit=50`),
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const allLoans = data.data || [];

          // Filter for active and overdue loans only
          const activeAndOverdue = allLoans.filter(
            (loan: any) => loan.status === "active" || loan.status === "overdue"
          );

          // Transform loans to match frontend format
          const transformedLoans = activeAndOverdue.map((loan: any) => {
            // Calculate progress percentage
            const progress =
              loan.totalAmount > 0
                ? Math.round((loan.totalPaid / loan.totalAmount) * 100)
                : 0;

            // Calculate monthly payment (approximate from total amount and repayment period)
            const numberOfPayments = loan.repaymentPeriodMonths || 1;
            const monthlyPayment = loan.totalAmount / numberOfPayments;

            // Format dates
            const formatDate = (date: string | null) => {
              if (!date) return "N/A";
              return new Date(date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
            };

            return {
              id: loan.id.substring(0, 5).toUpperCase(), // Short ID for display
              fullId: loan.id,
              status: loan.status === "active" ? "Active" : "Overdue",
              borrower: loan.full_name || "Unknown",
              progress: Math.min(progress, 100),
              remaining: loan.outstandingBalance || 0,
              total: loan.totalAmount || 0,
              interestRate: `${loan.interestRate || 0}%`,
              monthlyPayment: monthlyPayment,
              nextPayment: formatDate(loan.firstPaymentDate),
              // Additional backend data
              loanData: loan,
            };
          });

          setLoansList(transformedLoans);
        }
      } catch (error) {
        console.error("Failed to fetch loans:", error);
      } finally {
        setLoadingLoans(false);
      }
    };

    fetchLoans();
  }, [chamaId]);

  // Fetch recent activities
  useEffect(() => {
    const fetchActivities = async () => {
      if (!chamaId) {
        setLoadingActivities(false);
        return;
      }

      try {
        const accessToken = localStorage.getItem("accessToken");
        if (!accessToken) {
          setLoadingActivities(false);
          return;
        }

        const response = await fetch(
          apiUrl(`lending/chama/${chamaId}/activities?limit=5`),
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const backendActivities = data.data || [];

          // Transform activities to match frontend format
          const transformedActivities = backendActivities.map(
            (activity: any) => {
              // Format time ago
              const formatTimeAgo = (date: string) => {
                if (!date) return "Unknown";
                const now = new Date();
                const activityDate = new Date(date);
                const diffInSeconds = Math.floor(
                  (now.getTime() - activityDate.getTime()) / 1000
                );

                if (diffInSeconds < 60) return "Just now";
                if (diffInSeconds < 3600)
                  return `${Math.floor(diffInSeconds / 60)} minutes ago`;
                if (diffInSeconds < 86400)
                  return `${Math.floor(diffInSeconds / 3600)} hours ago`;
                if (diffInSeconds < 604800)
                  return `${Math.floor(diffInSeconds / 86400)} days ago`;
                return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
              };

              // Determine activity type and icon
              let title = "";
              let icon = DollarSign;
              let bg = "bg-green-50";
              let iconColor = "text-green-600";

              switch (activity.type) {
                case "payment":
                  title = `Payment received from ${activity.borrowerName}`;
                  icon = DollarSign;
                  bg = "bg-green-50";
                  iconColor = "text-green-600";
                  break;
                case "application":
                  title = `New loan application approved`;
                  icon = TrendingUp;
                  bg = "bg-blue-50";
                  iconColor = "text-blue-600";
                  break;
                case "disbursement":
                  title = `Loan disbursed to ${activity.borrowerName}`;
                  icon = TrendingUp;
                  bg = "bg-blue-50";
                  iconColor = "text-blue-600";
                  break;
                case "overdue":
                  title = `Payment overdue from ${activity.borrowerName}`;
                  icon = AlertCircle;
                  bg = "bg-red-50";
                  iconColor = "text-red-600";
                  break;
                case "contribution":
                  title = `Contribution from ${activity.contributorName}`;
                  icon = HandCoins;
                  bg = "bg-[#2e856e]/10";
                  iconColor = "text-[#2e856e]";
                  break;
                default:
                  title = "Loan activity";
              }

              return {
                type: activity.type,
                title,
                amount: `Ksh ${formatAmount(activity.amount)}`,
                time: formatTimeAgo(activity.timestamp),
                icon,
                bg,
                iconColor,
              };
            }
          );

          setActivities(transformedActivities);
        }
      } catch (error) {
        console.error("Failed to fetch activities:", error);
      } finally {
        setLoadingActivities(false);
      }
    };

    fetchActivities();
  }, [chamaId]);

  // Fetch all loans for Loans tab
  useEffect(() => {
    const fetchAllLoans = async () => {
      if (!chamaId || activeTab !== "Loans") {
        return;
      }

      setLoadingAllLoans(true);
      try {
        const accessToken = localStorage.getItem("accessToken");
        if (!accessToken) {
          setLoadingAllLoans(false);
          return;
        }

        const statusParam = loanFilter !== "all" ? `&status=${loanFilter}` : "";
        const response = await fetch(
          apiUrl(`lending/chama/${chamaId}/loans?limit=100${statusParam}`),
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const loans = data.data || [];

          // Transform loans
          const transformedLoans = loans.map((loan: any) => {
            const progress =
              loan.totalAmount > 0
                ? Math.round((loan.totalPaid / loan.totalAmount) * 100)
                : 0;
            const numberOfPayments = loan.repaymentPeriodMonths || 1;
            const monthlyPayment = loan.totalAmount / numberOfPayments;

            const formatDate = (date: string | null) => {
              if (!date) return "N/A";
              return new Date(date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
            };

            return {
              id: loan.id.substring(0, 8).toUpperCase(),
              fullId: loan.id,
              status:
                loan.status.charAt(0).toUpperCase() + loan.status.slice(1),
              borrower: loan.full_name || "Unknown",
              borrowerEmail: loan.email || "",
              progress: Math.min(progress, 100),
              remaining: loan.outstandingBalance || 0,
              total: loan.totalAmount || 0,
              principal: loan.principalAmount || 0,
              interestRate: `${loan.interestRate || 0}%`,
              monthlyPayment: monthlyPayment,
              nextPayment: formatDate(loan.firstPaymentDate),
              disbursedAt: formatDate(loan.disbursedAt),
              maturityDate: formatDate(loan.maturityDate),
              loanData: loan,
            };
          });

          // Filter by search term
          const filtered = loanSearch
            ? transformedLoans.filter(
                (loan: any) =>
                  loan.borrower
                    .toLowerCase()
                    .includes(loanSearch.toLowerCase()) ||
                  loan.id.toLowerCase().includes(loanSearch.toLowerCase())
              )
            : transformedLoans;

          setAllLoans(filtered);
        }
      } catch (error) {
        console.error("Failed to fetch all loans:", error);
      } finally {
        setLoadingAllLoans(false);
      }
    };

    fetchAllLoans();
  }, [chamaId, activeTab, loanFilter, loanSearch]);

  // Fetch repayments for Payments tab
  useEffect(() => {
    const fetchRepayments = async () => {
      if (!chamaId || activeTab !== "Payments") {
        return;
      }

      setLoadingRepayments(true);
      try {
        const accessToken = localStorage.getItem("accessToken");
        if (!accessToken) {
          setLoadingRepayments(false);
          return;
        }

        const statusParam =
          paymentFilter !== "all" ? `&status=${paymentFilter}` : "";
        const response = await fetch(
          apiUrl(`lending/chama/${chamaId}/repayments?limit=100${statusParam}`),
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const repaymentsData = data.data || [];

          // Transform repayments
          const transformed = repaymentsData.map((repayment: any) => {
            const formatDate = (date: string | null) => {
              if (!date) return "N/A";
              return new Date(date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
            };

            const status = repayment.status || "pending";
            const statusCapitalized =
              status.charAt(0).toUpperCase() + status.slice(1);

            return {
              id: repayment.id,
              loanId: repayment.loan_id_full || repayment.loan_id,
              installmentNumber: repayment.installmentNumber || 0,
              borrowerName: repayment.borrower_name || "Unknown",
              amountDue: repayment.amountDue || 0,
              amountPaid: repayment.amountPaid || 0,
              dueDate: formatDate(repayment.dueDate),
              paidAt: formatDate(repayment.paidAt),
              status: statusCapitalized,
              paymentMethod: repayment.paymentMethod || "N/A",
              repaymentData: repayment,
            };
          });

          setRepayments(transformed);
        }
      } catch (error) {
        console.error("Failed to fetch repayments:", error);
      } finally {
        setLoadingRepayments(false);
      }
    };

    fetchRepayments();
  }, [chamaId, activeTab, paymentFilter]);

  // Fetch analytics for Analytics tab
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!chamaId || activeTab !== "Analytics") {
        return;
      }

      setLoadingAnalytics(true);
      try {
        const accessToken = localStorage.getItem("accessToken");
        if (!accessToken) {
          setLoadingAnalytics(false);
          return;
        }

        const response = await fetch(
          apiUrl(`lending/chama/${chamaId}/analytics`),
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setAnalytics(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setLoadingAnalytics(false);
      }
    };

    fetchAnalytics();
  }, [chamaId, activeTab]);

  const stats = [
    {
      title: "Total Portfolio",
      value: "$1.25M",
      change: "+12.5%",
      icon: DollarSign,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      positive: true,
    },
    {
      title: "Active & Overdue Loans",
      value: null, // We'll render custom content for this card
      change: null,
      icon: null,
      iconBg: "",
      iconColor: "",
      positive: null,
      custom: true,
      activeLoans: {
        value: "45",
        change: "+5",
      },
      overduePayments: {
        value: "3",
        change: "-2",
      },
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 w-full" style={{ maxWidth: "100%" }}>
        {/* Fixed Header Cards - Independent of Tab Content */}
        <div className="mb-6 flex gap-4" style={{ isolation: "isolate" }}>
          {/* Total Portfolio Card (55% width) */}
          <Card
            className="h-[280px] flex-shrink-0 p-0 overflow-hidden"
            style={{ width: "55%", minWidth: 0 }}
          >
            <CardContent className="p-0 h-full flex flex-col">
              {/* Green Section - Top Half (50%) */}
              <div className="bg-[#083232] p-6 flex flex-col gap-2 shadow-sm border-b border-gray-100 h-1/2 flex-shrink-0">
                <div className="flex items-center gap-2 w-full">
                  <Wallet className="w-6 h-6 text-white" />
                  <span className="text-lg font-semibold text-white">
                    Total Cash
                  </span>
                </div>
                <p className="text-4xl font-extrabold text-white mt-2 mb-1">
                  {loading ? (
                    <span className="text-2xl">Loading...</span>
                  ) : (
                    `Ksh ${formatAmount(totalCash)}`
                  )}
                </p>
                {/* TODO: Calculate percentage change from last month */}
                {/* <span className="inline-block text-xs text-green-100 bg-green-600/70 px-3 py-1 rounded-full w-fit font-semibold">
                  +12.5% from last month
                </span> */}
              </div>
              {/* White Section - Bottom Half (50%) */}
              <div className="h-1/2 flex flex-col md:flex-row gap-0 md:gap-0 bg-white shadow-inner border-t border-gray-100 flex-shrink-0">
                <div className="flex-1 flex flex-col items-center justify-center p-5 border-b md:border-b-0 md:border-r border-gray-100">
                  <div className="w-10 h-10 bg-[#2e856e]/10 rounded-full flex items-center justify-center mb-2">
                    <DollarSign className="w-5 h-5 text-[#2e856e]" />
                  </div>
                  <p className="text-xs text-gray-500 font-medium mb-1">
                    Contributions
                  </p>
                  <p className="text-lg font-bold text-[#083232]">
                    {loading ? (
                      <span className="text-sm text-gray-400">Loading...</span>
                    ) : (
                      `Ksh ${formatAmount(contributions)}`
                    )}
                  </p>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-5">
                  <div className="w-10 h-10 bg-[#f64d52]/10 rounded-full flex items-center justify-center mb-2">
                    <Percent className="w-5 h-5 text-[#f64d52]" />
                  </div>
                  <p className="text-xs text-gray-500 font-medium mb-1">
                    Interest Income
                  </p>
                  <p className="text-lg font-bold text-[#083232]">
                    {loading ? (
                      <span className="text-sm text-gray-400">Loading...</span>
                    ) : (
                      `Ksh ${formatAmount(interestIncome)}`
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Loans Pie Chart Card (45% width) */}
          <Card
            className="h-[280px] flex-shrink-0"
            style={{ width: "45%", minWidth: 0 }}
          >
            <CardContent className="p-6 h-full flex flex-col items-center justify-center">
              <p className="text-base font-semibold text-gray-900 mb-4">
                Loan Distribution
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Active", value: activeLoans },
                      { name: "Overdue", value: overdueLoans },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    fill="#083232"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    <Cell key="active" fill="#083232" />
                    <Cell key="overdue" fill="#f64d52" />
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-[#083232]"></span>
                  <span className="text-xs text-gray-700">
                    Active: {loading ? "..." : activeLoans}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-[#f64d52]"></span>
                  <span className="text-xs text-gray-700">
                    Overdue: {loading ? "..." : overdueLoans}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs and Buttons */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("Overview")}
              className={`text-sm font-semibold pb-2 transition-colors ${
                activeTab === "Overview"
                  ? "text-gray-900 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("Loans")}
              className={`text-sm font-semibold pb-2 transition-colors ${
                activeTab === "Loans"
                  ? "text-gray-900 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Loans
            </button>
            <button
              onClick={() => setActiveTab("Payments")}
              className={`text-sm font-semibold pb-2 transition-colors ${
                activeTab === "Payments"
                  ? "text-gray-900 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Payments
            </button>
            <button
              onClick={() => setActiveTab("Analytics")}
              className={`text-sm font-semibold pb-2 transition-colors ${
                activeTab === "Analytics"
                  ? "text-gray-900 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab("Applications")}
              className={`text-sm font-semibold pb-2 transition-colors ${
                activeTab === "Applications"
                  ? "text-gray-900 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Applications
            </button>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              New Loan
            </Button>
          </div>
        </div>

        {/* Main Content - Conditional Rendering Based on Active Tab */}
        <div className="min-h-[600px]">
          {activeTab === "Overview" && (
        <div className="grid grid-cols-12 gap-6">
          {/* Active Loans - Takes up 8 columns (wider) */}
          <div className="col-span-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Active & Overdue Loans
                </h2>
                <button className="text-sm text-blue-600 hover:text-blue-700">
                  View All
                </button>
              </div>

              <div className="space-y-4">
                    {loadingLoans ? (
                      <div className="text-center py-8 text-gray-500">
                        Loading loans...
                      </div>
                    ) : loansList.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No active or overdue loans found.
                      </div>
                    ) : (
                      loansList.map((loan) => (
                  <Card
                    key={loan.id}
                    className="border-l-4"
                    style={{
                      borderLeftColor:
                              loan.status === "Active" ? "#083232" : "#f64d52",
                    }}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-semibold text-gray-900">
                            {loan.id}
                          </span>
                          <Badge
                            variant={
                              loan.status === "Active"
                                ? "default"
                                : "destructive"
                            }
                            className={
                              loan.status === "Active"
                                ? "bg-green-100 text-green-700 hover:bg-green-100"
                                : ""
                            }
                          >
                            {loan.status}
                          </Badge>
                        </div>
                        <button>
                          <MoreHorizontal className="w-5 h-5 text-gray-400" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mb-4 text-gray-600">
                        <Users className="w-4 h-4" />
                        <span className="text-sm">{loan.borrower}</span>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                                <span className="text-gray-600">
                                  Loan Progress
                                </span>
                          <span className="font-medium text-gray-900">
                            {loan.progress}% paid
                          </span>
                        </div>
                        <Progress value={loan.progress} className="h-2" />
                      </div>

                      <div className="flex items-center justify-between text-sm mb-4">
                        <span className="text-gray-600">
                          Remaining:{" "}
                          <span className="font-semibold text-gray-900">
                                  Ksh {formatAmount(loan.remaining)}
                          </span>
                        </span>
                        <span className="text-gray-600">
                          Total:{" "}
                          <span className="font-semibold text-gray-900">
                                  Ksh {formatAmount(loan.total)}
                          </span>
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                        <div className="flex items-start gap-2">
                          <Percent className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-600">
                              Interest Rate
                            </p>
                            <p className="text-sm font-medium text-gray-900">
                              {loan.interestRate}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <DollarSign className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-600">
                              Monthly Payment
                            </p>
                            <p className="text-sm font-medium text-gray-900">
                                    Ksh {formatAmount(loan.monthlyPayment)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-600">
                              Next Payment
                            </p>
                            <p className="text-sm font-medium text-gray-900">
                              {loan.nextPayment}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                      ))
                    )}
              </div>
            </div>
          </div>

          {/* Recent Activity - Takes up 4 columns (narrower) */}
          <div className="col-span-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">
                Recent Activity
              </h2>

              <div className="space-y-3">
                    {loadingActivities ? (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        Loading activities...
                      </div>
                    ) : activities.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        No recent activities found.
                      </div>
                    ) : (
                      activities.map((activity, index) => (
                  <div
                    key={index}
                          className={`${activity.bg} rounded-lg p-3 border border-gray-100`}
                  >
                          <div className="flex items-start gap-2">
                      <div
                              className={`w-8 h-8 ${activity.bg} rounded-lg flex items-center justify-center flex-shrink-0`}
                      >
                        <activity.icon
                                className={`w-4 h-4 ${activity.iconColor}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 whitespace-nowrap truncate mb-1">
                          {activity.title}
                        </p>
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                          {activity.amount}
                        </p>
                                <p className="text-xs text-gray-500 whitespace-nowrap">
                                  {activity.time}
                                </p>
                      </div>
                    </div>
                  </div>
                        </div>
                      ))
                    )}
              </div>

              <button className="w-full mt-6 text-sm text-blue-600 hover:text-blue-700 font-medium">
                View All Activity
              </button>
            </div>
          </div>
        </div>
          )}

          {/* Loans Tab */}
          {activeTab === "Loans" && (
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">
                      All Loans
                    </h2>
      </div>

                  {/* Filters and Search */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by borrower or loan ID..."
                        value={loanSearch}
                        onChange={(e) => setLoanSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
    </div>
                    <div className="flex gap-2">
                      {[
                        "all",
                        "active",
                        "overdue",
                        "completed",
                        "defaulted",
                      ].map((status) => (
                        <button
                          key={status}
                          onClick={() => setLoanFilter(status)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            loanFilter === status
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Loans Table */}
                  <div className="overflow-x-auto">
                    {loadingAllLoans ? (
                      <div className="text-center py-8 text-gray-500">
                        Loading loans...
                      </div>
                    ) : allLoans.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No loans found.
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                              Loan ID
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                              Borrower
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                              Status
                            </th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                              Amount
                            </th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                              Remaining
                            </th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                              Progress
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                              Disbursed
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {allLoans.map((loan) => (
                            <tr
                              key={loan.fullId}
                              className="border-b border-gray-100 hover:bg-gray-50"
                            >
                              <td className="py-3 px-4 text-sm font-medium text-gray-900">
                                {loan.id}
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-700">
                                {loan.borrower}
                              </td>
                              <td className="py-3 px-4">
                                <Badge
                                  variant={
                                    loan.status === "Active"
                                      ? "default"
                                      : loan.status === "Overdue"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                  className={
                                    loan.status === "Active"
                                      ? "bg-green-100 text-green-700"
                                      : loan.status === "Overdue"
                                      ? ""
                                      : "bg-gray-100 text-gray-700"
                                  }
                                >
                                  {loan.status}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-sm text-right font-medium text-gray-900">
                                Ksh {formatAmount(loan.total)}
                              </td>
                              <td className="py-3 px-4 text-sm text-right text-gray-700">
                                Ksh {formatAmount(loan.remaining)}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <Progress
                                    value={loan.progress}
                                    className="h-2 flex-1"
                                  />
                                  <span className="text-xs text-gray-600 w-12 text-right">
                                    {loan.progress}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-600">
                                {loan.disbursedAt}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === "Payments" && (
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12">
                <div className="space-y-6">
                  {/* Payment Statistics */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-6">
                        <p className="text-sm text-gray-600 mb-2">
                          Total Collected This Month
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          Ksh{" "}
                          {formatAmount(
                            repayments
                              .filter(
                                (r) =>
                                  r.status?.toLowerCase() === "paid" &&
                                  r.paidAt !== "N/A"
                              )
                              .reduce((sum, r) => sum + r.amountPaid, 0)
                          )}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-6">
                        <p className="text-sm text-gray-600 mb-2">
                          Pending Payments
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {
                            repayments.filter(
                              (r) => r.status?.toLowerCase() === "pending"
                            ).length
                          }
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-6">
                        <p className="text-sm text-gray-600 mb-2">
                          Overdue Payments
                        </p>
                        <p className="text-2xl font-bold text-red-600">
                          {
                            repayments.filter(
                              (r) => r.status?.toLowerCase() === "overdue"
                            ).length
                          }
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Repayment Schedule */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Repayment Schedule
                      </h2>
                      <div className="flex gap-2">
                        {["all", "pending", "paid", "overdue"].map((status) => (
                          <button
                            key={status}
                            onClick={() => setPaymentFilter(status)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              paymentFilter === status
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      {loadingRepayments ? (
                        <div className="text-center py-8 text-gray-500">
                          Loading repayments...
                        </div>
                      ) : repayments.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          No repayments found.
                        </div>
                      ) : (
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                Borrower
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                Installment
                              </th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                                Amount Due
                              </th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                                Amount Paid
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                Due Date
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                Paid Date
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {repayments.map((repayment) => (
                              <tr
                                key={repayment.id}
                                className="border-b border-gray-100 hover:bg-gray-50"
                              >
                                <td className="py-3 px-4 text-sm text-gray-900">
                                  {repayment.borrowerName}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-600">
                                  #{repayment.installmentNumber}
                                </td>
                                <td className="py-3 px-4 text-sm text-right font-medium text-gray-900">
                                  Ksh {formatAmount(repayment.amountDue)}
                                </td>
                                <td className="py-3 px-4 text-sm text-right text-gray-700">
                                  {repayment.amountPaid > 0
                                    ? `Ksh ${formatAmount(
                                        repayment.amountPaid
                                      )}`
                                    : "-"}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-600">
                                  {repayment.dueDate}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-600">
                                  {repayment.paidAt}
                                </td>
                                <td className="py-3 px-4">
                                  {repayment.status?.toLowerCase() ===
                                  "paid" ? (
                                    <Badge className="bg-green-100 text-green-700">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Paid
                                    </Badge>
                                  ) : repayment.status?.toLowerCase() ===
                                    "overdue" ? (
                                    <Badge variant="destructive">
                                      <AlertCircle className="w-3 h-3 mr-1" />
                                      Overdue
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-yellow-100 text-yellow-700">
                                      <Clock className="w-3 h-3 mr-1" />
                                      Pending
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === "Analytics" && (
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12">
                <div className="space-y-6">
                  {/* Key Metrics */}
                  {analytics && (
                    <div className="grid grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="p-6">
                          <p className="text-sm text-gray-600 mb-2">
                            Total Lent
                          </p>
                          <p className="text-2xl font-bold text-gray-900">
                            Ksh{" "}
                            {formatAmount(analytics.summary?.totalLent || 0)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-6">
                          <p className="text-sm text-gray-600 mb-2">
                            Total Recovered
                          </p>
                          <p className="text-2xl font-bold text-green-600">
                            Ksh{" "}
                            {formatAmount(
                              analytics.summary?.totalRecovered || 0
                            )}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-6">
                          <p className="text-sm text-gray-600 mb-2">
                            Outstanding Portfolio
                          </p>
                          <p className="text-2xl font-bold text-blue-600">
                            Ksh{" "}
                            {formatAmount(
                              analytics.summary?.outstandingPortfolio || 0
                            )}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-6">
                          <p className="text-sm text-gray-600 mb-2">
                            Default Rate
                          </p>
                          <p className="text-2xl font-bold text-red-600">
                            {analytics.summary?.defaultRate?.toFixed(1) || 0}%
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Charts */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Loan Status Distribution */}
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          Loan Status Distribution
                        </h3>
                        {loadingAnalytics ? (
                          <div className="text-center py-8 text-gray-500">
                            Loading...
                          </div>
                        ) : analytics?.statusBreakdown ? (
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={analytics.statusBreakdown.map(
                                  (item: any) => ({
                                    name: item.status,
                                    value: item.count,
                                  })
                                )}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) =>
                                  `${name}: ${(percent * 100).toFixed(0)}%`
                                }
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {analytics.statusBreakdown.map(
                                  (item: any, index: number) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={
                                        item.status === "active"
                                          ? "#083232"
                                          : item.status === "overdue"
                                          ? "#f64d52"
                                          : item.status === "completed"
                                          ? "#10b981"
                                          : "#6b7280"
                                      }
                                    />
                                  )
                                )}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            No data available
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Monthly Interest Income */}
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          Monthly Interest Income (Last 12 Months)
                        </h3>
                        {loadingAnalytics ? (
                          <div className="text-center py-8 text-gray-500">
                            Loading...
                          </div>
                        ) : analytics?.monthlyInterest &&
                          analytics.monthlyInterest.length > 0 ? (
                          <ResponsiveContainer width="100%" height={300}>
                            <AreaChart
                              data={analytics.monthlyInterest.map(
                                (item: any) => ({
                                  month: new Date(
                                    item.month
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                  }),
                                  income: parseFloat(item.interest_income || 0),
                                })
                              )}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis />
                              <Tooltip
                                formatter={(value: any) =>
                                  `Ksh ${formatAmount(value)}`
                                }
                              />
                              <Area
                                type="monotone"
                                dataKey="income"
                                stroke="#083232"
                                fill="#083232"
                                fillOpacity={0.6}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            No data available
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Monthly Loan Disbursements */}
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          Monthly Loan Disbursements (Last 12 Months)
                        </h3>
                        {loadingAnalytics ? (
                          <div className="text-center py-8 text-gray-500">
                            Loading...
                          </div>
                        ) : analytics?.monthlyDisbursements &&
                          analytics.monthlyDisbursements.length > 0 ? (
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart
                              data={analytics.monthlyDisbursements.map(
                                (item: any) => ({
                                  month: new Date(
                                    item.month
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                  }),
                                  amount: parseFloat(item.total_disbursed || 0),
                                  count: item.loan_count || 0,
                                })
                              )}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis />
                              <Tooltip
                                formatter={(value: any) =>
                                  `Ksh ${formatAmount(value)}`
                                }
                              />
                              <Bar dataKey="amount" fill="#083232" />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            No data available
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Portfolio Value Over Time */}
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          Portfolio Performance
                        </h3>
                        {loadingAnalytics ? (
                          <div className="text-center py-8 text-gray-500">
                            Loading...
                          </div>
                        ) : analytics?.monthlyInterest &&
                          analytics.monthlyInterest.length > 0 ? (
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart
                              data={analytics.monthlyInterest.map(
                                (item: any) => ({
                                  month: new Date(
                                    item.month
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                  }),
                                  income: parseFloat(item.interest_income || 0),
                                })
                              )}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis />
                              <Tooltip
                                formatter={(value: any) =>
                                  `Ksh ${formatAmount(value)}`
                                }
                              />
                              <Line
                                type="monotone"
                                dataKey="income"
                                stroke="#083232"
                                strokeWidth={2}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            No data available
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Applications Tab */}
          {activeTab === "Applications" && chamaId && (
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12">
                <div className="space-y-6">
                  {/* Lending Type Tabs */}
                  <div className="flex gap-2 border-b border-gray-200">
                    <button
                      onClick={() => setApplicationsLendingType("internal")}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        applicationsLendingType === "internal"
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Internal
                    </button>
                    <button
                      onClick={() => setApplicationsLendingType("external")}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        applicationsLendingType === "external"
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      External
                    </button>
                    <button
                      onClick={() => setApplicationsLendingType("inter-chama")}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        applicationsLendingType === "inter-chama"
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Inter-Chama
                    </button>
                  </div>

                  {/* Applications Review Component */}
                  <LoanApplicationsReview
                    chamaId={chamaId}
                    lendingType={applicationsLendingType}
                    userRole={userRole || undefined}
                    onApplicationUpdated={() => {
                      // Refresh data when application is updated
                      fetchWalletData();
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Payment Dialog */}
      {selectedRepaymentLoanId && (
        <LoanRepaymentPayment
          loanId={selectedRepaymentLoanId}
          isOpen={showPaymentDialog}
          onClose={() => {
            setShowPaymentDialog(false);
            setSelectedRepaymentLoanId(null);
          }}
          onSuccess={() => {
            // Refresh repayments
            if (activeTab === "Payments") {
              const fetchRepayments = async () => {
                if (!chamaId) return;
                setLoadingRepayments(true);
                try {
                  const accessToken = localStorage.getItem("accessToken");
                  if (!accessToken) return;

                  const statusParam =
                    paymentFilter !== "all" ? `&status=${paymentFilter}` : "";
                  const response = await fetch(
                    apiUrl(`lending/chama/${chamaId}/repayments?limit=100${statusParam}`),
                    {
                      headers: { Authorization: `Bearer ${accessToken}` },
                    }
                  );

                  if (response.ok) {
                    const data = await response.json();
                    const repaymentsData = data.data || [];

                    const formatDate = (date: string | null) => {
                      if (!date) return "N/A";
                      return new Date(date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });
                    };

                    const transformed = repaymentsData.map((repayment: any) => {
                      const status = repayment.status || "pending";
                      return {
                        id: repayment.id,
                        loanId: repayment.loan_id_full || repayment.loan_id,
                        installmentNumber: repayment.installmentNumber || 0,
                        borrowerName: repayment.borrower_name || "Unknown",
                        amountDue: repayment.amountDue || 0,
                        amountPaid: repayment.amountPaid || 0,
                        dueDate: formatDate(repayment.dueDate),
                        paidAt: formatDate(repayment.paidAt),
                        status: status.charAt(0).toUpperCase() + status.slice(1),
                        paymentMethod: repayment.paymentMethod || "N/A",
                        repaymentData: repayment,
                      };
                    });

                    setRepayments(transformed);
                  }
                } catch (error) {
                  console.error("Failed to fetch repayments:", error);
                } finally {
                  setLoadingRepayments(false);
                }
              };
              fetchRepayments();
            }
          }}
          userRole={userRole || undefined}
        />
      )}
    </div>
  );
}
