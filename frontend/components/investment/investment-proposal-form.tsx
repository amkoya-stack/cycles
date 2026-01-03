"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Percent,
  Calendar,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { apiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";

interface InvestmentProduct {
  id: string;
  name: string;
  minimum_investment: number;
  maximum_investment: number | null;
  interest_rate: number;
  maturity_days: number;
  product_type: string;
}

interface InvestmentProposalFormProps {
  product: InvestmentProduct;
  onSuccess: () => void;
  onCancel: () => void;
}

export function InvestmentProposalForm({
  product,
  onSuccess,
  onCancel,
}: InvestmentProposalFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [chamas, setChamas] = useState<any[]>([]);
  const [selectedChamaId, setSelectedChamaId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [requiresVote, setRequiresVote] = useState(true);
  const [votingType, setVotingType] = useState("simple_majority");
  const [deadlineHours, setDeadlineHours] = useState("72");

  useEffect(() => {
    fetchUserChamas();
  }, []);

  useEffect(() => {
    if (product.minimum_investment) {
      setAmount(product.minimum_investment.toString());
    }
  }, [product]);

  const fetchUserChamas = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(apiUrl("chama/my-chamas"), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setChamas(data);
        if (data.length > 0) {
          setSelectedChamaId(data[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch chamas:", error);
    }
  };

  const calculateExpectedReturn = (investAmount: number, days: number, rate: number) => {
    const years = days / 365;
    return investAmount * (rate / 100) * years;
  };

  const validateAmount = (value: string): string | null => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      return "Amount must be greater than 0";
    }
    if (numValue < product.minimum_investment) {
      return `Minimum investment is ${product.minimum_investment.toLocaleString()} KES`;
    }
    if (product.maximum_investment && numValue > product.maximum_investment) {
      return `Maximum investment is ${product.maximum_investment.toLocaleString()} KES`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const amountError = validateAmount(amount);
    if (amountError) {
      toast({
        title: "Validation Error",
        description: amountError,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (!selectedChamaId) {
      toast({
        title: "Validation Error",
        description: "Please select a chama",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(apiUrl("investment/investments"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chamaId: selectedChamaId,
          productId: product.id,
          amount: parseFloat(amount),
          requiresVote: requiresVote,
          votingType: requiresVote ? votingType : undefined,
          deadlineHours: requiresVote ? parseInt(deadlineHours) : undefined,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Investment proposal created successfully",
        });
        onSuccess();
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to create proposal");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create investment proposal",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const investAmount = parseFloat(amount) || 0;
  const expectedReturn = calculateExpectedReturn(
    investAmount,
    product.maturity_days,
    product.interest_rate
  );
  const maturityDate = new Date();
  maturityDate.setDate(maturityDate.getDate() + product.maturity_days);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product Summary */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Investment Product</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Product</p>
              <p className="font-medium">{product.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Interest Rate</p>
              <p className="font-medium">{product.interest_rate}% p.a.</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Maturity Period</p>
              <p className="font-medium">{product.maturity_days} days</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Min Investment</p>
              <p className="font-medium">
                {product.minimum_investment.toLocaleString()} KES
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chama Selection */}
      <div className="space-y-2">
        <Label htmlFor="chama">Select Chama *</Label>
        <Select value={selectedChamaId} onValueChange={setSelectedChamaId}>
          <SelectTrigger id="chama">
            <SelectValue placeholder="Select a chama" />
          </SelectTrigger>
          <SelectContent>
            {chamas.map((chama) => (
              <SelectItem key={chama.id} value={chama.id}>
                {chama.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Investment Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount">Investment Amount (KES) *</Label>
        <Input
          id="amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={product.minimum_investment}
          max={product.maximum_investment || undefined}
          required
        />
        <p className="text-xs text-gray-500">
          Min: {product.minimum_investment.toLocaleString()} KES
          {product.maximum_investment &&
            ` | Max: ${product.maximum_investment.toLocaleString()} KES`}
        </p>
        {amount && validateAmount(amount) && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {validateAmount(amount)}
          </p>
        )}
      </div>

      {/* Expected Return Preview */}
      {amount && !validateAmount(amount) && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-green-900">Expected Return</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-green-700">Principal</p>
                <p className="font-bold text-green-900">
                  {investAmount.toLocaleString()} KES
                </p>
              </div>
              <div>
                <p className="text-sm text-green-700">Expected Interest</p>
                <p className="font-bold text-green-900">
                  {expectedReturn.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{" "}
                  KES
                </p>
              </div>
              <div>
                <p className="text-sm text-green-700">Total Return</p>
                <p className="font-bold text-green-900">
                  {(investAmount + expectedReturn).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{" "}
                  KES
                </p>
              </div>
              <div>
                <p className="text-sm text-green-700">Maturity Date</p>
                <p className="font-bold text-green-900">
                  {maturityDate.toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Voting Options */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="requiresVote"
            checked={requiresVote}
            onChange={(e) => setRequiresVote(e.target.checked)}
            className="rounded"
          />
          <Label htmlFor="requiresVote" className="cursor-pointer">
            Require group voting approval
          </Label>
        </div>

        {requiresVote && (
          <div className="space-y-4 pl-6 border-l-2 border-gray-200">
            <div className="space-y-2">
              <Label htmlFor="votingType">Voting Type</Label>
              <Select value={votingType} onValueChange={setVotingType}>
                <SelectTrigger id="votingType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple_majority">
                    Simple Majority (50%+1)
                  </SelectItem>
                  <SelectItem value="supermajority_66">
                    Supermajority (66%)
                  </SelectItem>
                  <SelectItem value="supermajority_75">
                    Supermajority (75%)
                  </SelectItem>
                  <SelectItem value="unanimous">Unanimous (100%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadlineHours">Voting Deadline (hours)</Label>
              <Input
                id="deadlineHours"
                type="number"
                value={deadlineHours}
                onChange={(e) => setDeadlineHours(e.target.value)}
                min="24"
                max="168"
              />
              <p className="text-xs text-gray-500">
                Members will have this many hours to vote (24-168 hours)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading || !selectedChamaId || !amount}
          className="bg-[#083232] hover:bg-[#2e856e]"
        >
          {loading ? "Creating..." : "Create Proposal"}
        </Button>
      </div>
    </form>
  );
}

