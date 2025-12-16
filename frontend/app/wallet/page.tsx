/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Footer } from "@/components/footer";
import { HomeNavbar } from "@/components/home/home-navbar";
import { useAuth } from "@/hooks/use-auth";
import { useChamas } from "@/hooks/use-chamas";
import { io, Socket } from "socket.io-client";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { QuickSendSection } from "@/components/wallet/QuickSendSection";
import { TransactionHistory } from "@/components/wallet/TransactionHistory";
import { DepositModal } from "@/components/wallet/DepositModal";
import { WithdrawModal } from "@/components/wallet/WithdrawModal";
import { TransferModal } from "@/components/wallet/TransferModal";

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
  const { isAuthenticated, validateToken } = useAuth();
  const { chamas, fetchChamas } = useChamas();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userPhone, setUserPhone] = useState<string>("");
  const [coMembers, setCoMembers] = useState<any[]>([]);

  // Modals
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  // Form states
  const [depositPhone, setDepositPhone] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawPhone, setWithdrawPhone] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [transferPhone, setTransferPhone] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");

  // Polling state
  const [pollingCheckoutId, setPollingCheckoutId] = useState<string | null>(
    null
  );
  const [depositStatus, setDepositStatus] = useState<string>("");

  // WebSocket ref
  const socketRef = useRef<Socket | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    validateToken();
    fetchWalletData();
    fetchChamas();
    fetchCoMembers();
    setupWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [validateToken, fetchChamas]);

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
          `http://localhost:3001/api/wallet/deposit/status/${pollingCheckoutId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
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
              }`
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
      }
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
      }
    );

    socketRef.current.on(
      "transactionUpdate",
      (data: { transaction: any; timestamp: string }) => {
        console.log("Transaction update:", data);
        // Add new transaction to the list instead of refetching everything
        setTransactions((prev) => [data.transaction, ...prev]);
      }
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
        "http://localhost:3001/api/chama/co-members/all",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (response.ok) {
        const members = await response.json();
        setCoMembers(members);
      }
    } catch (error) {
      console.error("Failed to fetch co-members:", error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const txRes = await fetch(
        "http://localhost:3001/api/wallet/transactions?limit=50",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
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

      // Fetch user profile to get phone number
      const profileRes = await fetch("http://localhost:3001/api/auth/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData.phone) {
          setUserPhone(profileData.phone);
        }
      }

      // Fetch balance
      const balanceRes = await fetch(
        "http://localhost:3001/api/wallet/balance",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        setBalance(balanceData.balance);
      } else if (balanceRes.status === 401) {
        // Token expired or invalid
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        router.push("/auth/login");
        return;
      } else if (balanceRes.status === 404) {
        // Wallet not found - might need to be created
        console.error("Wallet not found for this user");
        alert("Your wallet hasn't been created yet. Please contact support.");
      }

      // Fetch transactions
      await fetchTransactions();
    } catch (error) {
      console.error("Failed to fetch wallet data:", error);
      alert(
        "Failed to connect to wallet service. Please make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!userPhone) {
      alert(
        "Please update your phone number in your profile settings before making a deposit."
      );
      setShowDeposit(false);
      return;
    }
    if (!depositAmount) return;

    setActionLoading(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch("http://localhost:3001/api/wallet/deposit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: userPhone,
          amount: parseFloat(depositAmount),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        alert(
          `STK Push sent! Check your phone (${userPhone}) to complete the transaction.\n${data.customerMessage}`
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
        "Please update your phone number in your profile settings before making a withdrawal."
      );
      setShowWithdraw(false);
      return;
    }
    if (!withdrawAmount) return;

    setActionLoading(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(
        "http://localhost:3001/api/wallet/withdraw",
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
        }
      );

      const data = await response.json();
      if (response.ok) {
        alert(
          `Withdrawal initiated! You will receive the money at ${userPhone} shortly.`
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

  const handleTransfer = async () => {
    if (!transferPhone || !transferAmount) return;

    setActionLoading(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(
        "http://localhost:3001/api/wallet/transfer",
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
        }
      );

      const data = await response.json();
      if (response.ok) {
        alert("Transfer successful!");
        setShowTransfer(false);
        setTransferPhone("");
        setTransferAmount("");
        setTransferDescription("");
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
      <div className="min-h-screen bg-gray-50 flex flex-col pt-16">
        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 py-8 flex-1">
          {/* Deposit Status Indicator */}
          {depositStatus && (
            <Card className="p-4 mb-4 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div>
                  <p className="font-medium text-blue-900">
                    Processing your deposit...
                  </p>
                  <p className="text-sm text-blue-700">
                    Waiting for M-Pesa confirmation. Please complete the payment
                    on your phone.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <BalanceCard
            balance={balance}
            onDeposit={() => setShowDeposit(true)}
            onWithdraw={() => setShowWithdraw(true)}
            onRequest={() => alert("Request money feature coming soon!")}
            onReceipts={() => alert("Receipts feature coming soon!")}
          />

          <QuickSendSection
            chamas={chamas}
            coMembers={coMembers}
            onChamaClick={(chama) => {
              setTransferPhone(chama.phone || "");
              setTransferDescription(`Transfer to ${chama.name}`);
              setShowTransfer(true);
            }}
            onMemberClick={(member) => {
              setTransferPhone(member.phone || "");
              setTransferDescription(
                `Transfer to ${member.full_name || member.name || "Member"}`
              );
              setShowTransfer(true);
            }}
            onAddRecipient={() => {
              setTransferPhone("");
              setTransferDescription("");
              setShowTransfer(true);
            }}
          />

          <TransactionHistory
            transactions={transactions}
            onRefresh={fetchWalletData}
          />
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
          amount={transferAmount}
          description={transferDescription}
          onPhoneChange={setTransferPhone}
          onAmountChange={setTransferAmount}
          onDescriptionChange={setTransferDescription}
          onClose={() => setShowTransfer(false)}
          onSubmit={handleTransfer}
          isLoading={actionLoading}
        />

        <Footer />
      </div>
    </>
  );
}
