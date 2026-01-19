"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/hooks/use-auth";
import { HomeNavbar } from "@/components/home/home-navbar";
import { ArrowUpRight, ArrowDownLeft, Plus, Users } from "lucide-react";

interface Transaction {
  id: string;
  transactionType: string;
  amount: number;
  description: string;
  status: string;
  createdAt: string;
  recipient_name?: string;
  sender_name?: string;
}

export default function TransactionsPage() {
  const router = useRouter();
  const isAuthenticated = useAuthGuard();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTransactionId, setExpandedTransactionId] = useState<
    string | null
  >(null);
  const [filterType, setFilterType] = useState<string>("all");
  const fetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !hasFetchedRef.current && !fetchingRef.current) {
      fetchTransactions();
    }
  }, [isAuthenticated]);

  const fetchTransactions = async () => {
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        router.push("/auth/login");
        return;
      }

      const response = await fetch(
        "http://localhost:3001/api/v1/wallet/transactions",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Transactions API response:", data);

        // Handle both array response and object with transactions property
        let transactionsArray: Transaction[] = [];
        if (Array.isArray(data)) {
          transactionsArray = data;
        } else if (data.transactions && Array.isArray(data.transactions)) {
          transactionsArray = data.transactions;
        } else if (data.data && Array.isArray(data.data)) {
          transactionsArray = data.data;
        }

        // Log transaction types for debugging
        console.log("First transaction full object:", transactionsArray[0]);
        transactionsArray.forEach((t) => {
          console.log(
            `Transaction: ${t.description}, Type: ${t.transactionType}, Amount: ${t.amount}`,
          );
        });

        setTransactions(transactionsArray);
        hasFetchedRef.current = true;
      } else {
        console.error(
          "API response not ok:",
          response.status,
          response.statusText,
        );
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case "DEPOSIT":
        return (
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <ArrowDownLeft className="w-5 h-5 text-green-600" />
          </div>
        );
      case "WITHDRAWAL":
        return (
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5 text-red-600" />
          </div>
        );
      case "TRANSFER":
        return (
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5 text-blue-600" />
          </div>
        );
      case "CONTRIBUTION":
        return (
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <Plus className="w-5 h-5 text-gray-600" />
          </div>
        );
    }
  };

  const getTransactionLabel = (transaction: Transaction) => {
    switch (transaction.transactionType?.toUpperCase()) {
      case "DEPOSIT":
        return "Top up";
      case "WITHDRAWAL":
        return "Withdrawal";
      case "TRANSFER":
        return "Transfer";
      case "CONTRIBUTION":
        return "Contribution";
      default:
        // Extract simple label from description for unknown types
        const desc = transaction.description || "Transaction";
        if (desc.toLowerCase().includes("transfer")) return "Transfer";
        if (desc.toLowerCase().includes("contribution")) return "Contribution";
        if (desc.toLowerCase().includes("deposit")) return "Top up";
        if (desc.toLowerCase().includes("withdrawal")) return "Withdrawal";
        if (desc.toLowerCase().includes("received")) return "Received";
        if (desc.toLowerCase().includes("payout")) return "Payout";
        return "Transaction";
    }
  };

  const getTransactionSubtext = (transaction: Transaction) => {
    const time = new Date(transaction.createdAt).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const date = new Date(transaction.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    if (transaction.transactionType?.toUpperCase() === "DEPOSIT") {
      return `${date} ${time}`;
    }
    if (
      transaction.transactionType?.toUpperCase() === "TRANSFER" &&
      transaction.recipient_name
    ) {
      return "Send";
    }

    // Filter out M-Pesa transaction codes (alphanumeric codes like TLTIC2E9EM)
    const status = transaction.status;
    // Check if status looks like an M-Pesa code (all caps, alphanumeric, 8-12 chars)
    if (/^[A-Z0-9]{8,12}$/.test(status)) {
      return `${date} ${time}`;
    }

    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatAmount = (amount: number, type: string, description?: string) => {
    // Check if transaction increases or decreases wallet balance
    // Deposits, received money, and payouts increase balance
    // Withdrawals, transfers/sends, and contributions decrease balance
    const descLower = (description || "").toLowerCase();
    const typeUpper = type?.toUpperCase() || "";
    const isDeposit =
      typeUpper === "DEPOSIT" ||
      descLower.includes("deposit") ||
      descLower.includes("from m-pesa");
    const isReceived =
      typeUpper === "RECEIVED" || descLower.includes("received");
    const isPayout = typeUpper === "PAYOUT" || descLower.includes("payout");

    const increasesBalance = isDeposit || isReceived || isPayout;
    const sign = increasesBalance ? "+" : "-";
    return `${sign}Ksh ${Math.abs(amount).toFixed(2)}`;
  };

  if (loading) {
    return (
      <>
        <HomeNavbar
          isAuthenticated={isAuthenticated}
          showSearchInNav={false}
          searchQuery=""
          onSearchChange={() => {}}
        />
        <div className="min-h-screen bg-white flex items-center justify-center pt-14 md:pt-16">
          <div className="text-gray-500">Loading transactions...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <HomeNavbar
        isAuthenticated={isAuthenticated}
        showSearchInNav={false}
        searchQuery=""
        onSearchChange={() => {}}
      />
      <div className="min-h-screen bg-white flex flex-col pt-14 md:pt-16 pb-20">
        <div className="max-w-4xl mx-auto w-full">
          {/* Header */}
          <div className="px-4 py-4">
            <h1 className="text-xl font-bold text-gray-900 mb-3">
              Transactions
            </h1>

            {/* Filter Buttons */}
            <div
              className="flex gap-2 overflow-x-auto scrollbar-hide"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  filterType === "all"
                    ? "bg-[#083232] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType("deposit")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  filterType === "deposit"
                    ? "bg-[#083232] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Top up
              </button>
              <button
                onClick={() => setFilterType("transfer")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  filterType === "transfer"
                    ? "bg-[#083232] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Transfers
              </button>
              <button
                onClick={() => setFilterType("contribution")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  filterType === "contribution"
                    ? "bg-[#083232] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Contributions
              </button>
              <button
                onClick={() => setFilterType("withdrawal")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  filterType === "withdrawal"
                    ? "bg-[#083232] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Withdrawals
              </button>
              <button
                onClick={() => setFilterType("payout")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  filterType === "payout"
                    ? "bg-[#083232] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Payouts
              </button>
            </div>
          </div>

          {/* Transactions List */}
          <div className="px-4">
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                No transactions yet
              </div>
            ) : transactions.filter((transaction) =>
                filterType === "all"
                  ? true
                  : transaction.transactionType?.toUpperCase() ===
                    filterType.toUpperCase(),
              ).length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                No{" "}
                {filterType === "deposit"
                  ? "deposits"
                  : filterType === "transfer"
                    ? "transfers"
                    : filterType === "contribution"
                      ? "contributions"
                      : filterType === "withdrawal"
                        ? "withdrawals"
                        : filterType === "payout"
                          ? "payouts"
                          : "transactions"}{" "}
                found
              </div>
            ) : (
              <div className="space-y-1">
                {transactions
                  .filter((transaction) => {
                    console.log(
                      "Filtering transaction:",
                      transaction.transactionType,
                      "filterType:",
                      filterType,
                      "match:",
                      filterType === "all" ||
                        transaction.transactionType?.toUpperCase() ===
                          filterType.toUpperCase(),
                    );
                    return filterType === "all"
                      ? true
                      : transaction.transactionType?.toUpperCase() ===
                          filterType.toUpperCase();
                  })
                  .map((transaction) => {
                    const isExpanded = expandedTransactionId === transaction.id;
                    return (
                      <div
                        key={transaction.id}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <div
                          onClick={() =>
                            setExpandedTransactionId(
                              isExpanded ? null : transaction.id,
                            )
                          }
                          className="py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="hidden md:block">
                                {getTransactionIcon(
                                  transaction.transactionType,
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900 text-base">
                                  {getTransactionLabel(transaction)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {getTransactionSubtext(transaction)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right ml-3">
                              <p
                                className={`font-bold text-sm ${
                                  formatAmount(
                                    transaction.amount,
                                    transaction.transactionType,
                                    transaction.description,
                                  ).startsWith("+")
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {formatAmount(
                                  transaction.amount,
                                  transaction.transactionType,
                                  transaction.description,
                                )}
                              </p>
                              <p className="text-xs text-gray-500 capitalize">
                                {getTransactionSubtext(transaction)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="px-4 pb-4 bg-gray-50 space-y-3">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">
                                Description
                              </p>
                              <p className="text-sm text-gray-900">
                                {transaction.description}
                              </p>
                            </div>

                            {transaction.recipient_name && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">
                                  Recipient
                                </p>
                                <p className="text-sm text-gray-900">
                                  {transaction.recipient_name}
                                </p>
                              </div>
                            )}

                            {transaction.sender_name && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">
                                  Sender
                                </p>
                                <p className="text-sm text-gray-900">
                                  {transaction.sender_name}
                                </p>
                              </div>
                            )}

                            <div>
                              <p className="text-xs text-gray-500 mb-1">
                                Status
                              </p>
                              <p className="text-sm text-gray-900 capitalize">
                                {transaction.status}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500 mb-1">
                                Date & Time
                              </p>
                              <p className="text-sm text-gray-900">
                                {new Date(transaction.createdAt).toLocaleString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  },
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500 mb-1">
                                Transaction ID
                              </p>
                              <p className="text-xs text-gray-600 font-mono break-all">
                                {transaction.id}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
