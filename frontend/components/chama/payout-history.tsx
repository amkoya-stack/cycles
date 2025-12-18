"use client";

import { useState, useEffect } from "react";
import {
  payoutApi,
  Payout,
  PayoutHistoryQuery,
  PayoutHistoryResponse,
} from "@/lib/rotation-payout-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  History,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
} from "lucide-react";

interface PayoutHistoryProps {
  chamaId: string;
}

export function PayoutHistory({ chamaId }: PayoutHistoryProps) {
  const { toast } = useToast();
  const [history, setHistory] = useState<PayoutHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  useEffect(() => {
    loadPayoutHistory();
  }, [chamaId, page, statusFilter]);

  const loadPayoutHistory = async () => {
    try {
      setLoading(true);
      const filters: PayoutHistoryQuery = {
        chamaId,
        page,
        limit: 10,
      };

      if (statusFilter !== "all") {
        filters.status = statusFilter;
      }

      const data = await payoutApi.getPayoutHistory(filters);
      setHistory(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load payout history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (payout: Payout) => {
    setSelectedPayout(payout);
    setShowDetailsDialog(true);
  };

  const handleExportCSV = () => {
    if (!history?.payouts) return;

    const headers = [
      "Date",
      "Cycle",
      "Recipient",
      "Amount",
      "Status",
      "Transaction ID",
    ];
    const rows = history.payouts.map((p) => [
      new Date(p.scheduledAt).toLocaleDateString(),
      `Cycle ${p.cycleNumber}`,
      p.recipientName,
      `KES ${p.amount.toLocaleString()}`,
      p.status,
      p.transactionId || "N/A",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payout-history-${chamaId}-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Payout history exported successfully",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      { color: string; icon: React.ReactNode; label: string }
    > = {
      completed: {
        color: "bg-green-100 text-green-800",
        icon: <CheckCircle className="h-3 w-3" />,
        label: "Completed",
      },
      pending: {
        color: "bg-yellow-100 text-yellow-800",
        icon: <Clock className="h-3 w-3" />,
        label: "Pending",
      },
      processing: {
        color: "bg-blue-100 text-blue-800",
        icon: <Clock className="h-3 w-3" />,
        label: "Processing",
      },
      failed: {
        color: "bg-red-100 text-red-800",
        icon: <XCircle className="h-3 w-3" />,
        label: "Failed",
      },
      cancelled: {
        color: "bg-gray-100 text-gray-800",
        icon: <Ban className="h-3 w-3" />,
        label: "Cancelled",
      },
    };
    const variant = variants[status] || variants.pending;
    return (
      <Badge className={`${variant.color} flex items-center gap-1`}>
        {variant.icon}
        {variant.label}
      </Badge>
    );
  };

  if (loading && !history) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#083232]"></div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <Card className="w-full">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-[#083232]" />
              Payout History
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleExportCSV}
                variant="outline"
                size="sm"
                disabled={!history?.payouts.length}
                className="border-[#083232] text-[#083232]"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {history?.payouts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No payout history found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Cycle</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history?.payouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell className="text-sm">
                          {new Date(payout.scheduledAt).toLocaleDateString(
                            "en-GB",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          Cycle {payout.cycleNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {payout.recipientName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {payout.recipientPhone}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-[#083232]">
                          KES {payout.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>{getStatusBadge(payout.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            onClick={() => handleViewDetails(payout)}
                            variant="ghost"
                            size="sm"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {history?.payouts.map((payout) => (
                  <Card key={payout.id} className="border-gray-200">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {payout.recipientName}
                          </p>
                          <p className="text-xs text-gray-500">
                            Cycle {payout.cycleNumber} •{" "}
                            {new Date(payout.scheduledAt).toLocaleDateString()}
                          </p>
                        </div>
                        {getStatusBadge(payout.status)}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-bold text-[#083232]">
                          KES {payout.amount.toLocaleString()}
                        </p>
                        <Button
                          onClick={() => handleViewDetails(payout)}
                          variant="outline"
                          size="sm"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {history && history.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    Page {history.pagination.page} of{" "}
                    {history.pagination.totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      variant="outline"
                      size="sm"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() =>
                        setPage((p) =>
                          Math.min(history.pagination.totalPages, p + 1)
                        )
                      }
                      disabled={page === history.pagination.totalPages}
                      variant="outline"
                      size="sm"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Payout Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payout Details</DialogTitle>
            <DialogDescription>
              Complete information about this payout transaction
            </DialogDescription>
          </DialogHeader>

          {selectedPayout && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Recipient</p>
                  <p className="text-sm font-medium">
                    {selectedPayout.recipientName}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  {getStatusBadge(selectedPayout.status)}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Amount</p>
                  <p className="text-sm font-semibold text-[#083232]">
                    KES {selectedPayout.amount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Cycle</p>
                  <p className="text-sm font-medium">
                    Cycle {selectedPayout.cycleNumber}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Scheduled Date</p>
                  <p className="text-sm">
                    {new Date(selectedPayout.scheduledAt).toLocaleDateString()}
                  </p>
                </div>
                {selectedPayout.executedAt && (
                  <div>
                    <p className="text-xs text-gray-500">Executed Date</p>
                    <p className="text-sm">
                      {new Date(selectedPayout.executedAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {selectedPayout.transactionId && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Transaction ID</p>
                  <p className="text-xs font-mono bg-gray-100 p-2 rounded break-all">
                    {selectedPayout.transactionId}
                  </p>
                </div>
              )}

              {selectedPayout.failedReason && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-xs font-medium text-red-800 mb-1">
                    Failure Reason:
                  </p>
                  <p className="text-xs text-red-700">
                    {selectedPayout.failedReason}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
