"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
  ArrowLeft,
  Loader2,
  FileText,
} from "lucide-react";
import { apiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import { LoanRepaymentPayment } from "@/components/lending/loan-repayment-payment";
import { LoanPaymentReminders } from "@/components/lending/loan-payment-reminders";
import { HomeNavbar } from "@/components/home/home-navbar";
import { Footer } from "@/components/footer";
import { useAuth } from "@/hooks/use-auth";

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
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  outstandingBalance: number;
  overdueAmount: number;
  lateFeePenalty: number;
}

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
  notes: string | null;
}

export default function LoanDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const loanId = params.id as string;

  const [loan, setLoan] = useState<Loan | null>(null);
  const [repayments, setRepayments] = useState<LoanRepayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  useEffect(() => {
    if (loanId) {
      fetchLoanDetails();
    }
  }, [loanId]);

  const fetchLoanDetails = async () => {
    try {
      setLoading(true);
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        router.push("/auth/login");
        return;
      }

      const response = await fetch(apiUrl(`lending/loans/${loanId}`), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setLoan(data.data.loan);
          setRepayments(data.data.repayments || []);
        }
      } else {
        throw new Error("Failed to fetch loan details");
      }
    } catch (error) {
      console.error("Failed to fetch loan details:", error);
      toast({
        title: "Error",
        description: "Failed to load loan details",
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

  const getRepaymentStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === "paid") {
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle className="w-3 h-3 mr-1" />
          Paid
        </Badge>
      );
    } else if (statusLower === "overdue") {
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Overdue
        </Badge>
      );
    } else if (statusLower === "partial") {
      return (
        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
          <Clock className="w-3 h-3 mr-1" />
          Partial
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    }
  };

  const calculateProgress = () => {
    if (!loan || loan.totalAmount === 0) return 0;
    return Math.round((loan.totalPaid / loan.totalAmount) * 100);
  };

  const nextRepayment = repayments.find(
    (r) => r.status === "pending" || r.status === "overdue" || r.status === "partial"
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <HomeNavbar
          isAuthenticated={isAuthenticated}
          showSearchInNav={false}
          searchQuery=""
          onSearchChange={() => {}}
          title="Loan Details"
        />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Loading loan details...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <HomeNavbar
          isAuthenticated={isAuthenticated}
          showSearchInNav={false}
          searchQuery=""
          onSearchChange={() => {}}
          title="Loan Details"
        />
        <main className="flex-1 flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Loan Not Found
              </h3>
              <p className="text-gray-600 mb-4">
                The loan you're looking for doesn't exist or you don't have access to it.
              </p>
              <Button onClick={() => router.push("/")} variant="outline">
                Go Home
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const progress = calculateProgress();
  const isActive = loan.status.toLowerCase() === "active";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <HomeNavbar
        isAuthenticated={isAuthenticated}
        showSearchInNav={false}
        searchQuery=""
        onSearchChange={() => {}}
        title="Loan Details"
      />
      <main className="flex-1">
        <div className="mx-auto px-4 py-8" style={{ maxWidth: '1085px' }}>
          <div className="space-y-6">
            {/* Back Button */}
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            {/* Loan Header */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl mb-2">
                      {loan.chamaName || `Loan ${loan.id.slice(0, 8)}`}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(loan.status)}
                    </div>
                  </div>
                  {isActive && nextRepayment && (
                    <Button
                      onClick={() => setShowPaymentDialog(true)}
                      className="bg-[#083232] hover:bg-[#2e856e]"
                    >
                      <DollarSign className="w-4 h-4 mr-2" />
                      Make Payment
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Loan Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Principal</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatAmount(loan.principalAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Interest Rate</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {loan.interestRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatAmount(loan.totalAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Outstanding</p>
                    <p className="text-lg font-semibold text-gray-900">
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
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-[#083232] h-3 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Loan Terms */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-600">First Payment</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(loan.firstPaymentDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-600">Maturity Date</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(loan.maturityDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <TrendingUp className="w-5 h-5 text-gray-400 mt-0.5" />
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
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-red-800 mb-2">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-semibold">Overdue Payment</span>
                    </div>
                    <p className="text-sm text-red-700">
                      You have an overdue amount of {formatAmount(loan.overdueAmount)}.
                      Please make a payment as soon as possible.
                    </p>
                  </div>
                )}

                {/* Next Payment Info */}
                {nextRepayment && isActive && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-blue-900 mb-1">
                          Next Payment Due
                        </p>
                        <p className="text-xs text-blue-700">
                          Installment #{nextRepayment.installmentNumber} -{" "}
                          {formatDate(nextRepayment.dueDate)}
                        </p>
                        <p className="text-lg font-bold text-blue-900 mt-2">
                          {formatAmount(
                            nextRepayment.amountDue - nextRepayment.amountPaid
                          )}
                        </p>
                      </div>
                      <Button
                        onClick={() => setShowPaymentDialog(true)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Pay Now
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Reminders */}
            {loan && (
              <LoanPaymentReminders loanId={loan.id} showTitle={true} />
            )}

            {/* Repayment Schedule */}
            <Card>
              <CardHeader>
                <CardTitle>Repayment Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                {repayments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>No repayment schedule available</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                            Installment
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                            Due Date
                          </th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                            Amount Due
                          </th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                            Amount Paid
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                            Paid Date
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {repayments.map((repayment) => (
                          <tr
                            key={repayment.id}
                            className="border-b border-gray-100 hover:bg-gray-50"
                          >
                            <td className="py-3 px-4 text-sm text-gray-900">
                              #{repayment.installmentNumber}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {formatDate(repayment.dueDate)}
                            </td>
                            <td className="py-3 px-4 text-sm text-right font-medium text-gray-900">
                              {formatAmount(repayment.amountDue)}
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-gray-700">
                              {repayment.amountPaid > 0
                                ? formatAmount(repayment.amountPaid)
                                : "-"}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {repayment.paidAt
                                ? formatDate(repayment.paidAt)
                                : "-"}
                            </td>
                            <td className="py-3 px-4">
                              {getRepaymentStatusBadge(repayment.status)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Payment Dialog */}
      {loan && (
        <LoanRepaymentPayment
          loanId={loan.id}
          repayment={nextRepayment || undefined}
          isOpen={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          onSuccess={() => {
            fetchLoanDetails();
          }}
        />
      )}

      <Footer />
    </div>
  );
}

