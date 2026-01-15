import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  RefreshCw,
  Download,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Coins,
} from "lucide-react";
import { useState } from "react";

interface Transaction {
  id: string;
  description?: string;
  amount: number;
  transaction_type?: string; // snake_case (old API)
  transactionType?: string; // camelCase (new mapper)
  reference?: string;
  direction: string;
  status: string;
  created_at?: string; // snake_case
  createdAt?: string; // camelCase
}

interface TransactionHistoryProps {
  transactions: Transaction[];
  onRefresh: () => void;
}

export function TransactionHistory({
  transactions,
  onRefresh,
}: TransactionHistoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showAll, setShowAll] = useState(false);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(amount);
  };

  const getTransactionIcon = (type: string | null | undefined) => {
    if (!type) {
      return <ArrowRight className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-gray-600" />;
    }
    const lowerType = type.toLowerCase();
    if (lowerType.includes("deposit")) {
      return <TrendingUp className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-green-600" />;
    } else if (lowerType.includes("withdrawal")) {
      return <TrendingDown className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-red-600" />;
    } else if (lowerType.includes("contribution")) {
      return <Coins className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-blue-600" />;
    }
    return <ArrowRight className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-gray-600" />;
  };

  const getStatusIcon = (status: string) => {
    if (status === "completed") {
      return <CheckCircle2 className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-green-600" />;
    } else if (status === "pending") {
      return <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-yellow-600" />;
    } else if (status === "failed") {
      return <XCircle className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-red-600" />;
    }
    return null;
  };

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      (tx.description?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (tx.reference?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    // Handle both snake_case (from old API) and camelCase (from new mapper)
    const txType = (tx.transaction_type || tx.transactionType || "").toLowerCase();
    const matchesType =
      filterType === "all" || txType === filterType;
    return matchesSearch && matchesType;
  });

  // Show only 5 transactions unless "View All" is clicked
  const displayedTransactions = showAll
    ? filteredTransactions
    : filteredTransactions.slice(0, 5);

  return (
    <div className="pt-3 pr-3 pb-3 pl-0 sm:p-4 md:p-6 sm:bg-white sm:rounded-lg sm:shadow-md sm:border">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-4 sm:mb-6">
        <div>
          <h3 className="text-lg sm:text-xl font-bold">Transaction History</h3>
          {filteredTransactions.length > 0 && (
            <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
              {showAll
                ? `Showing all ${filteredTransactions.length} transactions`
                : `Showing ${Math.min(5, filteredTransactions.length)} of ${
                    filteredTransactions.length
                  }`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="cursor-pointer h-8 sm:h-9"
          >
            <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
          <Button variant="outline" size="sm" className="cursor-pointer h-8 sm:h-9 text-xs sm:text-sm">
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
            <span className="hidden sm:inline">Statement</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
          <Input
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 sm:pl-10 h-9 sm:h-10 text-sm"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border rounded-lg px-3 sm:px-4 py-2 h-9 sm:h-10 text-sm"
        >
          <option value="all">All Types</option>
          <option value="deposit">Deposits</option>
          <option value="withdrawal">Withdrawals</option>
          <option value="transfer">Transfers</option>
          <option value="contribution">Contributions</option>
        </select>
      </div>

      {/* Transaction List */}
      <div className="space-y-2 sm:space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-8 sm:py-12 text-gray-500 text-sm sm:text-base">
            No transactions found
          </div>
        ) : (
          displayedTransactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center p-1.5 sm:p-4 sm:border sm:rounded-lg hover:bg-gray-50 gap-2 sm:justify-between"
            >
              <div className="flex items-center gap-1 sm:gap-3 md:gap-4 min-w-0 flex-1">
                <div className="p-0.5 sm:p-2 bg-gray-100 rounded-full flex-shrink-0">
                  {getTransactionIcon(tx.transaction_type || tx.transactionType)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[10px] sm:text-sm truncate">{tx.description || "Transaction"}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                    {(() => {
                      const dateValue = tx.created_at || tx.createdAt;
                      if (!dateValue) return "Date not available";
                      
                      // Handle if it's already a Date object (shouldn't happen after JSON, but just in case)
                      if (dateValue instanceof Date) {
                        return dateValue.toLocaleString();
                      }
                      
                      // Try parsing as string
                      const date = new Date(dateValue);
                      if (isNaN(date.getTime())) {
                        console.warn("Invalid date value:", dateValue);
                        return "Date not available";
                      }
                      return date.toLocaleString();
                    })()}
                    {tx.reference && 
                      !(tx.transaction_type || tx.transactionType || "").toLowerCase().includes("deposit") &&
                      !(tx.description || "").toLowerCase().includes("m-pesa") &&
                      !(tx.description || "").toLowerCase().includes("mpesa") &&
                      // Hide M-Pesa reference codes (typically 10-12 alphanumeric characters like TLTIC2E9EM)
                      !/^[A-Z0-9]{10,12}$/i.test(tx.reference) &&
                      ` • ${tx.reference.slice(0, 8)}`}
                  </p>
                </div>
              </div>
              <div className="text-right flex items-center gap-0.5 sm:gap-3 flex-shrink-0">
                {getStatusIcon(tx.status)}
                <p
                  className={`text-[10px] sm:text-base font-bold whitespace-nowrap ${
                    tx.direction === "credit"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {tx.direction === "credit" ? "+" : "-"}
                  {formatAmount(Math.abs(tx.amount))}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* View All / Show Less Button */}
      {filteredTransactions.length > 5 && (
        <div className="mt-3 sm:mt-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-[#083232] hover:text-[#2e856e] cursor-pointer text-xs sm:text-sm"
          >
            {showAll
              ? "Show Less"
              : `View All ${filteredTransactions.length} Transactions`}
          </Button>
        </div>
      )}
    </div>
  );
}
