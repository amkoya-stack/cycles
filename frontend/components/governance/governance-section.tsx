/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Vote,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  Users,
  FileText,
  AlertCircle,
  Plus,
} from "lucide-react";

interface GovernanceProps {
  chamaId: string;
  userId: string;
  userRole: string;
}

interface Proposal {
  id: string;
  proposal_type: string;
  title: string;
  description: string;
  status: string;
  voting_type: string;
  required_percentage: number;
  anonymous: boolean;
  deadline: string;
  created_at: string;
  creator_name: string;
  votes_for?: number;
  votes_against?: number;
  votes_abstain?: number;
  total_votes_cast?: number;
  percentage_for?: number;
  result?: string;
  discussion_count?: number;
  user_vote?: string;
}

export function GovernanceSection({
  chamaId,
  userId,
  userRole,
}: GovernanceProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [activeProposal, setActiveProposal] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filter, setFilter] = useState<string>("active");
  const [stats, setStats] = useState<any>(null);

  // Create proposal form state
  const [newProposal, setNewProposal] = useState({
    proposalType: "other",
    title: "",
    description: "",
    votingType: "simple_majority",
    anonymous: false,
    allowVoteChange: true,
    deadlineHours: 72,
    metadata: {},
  });

  useEffect(() => {
    fetchProposals();
    fetchStats();
  }, [chamaId, filter]);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const accessToken = localStorage.getItem("accessToken");
      const url = `http://localhost:3001/api/governance/chama/${chamaId}/proposals${
        filter !== "all" ? `?status=${filter}` : ""
      }`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProposals(data);
      }
    } catch (error) {
      console.error("Error fetching proposals:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(
        `http://localhost:3001/api/governance/chama/${chamaId}/stats`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchProposalDetails = async (proposalId: string) => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(
        `http://localhost:3001/api/governance/proposals/${proposalId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setActiveProposal(data);
      }
    } catch (error) {
      console.error("Error fetching proposal:", error);
    }
  };

  const createProposal = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(
        `http://localhost:3001/api/governance/proposals`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chamaId,
            ...newProposal,
          }),
        }
      );

      if (response.ok) {
        setShowCreateForm(false);
        setNewProposal({
          proposalType: "other",
          title: "",
          description: "",
          votingType: "simple_majority",
          anonymous: false,
          allowVoteChange: true,
          deadlineHours: 72,
          metadata: {},
        });
        fetchProposals();
        fetchStats();
      }
    } catch (error) {
      console.error("Error creating proposal:", error);
    }
  };

  const castVote = async (
    proposalId: string,
    vote: "for" | "against" | "abstain",
    reason?: string
  ) => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(
        `http://localhost:3001/api/governance/proposals/${proposalId}/vote`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ vote, reason }),
        }
      );

      if (response.ok) {
        fetchProposals();
        if (activeProposal?.id === proposalId) {
          fetchProposalDetails(proposalId);
        }
      }
    } catch (error) {
      console.error("Error casting vote:", error);
    }
  };

  const closeProposal = async (proposalId: string) => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(
        `http://localhost:3001/api/governance/proposals/${proposalId}/close`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        fetchProposals();
        fetchProposalDetails(proposalId);
      }
    } catch (error) {
      console.error("Error closing proposal:", error);
    }
  };

  const executeProposal = async (proposalId: string) => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(
        `http://localhost:3001/api/governance/proposals/${proposalId}/execute`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        fetchProposals();
        fetchProposalDetails(proposalId);
      }
    } catch (error) {
      console.error("Error executing proposal:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-blue-100 text-blue-800";
      case "passed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "executed":
        return "bg-purple-100 text-purple-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getProposalTypeLabel = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 0) return "Expired";
    if (hours < 24) return `${hours}h remaining`;
    return `${Math.floor(hours / 24)}d remaining`;
  };

  if (showCreateForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#083232]">Create Proposal</h2>
          <Button variant="outline" onClick={() => setShowCreateForm(false)}>
            Cancel
          </Button>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <Label>Proposal Type</Label>
              <Select
                value={newProposal.proposalType}
                onValueChange={(value) =>
                  setNewProposal({ ...newProposal, proposalType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="use_funds">Use Funds</SelectItem>
                  <SelectItem value="accept_member">Accept Member</SelectItem>
                  <SelectItem value="reject_member">Reject Member</SelectItem>
                  <SelectItem value="change_contribution">
                    Change Contribution
                  </SelectItem>
                  <SelectItem value="make_investment">
                    Make Investment
                  </SelectItem>
                  <SelectItem value="expel_member">Expel Member</SelectItem>
                  <SelectItem value="update_constitution">
                    Update Constitution
                  </SelectItem>
                  <SelectItem value="change_role">Change Role</SelectItem>
                  <SelectItem value="approve_loan">Approve Loan</SelectItem>
                  <SelectItem value="dissolve_chama">Dissolve Chama</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Title</Label>
              <Input
                value={newProposal.title}
                onChange={(e) =>
                  setNewProposal({ ...newProposal, title: e.target.value })
                }
                placeholder="Brief title for the proposal"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={newProposal.description}
                onChange={(e) =>
                  setNewProposal({
                    ...newProposal,
                    description: e.target.value,
                  })
                }
                placeholder="Detailed description of the proposal"
                rows={4}
              />
            </div>

            <div>
              <Label>Voting Type</Label>
              <Select
                value={newProposal.votingType}
                onValueChange={(value) =>
                  setNewProposal({ ...newProposal, votingType: value })
                }
              >
                <SelectTrigger>
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
                  <SelectItem value="weighted_by_role">
                    Weighted by Role
                  </SelectItem>
                  <SelectItem value="weighted_by_contribution">
                    Weighted by Contribution
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Voting Deadline (hours)</Label>
              <Input
                type="number"
                value={newProposal.deadlineHours}
                onChange={(e) =>
                  setNewProposal({
                    ...newProposal,
                    deadlineHours: parseInt(e.target.value),
                  })
                }
                min={1}
                max={720}
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newProposal.anonymous}
                  onChange={(e) =>
                    setNewProposal({
                      ...newProposal,
                      anonymous: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                <span className="text-sm">Anonymous voting</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newProposal.allowVoteChange}
                  onChange={(e) =>
                    setNewProposal({
                      ...newProposal,
                      allowVoteChange: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                <span className="text-sm">Allow vote changes</span>
              </label>
            </div>

            <Button
              onClick={createProposal}
              disabled={!newProposal.title || !newProposal.description}
              className="w-full bg-[#083232] hover:bg-[#2e856e]"
            >
              Create Proposal
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (activeProposal) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setActiveProposal(null)}>
            ← Back to Proposals
          </Button>
          <div className="flex gap-2">
            {(userRole === "admin" || userRole === "chairperson") &&
              activeProposal.status === "active" && (
                <Button
                  onClick={() => closeProposal(activeProposal.id)}
                  variant="outline"
                >
                  Close Voting
                </Button>
              )}
            {(userRole === "admin" || userRole === "chairperson") &&
              activeProposal.status === "passed" && (
                <Button
                  onClick={() => executeProposal(activeProposal.id)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Execute Proposal
                </Button>
              )}
          </div>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-[#083232] mb-2">
                  {activeProposal.title}
                </h2>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <span>By {activeProposal.creator_name}</span>
                  <span>•</span>
                  <span>
                    {new Date(activeProposal.created_at).toLocaleDateString()}
                  </span>
                  <span>•</span>
                  <Badge className={getStatusColor(activeProposal.status)}>
                    {activeProposal.status}
                  </Badge>
                  <Badge variant="outline">
                    {getProposalTypeLabel(activeProposal.proposal_type)}
                  </Badge>
                </div>
              </div>
              {activeProposal.status === "active" && (
                <div className="flex items-center gap-2 text-sm text-orange-600">
                  <Clock className="w-4 h-4" />
                  {formatDeadline(activeProposal.deadline)}
                </div>
              )}
            </div>

            <p className="text-gray-700 whitespace-pre-wrap">
              {activeProposal.description}
            </p>

            {/* Voting Results */}
            {activeProposal.total_votes_cast > 0 && (
              <div className="border-t pt-4 space-y-3">
                <h3 className="font-semibold">Voting Results</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ThumbsUp className="w-4 h-4 text-green-600" />
                      <span>For</span>
                    </div>
                    <span className="font-semibold text-green-600">
                      {activeProposal.votes_for} (
                      {activeProposal.percentage_for?.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ThumbsDown className="w-4 h-4 text-red-600" />
                      <span>Against</span>
                    </div>
                    <span className="font-semibold text-red-600">
                      {activeProposal.votes_against} (
                      {activeProposal.percentage_against?.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Abstain</span>
                    <span>{activeProposal.votes_abstain}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Required: {activeProposal.required_percentage}% • Total
                    votes: {activeProposal.total_votes_cast}
                  </div>
                </div>
              </div>
            )}

            {/* Vote Buttons */}
            {activeProposal.status === "active" && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Cast Your Vote</h3>
                {activeProposal.user_vote && (
                  <div className="mb-3 p-3 bg-blue-50 rounded-lg text-sm">
                    You voted: <strong>{activeProposal.user_vote.vote}</strong>
                    {activeProposal.allow_vote_change && (
                      <span className="text-gray-600">
                        {" "}
                        (you can change your vote)
                      </span>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() => castVote(activeProposal.id, "for")}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Vote For
                  </Button>
                  <Button
                    onClick={() => castVote(activeProposal.id, "against")}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    <ThumbsDown className="w-4 h-4 mr-2" />
                    Vote Against
                  </Button>
                  <Button
                    onClick={() => castVote(activeProposal.id, "abstain")}
                    variant="outline"
                    className="flex-1"
                  >
                    Abstain
                  </Button>
                </div>
              </div>
            )}

            {/* Discussions */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Discussion ({activeProposal.discussions?.length || 0})
              </h3>
              <div className="space-y-3">
                {activeProposal.discussions?.map((discussion: any) => (
                  <div
                    key={discussion.id}
                    className="p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm">
                        {discussion.full_name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(discussion.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">
                      {discussion.comment}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-2">
          <Card className="p-3">
            <div className="text-center">
              <Vote className="w-4 h-4 text-blue-600 mx-auto mb-1" />
              <p className="text-[10px] text-gray-600">Total</p>
              <p className="text-lg font-bold">{stats.total_proposals}</p>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <CheckCircle className="w-4 h-4 text-green-600 mx-auto mb-1" />
              <p className="text-[10px] text-gray-600">Passed</p>
              <p className="text-lg font-bold">{stats.passed_proposals}</p>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <XCircle className="w-4 h-4 text-red-600 mx-auto mb-1" />
              <p className="text-[10px] text-gray-600">Failed</p>
              <p className="text-lg font-bold">{stats.failed_proposals}</p>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <TrendingUp className="w-4 h-4 text-purple-600 mx-auto mb-1" />
              <p className="text-[10px] text-gray-600">Success</p>
              <p className="text-lg font-bold">{stats.success_rate || 0}%</p>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Filter proposals" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          side="bottom"
          align="start"
          sideOffset={5}
        >
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="passed">Passed</SelectItem>
          <SelectItem value="executed">Executed</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
        </SelectContent>
      </Select>

      {/* Proposals List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#083232]"></div>
        </div>
      ) : proposals.length === 0 ? (
        <Card className="p-12 text-center">
          <Vote className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Proposals Yet
          </h3>
          <p className="text-gray-600 mb-4">
            Create the first proposal to start democratic decision-making
          </p>
          <Button
            onClick={() => setShowCreateForm(true)}
            className="bg-[#083232] hover:bg-[#2e856e]"
          >
            Create Proposal
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <Card
              key={proposal.id}
              className="p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => fetchProposalDetails(proposal.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#083232] mb-2">
                    {proposal.title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>By {proposal.creator_name}</span>
                    <span>•</span>
                    <span>
                      {new Date(proposal.created_at).toLocaleDateString()}
                    </span>
                    <span>•</span>
                    <Badge className={getStatusColor(proposal.status)}>
                      {proposal.status}
                    </Badge>
                    <Badge variant="outline">
                      {getProposalTypeLabel(proposal.proposal_type)}
                    </Badge>
                  </div>
                </div>
                {proposal.status === "active" && (
                  <div className="flex items-center gap-2 text-sm text-orange-600">
                    <Clock className="w-4 h-4" />
                    {formatDeadline(proposal.deadline)}
                  </div>
                )}
              </div>

              <p className="text-gray-700 mb-4 line-clamp-2">
                {proposal.description}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  {proposal.total_votes_cast !== undefined &&
                    proposal.total_votes_cast > 0 && (
                      <>
                        <div className="flex items-center gap-1 text-green-600">
                          <ThumbsUp className="w-4 h-4" />
                          {proposal.votes_for}
                        </div>
                        <div className="flex items-center gap-1 text-red-600">
                          <ThumbsDown className="w-4 h-4" />
                          {proposal.votes_against}
                        </div>
                      </>
                    )}
                  <div className="flex items-center gap-1 text-gray-600">
                    <MessageSquare className="w-4 h-4" />
                    {proposal.discussion_count || 0}
                  </div>
                </div>
                {proposal.user_vote && (
                  <Badge variant="outline" className="text-xs">
                    You voted: {proposal.user_vote}
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
