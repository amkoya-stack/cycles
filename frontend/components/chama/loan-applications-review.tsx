"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Calendar,
  User,
  FileText,
  AlertCircle,
  Eye,
  Percent,
  Shield,
} from "lucide-react";
import { apiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import { EscrowManagement } from "@/components/lending/escrow-management";
import { RiskSharingManagement } from "@/components/lending/risk-sharing-management";

interface LoanApplication {
  id: string;
  applicantId: string;
  applicantName?: string;
  applicantEmail?: string;
  amountRequested: number;
  purpose: string;
  proposedInterestRate?: number;
  proposedRepaymentPeriodMonths: number;
  status: string;
  submittedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  finalInterestRate?: number;
  finalRepaymentPeriodMonths?: number;
  escrowAccountId?: string | null;
  repaymentFrequency?: string;
}

interface LoanApplicationsReviewProps {
  chamaId: string;
  lendingType: "internal" | "external" | "inter-chama";
  userRole?: string;
  onApplicationUpdated?: () => void;
}

// Helper component to show risk sharing badge
function RiskSharingBadge({ applicationId }: { applicationId: string }) {
  const [hasRiskSharing, setHasRiskSharing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRiskSharing = async () => {
      try {
        const accessToken = localStorage.getItem("accessToken");
        if (!accessToken) {
          setLoading(false);
          return;
        }

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
          setHasRiskSharing(data.success && data.data !== null);
        }
      } catch (error) {
        console.error("Failed to fetch risk sharing:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRiskSharing();
  }, [applicationId]);

  if (loading || !hasRiskSharing) return null;

  return (
    <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">
      <Shield className="w-3 h-3 mr-1" />
      Risk Shared
    </Badge>
  );
}

export function LoanApplicationsReview({
  chamaId,
  lendingType,
  userRole,
  onApplicationUpdated,
}: LoanApplicationsReviewProps) {
  const { toast } = useToast();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApplication, setSelectedApplication] =
    useState<LoanApplication | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // Approval form state
  const [finalInterestRate, setFinalInterestRate] = useState<string>("");
  const [finalRepaymentPeriodMonths, setFinalRepaymentPeriodMonths] =
    useState<string>("");
  const [gracePeriodDays, setGracePeriodDays] = useState<string>("7");
  const [repaymentFrequency, setRepaymentFrequency] = useState<string>("monthly");
  const [approvalNotes, setApprovalNotes] = useState("");

  // Rejection form state
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    fetchApplications();
  }, [chamaId, lendingType, statusFilter]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      let endpoint = "";
      if (lendingType === "internal") {
        endpoint = `lending/chama/${chamaId}/applications`;
      } else if (lendingType === "external") {
        endpoint = `lending/external/chama/${chamaId}/applications`;
      } else if (lendingType === "inter-chama") {
        endpoint = `lending/inter-chama/chama/${chamaId}/requests?role=lending`;
      }

      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const response = await fetch(
        apiUrl(`${endpoint}${params.toString() ? `?${params.toString()}` : ""}`),
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const rawApplications = data.data || [];
        
        // Transform backend data to match frontend interface
        const transformedApplications = rawApplications.map((app: any) => {
          // Map external application fields (backend uses borrowerName/borrowerEmail, frontend expects applicantName/applicantEmail)
          if (lendingType === "external") {
            return {
              id: app.id,
              applicantId: app.borrowerId,
              applicantName: app.borrowerName,
              applicantEmail: app.borrowerEmail,
              amountRequested: app.amountRequested,
              purpose: app.purpose,
              proposedInterestRate: app.proposedInterestRate,
              proposedRepaymentPeriodMonths: app.proposedRepaymentPeriodMonths,
              repaymentFrequency: app.repaymentFrequency || "monthly",
              status: app.status?.toLowerCase() || "submitted",
              submittedAt: app.createdAt,
              approvedAt: app.approvedAt,
              rejectedAt: app.rejectedAt,
              rejectionReason: app.rejectionReason,
              finalInterestRate: app.finalInterestRate,
              finalRepaymentPeriodMonths: app.finalRepaymentPeriodMonths,
              escrowAccountId: app.escrowAccountId || null,
            };
          }
          // Internal and inter-chama applications should already match
          return app;
        });
        
        setApplications(transformedApplications);
      } else {
        const error = await response.json();
        console.error("Failed to fetch applications:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to load loan applications",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to fetch applications:", error);
      toast({
        title: "Error",
        description: "Failed to load loan applications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedApplication) return;

    setApproving(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      let endpoint = "";
      const body: any = {};

      if (lendingType === "internal") {
        endpoint = `lending/applications/${selectedApplication.id}/approve`;
        body.finalInterestRate = finalInterestRate
          ? parseFloat(finalInterestRate)
          : selectedApplication.proposedInterestRate;
        body.finalRepaymentPeriodMonths = finalRepaymentPeriodMonths
          ? parseInt(finalRepaymentPeriodMonths)
          : selectedApplication.proposedRepaymentPeriodMonths;
        body.gracePeriodDays = gracePeriodDays
          ? parseInt(gracePeriodDays)
          : 7;
        body.repaymentFrequency = repaymentFrequency;
        if (approvalNotes) body.notes = approvalNotes;
      } else if (lendingType === "external") {
        endpoint = `lending/external/applications/${selectedApplication.id}/approve`;
        body.finalInterestRate = finalInterestRate
          ? parseFloat(finalInterestRate)
          : selectedApplication.proposedInterestRate;
        body.finalRepaymentPeriodMonths = finalRepaymentPeriodMonths
          ? parseInt(finalRepaymentPeriodMonths)
          : selectedApplication.proposedRepaymentPeriodMonths;
        body.repaymentFrequency = repaymentFrequency || selectedApplication.repaymentFrequency || "monthly";
      } else if (lendingType === "inter-chama") {
        // Inter-chama approval handled differently
        endpoint = `lending/inter-chama/requests/${selectedApplication.id}/approve`;
        body.side = "lending";
        body.finalInterestRate = finalInterestRate
          ? parseFloat(finalInterestRate)
          : selectedApplication.proposedInterestRate;
        body.finalRepaymentPeriodMonths = finalRepaymentPeriodMonths
          ? parseInt(finalRepaymentPeriodMonths)
          : selectedApplication.proposedRepaymentPeriodMonths;
      }

      const response = await fetch(apiUrl(endpoint), {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Loan application approved successfully",
        });
        setShowApproveDialog(false);
        setSelectedApplication(null);
        fetchApplications();
        onApplicationUpdated?.();
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to approve application");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve application",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApplication || !rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      });
      return;
    }

    setRejecting(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      let endpoint = "";
      if (lendingType === "internal") {
        endpoint = `lending/applications/${selectedApplication.id}/reject`;
      } else if (lendingType === "external") {
        endpoint = `lending/external/applications/${selectedApplication.id}/reject`;
      } else if (lendingType === "inter-chama") {
        endpoint = `lending/inter-chama/requests/${selectedApplication.id}/reject`;
      }

      const response = await fetch(apiUrl(endpoint), {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Loan application rejected",
        });
        setShowRejectDialog(false);
        setSelectedApplication(null);
        setRejectionReason("");
        fetchApplications();
        onApplicationUpdated?.();
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to reject application");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject application",
        variant: "destructive",
      });
    } finally {
      setRejecting(false);
    }
  };

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

  // Format EMI type for display
  const formatEMIType = (frequency?: string): string => {
    if (!frequency) return "Monthly";
    const freq = frequency.toLowerCase();
    switch (freq) {
      case "daily":
        return "Daily";
      case "weekly":
        return "Weekly";
      case "biweekly":
        return "Biweekly";
      case "monthly":
      default:
        return "Monthly";
    }
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
    if (statusLower === "approved") {
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      );
    } else if (statusLower === "rejected") {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Rejected
        </Badge>
      );
    } else if (statusLower === "pending" || statusLower === "submitted") {
      return (
        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    } else if (statusLower === "escrow_pending") {
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          <DollarSign className="w-3 h-3 mr-1" />
          Escrow Pending
        </Badge>
      );
    } else if (statusLower === "escrow_funded") {
      return (
        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
          <DollarSign className="w-3 h-3 mr-1" />
          Escrow Funded
        </Badge>
      );
    } else if (statusLower === "escrow_released") {
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle className="w-3 h-3 mr-1" />
          Escrow Released
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-gray-100 text-gray-700">
          {status}
        </Badge>
      );
    }
  };

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      !searchQuery ||
      app.applicantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.applicantEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.purpose.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const canManage = userRole === "admin" || userRole === "treasurer";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {lendingType === "internal"
              ? "Internal Loan Applications"
              : lendingType === "external"
              ? "External Loan Applications"
              : "Inter-Chama Loan Requests"}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Review and manage loan applications
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by applicant name, email, or purpose..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                {lendingType === "external" && (
                  <>
                    <SelectItem value="escrow_pending">Escrow Pending</SelectItem>
                    <SelectItem value="escrow_funded">Escrow Funded</SelectItem>
                    <SelectItem value="escrow_released">Escrow Released</SelectItem>
                  </>
                )}
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Applications List */}
      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#083232] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading applications...</p>
          </CardContent>
        </Card>
      ) : filteredApplications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No applications found
            </h3>
            <p className="text-gray-600">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your search or filters"
                : "No loan applications to review at this time"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredApplications.map((application) => (
            <Card key={application.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {application.applicantName || "Unknown Applicant"}
                          </h3>
                          {getStatusBadge(application.status)}
                          {lendingType === "external" && (
                            <RiskSharingBadge applicationId={application.id} />
                          )}
                        </div>
                        {application.applicantEmail && (
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {application.applicantEmail}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Loan Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-start gap-2">
                        <DollarSign className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600">Amount Requested</p>
                          <p className="text-lg font-semibold text-gray-900">
                            Ksh {formatAmount(application.amountRequested)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Percent className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600">Interest Rate</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {application.proposedInterestRate || "N/A"}%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600">Repayment Period</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {application.proposedRepaymentPeriodMonths} months
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* EMI Details */}
                    {application.proposedInterestRate && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                        <div className="flex items-start gap-2">
                          <DollarSign className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-600">EMI Amount</p>
                            <p className="text-lg font-semibold text-gray-900">
                              Ksh {formatAmount(
                                calculateEMI(
                                  application.amountRequested,
                                  application.proposedInterestRate,
                                  application.proposedRepaymentPeriodMonths,
                                  application.repaymentFrequency || "monthly"
                                )
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-600">EMI Type</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {formatEMIType(application.repaymentFrequency)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Purpose */}
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Purpose</p>
                      <p className="text-sm text-gray-900">{application.purpose}</p>
                    </div>

                    {/* Dates */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Submitted: {formatDate(application.submittedAt)}</span>
                      {application.approvedAt && (
                        <span>Approved: {formatDate(application.approvedAt)}</span>
                      )}
                      {application.rejectedAt && (
                        <span>Rejected: {formatDate(application.rejectedAt)}</span>
                      )}
                    </div>

                    {/* Rejection Reason */}
                    {application.rejectionReason && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-red-800 mb-1">
                          Rejection Reason:
                        </p>
                        <p className="text-sm text-red-700">
                          {application.rejectionReason}
                        </p>
                      </div>
                    )}

                    {/* Risk Sharing Management - For all external loans */}
                    {lendingType === "external" && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <RiskSharingManagement
                          applicationId={application.id}
                          chamaId={chamaId}
                          amountRequested={application.amountRequested}
                          onRiskSharingUpdated={fetchApplications}
                          userRole={userRole}
                        />
                      </div>
                    )}

                    {/* Escrow Management - Only for approved external loans */}
                    {lendingType === "external" &&
                      (application.status === "approved" ||
                        application.status === "escrow_pending" ||
                        application.status === "escrow_funded" ||
                        application.status === "escrow_released") && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <EscrowManagement
                            applicationId={application.id}
                            chamaId={chamaId}
                            amountRequested={application.amountRequested}
                            escrowAccountId={application.escrowAccountId}
                            onEscrowUpdated={fetchApplications}
                            userRole={userRole}
                          />
                        </div>
                      )}
                  </div>

                  {/* Actions */}
                  {canManage &&
                    (application.status === "submitted" ||
                      application.status === "pending" ||
                      application.status === "under_review") && (
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => {
                            setSelectedApplication(application);
                            setFinalInterestRate(
                              application.proposedInterestRate?.toString() || ""
                            );
                            setFinalRepaymentPeriodMonths(
                              application.proposedRepaymentPeriodMonths.toString()
                            );
                            setRepaymentFrequency(application.repaymentFrequency || "monthly");
                            setShowApproveDialog(true);
                          }}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedApplication(application);
                            setRejectionReason("");
                            setShowRejectDialog(true);
                          }}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Loan Application</DialogTitle>
            <DialogDescription>
              Review and set final terms for this loan application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Final Interest Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={finalInterestRate}
                onChange={(e) => setFinalInterestRate(e.target.value)}
                placeholder={selectedApplication?.proposedInterestRate?.toString()}
              />
            </div>
            <div>
              <Label>Repayment Period (Months)</Label>
              <Input
                type="number"
                value={finalRepaymentPeriodMonths}
                onChange={(e) => setFinalRepaymentPeriodMonths(e.target.value)}
                placeholder={selectedApplication?.proposedRepaymentPeriodMonths.toString()}
              />
            </div>
            {(lendingType === "internal" || lendingType === "external") && (
              <>
                {lendingType === "internal" && (
                  <div>
                    <Label>Grace Period (Days)</Label>
                    <Input
                      type="number"
                      value={gracePeriodDays}
                      onChange={(e) => setGracePeriodDays(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <Label>EMI Type (Repayment Frequency)</Label>
                  <Select
                    value={repaymentFrequency}
                    onValueChange={setRepaymentFrequency}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Biweekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Add any notes about this approval..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              disabled={approving}
            >
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={approving}
            >
              {approving ? "Approving..." : "Approve Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Loan Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Rejection Reason *</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this application is being rejected..."
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={rejecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejecting || !rejectionReason.trim()}
            >
              {rejecting ? "Rejecting..." : "Reject Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

