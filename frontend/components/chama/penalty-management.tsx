"use client";

import { useState, useEffect } from "react";
import {
  contributionApi,
  PenaltyWaiverDto,
  VotePenaltyWaiverDto,
} from "@/lib/contribution-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Calendar,
  Users,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";

interface PenaltyManagementProps {
  chamaId: string;
}

interface Penalty {
  id: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
  cycleId: string;
  waiverId?: string;
  waiverStatus?: string;
  waiverReason?: string;
  waiverVotes?: {
    approve: number;
    reject: number;
    required: number;
  };
}

export function PenaltyManagement({ chamaId }: PenaltyManagementProps) {
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [waiverDialogOpen, setWaiverDialogOpen] = useState(false);
  const [selectedPenalty, setSelectedPenalty] = useState<Penalty | null>(null);
  const [waiverReason, setWaiverReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPenalties();
  }, [chamaId]);

  const loadPenalties = async () => {
    try {
      setLoading(true);
      const data = await contributionApi.getMemberPenalties(chamaId);
      setPenalties(data.penalties);
    } catch (error) {
      console.error("Failed to load penalties:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestWaiver = async () => {
    if (!selectedPenalty || !waiverReason.trim()) {
      setError("Please provide a reason for the waiver request");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const dto: PenaltyWaiverDto = {
        penaltyId: selectedPenalty.id,
        reason: waiverReason,
      };

      await contributionApi.requestPenaltyWaiver(dto);
      setWaiverDialogOpen(false);
      setWaiverReason("");
      setSelectedPenalty(null);
      loadPenalties();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to request waiver");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (waiverId: string, approve: boolean) => {
    try {
      const dto: VotePenaltyWaiverDto = {
        waiverId,
        approve,
      };

      await contributionApi.votePenaltyWaiver(dto);
      loadPenalties();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to submit vote");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
      paid: "bg-[#2e856e]/10 text-[#2e856e] border-[#2e856e]/20",
      waived: "bg-blue-50 text-blue-700 border-blue-200",
      partial: "bg-orange-50 text-orange-700 border-orange-200",
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

  const getWaiverStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
      approved: "bg-[#2e856e]/10 text-[#2e856e] border-[#2e856e]/20",
      rejected: "bg-[#f64d52]/10 text-[#f64d52] border-[#f64d52]/20",
    };
    return (
      <Badge
        className={`${variants[status] || "bg-gray-100 text-gray-700"} text-xs`}
        variant="outline"
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const activePenalties = penalties.filter((p) => p.status === "pending");
  const totalPending = activePenalties.reduce((sum, p) => sum + p.amount, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl text-[#083232]">Penalties</CardTitle>
          {totalPending > 0 && (
            <Badge
              className="bg-[#f64d52]/10 text-[#f64d52] border-[#f64d52]/20"
              variant="outline"
            >
              KES {totalPending.toLocaleString()} Outstanding
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#083232]" />
          </div>
        ) : penalties.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 mx-auto text-[#2e856e] mb-4" />
            <p className="text-gray-600 font-medium">No penalties</p>
            <p className="text-sm text-gray-500 mt-1">Keep up the good work!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {penalties.map((penalty) => (
              <div
                key={penalty.id}
                className="border rounded-lg p-4 space-y-3 hover:border-[#083232]/20 transition-colors"
              >
                {/* Penalty Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="h-5 w-5 text-[#f64d52]" />
                      <span className="font-bold text-lg text-[#083232]">
                        KES {penalty.amount.toLocaleString()}
                      </span>
                      {getStatusBadge(penalty.status)}
                    </div>
                    <p className="text-sm text-gray-600">{penalty.reason}</p>
                  </div>
                </div>

                {/* Penalty Details */}
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(new Date(penalty.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>

                {/* Waiver Status */}
                {penalty.waiverId && (
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">
                          Waiver Request
                        </span>
                      </div>
                      {getWaiverStatusBadge(penalty.waiverStatus || "pending")}
                    </div>
                    {penalty.waiverReason && (
                      <p className="text-sm text-gray-600 italic">
                        "{penalty.waiverReason}"
                      </p>
                    )}
                    {penalty.waiverVotes &&
                      penalty.waiverStatus === "pending" && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4 text-[#2e856e]" />
                              <span className="text-[#2e856e] font-medium">
                                {penalty.waiverVotes.approve} Approve
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4 text-[#f64d52]" />
                              <span className="text-[#f64d52] font-medium">
                                {penalty.waiverVotes.reject} Reject
                              </span>
                            </div>
                            <span className="text-gray-500">
                              ({penalty.waiverVotes.required} required)
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                handleVote(penalty.waiverId!, true)
                              }
                              className="bg-[#2e856e] hover:bg-[#2e856e]/90 flex-1"
                            >
                              <ThumbsUp className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleVote(penalty.waiverId!, false)
                              }
                              className="border-[#f64d52] text-[#f64d52] hover:bg-[#f64d52]/10 flex-1"
                            >
                              <ThumbsDown className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      )}
                  </div>
                )}

                {/* Request Waiver Button */}
                {penalty.status === "pending" && !penalty.waiverId && (
                  <Dialog
                    open={waiverDialogOpen}
                    onOpenChange={setWaiverDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setSelectedPenalty(penalty)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Request Waiver
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Request Penalty Waiver</DialogTitle>
                        <DialogDescription>
                          Explain why this penalty should be waived. Other
                          members will vote on your request.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="waiverReason">
                            Reason for Waiver
                          </Label>
                          <Textarea
                            id="waiverReason"
                            value={waiverReason}
                            onChange={(e) => setWaiverReason(e.target.value)}
                            placeholder="Explain your situation..."
                            className="min-h-32 mt-2"
                            disabled={submitting}
                          />
                        </div>

                        {error && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                          </Alert>
                        )}

                        <div className="flex gap-3">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setWaiverDialogOpen(false);
                              setWaiverReason("");
                              setSelectedPenalty(null);
                            }}
                            disabled={submitting}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleRequestWaiver}
                            disabled={submitting || !waiverReason.trim()}
                            className="bg-[#083232] hover:bg-[#2e856e] flex-1"
                          >
                            {submitting ? "Submitting..." : "Submit Request"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
