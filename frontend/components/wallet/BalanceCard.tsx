import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowDownLeft,
  Receipt,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useState, useEffect } from "react";
import { api, ApiError } from "@/lib/api-client";

interface UpcomingPayment {
  chamaId: string;
  chamaName: string;
  cycleId: string;
  amount: number;
  dueDate: string;
  cycleNumber: number;
}

interface BalanceCardProps {
  balance: number;
  onDeposit: () => void;
  onWithdraw: () => void;
  onRequest: () => void;
  onReceipts: () => void;
  onBalanceUpdate?: () => void;
}

export function BalanceCard({
  balance,
  onDeposit,
  onWithdraw,
  onRequest,
  onReceipts,
  onBalanceUpdate,
}: BalanceCardProps) {
  const [upcomingPayments, setUpcomingPayments] = useState<UpcomingPayment[]>(
    []
  );
  const [loadingPayments, setLoadingPayments] = useState(true);

  useEffect(() => {
    fetchUpcomingPayments();
  }, []);

  const fetchUpcomingPayments = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        console.log("No access token, skipping upcoming payments fetch");
        return;
      }

      console.log("Fetching upcoming contributions...");
      const data = await api.get<UpcomingPayment[]>(
        "http://localhost:3001/api/v1/chama/upcoming-contributions"
      );

      console.log("Upcoming payments data:", data);
      setUpcomingPayments(data.slice(0, 2)); // Show max 2 upcoming payments
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("Failed to fetch upcoming payments:", error.message);
      } else {
        console.error("Failed to fetch upcoming payments:", error);
      }
    } finally {
      setLoadingPayments(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(amount);
  };

  const getDaysUntilDue = (dueDate: string) => {
    const days = Math.ceil(
      (new Date(dueDate).getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return days;
  };

  const handleQuickPay = async (payment: UpcomingPayment) => {
    try {
      await api.post(
        `http://localhost:3001/api/v1/chama/${payment.chamaId}/cycles/${payment.cycleId}/contribute`,
        {
          amount: Number(payment.amount),
          paymentMethod: "wallet",
        }
      );

      // Refresh balance and upcoming payments after successful payment
      if (onBalanceUpdate) onBalanceUpdate();
      await fetchUpcomingPayments();

      alert("Payment successful!");
    } catch (error) {
      if (error instanceof ApiError) {
        alert(error.message);
      } else {
        alert("Payment failed. Please try again.");
      }
      console.error("Quick pay failed:", error);
    }
  };

  return (
    <div className="mb-8">
      {/* Balance Card */}
      <Card className="overflow-hidden bg-[#083232]">
        {/* Upcoming Payments Strip */}
        {!loadingPayments && upcomingPayments.length > 0 && (
          <div className="bg-[#2e856e] px-4 py-2 border-b border-[#083232]/20">
            <div className="text-xs font-medium text-white/90 mb-1">
              Upcoming Payments
            </div>
            <div className="flex items-center justify-between gap-3">
              {upcomingPayments.map((payment, index) => {
                const daysLeft = getDaysUntilDue(payment.dueDate);
                const isUrgent = daysLeft <= 3;
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 flex-1"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-sm font-medium text-white truncate">
                        {payment.chamaName}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-white/80 whitespace-nowrap">
                        <Clock className="w-3 h-3" />
                        <span
                          className={
                            isUrgent ? "text-[#f64d52] font-semibold" : ""
                          }
                        >
                          {daysLeft > 0
                            ? `${daysLeft} day${daysLeft > 1 ? "s" : ""} left`
                            : "Overdue"}
                        </span>
                        <span className="mx-1">•</span>
                        <span className="font-semibold">
                          Ksh {Number(payment.amount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleQuickPay(payment)}
                      size="sm"
                      className="bg-white/20 hover:bg-white/30 text-white text-xs h-7 px-3"
                    >
                      Quick Pay
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="p-8 text-white">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-gray-200 mb-1">Available Balance</p>
              <h2 className="text-4xl font-bold">{formatAmount(balance)}</h2>
            </div>
            <Wallet className="w-16 h-16 opacity-20" />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-6">
            <button
              onClick={onDeposit}
              className="flex items-center gap-2 text-white hover:text-gray-200 cursor-pointer"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Deposit
            </button>
            <button
              onClick={onWithdraw}
              className="flex items-center gap-2 text-white hover:text-gray-200 cursor-pointer"
            >
              <ArrowUpFromLine className="w-4 h-4" />
              Withdraw
            </button>
            <button
              onClick={onRequest}
              className="flex items-center gap-2 text-white hover:text-gray-200 cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" />
              Request
            </button>
            <button
              onClick={onReceipts}
              className="flex items-center gap-2 text-white hover:text-gray-200 cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              Receipts
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
