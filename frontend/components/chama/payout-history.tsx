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
      {/* Filters */}
      <div className="flex items-center justify-between gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
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
          className="border-[#083232] text-[#083232] hover:bg-[#083232] hover:text-white"
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* History List */}
      {history?.payouts.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <History className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No payout history found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history?.payouts.map((payout) => (
            <div
              key={payout.id}
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-lg text-gray-900">
                      {payout.recipientName}
                    </h4>
                    {getStatusBadge(payout.status)}
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>Cycle {payout.cycleNumber}</p>
                    <p>
                      {new Date(payout.scheduledAt).toLocaleDateString(
                        "en-GB",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </p>
                    {payout.transactionId && (
                      <p className="text-xs text-gray-500">
                        TX: {payout.transactionId}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#083232]">
                    KES {payout.amount.toLocaleString()}
                  </p>
                  <Button
                    onClick={() => handleViewDetails(payout)}
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-[#2e856e] hover:text-[#083232]"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Details
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {history && history.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-gray-600">
            Page {history.pagination.page} of {history.pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              variant="outline"
              size="sm"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= history.pagination.totalPages}
              variant="outline"
              size="sm"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Details Dialog */}
      {selectedPayout && (
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Payout Details</DialogTitle>
              <DialogDescription>
                Cycle {selectedPayout.cycleNumber} Payout
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Recipient</p>
                <p className="font-semibold">{selectedPayout.recipientName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Amount</p>
                <p className="text-2xl font-bold text-[#083232]">
                  KES {selectedPayout.amount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                {getStatusBadge(selectedPayout.status)}
              </div>
              <div>
                <p className="text-sm text-gray-500">Scheduled Date</p>
                <p>{new Date(selectedPayout.scheduledAt).toLocaleString()}</p>
              </div>
              {selectedPayout.executedAt && (
                <div>
                  <p className="text-sm text-gray-500">Processed Date</p>
                  <p>{new Date(selectedPayout.executedAt).toLocaleString()}</p>
                </div>
              )}
              {selectedPayout.transactionId && (
                <div>
                  <p className="text-sm text-gray-500">Transaction ID</p>
                  <p className="font-mono text-sm">
                    {selectedPayout.transactionId}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
