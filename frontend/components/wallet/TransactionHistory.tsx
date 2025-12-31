import { Card } from "@/components/ui/card";
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
  created_at: string;
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
      return <ArrowRight className="w-5 h-5 text-gray-600" />;
    }
    const lowerType = type.toLowerCase();
    if (lowerType.includes("deposit")) {
      return <TrendingUp className="w-5 h-5 text-green-600" />;
    } else if (lowerType.includes("withdrawal")) {
      return <TrendingDown className="w-5 h-5 text-red-600" />;
    } else if (lowerType.includes("contribution")) {
      return <Coins className="w-5 h-5 text-blue-600" />;
    }
    return <ArrowRight className="w-5 h-5 text-gray-600" />;
  };

  const getStatusIcon = (status: string) => {
    if (status === "completed") {
      return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    } else if (status === "pending") {
      return <Clock className="w-5 h-5 text-yellow-600" />;
    } else if (status === "failed") {
      return <XCircle className="w-5 h-5 text-red-600" />;
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
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold">Transaction History</h3>
          {filteredTransactions.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
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
            className="cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="cursor-pointer">
            <Download className="w-4 h-4 mr-2" />
            Statement
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border rounded-lg px-4 py-2"
        >
          <option value="all">All Types</option>
          <option value="deposit">Deposits</option>
          <option value="withdrawal">Withdrawals</option>
          <option value="transfer">Transfers</option>
          <option value="contribution">Contributions</option>
        </select>
      </div>

      {/* Transaction List */}
      <div className="space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No transactions found
          </div>
        ) : (
          displayedTransactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-gray-100 rounded-full">
                  {getTransactionIcon(tx.transaction_type || tx.transactionType)}
                </div>
                <div>
                  <p className="font-medium">{tx.description || "Transaction"}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(tx.created_at).toLocaleString()}
                    {tx.reference && ` • ${tx.reference.slice(0, 8)}`}
                  </p>
                </div>
              </div>
              <div className="text-right flex items-center gap-3">
                {getStatusIcon(tx.status)}
                <p
                  className={`text-lg font-bold ${
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
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-[#083232] hover:text-[#2e856e] cursor-pointer"
          >
            {showAll
              ? "Show Less"
              : `View All ${filteredTransactions.length} Transactions`}
          </Button>
        </div>
      )}
    </Card>
  );
}
