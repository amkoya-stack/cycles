"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Shield,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { apiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";

interface EscrowAccount {
  id: string;
  externalLoanApplicationId: string;
  amount: number;
  currency: string;
  fundedByChamas: Array<{
    chamaId: string;
    chamaName?: string;
    amount: number;
    fundedAt?: string;
    transactionId?: string;
  }>;
  status: "pending" | "funded" | "released" | "refunded" | "disputed";
  releasedAt: string | null;
  releasedToUserId: string | null;
  releaseTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EscrowManagementProps {
  applicationId: string;
  chamaId: string;
  amountRequested: number;
  escrowAccountId?: string | null;
  onEscrowUpdated?: () => void;
  userRole?: string;
}

export function EscrowManagement({
  applicationId,
  chamaId,
  amountRequested,
  escrowAccountId,
  onEscrowUpdated,
  userRole,
}: EscrowManagementProps) {
  const { toast } = useToast();
  const [escrow, setEscrow] = useState<EscrowAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [funding, setFunding] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [chamaBalance, setChamaBalance] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showFundDialog, setShowFundDialog] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const canManage = userRole === "admin" || userRole === "treasurer";

  useEffect(() => {
    if (escrowAccountId) {
      fetchEscrowDetails();
    }
  }, [escrowAccountId]);

  useEffect(() => {
    if (showFundDialog && chamaId) {
      fetchChamaBalance();
    }
  }, [showFundDialog, chamaId]);

