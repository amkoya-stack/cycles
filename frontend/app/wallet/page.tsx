/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/footer";
import { HomeNavbar } from "@/components/home/home-navbar";
import { useChamas } from "@/hooks/use-chamas";
import { useAuth } from "@/hooks/use-auth";
import { apiUrl } from "@/lib/api-config";
import { io, Socket } from "socket.io-client";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { QuickSendSection } from "@/components/wallet/QuickSendSection";
import { TransactionHistory } from "@/components/wallet/TransactionHistory";
import { DepositModal } from "@/components/wallet/DepositModal";
import { WithdrawModal } from "@/components/wallet/WithdrawModal";
import { TransferModal } from "@/components/wallet/TransferModal";
import { RequestModal } from "@/components/wallet/RequestModal";
import { AutoDebitForm } from "@/components/chama/auto-debit-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  History,
  Calendar,
  Gift,
  Bell,
  TrendingUp,
  Circle,
  Database,
  CreditCard,
  Info,
  Plus,
  Sprout,
} from "lucide-react";

interface Transaction {
  id: string;
  reference: string;
  description: string;
  transaction_type: string;
  amount: number;
  direction: string;
  status: string;
  created_at: string;
}

export default function WalletPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const { chamas, fetchChamas } = useChamas();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userPhone, setUserPhone] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [userProfilePhoto, setUserProfilePhoto] = useState<string>("");
  const [coMembers, setCoMembers] = useState<any[]>([]);
  const [showBalance, setShowBalance] = useState(true);

  // Modals
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showRequest, setShowRequest] = useState(false);

  // Form states
  const [depositPhone, setDepositPhone] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawPhone, setWithdrawPhone] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [transferPhone, setTransferPhone] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");
  const [selectedRecipientName, setSelectedRecipientName] = useState("");
  const [selectedChamaId, setSelectedChamaId] = useState<string | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  // Polling state
  const [pollingCheckoutId, setPollingCheckoutId] = useState<string | null>(
    null,
  );
  const [depositStatus, setDepositStatus] = useState<string>("");

  // WebSocket ref
  const socketRef = useRef<Socket | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    fetchWalletData();
    fetchChamas();
    fetchCoMembers();
    setupWebSocket();

    // Auto-refresh balance every 10 seconds
    const balancePolling = setInterval(() => {
      fetchBalance();
    }, 10000);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      clearInterval(balancePolling);
    };
  }, [fetchChamas]);

  // Auto-hide balance after 5 seconds
  useEffect(() => {
    if (showBalance) {
      const timer = setTimeout(() => {
        setShowBalance(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [showBalance]);

  // Pre-populate phone fields when modals open
  useEffect(() => {
    if (userPhone) {
      if (showDeposit && !depositPhone) {
        setDepositPhone(userPhone);
      }
      if (showWithdraw && !withdrawPhone) {
        setWithdrawPhone(userPhone);
      }
    }
  }, [showDeposit, showWithdraw, userPhone]);

  // Poll for deposit status
  useEffect(() => {
    if (!pollingCheckoutId) return;

    const pollInterval = setInterval(async () => {
      try {
        const accessToken = localStorage.getItem("accessToken");
        const response = await fetch(
          `http://localhost:3001/api/v1/wallet/deposit/status/${pollingCheckoutId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );

        if (response.ok) {
          const data = await response.json();
          setDepositStatus(data.status);

          if (data.status === "completed") {
            setPollingCheckoutId(null);
            setDepositStatus("");
            alert("Deposit successful! Your balance has been updated.");
            // Don't fetch - WebSocket will update balance and transactions
          } else if (data.status === "failed" || data.status === "cancelled") {
            setPollingCheckoutId(null);
            setDepositStatus("");
            alert(
              `Deposit ${data.status}: ${
                data.result_desc || "Please try again"
              }`,
            );
          }
        }
      } catch (error) {
        console.error("Error polling deposit status:", error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [pollingCheckoutId]);

  const setupWebSocket = () => {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    socketRef.current = io("http://localhost:3001/wallet", {
      query: { userId },
      transports: ["websocket", "polling"],
    });

    socketRef.current.on("connect", () => {
      console.log("WebSocket connected");
    });

    socketRef.current.on(
      "balanceUpdated",
      (data: { balance: string; timestamp: string }) => {
        console.log("Balance updated via WebSocket:", data);
        setBalance(parseFloat(data.balance));
        // Fetch only transactions to update the list without refetching balance
        fetchTransactions();
      },
    );

    socketRef.current.on(
      "depositStatusUpdate",
      (data: {
        checkoutRequestId: string;
        status: string;
        timestamp: string;
      }) => {
        console.log("Deposit status update:", data);
        if (
          data.checkoutRequestId === pollingCheckoutId &&
          data.status === "completed"
        ) {
          setPollingCheckoutId(null);
          setDepositStatus("");
          alert("Deposit successful! Your balance has been updated.");
          // Don't fetch wallet data - WebSocket already updated balance
        }
      },
    );

    socketRef.current.on(
      "transactionUpdate",
      (data: { transaction: any; timestamp: string }) => {
        console.log("Transaction update:", data);
        // Add new transaction to the list instead of refetching everything
        setTransactions((prev) => [data.transaction, ...prev]);
      },
    );

    socketRef.current.on("disconnect", () => {
      console.log("WebSocket disconnected");
    });
  };

  const fetchCoMembers = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        "http://localhost:3001/api/v1/chama/co-members/all",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (response.ok) {
        const members = await response.json();
        setCoMembers(members);
      }
    } catch (error) {
      console.error("Failed to fetch co-members:", error);
    }
  };

  const fetchBalance = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const balanceRes = await fetch(
        "http://localhost:3001/api/v1/wallet/balance",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        setBalance(balanceData.balance);
      } else if (balanceRes.status === 401) {
        // Token expired - redirect to login
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        router.push("/auth/login");
      } else if (balanceRes.status === 404) {
        console.error("Wallet not found for this user");
      }
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const txRes = await fetch(
        "http://localhost:3001/api/v1/wallet/transactions?limit=50",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.transactions || []);
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    }
  };

  const fetchWalletData = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        router.push("/auth/login");
        return;
      }

      // Fetch user profile to get phone number and name
      const profileRes = await fetch("http://localhost:3001/api/v1/auth/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData.phone) {
          setUserPhone(profileData.phone);
        }
        if (profileData.full_name) {
          setUserName(profileData.full_name);
        } else if (profileData.first_name || profileData.last_name) {
          setUserName(
            `${profileData.first_name || ""} ${profileData.last_name || ""}`.trim(),
          );
        }
        if (profileData.profile_photo_url) {
          setUserProfilePhoto(profileData.profile_photo_url);
        }
      }

      // Fetch balance
      await fetchBalance();

      // Fetch transactions
      await fetchTransactions();
    } catch (error) {
      console.error("Failed to fetch wallet data:", error);
      alert(
        "Failed to connect to wallet service. Please make sure the backend is running.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!userPhone) {
      alert(
        "Please update your phone number in your profile settings before making a deposit.",
      );
      setShowDeposit(false);
      return;
    }
    if (!depositAmount) return;

    setActionLoading(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(
        "http://localhost:3001/api/v1/wallet/deposit",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phoneNumber: userPhone,
            amount: parseFloat(depositAmount),
          }),
        },
      );

      const data = await response.json();
      if (response.ok) {
        alert(
          `STK Push sent! Check your phone (${userPhone}) to complete the transaction.\n${data.customerMessage}`,
        );
        setShowDeposit(false);
        setDepositAmount("");
      } else {
        alert(`Deposit failed: ${data.message || "Unknown error"}`);
      }
    } catch (error) {
      alert("Deposit request failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!userPhone) {
      alert(
        "Please update your phone number in your profile settings before making a withdrawal.",
      );
      setShowWithdraw(false);
      return;
    }
    if (!withdrawAmount) return;

    // For withdrawals from personal wallet (not chama wallet), require governance approval
    const shouldRequireApproval = parseFloat(withdrawAmount) > 5000; // Require approval for withdrawals > 5000 KES

    if (!shouldRequireApproval) {
      // Process small withdrawals directly
      await processDirectWithdrawal();
    } else {
      // Create governance proposal for larger withdrawals
      await createWithdrawalProposal();
    }
  };

  const processDirectWithdrawal = async () => {
    setActionLoading(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(
        "http://localhost:3001/api/v1/wallet/withdraw",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phoneNumber: userPhone,
            amount: parseFloat(withdrawAmount),
          }),
        },
      );

      const data = await response.json();
      if (response.ok) {
        alert(
          `Withdrawal initiated! You will receive the money at ${userPhone} shortly.`,
        );
        setShowWithdraw(false);
        setWithdrawAmount("");
        fetchWalletData();
      } else {
        alert(`Withdrawal failed: ${data.message || "Unknown error"}`);
      }
    } catch (error) {
      alert("Withdrawal request failed");
    } finally {
      setActionLoading(false);
    }
  };

  const createWithdrawalProposal = async () => {
    setActionLoading(true);
    try {
      const accessToken = localStorage.getItem("accessToken");

      // Get user's primary chama (or let them select one)
      if (!chamas || chamas.length === 0) {
        alert(
          "You must be a member of a chama to request withdrawal approval. Join a chama first or contact support.",
        );
        setShowWithdraw(false);
        return;
      }

      // Use first chama for now - in production, let user select which chama to request approval from
      const chamaId = chamas[0].id;

      const response = await fetch(apiUrl("governance/proposals"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chamaId,
          title: `Withdrawal Request: KES ${withdrawAmount}`,
          description: `Member requesting withdrawal of KES ${withdrawAmount} to M-Pesa ${userPhone}. This withdrawal requires majority approval from chama members.`,
          votingType: "simple_majority",
          deadline: new Date(
            Date.now() + 3 * 24 * 60 * 60 * 1000,
          ).toISOString(), // 3 days
          metadata: {
            isWithdrawal: true,
            amount: parseFloat(withdrawAmount),
            phoneNumber: userPhone,
          },
        }),
      });

      const data = await response.json();
      if (response.ok) {
        alert(
          `Withdrawal proposal created successfully!\n\nYour chama members will vote on your withdrawal request. You'll be notified once it's approved.\n\nProposal ID: ${data.id}`,
        );
        setShowWithdraw(false);
        setWithdrawAmount("");
      } else {
        alert(
          `Failed to create withdrawal proposal: ${
            data.message || "Unknown error"
          }`,
        );
      }
    } catch (error) {
      console.error("Withdrawal proposal error:", error);
      alert("Failed to create withdrawal proposal");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferAmount) return;

    // For chama contributions, we need chamaId
    if (selectedChamaId && !transferPhone) {
      await handleChamaContribution();
      return;
    }

    // For regular transfers, we need recipient phone
    if (!transferPhone) return;

    setActionLoading(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(
        "http://localhost:3001/api/v1/wallet/transfer",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipientPhone: transferPhone,
            amount: parseFloat(transferAmount),
            description: transferDescription,
          }),
        },
      );

      const data = await response.json();
      if (response.ok) {
        alert("Transfer successful!");
        setShowTransfer(false);
        setTransferPhone("");
        setTransferAmount("");
        setTransferDescription("");
        setSelectedRecipientName("");
        setSelectedChamaId(null);
        setSelectedCycleId(null);
        fetchWalletData();
      } else {
        alert(`Transfer failed: ${data.message || "Unknown error"}`);
      }
    } catch (error) {
      alert("Transfer request failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleChamaContribution = async () => {
    if (!selectedChamaId || !selectedCycleId || !transferAmount) return;

    setActionLoading(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(
        `http://localhost:3001/api/v1/chama/${selectedChamaId}/cycles/${selectedCycleId}/contribute`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: parseFloat(transferAmount),
            paymentMethod: "wallet",
            notes: transferDescription,
          }),
        },
      );

      const data = await response.json();
      if (response.ok) {
        alert("Contribution successful!");
        setShowTransfer(false);
        setTransferPhone("");
        setTransferAmount("");
        setTransferDescription("");
        setSelectedRecipientName("");
        setSelectedChamaId(null);
        setSelectedCycleId(null);
        fetchWalletData();
      } else {
        alert(`Contribution failed: ${data.message || "Unknown error"}`);
      }
    } catch (error) {
      alert("Contribution request failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#083232]"></div>
      </div>
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
      <div className="min-h-screen bg-white flex flex-col pt-14 md:pt-16 pb-14">
        {/* Main Content */}
        <div className="max-w-4xl mx-auto md:px-4 flex-1 w-full">
          {/* Main Balance Card */}
          <div className="bg-[#083232] p-6 py-12">
            <div className="flex items-start justify-between">
              <div className="text-white text-3xl md:text-5xl font-bold">
                {showBalance
                  ? `Ksh ${balance.toLocaleString("en-KE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : "Ksh ••••••"}
              </div>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                {showBalance ? (
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons - Plain buttons outside balance card */}
          <div className="bg-gray-50 px-0 py-6 mb-6 md:px-6">
            <div className="grid grid-cols-4 gap-0 md:gap-3">
              <button
                onClick={() => setShowDeposit(true)}
                className="flex flex-col items-center gap-2 cursor-pointer"
              >
                <Plus className="w-6 h-6 text-gray-700" />
                <span className="text-xs text-gray-700 font-medium">
                  Add money
                </span>
              </button>
              <button
                onClick={() => setShowWithdraw(true)}
                className="flex flex-col items-center gap-2 cursor-pointer"
              >
                <TrendingUp className="w-6 h-6 text-gray-700" />
                <span className="text-xs text-gray-700 font-medium">
                  Withdraw
                </span>
              </button>
              <button
                onClick={() => setShowRequest(true)}
                className="flex flex-col items-center gap-2 cursor-pointer"
              >
                <svg
                  className="w-6 h-6 text-gray-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                <span className="text-xs text-gray-700 font-medium">
                  Request
                </span>
              </button>
              <button
                onClick={() => router.push("/transactions")}
                className="flex flex-col items-center gap-2 cursor-pointer"
              >
                <svg
                  className="w-6 h-6 text-gray-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <span className="text-xs text-gray-700 font-medium">
                  Transactions
                </span>
              </button>
            </div>
          </div>

          {/* Quick Send Section */}
          <div className="px-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Quick send
            </h3>
            <div className="flex items-start gap-4 overflow-x-auto pb-2">
              <button
                onClick={() => setShowTransfer(true)}
                className="flex-shrink-0 flex flex-col items-center gap-2 group"
              >
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                  <Plus className="w-6 h-6 text-gray-700" />
                </div>
                <span className="text-xs text-gray-700 font-medium">Add</span>
              </button>

              {coMembers.slice(0, 6).map((member: any) => {
                const displayName =
                  member.full_name ||
                  `${member.first_name || ""} ${member.last_name || ""}`.trim();
                const firstName =
                  member.full_name?.split(" ")[0] ||
                  member.first_name ||
                  displayName;

                return (
                  <button
                    key={member.id}
                    onClick={() => {
                      setTransferPhone(member.phone || "");
                      setSelectedRecipientName(displayName);
                      setShowTransfer(true);
                    }}
                    className="flex-shrink-0 flex flex-col items-center gap-2 group"
                  >
                    <div className="w-14 h-14 rounded-full bg-[#083232] overflow-hidden group-hover:opacity-90 transition-opacity">
                      {member.profile_photo_url ? (
                        <img
                          src={member.profile_photo_url}
                          alt={displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-semibold text-lg">
                          {firstName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-700 font-medium max-w-[56px] truncate">
                      {firstName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Cards Grid */}
          <div className="px-4 md:px-0">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="md:bg-white md:rounded-2xl p-4 md:shadow-sm md:border">
                <div className="flex items-center gap-3 mb-2">
                  <Circle className="w-5 h-5 text-[#083232]" />
                  <span className="text-gray-600 text-xs md:text-sm">
                    Pockets
                  </span>
                </div>
                <div className="text-gray-900 text-base md:text-xl font-bold">
                  Ksh{" "}
                  {balance.toLocaleString("en-KE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>

              <div className="md:bg-white md:rounded-2xl p-4 md:shadow-sm md:border">
                <div className="flex items-center gap-3 mb-2">
                  <Sprout className="w-5 h-5 text-[#083232]" />
                  <span className="text-gray-600 text-xs md:text-sm">
                    Investment
                  </span>
                </div>
                <div className="text-gray-900 text-base md:text-xl font-bold">
                  Ksh 0.00
                </div>
              </div>

              <div className="md:bg-white md:rounded-2xl p-4 md:shadow-sm md:border">
                <div className="flex items-center gap-3 mb-2">
                  <Database className="w-5 h-5 text-[#083232]" />
                  <span className="text-gray-600 text-xs md:text-sm">
                    Loans
                  </span>
                </div>
                <div className="text-gray-900 text-base md:text-xl font-bold">
                  Ksh 0.00
                </div>
              </div>

              <div className="md:bg-white md:rounded-2xl p-4 md:shadow-sm md:border">
                <div className="flex items-center gap-3 mb-2">
                  <CreditCard className="w-5 h-5 text-[#083232]" />
                  <span className="text-gray-600 text-xs md:text-sm">
                    Cycles
                  </span>
                </div>
                <div className="text-gray-900 text-base md:text-xl font-bold">
                  Ksh 0.00
                </div>
              </div>
            </div>

            {/* Deposit Status Indicator */}
            {depositStatus && (
              <div className="p-3 sm:p-4 mb-3 sm:mb-4 bg-blue-50 border-blue-200 sm:rounded-lg sm:shadow-md sm:border">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-blue-600 flex-shrink-0"></div>
                  <div>
                    <p className="font-medium text-blue-900 text-xs sm:text-sm">
                      Processing your deposit...
                    </p>
                    <p className="text-[10px] sm:text-xs text-blue-700">
                      Waiting for M-Pesa confirmation. Please complete the
                      payment on your phone.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DepositModal
          isOpen={showDeposit}
          userPhone={userPhone}
          amount={depositAmount}
          onAmountChange={setDepositAmount}
          onClose={() => setShowDeposit(false)}
          onSubmit={handleDeposit}
          isLoading={actionLoading}
        />

        <WithdrawModal
          isOpen={showWithdraw}
          userPhone={userPhone}
          amount={withdrawAmount}
          onAmountChange={setWithdrawAmount}
          onClose={() => setShowWithdraw(false)}
          onSubmit={handleWithdraw}
          isLoading={actionLoading}
        />

        <TransferModal
          isOpen={showTransfer}
          recipientPhone={transferPhone}
          recipientName={selectedRecipientName}
          amount={transferAmount}
          description={transferDescription}
          chamaId={selectedChamaId}
          onPhoneChange={setTransferPhone}
          onAmountChange={setTransferAmount}
          onDescriptionChange={setTransferDescription}
          onClose={() => {
            setShowTransfer(false);
            setSelectedRecipientName("");
            setSelectedChamaId(null);
            setSelectedCycleId(null);
          }}
          onSubmit={handleTransfer}
          isLoading={actionLoading}
        />

        <RequestModal
          isOpen={showRequest}
          onClose={() => setShowRequest(false)}
          coMembers={coMembers}
          onRequestSent={() => {
            // Optionally refresh notifications or show success
            console.log("Request sent successfully");
          }}
        />

        <Footer />
      </div>
    </>
  );
}
