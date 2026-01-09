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
  ChevronDown,
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
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);

  // Payments tab state
  const [repayments, setRepayments] = useState<any[]>([]);
  const [loadingRepayments, setLoadingRepayments] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [selectedRepaymentLoanId, setSelectedRepaymentLoanId] = useState<string | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  // Analytics tab state
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  
  // Mock data for all tabs (for testing UI)
  const mockOverviewData = {
    totalCash: 2500000,
    contributions: 1800000,
    interestIncome: 450000,
    activeLoans: 12,
    overdueLoans: 3,
    loansList: [
      {
        id: "L12345",
        fullId: "abc123-def456-ghi789",
        status: "Active",
        borrower: "James Mutiso",
        amount: 50000,
        total: 50000,
        remaining: 17500,
        progress: 65,
        monthlyPayment: 12500,
        nextPayment: "Jan 15",
        interestRate: 12,
      },
      {
        id: "L67890",
        fullId: "xyz789-abc123-def456",
        status: "Overdue",
        borrower: "Mary Wanjiku",
        amount: 75000,
        total: 75000,
        remaining: 45000,
        progress: 40,
        monthlyPayment: 15000,
        nextPayment: "Jan 5",
        interestRate: 15,
      },
      {
        id: "L11111",
        fullId: "aaa111-bbb222-ccc333",
        status: "Active",
        borrower: "John Kamau",
        amount: 30000,
        total: 30000,
        remaining: 6000,
        progress: 80,
        monthlyPayment: 7500,
        nextPayment: "Jan 20",
        interestRate: 10,
      },
    ],
    activities: [
      {
        id: "1",
        type: "disbursement",
        title: "Loan disbursed to James Mutiso",
        amount: "Ksh 50,000",
        time: "2 days ago",
        bg: "bg-blue-50",
        icon: DollarSign,
        iconColor: "text-blue-600",
      },
      {
        id: "2",
        type: "payment",
        title: "Payment received from Mary Wanjiku",
        amount: "Ksh 15,000",
        time: "3 days ago",
        bg: "bg-green-50",
        icon: CheckCircle,
        iconColor: "text-green-600",
      },
      {
        id: "3",
        type: "application",
        title: "New loan application approved",
        amount: "Ksh 30,000",
        time: "4 days ago",
        bg: "bg-purple-50",
        icon: TrendingUp,
        iconColor: "text-purple-600",
      },
    ],
  };

  const mockLoansData = [
    {
      id: "L12345",
      fullId: "abc123-def456-ghi789",
      status: "active",
      borrower: "James Mutiso",
      amount: 50000,
      totalAmount: 50000,
      totalPaid: 32500,
      progress: 65,
      monthlyPayment: 12500,
      nextPayment: "2025-01-15",
      interestRate: 12,
      repaymentPeriodMonths: 4,
    },
    {
      id: "L67890",
      fullId: "xyz789-abc123-def456",
      status: "overdue",
      borrower: "Mary Wanjiku",
      amount: 75000,
      totalAmount: 75000,
      totalPaid: 30000,
      progress: 40,
      monthlyPayment: 15000,
      nextPayment: "2025-01-05",
      interestRate: 15,
      repaymentPeriodMonths: 5,
    },
    {
      id: "L11111",
      fullId: "aaa111-bbb222-ccc333",
      status: "active",
      borrower: "John Kamau",
      amount: 30000,
      totalAmount: 30000,
      totalPaid: 24000,
      progress: 80,
      monthlyPayment: 7500,
      nextPayment: "2025-01-20",
      interestRate: 10,
      repaymentPeriodMonths: 4,
    },
    {
      id: "L22222",
      fullId: "ddd444-eee555-fff666",
      status: "completed",
      borrower: "Sarah Njeri",
      amount: 40000,
      totalAmount: 40000,
      totalPaid: 40000,
      progress: 100,
      monthlyPayment: 10000,
      nextPayment: null,
      interestRate: 12,
      repaymentPeriodMonths: 4,
    },
    {
      id: "L33333",
      fullId: "ggg777-hhh888-iii999",
      status: "active",
      borrower: "Peter Ochieng",
      amount: 60000,
      totalAmount: 60000,
      totalPaid: 18000,
      progress: 30,
      monthlyPayment: 15000,
      nextPayment: "2025-01-25",
      interestRate: 14,
      repaymentPeriodMonths: 4,
    },
  ];

  const mockRepaymentsData = [
    {
      id: "r1",
      loan_id: "L12345",
      loan_id_full: "abc123-def456-ghi789",
      installmentNumber: 3,
      borrower_name: "James Mutiso",
      amountDue: 12500,
      amountPaid: 12500,
      dueDate: "2025-01-15",
      paidAt: "2025-01-14",
      status: "paid",
      paymentMethod: "M-Pesa",
    },
    {
      id: "r2",
      loan_id: "L67890",
      loan_id_full: "xyz789-abc123-def456",
      installmentNumber: 2,
      borrower_name: "Mary Wanjiku",
      amountDue: 15000,
      amountPaid: 0,
      dueDate: "2025-01-05",
      paidAt: null,
      status: "overdue",
      paymentMethod: null,
    },
    {
      id: "r3",
      loan_id: "L11111",
      loan_id_full: "aaa111-bbb222-ccc333",
      installmentNumber: 4,
      borrower_name: "John Kamau",
      amountDue: 7500,
      amountPaid: 7500,
      dueDate: "2025-01-20",
      paidAt: "2025-01-19",
      status: "paid",
      paymentMethod: "Bank Transfer",
    },
    {
      id: "r4",
      loan_id: "L33333",
      loan_id_full: "ggg777-hhh888-iii999",
      installmentNumber: 2,
      borrower_name: "Peter Ochieng",
      amountDue: 15000,
      amountPaid: 0,
      dueDate: "2025-01-25",
      paidAt: null,
      status: "pending",
      paymentMethod: null,
    },
  ];

  const mockAnalytics = {
    summary: {
      totalLent: 2500000,
      totalRecovered: 1800000,
      outstandingPortfolio: 700000,
      defaultRate: 5.2,
    },
    statusBreakdown: [
      { status: "active", count: 12 },
      { status: "overdue", count: 3 },
      { status: "completed", count: 25 },
      { status: "pending", count: 2 },
    ],
    monthlyInterest: [
      { month: "2024-07-01", interest_income: 45000 },
      { month: "2024-08-01", interest_income: 52000 },
      { month: "2024-09-01", interest_income: 48000 },
      { month: "2024-10-01", interest_income: 55000 },
      { month: "2024-11-01", interest_income: 60000 },
      { month: "2024-12-01", interest_income: 58000 },
      { month: "2025-01-01", interest_income: 62000 },
      { month: "2025-02-01", interest_income: 65000 },
      { month: "2025-03-01", interest_income: 68000 },
      { month: "2025-04-01", interest_income: 70000 },
      { month: "2025-05-01", interest_income: 72000 },
      { month: "2025-06-01", interest_income: 75000 },
    ],
    monthlyDisbursements: [
      { month: "2024-07-01", total_disbursed: 200000, loan_count: 3 },
      { month: "2024-08-01", total_disbursed: 250000, loan_count: 4 },
      { month: "2024-09-01", total_disbursed: 180000, loan_count: 2 },
      { month: "2024-10-01", total_disbursed: 300000, loan_count: 5 },
      { month: "2024-11-01", total_disbursed: 220000, loan_count: 3 },
      { month: "2024-12-01", total_disbursed: 280000, loan_count: 4 },
      { month: "2025-01-01", total_disbursed: 320000, loan_count: 5 },
      { month: "2025-02-01", total_disbursed: 350000, loan_count: 6 },
      { month: "2025-03-01", total_disbursed: 400000, loan_count: 7 },
      { month: "2025-04-01", total_disbursed: 380000, loan_count: 6 },
      { month: "2025-05-01", total_disbursed: 420000, loan_count: 7 },
      { month: "2025-06-01", total_disbursed: 450000, loan_count: 8 },
    ],
  };

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

  // Compact format for mobile (uses K for thousands)
  const formatCompactAmount = (amount: number) => {
    if (amount >= 1000000) {
      const millions = amount / 1000000;
      return millions % 1 === 0 
        ? `${millions.toFixed(0)}M` 
        : `${millions.toFixed(1)}M`;
    } else if (amount >= 1000) {
      const thousands = amount / 1000;
      return thousands % 1 === 0 
        ? `${thousands.toFixed(0)}k` 
        : `${thousands.toFixed(1)}k`;
    }
    return amount.toString();
  };

  // Format for chart data (in thousands, no K suffix)
  const formatChartValue = (amount: number) => {
    const thousands = amount / 1000;
    return thousands % 1 === 0 
      ? thousands.toFixed(0) 
      : thousands.toFixed(1);
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
      // Use mock data for UI preview (comment out to use real API)
      setLoansList(mockOverviewData.loansList);
      setLoadingLoans(false);
      return;

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

            // Format short date (for Next EMI) - matches Loans > All format
            const formatShortDate = (date: string | null) => {
              if (!date) return "N/A";
              return new Date(date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
            };

            // Format loan ID - use a shorter, cleaner format
            const formatLoanIdShort = (loanId: string) => {
              if (!loanId) return "N/A";
              // If it's a UUID or long ID, use last 6 characters with L prefix
              if (loanId.length > 8) {
                return `L${loanId.slice(-6).toUpperCase()}`;
              }
              return loanId.toUpperCase();
            };

            return {
              id: formatLoanIdShort(loan.id), // Short ID for display
              fullId: loan.id,
              status: loan.status === "active" ? "Active" : "Overdue",
              borrower: loan.full_name || loan.borrower_name || loan.name || "N/A",
              progress: Math.min(progress, 100),
              remaining: loan.outstandingBalance || 0,
              total: loan.totalAmount || 0,
              interestRate: `${loan.interestRate || 0}%`,
              monthlyPayment: monthlyPayment,
              nextPayment: formatShortDate(loan.firstPaymentDate), // Use short format like Loans > All
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
      // Use mock data for UI preview (comment out to use real API)
      setActivities(mockOverviewData.activities);
      setLoadingActivities(false);
      return;

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
      if (activeTab !== "Loans") {
        return;
      }

      setLoadingAllLoans(true);
      
      // Use mock data for UI preview (comment out to use real API)
      const transformedMockLoans = mockLoansData.map((loan: any) => {
        const progress = loan.totalAmount > 0
          ? Math.round((loan.totalPaid / loan.totalAmount) * 100)
          : 0;
        
        const formatShortDate = (date: string | null) => {
          if (!date) return "N/A";
          return new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
        };

        const formatStatus = (status: string) => {
          if (!status) return "Unknown";
          return status.charAt(0).toUpperCase() + status.slice(1);
        };

        return {
          id: loan.id,
          fullId: loan.fullId,
          status: formatStatus(loan.status),
          borrower: loan.borrower,
          progress: Math.min(progress, 100),
          remaining: loan.totalAmount - loan.totalPaid,
          total: loan.totalAmount,
          principal: loan.amount,
          interestRate: `${loan.interestRate}%`,
          monthlyPayment: loan.monthlyPayment,
          nextPayment: formatShortDate(loan.nextPayment),
          disbursedAt: "Dec 15, 2024",
          maturityDate: "Apr 15, 2025",
          loanData: loan,
        };
      });

      // Filter by status
      let filtered = transformedMockLoans;
      if (loanFilter !== "all") {
        filtered = transformedMockLoans.filter((loan: any) => 
          loan.status.toLowerCase() === loanFilter.toLowerCase()
        );
      }

      // Filter by search term
      if (loanSearch) {
        filtered = filtered.filter((loan: any) =>
          loan.borrower.toLowerCase().includes(loanSearch.toLowerCase()) ||
          loan.id.toLowerCase().includes(loanSearch.toLowerCase())
        );
      }

      setAllLoans(filtered);
      setLoadingAllLoans(false);
      return;

      try {
        if (!chamaId) {
          setLoadingAllLoans(false);
          return;
        }

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

            const formatShortDate = (date: string | null) => {
              if (!date) return "N/A";
              return new Date(date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
            };

            // Format status - remove underscores and capitalize properly
            const formatStatus = (status: string) => {
              if (!status) return "Unknown";
              return status
                .split("_")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(" ");
            };

            // Format loan ID - use a shorter, cleaner format
            const formatLoanId = (loanId: string) => {
              if (!loanId) return "N/A";
              // If it's a UUID or long ID, use last 6 characters, otherwise use as is
              if (loanId.length > 8) {
                return `L${loanId.slice(-6).toUpperCase()}`;
              }
              return loanId.toUpperCase();
            };

            return {
              id: formatLoanId(loan.id),
              fullId: loan.id,
              status: formatStatus(loan.status),
              borrower: loan.full_name || loan.borrower_name || loan.name || "N/A",
              borrowerEmail: loan.email || "",
              progress: Math.min(progress, 100),
              remaining: loan.outstandingBalance || 0,
              total: loan.totalAmount || 0,
              principal: loan.principalAmount || 0,
              interestRate: `${loan.interestRate || 0}%`,
              monthlyPayment: monthlyPayment,
              nextPayment: formatShortDate(loan.firstPaymentDate),
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
      if (activeTab !== "Payments") {
        return;
      }

      setLoadingRepayments(true);
      
      // Use mock data for UI preview (comment out to use real API)
      const transformed = mockRepaymentsData.map((repayment: any) => {
        const formatDate = (date: string | null) => {
          if (!date) return "N/A";
          return new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        };

        const status = repayment.status || "pending";
        const statusCapitalized = status.charAt(0).toUpperCase() + status.slice(1);

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

      // Filter by status
      let filtered = transformed;
      if (paymentFilter !== "all") {
        filtered = transformed.filter((r: any) => 
          r.status.toLowerCase() === paymentFilter.toLowerCase()
        );
      }

      setRepayments(filtered);
      setLoadingRepayments(false);
      return;

      try {
        if (!chamaId) {
          setLoadingRepayments(false);
          return;
        }

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
      if (activeTab !== "Analytics") {
        return;
      }

      setLoadingAnalytics(true);
      
      // Use mock data for UI preview (comment out to use real API)
      // Uncomment the following line to always use mock data:
      setAnalytics(mockAnalytics);
      setLoadingAnalytics(false);
      return;

      try {
        if (!chamaId) {
          // Use mock data if no chamaId (for testing UI)
          setAnalytics(mockAnalytics);
          setLoadingAnalytics(false);
          return;
        }

        const accessToken = localStorage.getItem("accessToken");
        if (!accessToken) {
          setAnalytics(mockAnalytics);
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
        } else {
          // Use mock data if API fails (for testing UI)
          console.log("Using mock analytics data for UI preview");
          setAnalytics(mockAnalytics);
        }
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
        // Use mock data on error (for testing UI)
        console.log("Using mock analytics data for UI preview");
        setAnalytics(mockAnalytics);
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
      <div className="p-0 md:p-6 w-full" style={{ maxWidth: "100%" }}>
        {/* Fixed Header Cards - Independent of Tab Content */}
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-gray-200">
          {/* Total Cash, Contributions, and Interest - All in Same Green Background */}
          <div className="bg-[#083232] px-4 py-4 border-b border-gray-200">
            <div className="flex items-center justify-center gap-1.5 mb-3">
              <Wallet className="w-4 h-4 text-white" />
              <span className="text-sm font-semibold text-white">
                Total Cash
              </span>
            </div>
            <p className="text-xl font-bold text-white mb-3 text-center">
              {loading ? (
                <span className="text-base">Loading...</span>
              ) : (
                `Ksh ${formatAmount(totalCash)}`
              )}
            </p>
            {/* Contributions and Interest - Side by side within green background */}
            <div className="flex pt-3 border-t border-white/20">
              {/* Contributions - 50% width */}
              <div className="flex-1 pr-4 border-r border-white/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-white/90" />
                  <span className="text-[10px] text-white/80">Contributions</span>
                </div>
                <p className="text-sm font-semibold text-white">
                  {loading ? (
                    <span className="text-xs text-white/60">...</span>
                  ) : (
                    `Ksh ${formatAmount(contributions)}`
                  )}
                </p>
              </div>
              {/* Interest - 50% width */}
              <div className="flex-1 pl-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Percent className="w-3.5 h-3.5 text-white/90" />
                  <span className="text-[10px] text-white/80">Interest</span>
                </div>
                <p className="text-sm font-semibold text-white">
                  {loading ? (
                    <span className="text-xs text-white/60">...</span>
                  ) : (
                    `Ksh ${formatAmount(interestIncome)}`
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex mb-6 gap-4" style={{ isolation: "isolate" }}>
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
        {/* Mobile Navigation */}
        <div className="md:hidden bg-white border-b border-gray-200 sticky top-14 z-10">
          <div className="flex overflow-x-auto scrollbar-hide px-4">
            {["Overview", "Loans", "Payments", "Analytics", "Applications"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-xs font-medium px-3 py-3 whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab
                    ? "text-[#083232] border-[#083232]"
                    : "text-gray-600 border-transparent"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center justify-between mb-6">
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
            <>
              {/* Mobile View */}
              <div className="md:hidden space-y-0 pb-20">
                {/* Active & Overdue Loans List */}
                <div className="bg-white border-b border-gray-200">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <h2 className="text-base font-semibold text-gray-900">
                      Active & Overdue Loans
                    </h2>
                  </div>
                  <div className="space-y-0">
                    {loadingLoans ? (
                      <div className="text-center py-12 px-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#083232] border-t-transparent mx-auto mb-2"></div>
                        <p className="text-sm text-gray-500">Loading loans...</p>
                      </div>
                    ) : loansList.length === 0 ? (
                      <div className="text-center py-12 px-4">
                        <DollarSign className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">No active or overdue loans</p>
                      </div>
                    ) : (
                      loansList.map((loan) => (
                        <div
                          key={loan.id}
                          className={`border-l-4 border-b border-gray-200 ${
                            loan.status === "Active"
                              ? "border-l-green-500 bg-green-50/30"
                              : "border-l-red-500 bg-red-50/30"
                          }`}
                        >
                          <div className="px-4 py-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-gray-900">
                                {loan.id}
                              </span>
                              <Badge
                                className={`text-xs ${
                                  loan.status === "Active"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {loan.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <Users className="w-3.5 h-3.5 text-gray-500" />
                              <span className="text-sm text-gray-700">{loan.borrower}</span>
                            </div>
                            <div className="mb-2">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-gray-600">Progress</span>
                                <span className="font-medium text-gray-900">
                                  {loan.progress}% paid
                                </span>
                              </div>
                              <Progress value={loan.progress} className="h-1" />
                            </div>
                            <div className="flex items-center justify-between text-xs mb-3">
                              <span className="text-gray-600">
                                Remaining: <span className="font-semibold text-gray-900">Ksh {formatAmount(loan.remaining)}</span>
                              </span>
                              <span className="text-gray-600">
                                Total: <span className="font-semibold text-gray-900">Ksh {formatAmount(loan.total)}</span>
                              </span>
                            </div>
                            
                            {/* Financial Details - Three Columns */}
                            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-200">
                              <div className="flex items-start gap-1.5">
                                <Percent className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-[10px] text-gray-600">Interest</p>
                                  <p className="text-xs font-medium text-gray-900">
                                    {loan.interestRate || "N/A"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-start gap-1.5">
                                <DollarSign className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-[10px] text-gray-600">EMI Amount</p>
                                  <p className="text-xs font-medium text-gray-900">
                                    Ksh {formatAmount(loan.monthlyPayment || 0)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-start gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-[10px] text-gray-600">Next EMI</p>
                                  <p className="text-xs font-medium text-gray-900">
                                    {loan.nextPayment || "N/A"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop View */}
              <div className="hidden md:block">
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
                                    <Percent className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-gray-600">
                                        Interest
                            </p>
                            <p className="text-sm font-medium text-gray-900">
                                        {loan.interestRate || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                                    <DollarSign className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-gray-600">
                                        EMI Amount
                            </p>
                            <p className="text-sm font-medium text-gray-900">
                                        Ksh {formatAmount(loan.monthlyPayment || 0)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                                    <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-gray-600">
                                        Next EMI
                            </p>
                            <p className="text-sm font-medium text-gray-900">
                                        {loan.nextPayment || "N/A"}
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
                </div>
              </div>
            </>
          )}

          {/* Loans Tab */}
          {activeTab === "Loans" && (
            <>
              {/* Mobile View */}
              <div className="md:hidden pb-10">
                {/* Sticky Header with Quick Stats */}
                <div className="sticky top-14 z-10 bg-white border-b border-gray-200">
                  {/* Total Loans - Prominent Display */}
                  <div className="px-4 pt-4 pb-3 bg-white border-b border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-gray-700" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Total Loans</span>
                      </div>
                      <span className="text-2xl font-bold text-[#083232]">
                        {allLoans.length}
                      </span>
                    </div>
                  </div>
                  
                  {/* Active, Overdue, Completed Stats - Card Style */}
                  <div className="px-4 py-3 bg-white grid grid-cols-3 gap-3">
                    {/* Active Loans */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <p className="text-[10px] font-medium text-green-700 mb-0.5">Active</p>
                      <p className="text-base font-bold text-green-600">
                        {allLoans.filter((l) => l.status === "Active").length}
                      </p>
                      </div>
                    
                    {/* Overdue Loans */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      </div>
                      <p className="text-[10px] font-medium text-red-700 mb-0.5">Overdue</p>
                      <p className="text-base font-bold text-red-600">
                        {allLoans.filter((l) => l.status === "Overdue").length}
                      </p>
                    </div>
                    
                    {/* Completed Loans */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <CheckCircle className="w-4 h-4 text-gray-600" />
                      </div>
                      <p className="text-[10px] font-medium text-gray-700 mb-0.5">Completed</p>
                      <p className="text-base font-bold text-gray-600">
                        {allLoans.filter((l) => l.status === "Completed").length}
                                </p>
                      </div>
                    </div>
                  </div>

                {/* Search and Filter */}
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search loans..."
                      value={loanSearch}
                      onChange={(e) => setLoanSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#083232]"
                    />
                        </div>
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    {["all", "active", "overdue", "completed", "defaulted"].map((status) => (
                      <button
                        key={status}
                        onClick={() => setLoanFilter(status)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                          loanFilter === status
                            ? "bg-[#083232] text-white"
                            : "bg-white text-gray-700 border border-gray-300"
                        }`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
              </div>

                {/* Loans List - Card Layout */}
                <div className="py-4 space-y-0">
                  {loadingAllLoans ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#083232] border-t-transparent mx-auto mb-2"></div>
                      <p className="text-sm text-gray-500">Loading loans...</p>
                    </div>
                  ) : allLoans.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <DollarSign className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">No loans found</p>
                    </div>
                  ) : (
                    allLoans.map((loan) => {
                      const getStatusColor = (status: string) => {
                        switch (status) {
                          case "Active":
                            return "border-l-blue-500";
                          case "Overdue":
                            return "border-l-red-500";
                          case "Completed":
                            return "border-l-gray-400";
                          default:
                            return "border-l-gray-300";
                        }
                      };

                      const getStatusBadgeColor = (status: string) => {
                        switch (status) {
                          case "Active":
                            return "bg-green-100 text-green-700";
                          case "Overdue":
                            return "bg-red-100 text-red-700";
                          case "Completed":
                            return "bg-gray-100 text-gray-700";
                          default:
                            return "bg-gray-100 text-gray-700";
                        }
                      };

                      return (
                        <div
                          key={loan.fullId}
                          className={`bg-white border-l-4 ${getStatusColor(
                            loan.status
                          )} border-b border-gray-200 p-4`}
                        >
                          {/* Header with Loan ID, Status, and Menu */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-base font-semibold text-gray-900">
                                {loan.id}
                              </span>
                              <Badge className={`text-xs ${getStatusBadgeColor(loan.status)}`}>
                                {loan.status}
                              </Badge>
                            </div>
                            <button className="p-1 hover:bg-gray-100 rounded-full">
                              <MoreHorizontal className="w-5 h-5 text-gray-400" />
              </button>
            </div>

                          {/* Borrower */}
                          <div className="flex items-center gap-2 mb-3 text-gray-600">
                            <Users className="w-4 h-4" />
                            <span className="text-sm">{loan.borrower}</span>
          </div>

                          {/* Loan Progress */}
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span className="text-gray-600">Loan Progress</span>
                              <span className="font-medium text-gray-900">
                                {loan.progress}% paid
                              </span>
        </div>
                            <Progress value={loan.progress} className="h-2" />
                          </div>

                          {/* Remaining and Total */}
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

                          {/* Financial Details - Three Columns */}
                          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-200">
                            <div className="flex items-start gap-2">
                              <Percent className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs text-gray-600">Interest</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {loan.interestRate}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <DollarSign className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs text-gray-600">EMI Amount</p>
                                <p className="text-sm font-medium text-gray-900">
                                  Ksh {formatAmount(loan.monthlyPayment)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs text-gray-600">Next EMI</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {loan.nextPayment || "N/A"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Desktop View */}
              <div className="hidden md:block">
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
              </div>
            </>
          )}

          {/* Payments Tab */}
          {activeTab === "Payments" && (
            <>
              {/* Mobile View */}
              <div className="md:hidden pb-10">
                {/* Payment Statistics - Mobile */}
                <div className="bg-white border-b border-gray-200">
                  {/* Total Collected - Prominent */}
                  <div className="px-4 pt-4 pb-3 bg-white border-b border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-gray-700" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Total Collected</span>
                      </div>
                      <span className="text-xl font-bold text-[#083232]">
                        Ksh {formatAmount(
                          repayments
                            .filter(
                              (r) =>
                                r.status?.toLowerCase() === "paid" &&
                                r.paidAt !== "N/A"
                            )
                            .reduce((sum, r) => sum + r.amountPaid, 0)
                        )}
                      </span>
                    </div>
                  </div>
                  
                  {/* Pending and Overdue Stats */}
                  <div className="px-4 py-3 bg-white grid grid-cols-2 gap-3">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                      <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Clock className="w-4 h-4 text-yellow-600" />
                      </div>
                      <p className="text-[10px] font-medium text-yellow-700 mb-0.5">Pending</p>
                      <p className="text-base font-bold text-yellow-600">
                        {repayments.filter((r) => r.status?.toLowerCase() === "pending").length}
                      </p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      </div>
                      <p className="text-[10px] font-medium text-red-700 mb-0.5">Overdue</p>
                      <p className="text-base font-bold text-red-600">
                        {repayments.filter((r) => r.status?.toLowerCase() === "overdue").length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                  <div className="flex gap-4 overflow-x-auto scrollbar-hide">
                    {["all", "pending", "paid", "overdue"].map((status) => (
                      <button
                        key={status}
                        onClick={() => setPaymentFilter(status)}
                        className={`text-xs whitespace-nowrap ${
                          paymentFilter === status
                            ? "text-[#083232] font-semibold"
                            : "text-gray-600"
                        }`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Repayment List - Mobile */}
                <div>
                  {loadingRepayments ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#083232] border-t-transparent mx-auto mb-2"></div>
                      <p className="text-sm text-gray-500">Loading repayments...</p>
                    </div>
                  ) : repayments.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <DollarSign className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">No repayments found</p>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {repayments.map((repayment) => {
                        const getStatusColor = (status: string) => {
                          switch (status?.toLowerCase()) {
                            case "paid":
                              return "border-l-green-500";
                            case "overdue":
                              return "border-l-red-500";
                            case "pending":
                              return "border-l-yellow-500";
                            default:
                              return "border-l-gray-300";
                          }
                        };

                        return (
                          <div
                            key={repayment.id}
                            className={`bg-white border-l-4 ${getStatusColor(
                              repayment.status
                            )} border-b border-gray-200 px-4 py-4`}
                          >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-semibold text-gray-900">
                                    {repayment.borrowerName}
                                  </span>
                                  <Badge
                                    className={`text-xs ${
                                      repayment.status?.toLowerCase() === "paid"
                                        ? "bg-green-100 text-green-700"
                                        : repayment.status?.toLowerCase() === "overdue"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-yellow-100 text-yellow-700"
                                    }`}
                                  >
                                    {repayment.status?.charAt(0).toUpperCase() + repayment.status?.slice(1) || "Pending"}
                                  </Badge>
                                </div>
                                <p className="text-xs text-gray-500">
                                  Installment #{repayment.installmentNumber}
                                </p>
                              </div>
                            </div>

                            {/* Amount Details */}
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Amount Due</p>
                                <p className="text-sm font-semibold text-gray-900">
                                  Ksh {formatAmount(repayment.amountDue)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Amount Paid</p>
                                <p className="text-sm font-semibold text-gray-900">
                                  {repayment.amountPaid > 0
                                    ? `Ksh ${formatAmount(repayment.amountPaid)}`
                                    : "-"}
                                </p>
                              </div>
                            </div>

                            {/* Date Details */}
                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Due Date</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {repayment.dueDate}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Paid Date</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {repayment.paidAt !== "N/A" ? repayment.paidAt : "-"}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Desktop View */}
              <div className="hidden md:block">
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
                      <div className="flex gap-4">
                        {["all", "pending", "paid", "overdue"].map((status) => (
                          <button
                            key={status}
                            onClick={() => setPaymentFilter(status)}
                            className={`text-sm ${
                              paymentFilter === status
                                ? "text-[#083232] font-semibold"
                                : "text-gray-600"
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
            </div>
            </>
          )}

          {/* Analytics Tab */}
          {activeTab === "Analytics" && (
            <>
              {/* Mobile View */}
              <div className="md:hidden pb-10">
                {/* Key Metrics - Mobile */}
                {analytics && (
                  <div className="bg-white border-b border-gray-200">
                    {/* Total Lent - Prominent */}
                    <div className="px-4 pt-4 pb-3 border-b border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                            <DollarSign className="w-4 h-4 text-gray-700" />
                          </div>
                          <span className="text-sm font-medium text-gray-700">Total Lent</span>
                        </div>
                        <span className="text-xl font-bold text-[#083232]">
                          Ksh {formatCompactAmount((analytics || mockAnalytics).summary?.totalLent || 0)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Other Metrics - Grid */}
                    <div className="px-4 py-3 grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                        </div>
                        <p className="text-[10px] text-gray-500 mb-0.5">Recovered</p>
                        <p className="text-sm font-semibold text-green-600">
                          Ksh {formatCompactAmount((analytics || mockAnalytics).summary?.totalRecovered || 0)}
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <p className="text-[10px] text-gray-500 mb-0.5">Outstanding</p>
                        <p className="text-sm font-semibold text-blue-600">
                          Ksh {formatCompactAmount((analytics || mockAnalytics).summary?.outstandingPortfolio || 0)}
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="w-7 h-7 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                        </div>
                        <p className="text-[10px] text-gray-500 mb-0.5">Default Rate</p>
                        <p className="text-sm font-semibold text-red-600">
                          {(analytics || mockAnalytics).summary?.defaultRate?.toFixed(1) || 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Charts - Mobile - Simplified Design */}
                <div className="space-y-4">
                  {/* Loan Status - Card with Progress Bars */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      Loan Status Distribution
                    </h3>
                    {loadingAnalytics ? (
                      <div className="text-center text-gray-500 py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#083232] border-t-transparent mx-auto mb-1"></div>
                        <p className="text-xs">Loading...</p>
                      </div>
                    ) : (analytics || mockAnalytics)?.statusBreakdown ? (
                      <div className="space-y-3">
                        {(analytics || mockAnalytics).statusBreakdown.map((item: any, index: number) => {
                          const total = (analytics || mockAnalytics).statusBreakdown.reduce((sum: number, i: any) => sum + i.count, 0);
                          const percentage = total > 0 ? (item.count / total) * 100 : 0;
                          const color = item.status === "active"
                            ? "#083232"
                            : item.status === "overdue"
                            ? "#f64d52"
                            : item.status === "completed"
                            ? "#10b981"
                            : "#6b7280";
                          
                          return (
                            <div key={index} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                                  <span className="text-xs font-medium text-gray-700 capitalize">
                                    {item.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-gray-900">{item.count}</span>
                                  <span className="text-xs text-gray-500">({percentage.toFixed(0)}%)</span>
                                </div>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2">
                                <div
                                  className="h-2 rounded-full transition-all"
                                  style={{ width: `${percentage}%`, backgroundColor: color }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 text-xs py-8">
                        No data
                      </div>
                    )}
                  </div>

                  {/* Monthly Interest Income - Simplified Chart */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      Monthly Interest Income
                    </h3>
                    {loadingAnalytics ? (
                      <div className="text-center text-gray-500 py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#083232] border-t-transparent mx-auto mb-1"></div>
                        <p className="text-xs">Loading...</p>
                      </div>
                    ) : (analytics || mockAnalytics)?.monthlyInterest && (analytics || mockAnalytics).monthlyInterest.length > 0 ? (
                      <div className="space-y-2">
                        {(analytics || mockAnalytics).monthlyInterest.slice(-6).map((item: any, index: number) => {
                          const maxIncome = Math.max(...(analytics || mockAnalytics).monthlyInterest.map((i: any) => parseFloat(i.interest_income || 0)));
                          const currentIncome = parseFloat(item.interest_income || 0);
                          const percentage = maxIncome > 0 ? (currentIncome / maxIncome) * 100 : 0;
                          const month = new Date(item.month).toLocaleDateString("en-US", { month: "short" });
                          
                          return (
                            <div key={index} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-700">{month}</span>
                                <span className="text-xs font-semibold text-gray-900">
                                  Ksh {formatCompactAmount(currentIncome)}
                                </span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2.5">
                                <div
                                  className="h-2.5 rounded-full bg-[#083232] transition-all"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 text-xs py-8">
                        No data
                      </div>
                    )}
                  </div>

                  {/* Monthly Disbursements - Simplified Chart */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      Monthly Disbursements
                    </h3>
                    {loadingAnalytics ? (
                      <div className="text-center text-gray-500 py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#083232] border-t-transparent mx-auto mb-1"></div>
                        <p className="text-xs">Loading...</p>
                      </div>
                    ) : (analytics || mockAnalytics)?.monthlyDisbursements && (analytics || mockAnalytics).monthlyDisbursements.length > 0 ? (
                      <div className="space-y-2">
                        {(analytics || mockAnalytics).monthlyDisbursements.slice(-6).map((item: any, index: number) => {
                          const maxAmount = Math.max(...(analytics || mockAnalytics).monthlyDisbursements.map((i: any) => parseFloat(i.total_disbursed || 0)));
                          const currentAmount = parseFloat(item.total_disbursed || 0);
                          const percentage = maxAmount > 0 ? (currentAmount / maxAmount) * 100 : 0;
                          const month = new Date(item.month).toLocaleDateString("en-US", { month: "short" });
                          
                          return (
                            <div key={index} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-700">{month}</span>
                                  <span className="text-xs text-gray-500">({item.loan_count || 0} loans)</span>
                                </div>
                                <span className="text-xs font-semibold text-gray-900">
                                  Ksh {formatCompactAmount(currentAmount)}
                                </span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2.5">
                                <div
                                  className="h-2.5 rounded-full bg-[#083232] transition-all"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 text-xs py-8">
                        No data
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop View */}
              <div className="hidden md:block">
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
                        ) : (analytics || mockAnalytics)?.statusBreakdown &&
                          (analytics || mockAnalytics).statusBreakdown.length > 0 ? (
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={(analytics || mockAnalytics).statusBreakdown.map(
                                  (item: any) => ({
                                    name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
                                    value: item.count,
                                  })
                                )}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, value }) => `${name}: ${value}`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {(analytics || mockAnalytics).statusBreakdown.map(
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
                              <Legend verticalAlign="bottom" height={36} />
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
              </div>
            </>
          )}

          {/* Applications Tab */}
          {activeTab === "Applications" && chamaId && (
            <>
              {/* Mobile View */}
              <div className="md:hidden pb-10">
                {/* Lending Type Tabs - Mobile */}
                <div className="bg-white border-b border-gray-200 sticky top-14 z-10">
                  <div className="flex overflow-x-auto scrollbar-hide px-4">
                    <button
                      onClick={() => setApplicationsLendingType("internal")}
                      className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                        applicationsLendingType === "internal"
                          ? "border-[#083232] text-[#083232]"
                          : "border-transparent text-gray-600"
                      }`}
                    >
                      Internal
                    </button>
                    <button
                      onClick={() => setApplicationsLendingType("external")}
                      className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                        applicationsLendingType === "external"
                          ? "border-[#083232] text-[#083232]"
                          : "border-transparent text-gray-600"
                      }`}
                    >
                      External
                    </button>
                    <button
                      onClick={() => setApplicationsLendingType("inter-chama")}
                      className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                        applicationsLendingType === "inter-chama"
                          ? "border-[#083232] text-[#083232]"
                          : "border-transparent text-gray-600"
                      }`}
                    >
                      Inter-Chama
                    </button>
                  </div>
                </div>

                {/* Applications Review Component - Mobile */}
                <div>
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

              {/* Desktop View */}
              <div className="hidden md:block">
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
              </div>
            </>
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