  const fetchEscrowDetails = async () => {
    if (!escrowAccountId) return;

    try {
      setLoading(true);
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        apiUrl(`lending/external/escrow/${escrowAccountId}`),
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEscrow(data.data);
      } else {
        const error = await response.json();
        console.error("Failed to fetch escrow:", error);
      }
    } catch (error) {
      console.error("Failed to fetch escrow:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChamaBalance = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        apiUrl(`chama/${chamaId}/balance`),
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setChamaBalance(data.balance);
      }
    } catch (error) {
      console.error("Failed to fetch chama balance:", error);
    }
  };

  const handleCreateEscrow = async () => {
    setCreating(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        apiUrl(`lending/external/applications/${applicationId}/escrow`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEscrow(data.data);
        setShowCreateDialog(false);
        toast({
          title: "Success",
          description: "Escrow account created successfully",
        });
        onEscrowUpdated?.();
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to create escrow account");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create escrow account",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleFundEscrow = async () => {
    if (!escrow) return;

    setFunding(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        apiUrl(`lending/external/escrow/${escrow.id}/fund`),
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEscrow(data.data);
        setShowFundDialog(false);
        toast({
          title: "Success",
          description: "Escrow account funded successfully",
        });
        onEscrowUpdated?.();
        fetchChamaBalance(); // Refresh balance
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to fund escrow account");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fund escrow account",
        variant: "destructive",
      });
    } finally {
      setFunding(false);
    }
  };

  const handleReleaseEscrow = async () => {
    if (!escrow) return;

    setReleasing(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        apiUrl(`lending/external/escrow/${escrow.id}/release`),
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEscrow(data.data);
        setShowReleaseDialog(false);
        toast({
          title: "Success",
          description: "Escrow funds released to borrower successfully",
        });
        onEscrowUpdated?.();
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to release escrow funds");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to release escrow funds",
        variant: "destructive",
      });
    } finally {
      setReleasing(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "funded":
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            <DollarSign className="w-3 h-3 mr-1" />
            Funded
          </Badge>
        );
      case "released":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            Released
          </Badge>
        );
      case "refunded":
        return (
          <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
            Refunded
          </Badge>
        );
      case "disputed":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Disputed
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const totalFunded = escrow?.fundedByChamas?.reduce(
    (sum, chama) => sum + (chama.amount || 0),
    0
  ) || 0;

  const isRiskShared = escrow?.fundedByChamas && escrow.fundedByChamas.length > 1;

  if (!escrowAccountId && !canManage) {
    return null; // Don't show escrow management if no escrow and user can't manage
  }

  return (
    <div className="space-y-4">
      {escrow ? (
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-gray-900">Escrow Account</h4>
                  {getStatusBadge(escrow.status)}
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <p className="text-xs text-gray-600">Escrow Amount</p>
                    <p className="text-lg font-semibold text-gray-900">
                      Ksh {formatAmount(escrow.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Status</p>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {escrow.status}
                    </p>
                  </div>
                </div>
                {isRiskShared && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      <p className="text-xs font-semibold text-gray-700">
                        Risk-Shared Loan
                      </p>
                    </div>
                    <p className="text-xs text-gray-600">
                      {escrow.fundedByChamas.length} chama(s) co-funding
                    </p>
                  </div>
                )}
                {escrow.status === "funded" && escrow.releasedAt && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-600">
                      Released: {formatDate(escrow.releasedAt)}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDetailsDialog(true)}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Details
                </Button>
                {canManage && escrow.status === "pending" && (
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => setShowFundDialog(true)}
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Fund
                  </Button>
                )}
                {canManage && escrow.status === "funded" && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => setShowReleaseDialog(true)}
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Release
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : canManage ? (
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-5 h-5 text-yellow-600" />
                  <h4 className="font-semibold text-gray-900">No Escrow Account</h4>
                </div>
                <p className="text-sm text-gray-600">
                  Create an escrow account to secure the loan funds
                </p>
              </div>
              <Button
                size="sm"
                className="bg-yellow-600 hover:bg-yellow-700"
                onClick={() => setShowCreateDialog(true)}
              >
                <Shield className="w-4 h-4 mr-2" />
                Create Escrow
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Create Escrow Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Escrow Account</DialogTitle>
            <DialogDescription>
              Create an escrow account to secure the loan funds for this application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">
                Escrow Details
              </p>
              <div className="space-y-2 text-sm text-blue-800">
                <div className="flex justify-between">
                  <span>Loan Amount:</span>
                  <span className="font-semibold">
                    Ksh {formatAmount(amountRequested)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Escrow Amount:</span>
                  <span className="font-semibold">
                    Ksh {formatAmount(amountRequested)}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              An escrow account will be created to hold the loan funds until they are
              released to the borrower.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              className="bg-yellow-600 hover:bg-yellow-700"
              onClick={handleCreateEscrow}
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Escrow"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fund Escrow Dialog */}
      <Dialog open={showFundDialog} onOpenChange={setShowFundDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fund Escrow Account</DialogTitle>
            <DialogDescription>
              Transfer funds from your chama wallet to the escrow account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {escrow && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-2">
                    Funding Details
                  </p>
                  <div className="space-y-2 text-sm text-blue-800">
                    <div className="flex justify-between">
                      <span>Escrow Amount:</span>
                      <span className="font-semibold">
                        Ksh {formatAmount(escrow.amount)}
                      </span>
                    </div>
                    {chamaBalance !== null && (
                      <div className="flex justify-between">
                        <span>Chama Balance:</span>
                        <span className="font-semibold">
                          Ksh {formatAmount(chamaBalance)}
                        </span>
                      </div>
                    )}
                    {chamaBalance !== null && chamaBalance < escrow.amount && (
                      <div className="mt-2 pt-2 border-t border-blue-300">
                        <p className="text-xs text-red-700 font-semibold">
                          Insufficient balance! You need Ksh{" "}
                          {formatAmount(escrow.amount - chamaBalance)} more.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                {isRiskShared && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-yellow-700" />
                      <p className="text-sm font-semibold text-yellow-900">
                        Risk-Shared Loan
                      </p>
                    </div>
                    <p className="text-xs text-yellow-800">
                      This loan is co-funded by {escrow.fundedByChamas.length} chama(s).
                      Each chama will fund their portion.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFundDialog(false)}
              disabled={funding}
            >
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleFundEscrow}
              disabled={
                funding ||
                (chamaBalance !== null && escrow && chamaBalance < escrow.amount)
              }
            >
              {funding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Funding...
                </>
              ) : (
                "Fund Escrow"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release Escrow Dialog */}
      <AlertDialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release Escrow Funds</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to release the escrow funds to the borrower? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {escrow && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 my-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Amount to Release:</span>
                  <span className="font-semibold text-gray-900">
                    Ksh {formatAmount(escrow.amount)}
                  </span>
                </div>
                {escrow.releasedToUserId && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Recipient:</span>
                    <span className="font-semibold text-gray-900">Borrower</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={releasing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={handleReleaseEscrow}
              disabled={releasing}
            >
              {releasing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Releasing...
                </>
              ) : (
                "Release Funds"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Escrow Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Escrow Account Details</DialogTitle>
            <DialogDescription>
              Detailed information about the escrow account
            </DialogDescription>
          </DialogHeader>
          {escrow && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Escrow ID</p>
                  <p className="text-sm font-mono text-gray-900">
                    {escrow.id.substring(0, 8)}...
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Status</p>
                  {getStatusBadge(escrow.status)}
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Amount</p>
                  <p className="text-lg font-semibold text-gray-900">
                    Ksh {formatAmount(escrow.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Currency</p>
                  <p className="text-sm font-medium text-gray-900">
                    {escrow.currency || "KES"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Created</p>
                  <p className="text-sm text-gray-900">{formatDate(escrow.createdAt)}</p>
                </div>
                {escrow.releasedAt && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Released</p>
                    <p className="text-sm text-gray-900">
                      {formatDate(escrow.releasedAt)}
                    </p>
                  </div>
                )}
              </div>

              {escrow.fundedByChamas && escrow.fundedByChamas.length > 0 && (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm font-semibold text-gray-900 mb-3">
                    Funding Chamas ({escrow.fundedByChamas.length})
                  </p>
                  <div className="space-y-2">
                    {escrow.fundedByChamas.map((chama, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 border border-gray-200 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {chama.chamaName || `Chama ${chama.chamaId.substring(0, 8)}`}
                            </p>
                            {chama.fundedAt && (
                              <p className="text-xs text-gray-600 mt-1">
                                Funded: {formatDate(chama.fundedAt)}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900">
                              Ksh {formatAmount(chama.amount)}
                            </p>
                            {chama.transactionId && (
                              <p className="text-xs text-gray-500 mt-1 font-mono">
                                {chama.transactionId.substring(0, 8)}...
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-semibold text-blue-900">Total Funded</p>
                        <p className="text-lg font-bold text-blue-900">
                          Ksh {formatAmount(totalFunded)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {escrow.releaseTransactionId && (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-xs text-gray-600 mb-1">Release Transaction ID</p>
                  <p className="text-sm font-mono text-gray-900">
                    {escrow.releaseTransactionId}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

