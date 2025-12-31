"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LogOut,
  Wallet,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Calendar,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface LeaveChamaProps {
  chamaId: string;
  chamaName: string;
  userRole: string | null;
  memberBalance: number;
  totalContributions: number;
  pendingPayouts: number;
}

export function LeaveChamaComponent({
  chamaId,
  chamaName,
  userRole,
  memberBalance,
  totalContributions,
  pendingPayouts,
}: LeaveChamaProps) {
  const router = useRouter();
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [leaveReason, setLeaveReason] = useState("");
  const [transferMethod, setTransferMethod] = useState("wallet");
  const [withdrawalAddress, setWithdrawalAddress] = useState("");
  const [isLeaving, setIsLeaving] = useState(false);
  const [step, setStep] = useState<"confirm" | "settlement" | "processing">(
    "confirm"
  );

  const hasOutstandingBalance = memberBalance > 0 || totalContributions > 0;
  const canLeave = userRole !== "admin"; // Admin must transfer role first

  const handleInitiateLeave = () => {
    setShowLeaveDialog(true);
    setStep(hasOutstandingBalance ? "settlement" : "confirm");
  };

  const handleLeave = async () => {
    setIsLeaving(true);
    setStep("processing");

    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const payload: any = {
        reason: leaveReason,
      };

      if (hasOutstandingBalance) {
        payload.settlement = {
          method: transferMethod,
          withdrawal_address: withdrawalAddress,
        };
      }

      const response = await fetch(
        `http://localhost:3001/api/chama/${chamaId}/leave`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to leave chama");
      }

      const result = await response.json();

      // Show success message
      alert(result.message || "Successfully left the chama");

      // Redirect to home page
      router.push("/");
    } catch (error: any) {
      alert(error.message || "Failed to leave chama");
      setStep(hasOutstandingBalance ? "settlement" : "confirm");
    } finally {
      setIsLeaving(false);
    }
  };

  const renderConfirmStep = () => (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <LogOut className="w-12 h-12 text-orange-500 mx-auto" />
        <h3 className="text-lg font-semibold">Leave {chamaName}?</h3>
        <p className="text-gray-600">
          You are about to leave this chama. This action cannot be undone.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for leaving (optional)
          </label>
          <Textarea
            placeholder="Tell us why you're leaving..."
            value={leaveReason}
            onChange={(e) => setLeaveReason(e.target.value)}
            rows={3}
          />
        </div>

        {/* Impact summary */}
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="space-y-2">
              <h4 className="font-medium text-yellow-800">
                What happens when you leave:
              </h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>
                  • You will lose access to chama activities and discussions
                </li>
                <li>• Your contribution history will be preserved</li>
                <li>• Any outstanding balances will be settled</li>
                {userRole && userRole !== "member" && (
                  <li>• Your leadership role will be transferred</li>
                )}
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderSettlementStep = () => (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <Wallet className="w-12 h-12 text-blue-500 mx-auto" />
        <h3 className="text-lg font-semibold">Balance Settlement</h3>
        <p className="text-gray-600">
          You have outstanding balances that need to be settled before leaving.
        </p>
      </div>

      {/* Balance summary */}
      <Card className="p-4">
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Outstanding Balances</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Member Balance:</span>
              <span className="font-medium">
                KSh {memberBalance.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Contributions:</span>
              <span className="font-medium">
                KSh {totalContributions.toLocaleString()}
              </span>
            </div>
            {pendingPayouts > 0 && (
              <div className="flex justify-between col-span-2">
                <span className="text-gray-600">Pending Payouts:</span>
                <span className="font-medium text-orange-600">
                  KSh {pendingPayouts.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Settlement options */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            How would you like to receive your balance?
          </label>
          <Select value={transferMethod} onValueChange={setTransferMethod}>
            <SelectTrigger>
              <SelectValue placeholder="Select transfer method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wallet">Transfer to Wallet</SelectItem>
              <SelectItem value="mpesa">M-Pesa Transfer</SelectItem>
              <SelectItem value="bank">Bank Transfer</SelectItem>
              <SelectItem value="forfeited">Forfeit Balance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {transferMethod !== "wallet" && transferMethod !== "forfeited" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {transferMethod === "mpesa"
                ? "M-Pesa Number"
                : "Bank Account Details"}
            </label>
            <Input
              placeholder={
                transferMethod === "mpesa"
                  ? "254XXXXXXXXX"
                  : "Account number and bank name"
              }
              value={withdrawalAddress}
              onChange={(e) => setWithdrawalAddress(e.target.value)}
            />
          </div>
        )}

        {transferMethod === "forfeited" && (
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800">Forfeit Balance</h4>
                <p className="text-sm text-red-700">
                  Your balance will be distributed among remaining members. This
                  action cannot be undone.
                </p>
              </div>
            </div>
          </Card>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for leaving (optional)
          </label>
          <Textarea
            placeholder="Tell us why you're leaving..."
            value={leaveReason}
            onChange={(e) => setLeaveReason(e.target.value)}
            rows={3}
          />
        </div>
      </div>
    </div>
  );

  const renderProcessingStep = () => (
    <div className="space-y-4">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#083232] mx-auto"></div>
        <h3 className="text-lg font-semibold">Processing Your Request</h3>
        <p className="text-gray-600">
          We're processing your leave request and settling your balances. This
          may take a moment.
        </p>
      </div>

      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="space-y-2 text-sm text-blue-800">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>Validating membership status</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>Calculating final balances</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Processing settlement...</span>
          </div>
        </div>
      </Card>
    </div>
  );

  if (!canLeave) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <User className="w-12 h-12 text-gray-400 mx-auto" />
          <h3 className="text-lg font-semibold text-gray-900">
            Cannot Leave Chama
          </h3>
          <p className="text-gray-600 max-w-md">
            As the admin, you must transfer your role to another member
            before leaving the chama.
          </p>
          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
            Chairperson Role Required Transfer
          </Badge>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Leave Chama</h3>
          <p className="text-gray-600">
            If you're no longer able to participate in this chama, you can leave
            at any time. We'll handle the settlement of any outstanding
            balances.
          </p>

          {/* Current status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Your Balance</p>
                  <p className="font-semibold">
                    KSh {memberBalance.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Contributed</p>
                  <p className="font-semibold">
                    KSh {totalContributions.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-sm text-gray-600">Pending Payouts</p>
                  <p className="font-semibold">
                    KSh {pendingPayouts.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleInitiateLeave}
            variant="outline"
            className="w-full border-red-200 text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Leave Chama
          </Button>
        </div>
      </Card>

      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {step === "confirm" && "Confirm Leave Chama"}
              {step === "settlement" && "Settle Outstanding Balances"}
              {step === "processing" && "Processing Request"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {step === "confirm" && renderConfirmStep()}
                {step === "settlement" && renderSettlementStep()}
                {step === "processing" && renderProcessingStep()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {step !== "processing" && (
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLeaving}>Cancel</AlertDialogCancel>
              {step === "settlement" && (
                <Button
                  onClick={() => setStep("confirm")}
                  variant="outline"
                  disabled={isLeaving}
                >
                  Back
                </Button>
              )}
              <AlertDialogAction
                onClick={handleLeave}
                disabled={
                  isLeaving ||
                  (step === "settlement" &&
                    transferMethod !== "wallet" &&
                    transferMethod !== "forfeited" &&
                    !withdrawalAddress)
                }
                className="bg-red-600 hover:bg-red-700"
              >
                {isLeaving ? "Processing..." : "Leave Chama"}
              </AlertDialogAction>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
