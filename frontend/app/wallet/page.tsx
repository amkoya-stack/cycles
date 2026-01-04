/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
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
import { History, Calendar, PieChart } from "lucide-react";
import { InvestmentPortfolio } from "@/components/investment/investment-portfolio";

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
  const [coMembers, setCoMembers] = useState<any[]>([]);

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
    null
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
        "http://localhost:3001/api/v1/chama/co-members/all",
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

  const fetchBalance = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const balanceRes = await fetch(
        "http://localhost:3001/api/v1/wallet/balance",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
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
      const profileRes = await fetch("http://localhost:3001/api/v1/auth/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData.phone) {
          setUserPhone(profileData.phone);
        }
      }

      // Fetch balance
      await fetchBalance();

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
      const response = await fetch("http://localhost:3001/api/v1/wallet/deposit", {
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

  const createWithdrawalProposal = async () => {
    setActionLoading(true);
    try {
      const accessToken = localStorage.getItem("accessToken");

      // Get user's primary chama (or let them select one)
      if (!chamas || chamas.length === 0) {
        alert(
          "You must be a member of a chama to request withdrawal approval. Join a chama first or contact support."
        );
        setShowWithdraw(false);
        return;
      }

      // Use first chama for now - in production, let user select which chama to request approval from
      const chamaId = chamas[0].id;

      const response = await fetch(
        apiUrl("governance/proposals"),
        {
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
              Date.now() + 3 * 24 * 60 * 60 * 1000
            ).toISOString(), // 3 days
            metadata: {
              isWithdrawal: true,
              amount: parseFloat(withdrawAmount),
              phoneNumber: userPhone,
            },
          }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        alert(
          `Withdrawal proposal created successfully!\n\nYour chama members will vote on your withdrawal request. You'll be notified once it's approved.\n\nProposal ID: ${data.id}`
        );
        setShowWithdraw(false);
        setWithdrawAmount("");
      } else {
        alert(
          `Failed to create withdrawal proposal: ${
            data.message || "Unknown error"
          }`
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
        }
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
        }
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
            onRequest={() => setShowRequest(true)}
            onReceipts={() => alert("Receipts feature coming soon!")}
            onBalanceUpdate={fetchBalance}
          />

          <QuickSendSection
            chamas={chamas}
            coMembers={coMembers}
            onChamaClick={async (chama) => {
              // Fetch active cycle for this chama
              try {
                const accessToken = localStorage.getItem("accessToken");
                const response = await fetch(
                  `http://localhost:3001/api/v1/chama/${chama.id}/cycles/active`,
                  {
                    headers: { Authorization: `Bearer ${accessToken}` },
                  }
                );

                if (response.ok) {
                  const text = await response.text();

                  // Handle empty response or null
                  if (!text || text === "null" || text.trim() === "") {
                    alert(
                      "No active contribution cycle found.\n\nAn admin must create a rotation in the Rotation tab. This will automatically create the first contribution cycle."
                    );
                    return;
                  }

                  let cycle;
                  try {
                    cycle = JSON.parse(text);
                  } catch (parseError) {
                    console.error("Failed to parse cycle data:", text);
                    alert("Invalid response from server");
                    return;
                  }

                  if (!cycle || !cycle.id) {
                    alert("No active contribution cycle found");
                    return;
                  }

                  setSelectedChamaId(chama.id);
                  setSelectedCycleId(cycle.id);
                  setSelectedRecipientName(chama.name);
                  setTransferPhone("");
                  setTransferDescription(`Contribution to ${chama.name}`);
                  setTransferAmount(cycle.expected_amount?.toString() || "");
                  setShowTransfer(true);
                } else {
                  const errorText = await response.text();
                  console.error("Error fetching cycle:", errorText);
                  alert(
                    "Failed to fetch cycle. You may not be a member of this chama."
                  );
                }
              } catch (error) {
                alert("Failed to load contribution cycle");
                console.error(error);
              }
            }}
            onMemberClick={(member) => {
              setSelectedChamaId(null);
              const memberName = member.full_name || member.name || "Member";
              setSelectedRecipientName(memberName);
              setTransferPhone(member.phone || "");
              setTransferDescription(`Transfer to ${memberName}`);
              setShowTransfer(true);
            }}
            onAddRecipient={() => {
              setSelectedChamaId(null);
              setSelectedRecipientName("");
              setTransferPhone("");
              setTransferDescription("");
              setShowTransfer(true);
            }}
          />

          {/* Investments Section */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-[#083232]" />
                  <h2 className="text-xl font-semibold">My Investments</h2>
                </div>
                <Link href="/investment/marketplace">
                  <Button variant="outline" size="sm">
                    Browse Investments
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {chamas.length === 0 ? (
                <p className="text-gray-600 text-center py-8">
                  Join a chama to start investing
                </p>
              ) : (
                <div className="space-y-4">
                  {chamas.map((chama) => (
                    <div key={chama.id} className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-2">{chama.name}</h3>
                      <InvestmentPortfolio chamaId={chama.id} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contributions Section can be added here if needed for chama-specific functionality */}

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
