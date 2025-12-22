"use client";

import { useState, useEffect } from "react";
import {
  contributionApi,
  SetupAutoDebitDto,
  UpdateAutoDebitDto,
} from "@/lib/contribution-api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Wallet,
  Smartphone,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";

interface AutoDebitFormProps {
  chamaId: string;
  cycleId: string;
  expectedAmount: number;
  existingAutoDebit?: {
    id: string;
    amount: number | null;
    dayOfMonth?: number;
    dayOfWeek?: number;
    frequencyType?: string;
    intervalDays?: number;
    paymentMethod: string;
    enabled: boolean;
  };
  onSuccess: () => void;
  onCancel: () => void;
}

export function AutoDebitForm({
  chamaId,
  cycleId,
  expectedAmount,
  existingAutoDebit,
  onSuccess,
  onCancel,
}: AutoDebitFormProps) {
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "mpesa_direct">(
    (existingAutoDebit?.paymentMethod as any) || "wallet"
  );
  const [amountType, setAmountType] = useState<"cycle" | "fixed">(
    existingAutoDebit?.amount ? "fixed" : "cycle"
  );
  const [fixedAmount, setFixedAmount] = useState(
    existingAutoDebit?.amount?.toString() || expectedAmount.toString()
  );
  const [frequencyType, setFrequencyType] = useState<
    "daily" | "2-day" | "3-day" | "weekly" | "biweekly" | "monthly"
  >((existingAutoDebit?.frequencyType as any) || "monthly");
  const [dayOfMonth, setDayOfMonth] = useState(
    existingAutoDebit?.dayOfMonth?.toString() || "1"
  );
  const [dayOfWeek, setDayOfWeek] = useState(
    existingAutoDebit?.dayOfWeek?.toString() || "1"
  );
  const [enabled, setEnabled] = useState(existingAutoDebit?.enabled ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const validateForm = () => {
    // Validate based on frequency type
    if (frequencyType === "monthly" || frequencyType === "biweekly") {
      const day = parseInt(dayOfMonth);
      if (isNaN(day) || day < 1 || day > 28) {
        return "Day of month must be between 1 and 28";
      }
    }

    if (frequencyType === "weekly" || frequencyType === "biweekly") {
      const day = parseInt(dayOfWeek);
      if (isNaN(day) || day < 0 || day > 6) {
        return "Please select a valid day of the week";
      }
    }

    if (amountType === "fixed") {
      const amount = parseFloat(fixedAmount);
      if (isNaN(amount) || amount <= 0) {
        return "Please enter a valid amount";
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setLoading(true);

    try {
      if (existingAutoDebit) {
        // Update existing auto-debit
        const dto: UpdateAutoDebitDto = {
          amount: amountType === "fixed" ? parseFloat(fixedAmount) : null,
          frequencyType,
          dayOfMonth:
            frequencyType === "monthly" || frequencyType === "biweekly"
              ? parseInt(dayOfMonth)
              : undefined,
          dayOfWeek:
            frequencyType === "weekly" || frequencyType === "biweekly"
              ? parseInt(dayOfWeek)
              : undefined,
          paymentMethod,
          enabled,
        };
        await contributionApi.updateAutoDebit(existingAutoDebit.id, dto);
      } else {
        // Create new auto-debit
        const dto: SetupAutoDebitDto = {
          chamaId,
          cycleId,
          amount: amountType === "fixed" ? parseFloat(fixedAmount) : null,
          frequencyType,
          dayOfMonth:
            frequencyType === "monthly" || frequencyType === "biweekly"
              ? parseInt(dayOfMonth)
              : undefined,
          dayOfWeek:
            frequencyType === "weekly" || frequencyType === "biweekly"
              ? parseInt(dayOfWeek)
              : undefined,
          paymentMethod,
        };
        await contributionApi.setupAutoDebit(dto);
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to save auto-debit settings"
      );
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
                Auto-Debit {existingAutoDebit ? "Updated" : "Activated"}!
              </h3>
              <p className="text-gray-600 mt-2">
                Your automatic contributions will be processed on day{" "}
                {dayOfMonth} of each month.
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
          {existingAutoDebit ? "Edit Auto-Debit" : "Setup Auto-Debit"}
        </CardTitle>
        <CardDescription>
          Automatically contribute on a specific day each month
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Info Alert */}
          <Alert className="border-[#2e856e]/20 bg-[#2e856e]/5">
            <Info className="h-4 w-4 text-[#2e856e]" />
            <AlertDescription className="text-sm text-gray-700">
              Auto-debit will only execute if you have sufficient balance in
              your selected payment method. You'll receive a notification after
              each attempt.
            </AlertDescription>
          </Alert>

          {/* Amount Type */}
          <div className="space-y-3">
            <Label className="text-base">Contribution Amount</Label>
            <RadioGroup
              value={amountType}
              onValueChange={(value) => setAmountType(value as any)}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="cycle" id="cycle-amount" />
                <Label htmlFor="cycle-amount" className="cursor-pointer flex-1">
                  <div>
                    <p className="font-medium">Use Cycle Amount</p>
                    <p className="text-sm text-gray-600">
                      Automatically use the required amount for each cycle
                    </p>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="fixed" id="fixed-amount" />
                <Label htmlFor="fixed-amount" className="cursor-pointer flex-1">
                  <div>
                    <p className="font-medium">Fixed Amount</p>
                    <p className="text-sm text-gray-600">
                      Contribute the same amount every month
                    </p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Fixed Amount Input */}
          {amountType === "fixed" && (
            <div className="space-y-2">
              <Label htmlFor="fixedAmount" className="text-base">
                Monthly Amount
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  KES
                </span>
                <Input
                  id="fixedAmount"
                  type="number"
                  value={fixedAmount}
                  onChange={(e) => setFixedAmount(e.target.value)}
                  className="pl-14 text-lg h-12"
                  placeholder="0.00"
                  disabled={loading}
                  step="0.01"
                  min="1"
                />
              </div>
            </div>
          )}

          {/* Frequency Type */}
          <div className="space-y-2">
            <Label htmlFor="frequencyType" className="text-base">
              Contribution Frequency
            </Label>
            <Select
              value={frequencyType}
              onValueChange={(value) => setFrequencyType(value as any)}
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="2-day">Every 2 Days</SelectItem>
                <SelectItem value="3-day">Every 3 Days</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">
                  Bi-weekly (Every 2 weeks)
                </SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Day of Week (for weekly/biweekly) */}
          {(frequencyType === "weekly" || frequencyType === "biweekly") && (
            <div className="space-y-2">
              <Label htmlFor="dayOfWeek" className="text-base">
                Day of Week
              </Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sunday</SelectItem>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600">
                <Calendar className="inline h-4 w-4 mr-1" />
                Contributions will be processed on this day each{" "}
                {frequencyType === "weekly" ? "week" : "two weeks"}
              </p>
            </div>
          )}

          {/* Day of Month (for monthly/biweekly) */}
          {(frequencyType === "monthly" || frequencyType === "biweekly") && (
            <div className="space-y-2">
              <Label htmlFor="dayOfMonth" className="text-base">
                {frequencyType === "monthly"
                  ? "Day of Month"
                  : "Day of Month (for biweekly cycle)"}
              </Label>
              <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      Day {day}{" "}
                      {frequencyType === "monthly"
                        ? "of every month"
                        : "of biweekly cycle"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600">
                <Calendar className="inline h-4 w-4 mr-1" />
                Days limited to 1-28 to ensure execution in all months
              </p>
            </div>
          )}

          {/* Daily frequency info */}
          {(frequencyType === "daily" ||
            frequencyType === "2-day" ||
            frequencyType === "3-day") && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start space-x-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">
                    {frequencyType === "daily" && "Daily Contributions"}
                    {frequencyType === "2-day" && "Every 2 Days"}
                    {frequencyType === "3-day" && "Every 3 Days"}
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Your contributions will be processed
                    {frequencyType === "daily" && " every day"}
                    {frequencyType === "2-day" && " every 2 days"}
                    {frequencyType === "3-day" && " every 3 days"} starting from
                    the next execution date.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Payment Method */}
          <div className="space-y-3">
            <Label className="text-base">Payment Method</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as any)}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="wallet" id="wallet-method" />
                <Label
                  htmlFor="wallet-method"
                  className="flex items-center gap-3 cursor-pointer flex-1"
                >
                  <div className="p-2 bg-[#083232]/10 rounded">
                    <Wallet className="h-5 w-5 text-[#083232]" />
                  </div>
                  <div>
                    <p className="font-medium">Wallet</p>
                    <p className="text-sm text-gray-600">
                      Debit from your wallet balance
                    </p>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="mpesa_direct" id="mpesa-method" />
                <Label
                  htmlFor="mpesa-method"
                  className="flex items-center gap-3 cursor-pointer flex-1"
                >
                  <div className="p-2 bg-[#2e856e]/10 rounded">
                    <Smartphone className="h-5 w-5 text-[#2e856e]" />
                  </div>
                  <div>
                    <p className="font-medium">M-Pesa</p>
                    <p className="text-sm text-gray-600">
                      Automatic STK push to your phone
                    </p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Enable/Disable Toggle */}
          {existingAutoDebit && (
            <div className="flex items-center justify-between border rounded-lg p-4">
              <div>
                <Label htmlFor="enabled" className="text-base cursor-pointer">
                  Auto-Debit {enabled ? "Enabled" : "Disabled"}
                </Label>
                <p className="text-sm text-gray-600 mt-1">
                  {enabled
                    ? "Contributions will be processed automatically"
                    : "Auto-debit is paused"}
                </p>
              </div>
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={loading}
              />
            </div>
          )}

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
              className="bg-[#083232] hover:bg-[#2e856e] md:flex-1"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : existingAutoDebit ? (
                "Update Auto-Debit"
              ) : (
                "Activate Auto-Debit"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
