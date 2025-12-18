"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Badge as ReputationBadge } from "@/components/reputation/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Users,
  Search,
  Filter,
  MoreVertical,
  Crown,
  Calculator,
  FileText,
  User,
  UserMinus,
  Settings,
  Activity,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Star,
  AlertTriangle,
  UserCheck,
  UserX,
  Clock,
  Trophy,
  RefreshCw,
} from "lucide-react";

interface Member {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  role: "admin" | "chairperson" | "treasurer" | "secretary" | "member";
  status: "active" | "inactive" | "suspended";
  joined_at: string;
  activity_score: number;
  warnings_count: number;
  total_contributions: number;
  missed_contributions: number;
  contribution_rate: number;
  last_activity_at?: string;
  profile_picture?: string;
  location?: string;
  reputation?: {
    totalScore: number;
    tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
    contributionConsistencyRate: number;
    contributionStreakMonths: number;
  };
}

interface JoinRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_phone: string;
  requested_at: string;
  status: string;
}

interface MemberDirectoryProps {
  chamaId: string;
  userRole: string | null;
  currentUserId: string | null;
}

const ROLE_CONFIG = {
  admin: {
    label: "Admin",
    icon: Crown,
    color: "bg-purple-100 text-purple-800 border-purple-200",
    description: "Full control over chama operations",
  },
  chairperson: {
    label: "Chairperson",
    icon: Crown,
    color: "bg-purple-100 text-purple-800 border-purple-200",
    description: "Full control over chama operations",
  },
  treasurer: {
    label: "Treasurer",
    icon: Calculator,
    color: "bg-green-100 text-green-800 border-green-200",
    description: "Manages finances and transactions",
  },
  secretary: {
    label: "Secretary",
    icon: FileText,
    color: "bg-blue-100 text-blue-800 border-blue-200",
    description: "Handles documentation and communication",
  },
  member: {
    label: "Member",
    icon: User,
    color: "bg-gray-100 text-gray-800 border-gray-200",
    description: "Regular member with basic permissions",
  },
} as const;

