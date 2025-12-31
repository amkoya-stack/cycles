"use client";

import React, { useState } from "react";
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
import { apiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ExternalLoanListing {
  id: string;
  chamaId: string;
  chamaName: string;
  title: string;
  minAmount: number;
  maxAmount: number;
  interestRateMin: number;
  interestRateMax: number;
  minRepaymentPeriodMonths: number;
  maxRepaymentPeriodMonths: number;
  requiresEmploymentVerification: boolean;
  requiresIncomeProof: boolean;
  minMonthlyIncome: number | null;
}

interface ExternalLoanApplicationFormProps {
  listing: ExternalLoanListing;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ExternalLoanApplicationForm({
  listing,
  onSuccess,
  onCancel,
}: ExternalLoanApplicationFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [amountRequested, setAmountRequested] = useState<string>("");
  const [purpose, setPurpose] = useState("");
  const [proposedInterestRate, setProposedInterestRate] = useState<string>("");
  const [proposedRepaymentPeriodMonths, setProposedRepaymentPeriodMonths] =
    useState<string>("");
  const [repaymentFrequency, setRepaymentFrequency] = useState<string>("monthly");
  const [employmentStatus, setEmploymentStatus] = useState<string>("");
  const [monthlyIncome, setMonthlyIncome] = useState<string>("");

  // Employment details (for self-employed)
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [yearsInBusiness, setYearsInBusiness] = useState<string>("");

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate EMI amount based on loan details
  const calculateEMI = (
    principal: number,
    interestRate: number,
    months: number,
    frequency: "daily" | "weekly" | "biweekly" | "monthly" = "monthly"
  ): number => {
    if (!principal || !interestRate || !months) return 0;
    
    // Calculate total amount (principal + interest)
    const totalInterest = principal * (interestRate / 100) * (months / 12);
    const totalAmount = principal + totalInterest;

    // Calculate number of payments based on frequency
    let numberOfPayments: number;
    switch (frequency) {
      case "daily":
        numberOfPayments = months * 30; // Approximately 30 days per month
        break;
      case "weekly":
        numberOfPayments = months * 4; // Approximately 4 weeks per month
        break;
      case "biweekly":
        numberOfPayments = months * 2;
        break;
      case "monthly":
      default:
        numberOfPayments = months;
        break;
    }

    return totalAmount / numberOfPayments;
  };

  // Get current EMI amount for display
  const getCurrentEMI = (): number => {
    const amount = parseFloat(amountRequested) || 0;
    const rate = proposedInterestRate ? parseFloat(proposedInterestRate) : listing.interestRateMin;
    const months = proposedRepaymentPeriodMonths ? parseInt(proposedRepaymentPeriodMonths) : listing.minRepaymentPeriodMonths;
    
    if (!amount || !rate || !months) return 0;
    
    return calculateEMI(amount, rate, months, repaymentFrequency as "daily" | "weekly" | "biweekly" | "monthly");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        toast({
          title: "Authentication Required",
          description: "Please log in to apply for a loan",
          variant: "destructive",
        });
        return;
      }

      // Validate amount
      const amount = parseFloat(amountRequested);
      if (isNaN(amount) || amount < listing.minAmount || amount > listing.maxAmount) {
        toast({
          title: "Invalid Amount",
          description: `Amount must be between Ksh ${formatAmount(listing.minAmount)} and ${formatAmount(listing.maxAmount)}`,
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate interest rate
      const interestRate = proposedInterestRate
        ? parseFloat(proposedInterestRate)
        : listing.interestRateMin;
      if (
        isNaN(interestRate) ||
        interestRate < listing.interestRateMin ||
        interestRate > listing.interestRateMax
      ) {
        toast({
          title: "Invalid Interest Rate",
          description: `Interest rate must be between ${listing.interestRateMin}% and ${listing.interestRateMax}%`,
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate repayment period
      const period = proposedRepaymentPeriodMonths
        ? parseInt(proposedRepaymentPeriodMonths)
        : listing.minRepaymentPeriodMonths;
      if (
        isNaN(period) ||
        period < listing.minRepaymentPeriodMonths ||
        period > listing.maxRepaymentPeriodMonths
      ) {
        toast({
          title: "Invalid Repayment Period",
          description: `Repayment period must be between ${listing.minRepaymentPeriodMonths} and ${listing.maxRepaymentPeriodMonths} months`,
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate employment requirements
      if (listing.requiresEmploymentVerification && !employmentStatus) {
        toast({
          title: "Employment Status Required",
          description: "Please provide your employment status",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate income requirements
      if (listing.requiresIncomeProof && !monthlyIncome) {
        toast({
          title: "Monthly Income Required",
          description: "Please provide your monthly income",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (
        listing.minMonthlyIncome &&
        monthlyIncome &&
        parseFloat(monthlyIncome) < listing.minMonthlyIncome
      ) {
        toast({
          title: "Income Too Low",
          description: `Minimum monthly income required is Ksh ${formatAmount(listing.minMonthlyIncome)}`,
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Build request body
      const requestBody: any = {
        listingId: listing.id,
        amountRequested: amount,
        purpose: purpose.trim(),
        proposedRepaymentPeriodMonths: period,
        repaymentFrequency: repaymentFrequency,
      };

      if (proposedInterestRate) {
        requestBody.proposedInterestRate = interestRate;
      }

      if (employmentStatus) {
        requestBody.employmentStatus = employmentStatus;
      }

      if (monthlyIncome) {
        requestBody.monthlyIncome = parseFloat(monthlyIncome);
      }

      // Add employment details for self-employed
      if (employmentStatus === "self_employed") {
        requestBody.employmentDetails = {
          businessName: businessName.trim(),
          businessType: businessType.trim(),
          yearsInBusiness: yearsInBusiness ? parseInt(yearsInBusiness) : null,
        };
      }

      const response = await fetch(apiUrl("lending/external/applications"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Loan application submitted successfully",
        });
        onSuccess();
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit application");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit loan application",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Loan Amount */}
      <div>
        <Label htmlFor="amount">
          Loan Amount (Ksh) *
          <span className="text-xs text-gray-500 ml-2">
            {formatAmount(listing.minAmount)} - {formatAmount(listing.maxAmount)}
          </span>
        </Label>
        <Input
          id="amount"
          type="number"
          value={amountRequested}
          onChange={(e) => setAmountRequested(e.target.value)}
          placeholder={`Enter amount between ${formatAmount(listing.minAmount)} and ${formatAmount(listing.maxAmount)}`}
          required
          min={listing.minAmount}
          max={listing.maxAmount}
        />
      </div>

      {/* Purpose */}
      <div>
        <Label htmlFor="purpose">Purpose of Loan *</Label>
        <Textarea
          id="purpose"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Describe what you need the loan for..."
          rows={4}
          required
        />
      </div>

      {/* Interest Rate (Optional) */}
      <div>
        <Label htmlFor="interestRate">
          Proposed Interest Rate (%)
          <span className="text-xs text-gray-500 ml-2">
            {listing.interestRateMin}% - {listing.interestRateMax}% (optional)
          </span>
        </Label>
        <Input
          id="interestRate"
          type="number"
          step="0.1"
          value={proposedInterestRate}
          onChange={(e) => setProposedInterestRate(e.target.value)}
          placeholder={`Default: ${listing.interestRateMin}%`}
          min={listing.interestRateMin}
          max={listing.interestRateMax}
        />
      </div>

      {/* Repayment Period */}
      <div>
        <Label htmlFor="repaymentPeriod">
          Repayment Period (Months) *
          <span className="text-xs text-gray-500 ml-2">
            {listing.minRepaymentPeriodMonths} - {listing.maxRepaymentPeriodMonths} months
          </span>
        </Label>
        <Input
          id="repaymentPeriod"
          type="number"
          value={proposedRepaymentPeriodMonths}
          onChange={(e) => setProposedRepaymentPeriodMonths(e.target.value)}
          placeholder={`Enter period between ${listing.minRepaymentPeriodMonths} and ${listing.maxRepaymentPeriodMonths} months`}
          required
          min={listing.minRepaymentPeriodMonths}
          max={listing.maxRepaymentPeriodMonths}
        />
      </div>

      {/* EMI Type (Repayment Frequency) */}
      <div>
        <Label htmlFor="repaymentFrequency">EMI Type (Repayment Frequency) *</Label>
        <Select value={repaymentFrequency} onValueChange={setRepaymentFrequency}>
          <SelectTrigger id="repaymentFrequency">
            <SelectValue placeholder="Select repayment frequency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="biweekly">Biweekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          How often you will make loan repayments
        </p>
      </div>

      {/* EMI Amount Display (Read-only, calculated) */}
      {(amountRequested && proposedRepaymentPeriodMonths) && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">Estimated EMI Amount</p>
              <p className="text-xs text-gray-600 mt-1">
                Based on your loan details
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[#083232]">
                Ksh {formatAmount(getCurrentEMI())}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Per {repaymentFrequency === "daily" ? "day" : repaymentFrequency === "weekly" ? "week" : repaymentFrequency === "biweekly" ? "2 weeks" : "month"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Employment Status (if required) */}
      {listing.requiresEmploymentVerification && (
        <div>
          <Label htmlFor="employmentStatus">Employment Status *</Label>
          <Select value={employmentStatus} onValueChange={setEmploymentStatus}>
            <SelectTrigger id="employmentStatus">
              <SelectValue placeholder="Select employment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="employed">Employed</SelectItem>
              <SelectItem value="self_employed">Self-Employed</SelectItem>
              <SelectItem value="unemployed">Unemployed</SelectItem>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Business Details (if self-employed) */}
      {employmentStatus === "self_employed" && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
          <h4 className="font-semibold text-sm">Business Details</h4>
          <div>
            <Label htmlFor="businessName">Business Name</Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Enter business name"
            />
          </div>
          <div>
            <Label htmlFor="businessType">Business Type</Label>
            <Input
              id="businessType"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="e.g., Retail, Services, Manufacturing"
            />
          </div>
          <div>
            <Label htmlFor="yearsInBusiness">Years in Business</Label>
            <Input
              id="yearsInBusiness"
              type="number"
              value={yearsInBusiness}
              onChange={(e) => setYearsInBusiness(e.target.value)}
              placeholder="Number of years"
            />
          </div>
        </div>
      )}

      {/* Monthly Income (if required) */}
      {listing.requiresIncomeProof && (
        <div>
          <Label htmlFor="monthlyIncome">
            Monthly Income (Ksh) *
            {listing.minMonthlyIncome && (
              <span className="text-xs text-gray-500 ml-2">
                Minimum: {formatAmount(listing.minMonthlyIncome)}
              </span>
            )}
          </Label>
          <Input
            id="monthlyIncome"
            type="number"
            value={monthlyIncome}
            onChange={(e) => setMonthlyIncome(e.target.value)}
            placeholder="Enter your monthly income"
            required
            min={listing.minMonthlyIncome || 0}
          />
        </div>
      )}

      {/* Form Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="flex-1 bg-[#083232] hover:bg-[#2e856e]"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Application"
          )}
        </Button>
      </div>
    </form>
  );
}

