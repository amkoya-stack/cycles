"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Plus,
  X,
  Shield,
  Percent,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { apiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import { useChamas } from "@/hooks/use-chamas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RiskSharingAgreement {
  id: string;
  externalLoanApplicationId: string;
  totalLoanAmount: number;
  primaryChamaId: string;
  primaryChamaName?: string;
  primaryChamaAmount: number;
  primaryChamaPercentage: number;
  coFunders: Array<{
    chamaId: string;
    chamaName?: string;
    amount: number;
    percentage: number;
    agreedAt?: string;
  }>;
  profitSharingMethod: string;
  status: "pending" | "agreed" | "active" | "completed" | "cancelled";
  requiresVote: boolean;
  primaryChamaVoted: boolean;
  allCoFundersVoted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RiskSharingManagementProps {
  applicationId: string;
  chamaId: string;
  amountRequested: number;
  onRiskSharingUpdated?: () => void;
  userRole?: string;
}

export function RiskSharingManagement({
  applicationId,
  chamaId,
  amountRequested,
  onRiskSharingUpdated,
  userRole,
}: RiskSharingManagementProps) {
  const { toast } = useToast();
  const { chamas, loading: chamasLoading } = useChamas();
  const [agreement, setAgreement] = useState<RiskSharingAgreement | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddCoFunderDialog, setShowAddCoFunderDialog] = useState(false);

  // Form state
  const [primaryChamaAmount, setPrimaryChamaAmount] = useState<string>("");
  const [coFunders, setCoFunders] = useState<
    Array<{ chamaId: string; amount: string }>
  >([]);
  const [selectedChamaId, setSelectedChamaId] = useState<string>("");
  const [coFunderAmount, setCoFunderAmount] = useState<string>("");

  const canManage = userRole === "admin" || userRole === "treasurer";

  useEffect(() => {
    fetchRiskSharingAgreement();
  }, [applicationId]);

  useEffect(() => {
    if (showCreateDialog && !agreement) {
      // Initialize with primary chama taking full amount
      setPrimaryChamaAmount(amountRequested.toString());
      setCoFunders([]);
    }
  }, [showCreateDialog, agreement, amountRequested]);

  const fetchRiskSharingAgreement = async () => {
    try {
      setLoading(true);
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        apiUrl(`lending/external/applications/${applicationId}/risk-sharing`),
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setAgreement(data.data);
        } else {
          setAgreement(null);
        }
      } else {
        setAgreement(null);
      }
    } catch (error) {
      console.error("Failed to fetch risk sharing agreement:", error);
      setAgreement(null);
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

  const calculateTotal = () => {
    const primary = parseFloat(primaryChamaAmount) || 0;
    const coFundersTotal = coFunders.reduce(
      (sum, cf) => sum + (parseFloat(cf.amount) || 0),
      0
    );
    return primary + coFundersTotal;
  };

  const calculateRemaining = () => {
    return amountRequested - calculateTotal();
  };

  const getAvailableChamas = () => {
    // Filter out the primary chama and already selected co-funders
    const selectedChamaIds = new Set([
      chamaId,
      ...coFunders.map((cf) => cf.chamaId),
    ]);
    return chamas.filter((chama) => !selectedChamaIds.has(chama.id));
  };

  const handleAddCoFunder = () => {
    if (!selectedChamaId || !coFunderAmount) {
      toast({
        title: "Error",
        description: "Please select a chama and enter an amount",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(coFunderAmount);
    if (amount <= 0) {
      toast({
        title: "Error",
        description: "Amount must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    const remaining = calculateRemaining();
    if (amount > remaining) {
      toast({
        title: "Error",
        description: `Amount exceeds remaining balance of ${formatAmount(remaining)}`,
        variant: "destructive",
      });
      return;
    }

    setCoFunders([
      ...coFunders,
      { chamaId: selectedChamaId, amount: coFunderAmount },
    ]);
    setSelectedChamaId("");
    setCoFunderAmount("");
    setShowAddCoFunderDialog(false);
  };

  const handleRemoveCoFunder = (index: number) => {
    setCoFunders(coFunders.filter((_, i) => i !== index));
  };

  const handleCreateAgreement = async () => {
    const total = calculateTotal();
    const remaining = calculateRemaining();

    if (Math.abs(remaining) > 0.01) {
      toast({
        title: "Error",
        description: `Total amount (${formatAmount(total)}) must equal loan amount (${formatAmount(amountRequested)})`,
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        toast({
          title: "Error",
          description: "Please log in to continue",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(
        apiUrl(`lending/external/applications/${applicationId}/risk-sharing`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            primaryChamaId: chamaId,
            primaryChamaAmount: parseFloat(primaryChamaAmount),
            coFunders: coFunders.map((cf) => ({
              chamaId: cf.chamaId,
              amount: parseFloat(cf.amount),
            })),
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast({
            title: "Success",
            description: "Risk sharing agreement created successfully",
          });
          setShowCreateDialog(false);
          fetchRiskSharingAgreement();
          onRiskSharingUpdated?.();
        } else {
          throw new Error(data.message || "Failed to create agreement");
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create agreement");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create risk sharing agreement",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "agreed":
      case "active":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
            <X className="w-3 h-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-600">
              Loading risk sharing agreement...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg">Risk Sharing</CardTitle>
            </div>
            {!agreement && canManage && (
              <Button
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Agreement
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!agreement ? (
            <div className="text-center py-6">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-4">
                No risk sharing agreement has been created for this loan.
              </p>
              {canManage && (
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(true)}
                >
                  Create Risk Sharing Agreement
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status:</span>
                {getStatusBadge(agreement.status)}
              </div>

              {/* Primary Chama */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-gray-900">
                      Primary Chama
                    </span>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700">
                    Primary
                  </Badge>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Chama:</span>
                    <span className="font-medium text-gray-900">
                      {agreement.primaryChamaName || "Unknown"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-medium text-gray-900">
                      {formatAmount(agreement.primaryChamaAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Percentage:</span>
                    <span className="font-medium text-gray-900">
                      {agreement.primaryChamaPercentage.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Co-Funders */}
              {agreement.coFunders && agreement.coFunders.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">
                      Co-Funders ({agreement.coFunders.length})
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {agreement.coFunders.map((coFunder, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-600" />
                            <span className="font-medium text-gray-900">
                              {coFunder.chamaName || `Chama ${index + 1}`}
                            </span>
                          </div>
                          <Badge variant="outline">Co-Funder</Badge>
                        </div>
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Amount:</span>
                            <span className="font-medium text-gray-900">
                              {formatAmount(coFunder.amount)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Percentage:</span>
                            <span className="font-medium text-gray-900">
                              {coFunder.percentage.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">
                    Total Loan Amount:
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    {formatAmount(agreement.totalLoanAmount)}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  Profit Sharing: {agreement.profitSharingMethod || "Proportional"}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Agreement Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Risk Sharing Agreement</DialogTitle>
            <DialogDescription>
              Distribute the loan amount between your chama and co-funders. The
              total must equal the loan amount.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Primary Chama Amount */}
            <div>
              <Label>
                Primary Chama Amount (Your Chama: {chamaId.slice(0, 8)}...)
              </Label>
              <Input
                type="number"
                step="0.01"
                value={primaryChamaAmount}
                onChange={(e) => setPrimaryChamaAmount(e.target.value)}
                placeholder="Enter amount"
              />
              {primaryChamaAmount && (
                <p className="text-xs text-gray-500 mt-1">
                  Percentage:{" "}
                  {(
                    (parseFloat(primaryChamaAmount) / amountRequested) *
                    100
                  ).toFixed(2)}
                  %
                </p>
              )}
            </div>

            {/* Co-Funders */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Co-Funders</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddCoFunderDialog(true)}
                  disabled={calculateRemaining() <= 0}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Co-Funder
                </Button>
              </div>

              {coFunders.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No co-funders added yet
                </p>
              ) : (
                <div className="space-y-2">
                  {coFunders.map((coFunder, index) => {
                    const chama = chamas.find((c) => c.id === coFunder.chamaId);
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {chama?.name || `Chama ${index + 1}`}
                          </p>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-sm text-gray-600">
                              Amount: {formatAmount(parseFloat(coFunder.amount))}
                            </span>
                            <span className="text-sm text-gray-600">
                              Percentage:{" "}
                              {(
                                (parseFloat(coFunder.amount) /
                                  amountRequested) *
                                100
                              ).toFixed(2)}
                              %
                            </span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveCoFunder(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Primary Chama:</span>
                  <span className="font-medium">
                    {formatAmount(parseFloat(primaryChamaAmount) || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Co-Funders Total:</span>
                  <span className="font-medium">
                    {formatAmount(
                      coFunders.reduce(
                        (sum, cf) => sum + (parseFloat(cf.amount) || 0),
                        0
                      )
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t border-blue-200 pt-2">
                  <span>Total:</span>
                  <span>{formatAmount(calculateTotal())}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Loan Amount:</span>
                  <span className="font-medium">{formatAmount(amountRequested)}</span>
                </div>
                <div
                  className={`flex justify-between text-sm font-semibold ${
                    Math.abs(calculateRemaining()) <= 0.01
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  <span>Remaining:</span>
                  <span>{formatAmount(calculateRemaining())}</span>
                </div>
              </div>
              {Math.abs(calculateRemaining()) > 0.01 && (
                <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span>
                    Total must equal loan amount. Remaining:{" "}
                    {formatAmount(calculateRemaining())}
                  </span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAgreement}
              disabled={
                creating ||
                Math.abs(calculateRemaining()) > 0.01 ||
                !primaryChamaAmount
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Agreement"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Co-Funder Dialog */}
      <Dialog
        open={showAddCoFunderDialog}
        onOpenChange={setShowAddCoFunderDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Co-Funder</DialogTitle>
            <DialogDescription>
              Select a chama and specify the amount they will contribute.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Select Chama</Label>
              <Select
                value={selectedChamaId}
                onValueChange={setSelectedChamaId}
                disabled={chamasLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a chama" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableChamas().map((chama) => (
                    <SelectItem key={chama.id} value={chama.id}>
                      {chama.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={coFunderAmount}
                onChange={(e) => setCoFunderAmount(e.target.value)}
                placeholder="Enter amount"
                max={calculateRemaining()}
              />
              <p className="text-xs text-gray-500 mt-1">
                Remaining: {formatAmount(calculateRemaining())}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddCoFunderDialog(false);
                setSelectedChamaId("");
                setCoFunderAmount("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddCoFunder}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

