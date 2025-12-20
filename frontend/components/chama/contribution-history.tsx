"use client";

import { useState, useEffect } from "react";
import {
  contributionApi,
  ContributionHistoryQuery,
} from "@/lib/contribution-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  Wallet,
  Smartphone,
} from "lucide-react";
import { format } from "date-fns";

interface ContributionHistoryProps {
  chamaId?: string;
  cycleId?: string;
}

interface Contribution {
  id: string;
  amount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  cycleId: string;
  cycleName?: string;
  notes?: string;
  externalReference: string;
}

export function ContributionHistory({
  chamaId: propChamaId,
  cycleId: propCycleId,
}: ContributionHistoryProps) {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedChamaId, setSelectedChamaId] = useState<string>(
    propChamaId || "all"
  );
  const [selectedCycleId, setSelectedCycleId] = useState<string>(
    propCycleId || "all"
  );
  const [chamas, setChamas] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!propChamaId) {
      fetchUserChamas();
    }
  }, [propChamaId]);

  useEffect(() => {
    if (selectedChamaId && selectedChamaId !== "all") {
      fetchChamaCycles(selectedChamaId);
    } else {
      setCycles([]);
      setSelectedCycleId("all");
    }
  }, [selectedChamaId]);

  useEffect(() => {
    loadContributions();
  }, [
    propChamaId,
    propCycleId,
    selectedChamaId,
    selectedCycleId,
    statusFilter,
    page,
  ]);

  const fetchUserChamas = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const res = await fetch("http://localhost:3001/api/chama/user/chamas", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        setChamas(data);
      }
    } catch (error) {
      console.error("Failed to fetch chamas:", error);
    }
  };

  const fetchChamaCycles = async (chamaId: string) => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const res = await fetch(
        `http://localhost:3001/api/chama/${chamaId}/cycles`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (res.ok) {
        const data = await res.json();
        setCycles(data);
      }
    } catch (error) {
      console.error("Failed to fetch cycles:", error);
    }
  };

  const loadContributions = async () => {
    try {
      setLoading(true);

      // Check if user is authenticated
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        console.warn("Not authenticated, skipping contribution fetch");
        setContributions([]);
        setTotalPages(0);
        setLoading(false);
        return;
      }

      const query: ContributionHistoryQuery = {
        chamaId: selectedChamaId === "all" ? undefined : selectedChamaId,
        cycleId: selectedCycleId === "all" ? undefined : selectedCycleId,
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
        limit: 10,
      };

      const response = await contributionApi.getContributionHistory(query);

      // Handle empty or invalid response
      if (!response || typeof response !== "object") {
        console.warn("Invalid response from contribution API:", response);
        setContributions([]);
        setTotalPages(0);
        return;
      }

      setContributions(response.contributions || []);
      setTotalPages(Math.ceil((response.total || 0) / 10));
    } catch (error) {
      console.error("Failed to load contributions:", error);
      // Show user-friendly error
      setContributions([]);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      // TODO: Implement CSV export
      const csv = generateCSV(contributions);
      downloadCSV(csv, `contributions-${Date.now()}.csv`);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExporting(false);
    }
  };

  const generateCSV = (data: Contribution[]) => {
    const headers = [
      "Date",
      "Amount",
      "Payment Method",
      "Status",
      "Reference",
      "Notes",
    ];
    const rows = data.map((c) => [
      format(new Date(c.createdAt), "yyyy-MM-dd HH:mm:ss"),
      c.amount.toString(),
      c.paymentMethod,
      c.status,
      c.externalReference,
      c.notes || "",
    ]);
    return [headers, ...rows].map((row) => row.join(",")).join("\n");
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-[#2e856e]" />;
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-[#f64d52]" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      completed: "bg-[#2e856e]/10 text-[#2e856e] border-[#2e856e]/20",
      pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
      failed: "bg-[#f64d52]/10 text-[#f64d52] border-[#f64d52]/20",
    };
    return (
      <Badge
        className={variants[status] || "bg-gray-100 text-gray-700"}
        variant="outline"
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPaymentMethodIcon = (method: string) => {
    if (method === "wallet") {
      return <Wallet className="h-4 w-4 text-[#083232]" />;
    }
    return <Smartphone className="h-4 w-4 text-[#2e856e]" />;
  };

  const filteredContributions = contributions.filter((c) =>
    searchTerm
      ? c.externalReference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl text-[#083232] mb-4">
          Contribution History
        </CardTitle>
        <div className="flex flex-col gap-3">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by reference or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {!propChamaId && (
              <>
                <Select
                  value={selectedChamaId}
                  onValueChange={setSelectedChamaId}
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="All Chamas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Chamas</SelectItem>
                    {chamas.map((chama) => (
                      <SelectItem key={chama.id} value={chama.id}>
                        {chama.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedChamaId !== "all" && cycles.length > 0 && (
                  <Select
                    value={selectedCycleId}
                    onValueChange={setSelectedCycleId}
                  >
                    <SelectTrigger className="w-full sm:w-[140px]">
                      <SelectValue placeholder="All Cycles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cycles</SelectItem>
                      {cycles.map((cycle) => (
                        <SelectItem key={cycle.id} value={cycle.id}>
                          Cycle #{cycle.cycle_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </>
            )}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting || contributions.length === 0}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#083232]" />
          </div>
        ) : filteredContributions.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600">No contributions found</p>
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="space-y-3 md:hidden">
              {filteredContributions.map((contribution) => (
                <div
                  key={contribution.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(contribution.status)}
                      <span className="font-bold text-lg text-[#083232]">
                        KES {contribution.amount.toLocaleString()}
                      </span>
                    </div>
                    {getStatusBadge(contribution.status)}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      {getPaymentMethodIcon(contribution.paymentMethod)}
                      <span className="capitalize">
                        {contribution.paymentMethod.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(
                          new Date(contribution.createdAt),
                          "MMM d, yyyy h:mm a"
                        )}
                      </span>
                    </div>
                    {contribution.notes && (
                      <p className="text-gray-600 italic">
                        {contribution.notes}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 font-mono">
                      {contribution.externalReference}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-[#083232]">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#083232]">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#083232]">
                      Method
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#083232]">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#083232]">
                      Reference
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#083232]">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContributions.map((contribution) => (
                    <tr
                      key={contribution.id}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 text-sm">
                        {format(
                          new Date(contribution.createdAt),
                          "MMM d, yyyy"
                        )}
                        <br />
                        <span className="text-xs text-gray-500">
                          {format(new Date(contribution.createdAt), "h:mm a")}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#083232]">
                        KES {contribution.amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-sm">
                          {getPaymentMethodIcon(contribution.paymentMethod)}
                          <span className="capitalize">
                            {contribution.paymentMethod.replace("_", " ")}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(contribution.status)}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500 font-mono">
                        {contribution.externalReference.substring(0, 12)}...
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {contribution.notes || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
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
  );
}
