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
    <div className="sm:mb-8">
      {/* Balance Card */}
      <div className="overflow-hidden bg-[#083232] sm:rounded-lg sm:shadow-md w-full">
        {/* Upcoming Payments Strip */}
        {!loadingPayments && upcomingPayments.length > 0 && (
          <div className="bg-[#2e856e] px-3 sm:px-4 py-2 border-b border-[#083232]/20">
            <div className="text-[10px] sm:text-xs font-medium text-white/90 mb-1">
              Upcoming Payments
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
              {upcomingPayments.map((payment, index) => {
                const daysLeft = getDaysUntilDue(payment.dueDate);
                const isUrgent = daysLeft <= 3;
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-2 sm:gap-3 flex-1"
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                      <span className="text-xs sm:text-sm font-medium text-white truncate">
                        {payment.chamaName}
                      </span>
                      <div className="flex items-center gap-1 text-[10px] sm:text-xs text-white/80 whitespace-nowrap">
                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span
                          className={
                            isUrgent ? "text-[#f64d52] font-semibold" : ""
                          }
                        >
                          {daysLeft > 0
                            ? `${daysLeft} day${daysLeft > 1 ? "s" : ""} left`
                            : "Overdue"}
                        </span>
                        <span className="mx-0.5 sm:mx-1">•</span>
                        <span className="font-semibold">
                          Ksh {Number(payment.amount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleQuickPay(payment)}
                      size="sm"
                      className="bg-white/20 hover:bg-white/30 text-white text-[10px] sm:text-xs h-6 sm:h-7 px-2 sm:px-3 flex-shrink-0"
                    >
                      Quick Pay
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="p-4 sm:p-6 md:p-8 text-white">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <p className="text-xs sm:text-sm text-gray-200 mb-1">
                Available Balance
              </p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">
                {formatAmount(balance)}
              </h2>
            </div>
            <Wallet className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 opacity-20 flex-shrink-0" />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 sm:gap-4 md:gap-6">
            <button
              onClick={onDeposit}
              className="flex items-center gap-1.5 sm:gap-2 text-white hover:text-gray-200 cursor-pointer text-xs sm:text-sm"
            >
              <ArrowDownToLine className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Deposit
            </button>
            <button
              onClick={onWithdraw}
              className="flex items-center gap-1.5 sm:gap-2 text-white hover:text-gray-200 cursor-pointer text-xs sm:text-sm"
            >
              <ArrowUpFromLine className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Withdraw
            </button>
            <button
              onClick={onRequest}
              className="flex items-center gap-1.5 sm:gap-2 text-white hover:text-gray-200 cursor-pointer text-xs sm:text-sm"
            >
              <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Request
            </button>
            <button
              onClick={onReceipts}
              className="flex items-center gap-1.5 sm:gap-2 text-white hover:text-gray-200 cursor-pointer text-xs sm:text-sm"
            >
              <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Receipts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
