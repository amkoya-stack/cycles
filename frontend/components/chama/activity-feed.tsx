/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
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
  Activity,
  Filter,
  Download,
  DollarSign,
  Users,
  FileText,
  Settings,
  Clock,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
} from "lucide-react";

interface ActivityLog {
  id: string;
  category: string;
  activity_type: string;
  title: string;
  description: string;
  user_name: string;
  user_avatar: string;
  metadata: Record<string, any>;
  created_at: string;
}

interface ActivityFeedProps {
  chamaId: string;
}

const categoryConfig = {
  financial: {
    icon: DollarSign,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  governance: {
    icon: Settings,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  membership: {
    icon: Users,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  document: {
    icon: FileText,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
  system: {
    icon: Activity,
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
  },
};

export function ActivityFeed({ chamaId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<string>("7days");

  // Mock data for UI preview
  const mockActivities: ActivityLog[] = [
    {
      id: "1",
      category: "financial",
      activity_type: "loan_disbursed",
      title: "Loan Disbursed",
      description: "Loan L12345 of KES 50,000 disbursed to James Mutiso",
      user_name: "James Mutiso",
      user_avatar: "",
      metadata: {
        amount: 50000,
        loan_id: "L12345",
        status: "disbursed",
      },
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    },
    {
      id: "2",
      category: "financial",
      activity_type: "repayment",
      title: "Repayment Received",
      description: "Mary Wanjiku made a repayment of KES 15,000",
      user_name: "Mary Wanjiku",
      user_avatar: "",
      metadata: {
        amount: 15000,
        loan_id: "L67890",
        status: "paid",
      },
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    },
    {
      id: "3",
      category: "governance",
      activity_type: "proposal_approved",
      title: "Proposal Approved",
      description: "Investment proposal for Money Market Fund approved by members",
      user_name: "John Kamau",
      user_avatar: "",
      metadata: {
        proposal_id: "PROP-001",
        status: "approved",
      },
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    },
    {
      id: "4",
      category: "membership",
      activity_type: "member_joined",
      title: "New Member Joined",
      description: "Sarah Njeri joined the cycle",
      user_name: "Sarah Njeri",
      user_avatar: "",
      metadata: {
        member_id: "MEM-123",
        status: "active",
      },
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    },
    {
      id: "5",
      category: "financial",
      activity_type: "contribution",
      title: "Contribution Made",
      description: "Peter Ochieng made a contribution of KES 5,000",
      user_name: "Peter Ochieng",
      user_avatar: "",
      metadata: {
        amount: 5000,
        status: "completed",
      },
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    },
    {
      id: "6",
      category: "document",
      activity_type: "document_uploaded",
      title: "Document Uploaded",
      description: "Meeting minutes for January 2025 uploaded",
      user_name: "Admin",
      user_avatar: "",
      metadata: {
        document_type: "minutes",
        status: "uploaded",
      },
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
    },
    {
      id: "7",
      category: "governance",
      activity_type: "vote_cast",
      title: "Vote Cast",
      description: "Vote cast on proposal for new investment strategy",
      user_name: "James Mutiso",
      user_avatar: "",
      metadata: {
        proposal_id: "PROP-002",
        vote: "yes",
      },
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    },
    {
      id: "8",
      category: "financial",
      activity_type: "loan_overdue",
      title: "Loan Overdue",
      description: "Loan L67890 is now overdue. Payment of KES 15,000 was due on Jan 5",
      user_name: "Mary Wanjiku",
      user_avatar: "",
      metadata: {
        amount: 15000,
        loan_id: "L67890",
        status: "overdue",
      },
      created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days ago
    },
    {
      id: "9",
      category: "system",
      activity_type: "settings_updated",
      title: "Settings Updated",
      description: "Cycle settings updated by admin",
      user_name: "Admin",
      user_avatar: "",
      metadata: {
        setting_type: "auto_payout",
        status: "enabled",
      },
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    },
    {
      id: "10",
      category: "membership",
      activity_type: "member_role_changed",
      title: "Member Role Changed",
      description: "John Kamau promoted to Treasurer",
      user_name: "John Kamau",
      user_avatar: "",
      metadata: {
        old_role: "member",
        new_role: "treasurer",
        status: "updated",
      },
      created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
    },
  ];

  useEffect(() => {
    fetchActivities();
  }, [chamaId, categoryFilter, dateRange]);

  const fetchActivities = async () => {
    // Use mock data for UI preview (comment out to use real API)
    let filtered = mockActivities;
    
    // Filter by category
    if (categoryFilter !== "all") {
      filtered = mockActivities.filter((activity) => 
        activity.category === categoryFilter
      );
    }
    
    // Filter by date range
    if (dateRange !== "all") {
      const now = new Date();
      const cutoffDate = new Date();
      if (dateRange === "7days") {
        cutoffDate.setDate(cutoffDate.getDate() - 7);
      } else if (dateRange === "30days") {
        cutoffDate.setDate(cutoffDate.getDate() - 30);
      } else if (dateRange === "90days") {
        cutoffDate.setDate(cutoffDate.getDate() - 90);
      }
      filtered = filtered.filter((activity) => 
        new Date(activity.created_at) >= cutoffDate
      );
    }
    
    setActivities(filtered);
    setLoading(false);
    return;

    try {
      setLoading(true);
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      let url = `http://localhost:3001/api/activity/chama/${chamaId}?limit=100`;

      if (categoryFilter !== "all") {
        url += `&category=${categoryFilter}`;
      }

      // Calculate date range
      if (dateRange !== "all") {
        const endDate = new Date();
        const startDate = new Date();
        if (dateRange === "7days") {
          startDate.setDate(startDate.getDate() - 7);
        } else if (dateRange === "30days") {
          startDate.setDate(startDate.getDate() - 30);
        } else if (dateRange === "90days") {
          startDate.setDate(startDate.getDate() - 90);
        }
        url += `&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setActivities(data);
      }
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      let url = `http://localhost:3001/api/activity/chama/${chamaId}/export`;

      if (categoryFilter !== "all") {
        url += `?category=${categoryFilter}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `activities-${chamaId}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      }
    } catch (error) {
      console.error("Error exporting activities:", error);
    }
  };

  const filteredActivities = activities.filter((activity) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      activity.title.toLowerCase().includes(query) ||
      activity.description?.toLowerCase().includes(query) ||
      activity.user_name?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-500">Loading activities...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-[#083232]" />
          <h2 className="text-2xl font-bold text-[#083232]">Activity Feed</h2>
        </div>
        <Button
          onClick={handleExport}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="p-4 bg-white rounded-lg border border-gray-200">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="financial">Financial</SelectItem>
              <SelectItem value="governance">Governance</SelectItem>
              <SelectItem value="membership">Membership</SelectItem>
              <SelectItem value="document">Document</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="90days">Last 90 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Activity List */}
      <div className="space-y-3">
        {filteredActivities.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-lg border border-gray-200">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No activities found
            </h3>
            <p className="text-gray-600">
              {searchQuery || categoryFilter !== "all"
                ? "Try adjusting your filters"
                : "Activities will appear here as they happen"}
            </p>
          </div>
        ) : (
          filteredActivities.map((activity) => {
            const config =
              categoryConfig[activity.category as keyof typeof categoryConfig];
            const Icon = config?.icon || Activity;

            return (
              <div
                key={activity.id}
                className={`p-4 bg-white rounded-lg border-l-4 border-b border-gray-200 hover:bg-gray-50 transition-colors ${config?.borderColor}`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full ${config?.bgColor} flex items-center justify-center`}
                  >
                    <Icon className={`w-5 h-5 ${config?.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {activity.title}
                        </h3>
                        {activity.description && (
                          <p className="text-sm text-gray-600 mb-2">
                            {activity.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(activity.created_at)}
                          </span>
                          {activity.user_name && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {activity.user_name}
                            </span>
                          )}
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className="flex-shrink-0 capitalize"
                      >
                        {activity.category}
                      </Badge>
                    </div>

                    {/* Metadata */}
                    {activity.metadata &&
                      Object.keys(activity.metadata).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                            {activity.metadata.amount && (
                              <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                                <DollarSign className="w-3 h-3" />
                                KES{" "}
                                {Number(
                                  activity.metadata.amount
                                ).toLocaleString()}
                              </span>
                            )}
                            {activity.metadata.status && (
                              <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded capitalize">
                                {activity.metadata.status}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
