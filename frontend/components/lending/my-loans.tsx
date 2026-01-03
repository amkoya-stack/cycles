"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Calendar,
  Percent,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { apiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import { LoanRepaymentPayment } from "./loan-repayment-payment";

interface Loan {
  id: string;
  chamaId: string;
  chamaName?: string;
  borrowerId: string;
  principalAmount: number;
  interestRate: number;
  totalAmount: number;
  repaymentPeriodMonths: number;
  repaymentFrequency: string;
  disbursedAt: string | null;
  firstPaymentDate: string;
  maturityDate: string;
  status: string;
  amountDisbursed: number;
  totalPaid: number;
  outstandingBalance: number;
  overdueAmount: number;
  lateFeePenalty: number;
}

interface MyLoansProps {
  chamaId?: string;
}

export function MyLoans({ chamaId }: MyLoansProps) {
  const { toast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  useEffect(() => {
    fetchMyLoans();
  }, [chamaId]);

  const fetchMyLoans = async () => {
    try {
      setLoading(true);
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const url = chamaId
        ? apiUrl(`lending/loans/me?chamaId=${chamaId}`)
        : apiUrl("lending/loans/me");

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLoans(data.data || []);
        }
      } else {
        throw new Error("Failed to fetch loans");
      }
    } catch (error) {
      console.error("Failed to fetch loans:", error);
      toast({
        title: "Error",
        description: "Failed to load your loans",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === "active") {
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    } else if (statusLower === "paid_off") {
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          <CheckCircle className="w-3 h-3 mr-1" />
          Paid Off
        </Badge>
      );
    } else if (statusLower === "defaulted") {
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Defaulted
        </Badge>
      );
    } else if (statusLower === "pending_disbursement") {
      return (
        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
          <Clock className="w-3 h-3 mr-1" />
          Pending Disbursement
        </Badge>
      );
    } else {
      return <Badge>{status}</Badge>;
    }
  };

  const calculateProgress = (loan: Loan) => {
    if (loan.totalAmount === 0) return 0;
    return Math.round((loan.totalPaid / loan.totalAmount) * 100);
  };

  const handleMakePayment = (loan: Loan) => {
    setSelectedLoan(loan);
    setShowPaymentDialog(true);
  };

  const handlePaymentSuccess = () => {
    fetchMyLoans();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Loading your loans...</p>
        </CardContent>
      </Card>
    );
  }

  if (loans.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Loans Found
          </h3>
          <p className="text-gray-600">
            {chamaId
              ? "You don't have any loans in this chama"
              : "You don't have any active loans"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">My Loans</h2>
        <p className="text-sm text-gray-600 mt-1">
          View and manage your loan repayments
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loans.map((loan) => {
          const progress = calculateProgress(loan);
          const isActive = loan.status.toLowerCase() === "active";

          return (
            <Card key={loan.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg mb-2">
                      {loan.chamaName || `Loan ${loan.id.slice(0, 8)}`}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(loan.status)}
                    </div>
                  </div>
                  {isActive && (
                    <Button
                      size="sm"
                      onClick={() => handleMakePayment(loan)}
                      className="bg-[#083232] hover:bg-[#2e856e]"
                    >
                      <DollarSign className="w-4 h-4 mr-2" />
                      Make Payment
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Loan Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Principal</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatAmount(loan.principalAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Interest Rate</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {loan.interestRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatAmount(loan.totalAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Outstanding</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatAmount(loan.outstandingBalance)}
                    </p>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">Repayment Progress</span>
                    <span className="font-medium text-gray-900">
                      {progress}% ({formatAmount(loan.totalPaid)} /{" "}
                      {formatAmount(loan.totalAmount)})
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-[#083232] h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Loan Terms */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-600">First Payment</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(loan.firstPaymentDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-600">Maturity Date</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(loan.maturityDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-600">Frequency</p>
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {loan.repaymentFrequency}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Overdue Warning */}
                {loan.overdueAmount > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-red-800">
                      <AlertCircle className="w-4 h-4" />
                      <span>
                        Overdue Amount: {formatAmount(loan.overdueAmount)}
                      </span>
                    </div>
                  </div>
                )}

                {/* View Details Button */}
                <div className="pt-2 border-t border-gray-200">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      window.location.href = `/loans/${loan.id}`;
                    }}
                  >
                    View Details & Payment History
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Payment Dialog */}
      {selectedLoan && (
        <LoanRepaymentPayment
          loanId={selectedLoan.id}
          isOpen={showPaymentDialog}
          onClose={() => {
            setShowPaymentDialog(false);
            setSelectedLoan(null);
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

