"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  MessageSquare,
  Vote,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Upload,
  Send,
  AlertTriangle,
  Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { FileDisputeForm } from "./file-dispute-form";

interface DisputeDetailProps {
  disputeId: string;
  chamaId: string;
  userRole?: string;
}

export function DisputeDetail({
  disputeId,
  chamaId,
  userRole,
}: DisputeDetailProps) {
  const [dispute, setDispute] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [voteType, setVoteType] = useState<"for" | "against" | "abstain">("for");
  const [hasVoted, setHasVoted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchDisputeDetails();
  }, [disputeId]);

  const fetchDisputeDetails = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const [disputeRes, commentsRes, votesRes, evidenceRes] = await Promise.all([
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/disputes/${disputeId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        ),
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/disputes/${disputeId}/comments`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        ),
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/disputes/${disputeId}/votes`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        ),
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/disputes/${disputeId}/evidence`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        ),
      ]);

      if (disputeRes.ok) {
        const disputeData = await disputeRes.json();
        setDispute(disputeData);
      }

      if (commentsRes.ok) {
        const commentsData = await commentsRes.json();
        setComments(commentsData);
      }

      if (votesRes.ok) {
        const votesData = await votesRes.json();
        setVotes(votesData);
        // Check if current user has voted
        const userId = localStorage.getItem("userId");
        setHasVoted(votesData.some((v: any) => v.userId === userId));
      }

      if (evidenceRes.ok) {
        const evidenceData = await evidenceRes.json();
        setEvidence(evidenceData);
      }
    } catch (error) {
      console.error("Failed to fetch dispute details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/disputes/${disputeId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: newComment }),
        }
      );

      if (response.ok) {
        setNewComment("");
        fetchDisputeDetails();
        toast({
          title: "Comment added",
          description: "Your comment has been added to the discussion.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add comment",
        variant: "destructive",
      });
    }
  };

  const handleCastVote = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/disputes/${disputeId}/votes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ voteType }),
        }
      );

      if (response.ok) {
        fetchDisputeDetails();
        toast({
          title: "Vote cast",
          description: "Your vote has been recorded.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to cast vote",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading dispute details...</div>;
  }

  if (!dispute) {
    return <div className="text-center py-8">Dispute not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Dispute Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {dispute.title}
                <Badge>{dispute.disputeType.replace("_", " ")}</Badge>
                <Badge variant={dispute.status === "resolved" ? "default" : "secondary"}>
                  {dispute.status}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-2">
                {dispute.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Filed By</div>
              <div className="font-medium">{dispute.filedByName || "Unknown"}</div>
            </div>
            {dispute.filedAgainstName && (
              <div>
                <div className="text-muted-foreground">Filed Against</div>
                <div className="font-medium">{dispute.filedAgainstName}</div>
              </div>
            )}
            {dispute.amountDisputed && (
              <div>
                <div className="text-muted-foreground">Amount</div>
                <div className="font-medium">
                  KSh {dispute.amountDisputed.toLocaleString("en-KE")}
                </div>
              </div>
            )}
            <div>
              <div className="text-muted-foreground">Priority</div>
              <div className="font-medium capitalize">{dispute.priority}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evidence Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Evidence ({evidence.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {evidence.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No evidence submitted yet
            </div>
          ) : (
            <div className="space-y-2">
              {evidence.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 border rounded"
                >
                  <div>
                    <div className="font-medium">{item.title}</div>
                    {item.description && (
                      <div className="text-sm text-muted-foreground">
                        {item.description}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      Submitted by {item.submittedByName} •{" "}
                      {formatDistanceToNow(new Date(item.createdAt), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                  {item.fileUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={item.fileUrl} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discussion/Comments Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Discussion ({comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {comments.map((comment: any) => (
              <div key={comment.id} className="border-l-2 pl-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{comment.userName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <p className="text-sm">{comment.content}</p>
              </div>
            ))}
          </div>

          {dispute.status === "discussion" || dispute.status === "under_review" ? (
            <div className="space-y-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={3}
              />
              <Button onClick={handleAddComment} size="sm">
                <Send className="mr-2 h-4 w-4" />
                Add Comment
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Comments are only allowed during discussion phase
            </div>
          )}
        </CardContent>
      </Card>

      {/* Voting Section */}
      {dispute.status === "voting" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Vote className="h-5 w-5" />
              Voting ({dispute.voteCount} votes)
            </CardTitle>
            <CardDescription>
              {dispute.votesFor} for • {dispute.votesAgainst} against •{" "}
              {dispute.votesAbstain} abstain
              {dispute.requiredVotes && (
                <span> • {dispute.requiredVotes} required</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasVoted ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Your Vote</Label>
                  <Select
                    value={voteType}
                    onValueChange={(value: any) => setVoteType(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="for">For</SelectItem>
                      <SelectItem value="against">Against</SelectItem>
                      <SelectItem value="abstain">Abstain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCastVote}>Cast Vote</Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                You have already voted
              </div>
            )}

            {votes.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="font-medium">Votes:</div>
                {votes.map((vote: any) => (
                  <div
                    key={vote.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{vote.userName}</span>
                    <Badge variant="outline">{vote.voteType}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Admin Actions */}
      {(userRole === "admin" || userRole === "treasurer") && (
        <Card>
          <CardHeader>
            <CardTitle>Admin Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dispute.status === "under_review" && (
              <Button
                variant="outline"
                onClick={async () => {
                  // Start discussion phase
                  const token = localStorage.getItem("token");
                  const deadline = new Date();
                  deadline.setDate(deadline.getDate() + 7); // 7 days from now

                  await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/disputes/${disputeId}/start-discussion`,
                    {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({
                        discussionDeadline: deadline.toISOString(),
                      }),
                    }
                  );
                  fetchDisputeDetails();
                }}
              >
                Start Discussion Phase
              </Button>
            )}

            {dispute.status === "discussion" && (
              <Button
                variant="outline"
                onClick={async () => {
                  // Start voting phase
                  const token = localStorage.getItem("token");
                  const deadline = new Date();
                  deadline.setDate(deadline.getDate() + 3); // 3 days from now

                  await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/disputes/${disputeId}/start-voting`,
                    {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({
                        votingDeadline: deadline.toISOString(),
                      }),
                    }
                  );
                  fetchDisputeDetails();
                }}
              >
                Start Voting Phase
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

