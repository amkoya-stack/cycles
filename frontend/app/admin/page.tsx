/* eslint-disable react/no-unescaped-entities */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Activity,
  Database,
  Search,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

interface SystemStats {
  totalUsers: number;
  totalTransactions: number;
  totalVolume: number;
  platformRevenue: number;
  activeWallets: number;
  failedToday: number;
  pendingCallbacks: number;
  transactionTypeBreakdown: Array<{
    transaction_type: string;
    count: string;
    volume: string;
  }>;
}

interface Transaction {
  id: string;
  external_reference: string;
  description: string;
  transaction_type: string;
  status: string;
  created_at: string;
  completed_at: string;
  user_email: string;
  user_phone: string;
  total_amount: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    loadDashboardData();
  }, [page, filterStatus, filterType]);

  const loadDashboardData = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        router.push("/auth/login");
        return;
      }

      // Fetch system stats
      const statsRes = await fetch("http://localhost:3001/api/admin/stats", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (statsRes.status === 401) {
        alert("Admin access required");
        router.push("/");
        return;
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Fetch transactions
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });

      if (filterStatus !== "all") params.append("status", filterStatus);
      if (filterType !== "all") params.append("type", filterType);

      const txRes = await fetch(
        `http://localhost:3001/api/admin/transactions?${params}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.transactions);
        setTotalPages(txData.pagination.totalPages);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading admin dashboard:", error);
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-KE");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#083232]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#083232]">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">System overview and management</p>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-[#083232] mt-1">
                    {stats.totalUsers.toLocaleString()}
                  </p>
                </div>
                <Users className="h-10 w-10 text-[#2e856e]" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Volume</p>
                  <p className="text-2xl font-bold text-[#083232] mt-1">
                    {formatCurrency(stats.totalVolume)}
                  </p>
                </div>
                <DollarSign className="h-10 w-10 text-[#2e856e]" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Platform Revenue</p>
                  <p className="text-2xl font-bold text-[#083232] mt-1">
                    {formatCurrency(stats.platformRevenue)}
                  </p>
                </div>
                <TrendingUp className="h-10 w-10 text-green-600" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Failed Today</p>
                  <p className="text-2xl font-bold text-[#f64d52] mt-1">
                    {stats.failedToday}
                  </p>
                </div>
                <AlertCircle className="h-10 w-10 text-[#f64d52]" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Wallets</p>
                  <p className="text-2xl font-bold text-[#083232] mt-1">
                    {stats.activeWallets.toLocaleString()}
                  </p>
                </div>
                <Activity className="h-10 w-10 text-[#2e856e]" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Transactions</p>
                  <p className="text-2xl font-bold text-[#083232] mt-1">
                    {stats.totalTransactions.toLocaleString()}
                  </p>
                </div>
                <Database className="h-10 w-10 text-[#2e856e]" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending Callbacks</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-1">
                    {stats.pendingCallbacks}
                  </p>
                </div>
                <Clock className="h-10 w-10 text-yellow-600" />
              </div>
            </Card>
          </div>
        )}

        {/* Transaction Breakdown */}
        {stats && stats.transactionTypeBreakdown.length > 0 && (
          <Card className="p-6 mb-8">
            <h2 className="text-xl font-bold text-[#083232] mb-4">
              Today's Transaction Breakdown
            </h2>
            <div className="space-y-3">
              {stats.transactionTypeBreakdown.map((type) => (
                <div
                  key={type.transaction_type}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-[#083232] capitalize">
                      {type.transaction_type}
                    </p>
                    <p className="text-sm text-gray-600">
                      {type.count} transactions
                    </p>
                  </div>
                  <p className="text-lg font-bold text-[#2e856e]">
                    {formatCurrency(parseFloat(type.volume))}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Transactions Table */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[#083232]">
              All Transactions
            </h2>
            <Button
              onClick={loadDashboardData}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="all">All Types</option>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="transfer">Transfer</option>
              <option value="contribution">Contribution</option>
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="pb-3 font-semibold text-sm text-gray-600">
                    Reference
                  </th>
                  <th className="pb-3 font-semibold text-sm text-gray-600">
                    User
                  </th>
                  <th className="pb-3 font-semibold text-sm text-gray-600">
                    Type
                  </th>
                  <th className="pb-3 font-semibold text-sm text-gray-600">
                    Amount
                  </th>
                  <th className="pb-3 font-semibold text-sm text-gray-600">
                    Status
                  </th>
                  <th className="pb-3 font-semibold text-sm text-gray-600">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="py-3">
                      <p className="text-sm font-mono text-gray-900">
                        {tx.external_reference?.substring(0, 8)}...
                      </p>
                    </td>
                    <td className="py-3">
                      <p className="text-sm text-gray-900">{tx.user_email}</p>
                      <p className="text-xs text-gray-500">{tx.user_phone}</p>
                    </td>
                    <td className="py-3">
                      <span className="text-sm capitalize text-gray-900">
                        {tx.transaction_type}
                      </span>
                    </td>
                    <td className="py-3">
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(tx.total_amount)}
                      </p>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(tx.status)}
                        <span className="text-sm capitalize">{tx.status}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <p className="text-sm text-gray-900">
                        {formatDate(tx.created_at)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                variant="outline"
              >
                Previous
              </Button>
              <Button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                variant="outline"
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
