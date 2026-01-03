"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, MessageSquare, Vote, FileText, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";

interface Dispute {
  id: string;
  title: string;
  disputeType: string;
  status: string;
  priority: string;
  amountDisputed?: number;
  evidenceCount: number;
  commentCount: number;
  voteCount: number;
  votesFor: number;
  votesAgainst: number;
  createdAt: string;
  filedByName?: string;
  filedAgainstName?: string;
  votingDeadline?: string;
  discussionDeadline?: string;
}

interface DisputeListProps {
  chamaId: string;
  showActions?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  filed: "bg-gray-500",
  under_review: "bg-blue-500",
  discussion: "bg-yellow-500",
  voting: "bg-purple-500",
  resolved: "bg-green-500",
  escalated: "bg-red-500",
  closed: "bg-gray-400",
  dismissed: "bg-gray-300",
};

const DISPUTE_TYPE_LABELS: Record<string, string> = {
  payment_dispute: "Payment",
  payout_dispute: "Payout",
  membership_dispute: "Membership",
  loan_default: "Loan Default",
  rule_violation: "Rule Violation",
};

export function DisputeList({ chamaId, showActions = true }: DisputeListProps) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const router = useRouter();

  useEffect(() => {
    fetchDisputes();
  }, [chamaId, statusFilter]);

  const fetchDisputes = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const url = new URL(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/disputes/chama/${chamaId}`
      );
      if (statusFilter !== "all") {
        url.searchParams.append("status", statusFilter);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDisputes(data);
      }
    } catch (error) {
      console.error("Failed to fetch disputes:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const color = STATUS_COLORS[status] || "bg-gray-500";
    return (
      <Badge className={color} variant="default">
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "high":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading disputes...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Disputes</CardTitle>
            <CardDescription>
              Manage and track disputes in your chama
            </CardDescription>
          </div>
          {showActions && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="filed">Filed</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="discussion">Discussion</SelectItem>
                <SelectItem value="voting">Voting</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {disputes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No disputes found
          </div>
        ) : (
          <div className="space-y-4">
            {disputes.map((dispute) => (
              <Card
                key={dispute.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => router.push(`/disputes/${dispute.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{dispute.title}</h3>
                        {getPriorityIcon(dispute.priority)}
                        {getStatusBadge(dispute.status)}
                        <Badge variant="outline">
                          {DISPUTE_TYPE_LABELS[dispute.disputeType] ||
                            dispute.disputeType}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {dispute.filedByName && (
                          <span>
                            Filed by: <strong>{dispute.filedByName}</strong>
                          </span>
                        )}
                        {dispute.filedAgainstName && (
                          <span>
                            Against: <strong>{dispute.filedAgainstName}</strong>
                          </span>
                        )}
                        {dispute.amountDisputed && (
                          <span>
                            Amount:{" "}
                            <strong>
                              KSh{" "}
                              {dispute.amountDisputed.toLocaleString("en-KE")}
                            </strong>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          <span>{dispute.evidenceCount} evidence</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          <span>{dispute.commentCount} comments</span>
                        </div>
                        {dispute.status === "voting" && (
                          <div className="flex items-center gap-1">
                            <Vote className="h-4 w-4" />
                            <span>
                              {dispute.votesFor} for / {dispute.votesAgainst}{" "}
                              against
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>
                            {formatDistanceToNow(new Date(dispute.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>

                      {dispute.votingDeadline && (
                        <div className="text-sm text-orange-600">
                          Voting deadline:{" "}
                          {new Date(dispute.votingDeadline).toLocaleString()}
                        </div>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/disputes/${dispute.id}`);
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

