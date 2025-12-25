/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { rotationApi, payoutApi } from "@/lib/rotation-payout-api";
import {
  CheckCircle,
  Clock,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Users,
  Calculator,
  ArrowRight,
  Zap,
} from "lucide-react";

interface PayoutProcessorProps {
  chamaId: string;
  rotationId: string;
  currentCycleId: string;
}

interface ContributionStatus {
  userId: string;
  userName: string;
  expectedAmount: number;
  paidAmount: number;
  isPaid: boolean;
  paymentDate: string | null;
  lateFee: number;
}

interface PayoutSummary {
  totalCollected: number;
  totalExpected: number;
  recipientId: string;
  recipientName: string;
  payoutAmount: number;
  fees: number;
  canProcess: boolean;
}

export function PayoutProcessor({
  chamaId,
  rotationId,
  currentCycleId,
}: PayoutProcessorProps) {
  const [contributions, setContributions] = useState<ContributionStatus[]>([]);
  const [payoutSummary, setPayoutSummary] = useState<PayoutSummary | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadContributionStatus();
  }, [chamaId, rotationId, currentCycleId]);

  const loadContributionStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load current cycle contributions
      const rotationStatus = await rotationApi.getRotationStatus(chamaId);
      // Find the current cycle by rotationId or currentCycleId
      const currentCycle =
        rotationStatus.cycles?.find(
          (cycle: any) =>
            cycle.id === currentCycleId || cycle.rotationId === rotationId
        ) || rotationStatus.currentCycle;
      setContributions(currentCycle?.contributions || []);

      // Calculate payout summary
      const summary = calculatePayoutSummary(currentCycle);
      setPayoutSummary(summary);
    } catch (error) {
      console.error("Failed to load contribution status:", error);
      setError("Failed to load contribution data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const calculatePayoutSummary = (cycleData: any): PayoutSummary => {
    const contributions = cycleData.contributions || [];
    const totalPaid = contributions.reduce(
      (sum: number, c: any) => sum + c.paidAmount,
      0
    );
    const totalExpected = contributions.reduce(
      (sum: number, c: any) => sum + c.expectedAmount,
      0
    );
    const totalLateFees = contributions.reduce(
      (sum: number, c: any) => sum + (c.lateFee || 0),
      0
    );

    // Platform fee (4.5% of total collected)
    const platformFee = totalPaid * 0.045;
    const payoutAmount = totalPaid - platformFee;

    // Check if everyone has contributed (all members have paid their expected amount)
    const allPaid = contributions.every((c: any) => c.isPaid);

    return {
      totalCollected: totalPaid,
      totalExpected,
      recipientId: cycleData.currentRecipient?.id || "",
      recipientName: cycleData.currentRecipient?.name || "Unknown",
      payoutAmount,
      fees: platformFee,
      canProcess: allPaid && totalPaid > 0, // Only allow payout when everyone has contributed
    };
  };

  const handleManualRefresh = () => {
    loadContributionStatus();
  };

  const handleProcessPayout = async () => {
    if (!payoutSummary) return;

    try {
      setProcessing(true);

      await payoutApi.processPayout({
        chamaId,
        rotationId,
        cycleId: currentCycleId,
        recipientId: payoutSummary.recipientId,
        amount: payoutSummary.payoutAmount,
      });

      // Refresh data after successful payout
      await loadContributionStatus();
      setShowConfirmDialog(false);
    } catch (error) {
      console.error("Failed to process payout:", error);
      setError(
        "Failed to process payout. Please try again or contact support."
      );
    } finally {
      setProcessing(false);
    }
  };

  const getCompletionPercentage = () => {
    if (!payoutSummary) return 0;
    return Math.round(
      (payoutSummary.totalCollected / payoutSummary.totalExpected) * 100
    );
  };

  const getPayoutStatus = () => {
    if (!payoutSummary) return { status: "loading", color: "gray" };

    if (payoutSummary.totalCollected >= payoutSummary.totalExpected) {
      return { status: "ready", color: "green", text: "Ready for Payout" };
    } else if (payoutSummary.canProcess) {
      return {
        status: "partial",
        color: "yellow",
        text: "Partial Payout Available",
      };
    } else {
      return {
        status: "pending",
        color: "gray",
        text: "Awaiting More Contributions",
      };
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading contribution status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const payoutStatus = getPayoutStatus();

  return (
    <div className="space-y-6">
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Payout Summary Card */}
      <Card className="border-l-4 border-l-[#083232]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              Current Cycle Payout
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManualRefresh}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {payoutSummary && (
            <>
              {/* Progress Overview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Collection Progress</span>
                  <span className="font-medium">
                    {getCompletionPercentage()}%
                  </span>
                </div>
                <Progress value={getCompletionPercentage()} className="h-2" />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>
                    KES {payoutSummary.totalCollected.toLocaleString()}
                  </span>
                  <span>
                    KES {payoutSummary.totalExpected.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className={`
                    ${
                      payoutStatus.color === "green"
                        ? "border-green-500 text-green-700 bg-green-50"
                        : ""
                    }
                    ${
                      payoutStatus.color === "yellow"
                        ? "border-yellow-500 text-yellow-700 bg-yellow-50"
                        : ""
                    }
                    ${
                      payoutStatus.color === "gray"
                        ? "border-gray-500 text-gray-700 bg-gray-50"
                        : ""
                    }
                  `}
                >
                  {payoutStatus.status === "ready" && (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  )}
                  {payoutStatus.status === "partial" && (
                    <Clock className="h-3 w-3 mr-1" />
                  )}
                  {payoutStatus.status === "pending" && (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  {payoutStatus.text}
                </Badge>
              </div>

              {/* Payout Details */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Recipient</p>
                  <p className="font-semibold">{payoutSummary.recipientName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Payout Amount</p>
                  <p className="font-semibold text-[#083232]">
                    KES {payoutSummary.payoutAmount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Platform Fee (4.5%)</p>
                  <p className="font-semibold">
                    KES {payoutSummary.fees.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Collected</p>
                  <p className="font-semibold">
                    KES {payoutSummary.totalCollected.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Process Payout Button */}
              {payoutSummary.canProcess && (
                <Button
                  className="w-full bg-[#083232] hover:bg-[#2e856e]"
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Process Payout
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Contributions Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Member Contributions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {contributions.map((contribution) => (
              <div
                key={contribution.userId}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      contribution.isPaid ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <div>
                    <p className="font-medium">{contribution.userName}</p>
                    {contribution.lateFee > 0 && (
                      <p className="text-sm text-red-600">
                        +KES {contribution.lateFee} late fee
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-semibold">
                    KES {contribution.paidAmount.toLocaleString()} /{" "}
                    {contribution.expectedAmount.toLocaleString()}
                  </p>
                  {contribution.paymentDate && (
                    <p className="text-sm text-gray-500">
                      Paid{" "}
                      {new Date(contribution.paymentDate).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <Badge variant={contribution.isPaid ? "default" : "secondary"}>
                  {contribution.isPaid ? "Paid" : "Pending"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payout Processing</DialogTitle>
            <DialogDescription>
              You are about to process a payout for the current rotation cycle.
            </DialogDescription>
          </DialogHeader>

          {payoutSummary && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <DollarSign className="h-8 w-8 text-[#083232]" />
                <div>
                  <p className="font-semibold">{payoutSummary.recipientName}</p>
                  <p className="text-sm text-gray-600">will receive</p>
                  <p className="text-lg font-bold text-[#083232]">
                    KES {payoutSummary.payoutAmount.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Collected:</span>
                  <span>
                    KES {payoutSummary.totalCollected.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Platform Fee (4.5%):</span>
                  <span>KES {payoutSummary.fees.toLocaleString()}</span>
                </div>
                <div className="border-t pt-2 font-semibold flex justify-between">
                  <span>Payout Amount:</span>
                  <span>KES {payoutSummary.payoutAmount.toLocaleString()}</span>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This action cannot be undone. The funds will be transferred
                  immediately to the recipient's wallet.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#083232] hover:bg-[#2e856e]"
              onClick={handleProcessPayout}
              disabled={processing}
            >
              {processing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Confirm Payout
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
