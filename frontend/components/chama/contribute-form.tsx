"use client";

import { useState } from "react";
import { contributionApi, CreateContributionDto } from "@/lib/contribution-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Wallet, Smartphone, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ContributeFormProps {
  chamaId: string;
  cycleId: string;
  expectedAmount: number;
  contributionType?: "fixed" | "flexible" | "income_based";
  minAmount?: number;
  maxAmount?: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ContributeForm({
  chamaId,
  cycleId,
  expectedAmount,
  contributionType = "fixed",
  minAmount,
  maxAmount,
  onSuccess,
  onCancel,
}: ContributeFormProps) {
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "mpesa_direct">(
    "wallet"
  );
  const [amount, setAmount] = useState(expectedAmount.toString());
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const validateAmount = () => {
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return "Please enter a valid amount";
    }

    if (contributionType === "fixed" && numAmount !== expectedAmount) {
      return `Amount must be exactly KES ${expectedAmount.toLocaleString()}`;
    }

    if (contributionType === "flexible") {
      if (minAmount && numAmount < minAmount) {
        return `Amount must be at least KES ${minAmount.toLocaleString()}`;
      }
      if (maxAmount && numAmount > maxAmount) {
        return `Amount cannot exceed KES ${maxAmount.toLocaleString()}`;
      }
    }

    return null;
  };

  const validateMpesaPhone = () => {
    if (paymentMethod === "mpesa_direct") {
      const cleaned = mpesaPhone.replace(/\D/g, "");
      if (cleaned.length < 10) {
        return "Please enter a valid phone number";
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountError = validateAmount();
    if (amountError) {
      setError(amountError);
      return;
    }

    const phoneError = validateMpesaPhone();
    if (phoneError) {
      setError(phoneError);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const dto: CreateContributionDto = {
        chamaId,
        cycleId,
        amount: parseFloat(amount),
        paymentMethod,
        mpesaPhone: paymentMethod === "mpesa_direct" ? mpesaPhone : undefined,
        notes: notes || undefined,
      };

      await contributionApi.createContribution(dto);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to process contribution");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="border-[#2e856e]">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-[#2e856e]/10 rounded-full">
                <CheckCircle2 className="h-16 w-16 text-[#2e856e]" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#083232]">
                Contribution Successful!
              </h3>
              <p className="text-gray-600 mt-2">
                Your contribution of KES {parseFloat(amount).toLocaleString()}{" "}
                has been processed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl text-[#083232]">
          Make Contribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-base">
              Amount {contributionType === "fixed" ? "(Fixed)" : ""}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                KES
              </span>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-14 text-lg h-12"
                placeholder="0.00"
                disabled={contributionType === "fixed" || loading}
                min={minAmount}
                max={maxAmount}
                step="0.01"
              />
            </div>
            {contributionType === "flexible" && (
              <p className="text-sm text-gray-600">
                Range: KES {minAmount?.toLocaleString()} -{" "}
                {maxAmount?.toLocaleString()}
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <Label className="text-base">Payment Method</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as any)}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="wallet" id="wallet" />
                <Label
                  htmlFor="wallet"
                  className="flex items-center gap-3 cursor-pointer flex-1"
                >
                  <div className="p-2 bg-[#083232]/10 rounded">
                    <Wallet className="h-5 w-5 text-[#083232]" />
                  </div>
                  <div>
                    <p className="font-medium">Wallet</p>
                    <p className="text-sm text-gray-600">
                      Instant payment from your wallet
                    </p>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="mpesa_direct" id="mpesa" />
                <Label
                  htmlFor="mpesa"
                  className="flex items-center gap-3 cursor-pointer flex-1"
                >
                  <div className="p-2 bg-[#2e856e]/10 rounded">
                    <Smartphone className="h-5 w-5 text-[#2e856e]" />
                  </div>
                  <div>
                    <p className="font-medium">M-Pesa</p>
                    <p className="text-sm text-gray-600">
                      Pay via M-Pesa STK push
                    </p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* M-Pesa Phone */}
          {paymentMethod === "mpesa_direct" && (
            <div className="space-y-2">
              <Label htmlFor="mpesaPhone" className="text-base">
                M-Pesa Phone Number
              </Label>
              <Input
                id="mpesaPhone"
                type="tel"
                value={mpesaPhone}
                onChange={(e) => setMpesaPhone(e.target.value)}
                placeholder="0712345678"
                className="h-12"
                disabled={loading}
              />
              <p className="text-sm text-gray-600">
                You'll receive an STK push prompt on this number
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-base">
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this contribution..."
              className="min-h-20"
              disabled={loading}
            />
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col md:flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              className="md:flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#f64d52] hover:bg-[#f64d52]/90 md:flex-1"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                `Contribute KES ${parseFloat(amount || "0").toLocaleString()}`
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
