"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wallet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  DollarSign,
  Calendar,
} from "lucide-react";
import { apiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";

interface LoanRepayment {
  id: string;
  loanId: string;
  installmentNumber: number;
  dueDate: string;
  amountDue: number;
  principalAmount: number;
  interestAmount: number;
  lateFee: number;
  status: string;
  amountPaid: number;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
}

interface Loan {
  id: string;
  chamaId: string;
  borrowerId: string;
  principalAmount: number;
  interestRate: number;
  totalAmount: number;
  outstandingBalance: number;
  status: string;
}

interface LoanRepaymentPaymentProps {
  loanId: string;
  repayment?: LoanRepayment | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  userRole?: string;
}

export function LoanRepaymentPayment({
  loanId,
  repayment,
  isOpen,
  onClose,
  onSuccess,
  userRole,
}: LoanRepaymentPaymentProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [nextRepayment, setNextRepayment] = useState<LoanRepayment | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "manual">("wallet");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const isAdmin = userRole === "admin" || userRole === "treasurer";

  useEffect(() => {
    if (isOpen && loanId) {
      fetchLoanDetails();
      fetchWalletBalance();
    }
  }, [isOpen, loanId]);

  useEffect(() => {
    if (repayment) {
      const amountDue = repayment.amountDue - repayment.amountPaid;
      setAmount(amountDue > 0 ? amountDue.toFixed(2) : "");
      setNextRepayment(repayment);
    } else if (loan && !repayment) {
      fetchNextRepayment();
    }
  }, [loan, repayment]);

  const fetchLoanDetails = async () => {
    try {
      setFetching(true);
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(apiUrl(`lending/loans/${loanId}`), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setLoan(data.data.loan);
          if (data.data.repayments && data.data.repayments.length > 0) {
            // Find next pending/overdue/partial repayment
            const next = data.data.repayments.find(
              (r: LoanRepayment) =>
                r.status === "pending" ||
                r.status === "overdue" ||
                r.status === "partial"
            );
            if (next) {
              setNextRepayment(next);
              const amountDue = next.amountDue - next.amountPaid;
              setAmount(amountDue > 0 ? amountDue.toFixed(2) : "");
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch loan details:", error);
    } finally {
      setFetching(false);
    }
  };

  const fetchNextRepayment = async () => {
    if (!loan) return;

    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(apiUrl(`lending/loans/${loanId}`), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.repayments) {
          const next = data.data.repayments.find(
            (r: LoanRepayment) =>
              r.status === "pending" ||
              r.status === "overdue" ||
              r.status === "partial"
          );
          if (next) {
            setNextRepayment(next);
            const amountDue = next.amountDue - next.amountPaid;
            setAmount(amountDue > 0 ? amountDue.toFixed(2) : "");
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch next repayment:", error);
    }
  };

  const fetchWalletBalance = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(apiUrl("wallet/balance"), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.balance !== undefined) {
          setWalletBalance(data.balance);
        }
      }
    } catch (error) {
      console.error("Failed to fetch wallet balance:", error);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (!nextRepayment) {
      toast({
        title: "Error",
        description: "No pending repayment found",
        variant: "destructive",
      });
      return;
    }

    const amountDue = nextRepayment.amountDue - nextRepayment.amountPaid;
    if (numAmount > amountDue && !isAdmin) {
      toast({
        title: "Error",
        description: `Payment amount cannot exceed amount due (${formatAmount(amountDue)})`,
        variant: "destructive",
      });
      return;
    }

    if (paymentMethod === "wallet" && walletBalance !== null && numAmount > walletBalance) {
      toast({
        title: "Insufficient Balance",
        description: `Your wallet balance is ${formatAmount(walletBalance)}. Please deposit funds or use manual payment.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        toast({
          title: "Error",
          description: "Please log in to continue",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(apiUrl(`lending/loans/${loanId}/repay`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          amount: numAmount,
          paymentMethod: paymentMethod === "manual" ? "manual" : "wallet",
          paymentReference: paymentReference || undefined,
          notes: notes || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSuccess(true);
          toast({
            title: "Success",
            description: "Payment processed successfully",
          });
          setTimeout(() => {
            onSuccess?.();
            handleClose();
          }, 2000);
        } else {
          throw new Error(data.message || "Failed to process payment");
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to process payment");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setAmount("");
    setPaymentMethod("wallet");
    setPaymentReference("");
    setNotes("");
    setNextRepayment(null);
    onClose();
  };

  if (success) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Payment Successful!
            </h3>
            <p className="text-sm text-gray-600 text-center">
              Your loan repayment has been processed successfully.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const amountDue = nextRepayment
    ? nextRepayment.amountDue - nextRepayment.amountPaid
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isAdmin ? "Record Manual Payment" : "Make Loan Payment"}
          </DialogTitle>
          <DialogDescription>
            {isAdmin
              ? "Record a manual payment received outside the system"
              : "Pay your loan installment using your wallet"}
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-600">Loading...</span>
          </div>
        ) : nextRepayment ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Repayment Details */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Installment #</span>
                <span className="font-medium text-gray-900">
                  {nextRepayment.installmentNumber}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Due Date</span>
                <span className="font-medium text-gray-900">
                  {formatDate(nextRepayment.dueDate)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Amount Due</span>
                <span className="font-semibold text-gray-900">
                  {formatAmount(amountDue)}
                </span>
              </div>
              {nextRepayment.lateFee > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Late Fee</span>
                  <span className="font-medium text-red-600">
                    {formatAmount(nextRepayment.lateFee)}
                  </span>
                </div>
              )}
              {nextRepayment.status === "overdue" && (
                <div className="flex items-center gap-2 text-xs text-red-600 mt-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>This payment is overdue</span>
                </div>
              )}
            </div>

            {/* Payment Amount */}
            <div>
              <Label>Payment Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Amount due: {formatAmount(amountDue)}
              </p>
            </div>

            {/* Payment Method */}
            <div>
              <Label>Payment Method</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value: "wallet" | "manual") =>
                  setPaymentMethod(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wallet">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4" />
                      <span>Wallet</span>
                      {walletBalance !== null && (
                        <span className="text-xs text-gray-500 ml-auto">
                          Balance: {formatAmount(walletBalance)}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                  {isAdmin && (
                    <SelectItem value="manual">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        <span>Manual Payment</span>
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Reference (for manual payments) */}
            {paymentMethod === "manual" && (
              <div>
                <Label>Payment Reference (Optional)</Label>
                <Input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g., M-Pesa code, cheque number"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this payment"
                rows={3}
              />
            </div>

            {/* Wallet Balance Warning */}
            {paymentMethod === "wallet" &&
              walletBalance !== null &&
              parseFloat(amount) > walletBalance && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-yellow-800">
                    <AlertCircle className="w-4 h-4" />
                    <span>
                      Insufficient balance. Your wallet has{" "}
                      {formatAmount(walletBalance)}
                    </span>
                  </div>
                </div>
              )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !amount || parseFloat(amount) <= 0}
                className="bg-[#083232] hover:bg-[#2e856e]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4 mr-2" />
                    {isAdmin ? "Record Payment" : "Make Payment"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600">
              No pending repayments found for this loan.
            </p>
            <Button variant="outline" onClick={handleClose} className="mt-4">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