export function MemberDirectory({
  chamaId,
  userRole,
  currentUserId,
}: MemberDirectoryProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<
    "7days" | "30days" | "alltime"
  >("7days");

  useEffect(() => {
    fetchMembers();
    if (userRole === "admin") {
      fetchJoinRequests();
    }
  }, [chamaId, userRole]);

  const fetchMembers = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        `http://localhost:3001/api/chama/${chamaId}/members`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch members");
      }

      const data = await response.json();

      // Fetch reputation for each member
      const membersWithReputation = await Promise.all(
        data.map(async (member: Member) => {
          try {
            const repResponse = await fetch(
              `http://localhost:3001/api/reputation/${chamaId}/user/${member.user_id}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            );

            if (repResponse.ok) {
              const repData = await repResponse.json();
              return {
                ...member,
                reputation: repData.reputation,
              };
            }
          } catch (err) {
            console.error(
              `Failed to fetch reputation for ${member.user_id}:`,
              err
            );
          }
          return member;
        })
      );

      setMembers(membersWithReputation);
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setLoading(false);
    }
  };

  const recalculateReputation = async () => {
    if (!currentUserId) return;

    setCalculating(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        `http://localhost:3001/api/reputation/${chamaId}/calculate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        // Refresh members list to get updated reputation
        await fetchMembers();
      }
    } catch (err) {
      console.error("Failed to recalculate reputation:", err);
    } finally {
      setCalculating(false);
    }
  };

  const fetchJoinRequests = async () => {
    try {
      setRequestsLoading(true);
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        `http://localhost:3001/api/chama/${chamaId}/invite/requests`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch join requests");
      }

      const data = await response.json();
      setJoinRequests(data);
    } catch (error) {
      console.error("Error fetching join requests:", error);
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleRespondToRequest = async (
    inviteId: string,
    action: "accept" | "reject"
  ) => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        `http://localhost:3001/api/chama/invite/${inviteId}/respond`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ action }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Failed to ${action} request`);
      }

      // Refresh both lists
      await fetchJoinRequests();
      await fetchMembers();

      alert(`Request ${action}ed successfully!`);
    } catch (error: any) {
      alert(error.message || `Failed to ${action} request`);
    }
  };

  const handleRoleChange = async () => {
    if (!selectedMember) return;

    setIsUpdating(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        `http://localhost:3001/api/chama/${chamaId}/members/${selectedMember.user_id}/role`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ role: newRole }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to update role");
      }

      // Refresh member list
      await fetchMembers();
      setShowRoleDialog(false);
      setSelectedMember(null);
      setNewRole("");
    } catch (error: any) {
      alert(error.message || "Failed to update member role");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;

    setIsUpdating(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        `http://localhost:3001/api/chama/${chamaId}/members/${selectedMember.user_id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to remove member");
      }

      // Refresh member list
      await fetchMembers();
      setShowRemoveDialog(false);
      setSelectedMember(null);
    } catch (error: any) {
      alert(error.message || "Failed to remove member");
    } finally {
      setIsUpdating(false);
    }
  };

  const openRoleDialog = (member: Member) => {
    setSelectedMember(member);
    setNewRole(member.role);
    setShowRoleDialog(true);
  };

  const openRemoveDialog = (member: Member) => {
    setSelectedMember(member);
    setShowRemoveDialog(true);
  };

  const filteredMembers = members
    .filter((member) => {
      if (
        searchQuery &&
        !member.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !member.email.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      if (roleFilter !== "all" && member.role !== roleFilter) {
        return false;
      }
      if (statusFilter !== "all" && member.status !== statusFilter) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.name || "").localeCompare(b.name || "");
        case "role":
          return (a.role || "").localeCompare(b.role || "");
        case "joinDate":
          return (
            new Date(b.joined_at || 0).getTime() -
            new Date(a.joined_at || 0).getTime()
          );
        case "activity":
          return (b.activity_score || 0) - (a.activity_score || 0);
        case "contributions":
          return (b.total_contributions || 0) - (a.total_contributions || 0);
        default:
          return 0;
      }
    });

  const canManageMembers = userRole === "chairperson" || userRole === "admin";
  const canAssignRoles = userRole === "chairperson";

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#083232]"></div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Join Requests - Admin Only */}
      {userRole === "admin" && joinRequests.length > 0 && (
        <Card className="p-6 border-[#f64d52] border-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#f64d52]" />
              <h3 className="text-lg font-semibold text-gray-900">
                Pending Join Requests ({joinRequests.length})
              </h3>
            </div>
          </div>
          <div className="space-y-3">
            {joinRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-[#083232] text-white rounded-full w-12 h-12 flex items-center justify-center font-semibold">
                    {request.user_name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {request.user_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {request.user_email}
                    </p>
                    <p className="text-xs text-gray-500">
                      Requested{" "}
                      {new Date(request.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 cursor-pointer"
                    onClick={() => handleRespondToRequest(request.id, "accept")}
                  >
                    <UserCheck className="w-4 h-4 mr-1" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-600 text-red-600 hover:bg-red-50 cursor-pointer"
                    onClick={() => handleRespondToRequest(request.id, "reject")}
                  >
                    <UserX className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Main layout with sidebar */}
      <div className="flex gap-6">
        {/* Left side - Main content */}
        <div className="flex-1 space-y-4">
          {/* Filters and search */}
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search members by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="chairperson">Chairperson</SelectItem>
                    <SelectItem value="treasurer">Treasurer</SelectItem>
                    <SelectItem value="secretary">Secretary</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="role">Role</SelectItem>
                    <SelectItem value="joinDate">Join Date</SelectItem>
                    <SelectItem value="activity">Activity Score</SelectItem>
                    <SelectItem value="contributions">Contributions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Member list */}
          <div className="space-y-2">
            {filteredMembers.map((member) => {
              const roleConfig = ROLE_CONFIG[member.role];
              const RoleIcon = roleConfig.icon;

              return (
                <Card
                  key={member.user_id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left side: Avatar + Info */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Avatar with online indicator */}
                      <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                          {member.profile_picture ? (
                            <img
                              src={member.profile_picture}
                              alt={member.name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <User className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                        {/* Online status indicator */}
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      </div>

                      {/* Member details */}
                      <div className="flex-1 min-w-0 pt-1">
                        <h3 className="font-semibold text-gray-900 truncate mb-1">
                          {member.name}
                          {member.user_id === currentUserId && (
                            <span className="text-sm text-gray-500 font-normal ml-1">
                              (You)
                            </span>
                          )}
                        </h3>

                        <div className="mb-2">
                          <Badge className={`${roleConfig.color} text-xs`}>
                            <RoleIcon className="w-3 h-3 mr-1" />
                            {roleConfig.label}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{member.email}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>
                              Joined{" "}
                              {new Date(member.joined_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right side: Reputation + Actions */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      {/* Reputation Score */}
                      {member.reputation ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex flex-col items-center gap-1">
                                <ReputationBadge
                                  tier={member.reputation.tier}
                                  name=""
                                  size="sm"
                                  showLabel={false}
                                />
                                <span className="text-xs font-semibold text-gray-700">
                                  {member.reputation.totalScore}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs space-y-1">
                                <p className="font-semibold">
                                  Reputation: {member.reputation.totalScore}{" "}
                                  points
                                </p>
                                <p>Tier: {member.reputation.tier}</p>
                                <p>
                                  Consistency:{" "}
                                  {member.reputation.contributionConsistencyRate.toFixed(
                                    0
                                  )}
                                  %
                                </p>
                                <p>
                                  Streak:{" "}
                                  {member.reputation.contributionStreakMonths}{" "}
                                  months
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <Star className="w-4 h-4 text-gray-400" />
                          </div>
                          <span className="text-xs text-gray-400">N/A</span>
                        </div>
                      )}

                      {/* Actions menu */}
                      {canManageMembers && member.user_id !== currentUserId && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canAssignRoles && (
                              <DropdownMenuItem
                                onClick={() => openRoleDialog(member)}
                              >
                                <Settings className="mr-2 h-4 w-4" />
                                Change Role
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => openRemoveDialog(member)}
                              className="text-red-600"
                            >
                              <UserMinus className="mr-2 h-4 w-4" />
                              Remove Member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {filteredMembers.length === 0 && (
            <Card className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No members found
              </h3>
              <p className="text-gray-600">
                {searchQuery || roleFilter !== "all" || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "This chama doesn't have any members yet"}
              </p>
            </Card>
          )}
        </div>

        {/* Right side - Reputation Sidebar */}
        <div className="w-80 space-y-4">
          {/* My Reputation Card */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-[#083232]" />
              <h3 className="font-semibold text-lg">My Reputation</h3>
            </div>

            {members.find((m) => m.user_id === currentUserId)?.reputation ? (
              <div className="space-y-4">
                <div className="text-center p-4 bg-gradient-to-br from-[#083232] to-[#2e856e] rounded-lg text-white">
                  <p className="text-sm opacity-90 mb-1">Your Score</p>
                  <p className="text-4xl font-bold">
                    {members.find((m) => m.user_id === currentUserId)
                      ?.reputation?.totalScore || 0}
                  </p>
                  <p className="text-sm opacity-90 mt-1 capitalize">
                    {members.find((m) => m.user_id === currentUserId)
                      ?.reputation?.tier || "unrated"}
                  </p>
                </div>
                <Button
                  className="w-full bg-[#083232] hover:bg-[#2e856e]"
                  size="sm"
                  onClick={recalculateReputation}
                  disabled={calculating}
                >
                  {calculating ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh Score
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-center py-6">
                <Trophy className="mx-auto mb-3 text-gray-400" size={48} />
                <h4 className="font-semibold text-gray-900 mb-2">
                  No Reputation Data Yet
                </h4>
                <p className="text-sm text-gray-600 mb-4">
                  Start contributing to build your reputation in this chama
                </p>
                <Button
                  className="w-full bg-[#083232] hover:bg-[#2e856e]"
                  size="sm"
                  onClick={recalculateReputation}
                  disabled={calculating}
                >
                  {calculating ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Calculate My Reputation
                    </>
                  )}
                </Button>
              </div>
            )}
          </Card>

          {/* Leaderboard Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#f64d52]" />
                <h3 className="font-semibold text-lg">Leaderboard</h3>
              </div>
            </div>

            {/* Period Selector */}
            <div className="flex gap-2 mb-4">
              <Button
                size="sm"
                variant={leaderboardPeriod === "7days" ? "default" : "outline"}
                onClick={() => setLeaderboardPeriod("7days")}
                className={
                  leaderboardPeriod === "7days"
                    ? "bg-[#083232] hover:bg-[#2e856e]"
                    : ""
                }
              >
                7 Days
              </Button>
              <Button
                size="sm"
                variant={leaderboardPeriod === "30days" ? "default" : "outline"}
                onClick={() => setLeaderboardPeriod("30days")}
                className={
                  leaderboardPeriod === "30days"
                    ? "bg-[#083232] hover:bg-[#2e856e]"
                    : ""
                }
              >
                30 Days
              </Button>
              <Button
                size="sm"
                variant={
                  leaderboardPeriod === "alltime" ? "default" : "outline"
                }
                onClick={() => setLeaderboardPeriod("alltime")}
                className={
                  leaderboardPeriod === "alltime"
                    ? "bg-[#083232] hover:bg-[#2e856e]"
                    : ""
                }
              >
                All Time
              </Button>
            </div>

            {/* Top Members List */}
            <div className="space-y-3">
              {members
                .filter((m) => m.reputation?.totalScore)
                .sort(
                  (a, b) =>
                    (b.reputation?.totalScore || 0) -
                    (a.reputation?.totalScore || 0)
                )
                .slice(0, 5)
                .map((member, index) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-gray-50 to-transparent border border-gray-100"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-[#083232] to-[#2e856e] text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="relative flex-shrink-0">
                        {member.profile_picture ? (
                          <img
                            src={member.profile_picture}
                            alt={member.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#083232] to-[#2e856e] flex items-center justify-center text-white text-xs font-semibold">
                            {member.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {member.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[#f64d52] font-bold">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-sm">
                        {member.reputation?.totalScore || 0}
                      </span>
                    </div>
                  </div>
                ))}

              {members.filter((m) => m.reputation?.totalScore).length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No reputation data yet
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Role change dialog */}
      <AlertDialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Member Role</AlertDialogTitle>
            <AlertDialogDescription>
              Change the role for {selectedMember?.name}. This will update their
              permissions within the chama.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select new role" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                  <SelectItem key={role} value={role}>
                    <div className="flex items-center gap-2">
                      <config.icon className="w-4 h-4" />
                      <div>
                        <p className="font-medium">{config.label}</p>
                        <p className="text-xs text-gray-600">
                          {config.description}
                        </p>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRoleChange}
              disabled={isUpdating || newRole === selectedMember?.role}
            >
              {isUpdating ? "Updating..." : "Update Role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove member dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedMember?.name} from this
              chama? This action cannot be undone and they will lose access to
              all chama activities.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={isUpdating}
              className="bg-red-600 hover:bg-red-700"
            >
              {isUpdating ? "Removing..." : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
