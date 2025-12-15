/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Footer } from "@/components/footer";
import { HomeNavbar } from "@/components/home/home-navbar";
import {
  Users,
  Calendar,
  MessageSquare,
  GraduationCap,
  Video,
  UserPlus,
  HandCoins,
  Repeat,
  TrendingUp,
  Activity,
  FileText,
  Info,
  Trash2,
  MoreHorizontal,
} from "lucide-react";

interface ChamaDetails {
  id: string;
  name: string;
  description: string;
  admin_email: string;
  admin_phone: string;
  admin_name: string;
  contribution_amount: number;
  contribution_frequency: string;
  max_members: number;
  active_members: number;
  total_contributions: number;
  current_balance: number;
  status: string;
  settings: any;
  created_at: string;
  tags?: string[];
  type?: string;
  lending_enabled?: boolean;
  is_public?: boolean;
}

type TabType =
  | "community"
  | "classroom"
  | "meetings"
  | "members"
  | "contributions"
  | "rotation"
  | "financials"
  | "activity"
  | "documents"
  | "about";

export default function CycleBySlugPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [chama, setChama] = useState<ChamaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("about");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoreTabs, setShowMoreTabs] = useState(false);
  const [visibleTabCount, setVisibleTabCount] = useState(10);
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const fetchChamaBySlug = async () => {
      try {
        const accessToken = localStorage.getItem("accessToken");

        // First, fetch all public chamas to find by name
        const response = await fetch("http://localhost:3001/api/chama/public");

        if (!response.ok) {
          throw new Error("Failed to load cycle");
        }

        const chamas = await response.json();

        // Decode the slug and find matching chama by name
        const decodedSlug = decodeURIComponent(slug);
        const matchedChama = chamas.find(
          (c: any) =>
            c.name.toLowerCase().replace(/\s+/g, "-") ===
              decodedSlug.toLowerCase() ||
            c.name.toLowerCase() === decodedSlug.toLowerCase()
        );

        if (!matchedChama) {
          throw new Error("Cycle not found");
        }

        // Now fetch full details by ID
        const detailResponse = await fetch(
          `http://localhost:3001/api/chama/${matchedChama.id}`,
          accessToken
            ? {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            : {}
        );

        if (!detailResponse.ok) {
          throw new Error("Failed to load cycle details");
        }

        const data = await detailResponse.json();
        setChama(data);

        // Check if user is a member and get their role
        if (accessToken && data.role) {
          setUserRole(data.role);
        }
      } catch (err: any) {
        setError(err.message || "Unable to load cycle");
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchChamaBySlug();
    }
  }, [slug]);

  const formatAmount = (amount: number) => {
    if (!amount) return "0";
    return amount >= 1000
      ? `${(amount / 1000).toFixed(1)}k`
      : amount.toString();
  };

  const formatFrequency = (freq: string) => {
    const map: Record<string, string> = {
      daily: "Daily",
      weekly: "Weekly",
      biweekly: "Biweekly",
      monthly: "Monthly",
      custom: "Custom",
    };
    return map[freq] || freq;
  };

  const handleDeleteCycle = async () => {
    if (!chama) return;

    setIsDeleting(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        router.push("/auth/login");
        return;
      }

      const response = await fetch(
        `http://localhost:3001/api/chama/${chama.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to delete cycle");
      }

      // Redirect to home after successful deletion
      router.push("/");
    } catch (err: any) {
      alert(err.message || "Unable to delete cycle");
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const canDeleteCycle = () => {
    if (!chama) return false;
    // Can delete if user is admin and is the only active member
    return userRole === "admin" && chama.active_members <= 1;
  };

  const tabs = [
    { id: "community" as TabType, label: "Community", icon: MessageSquare },
    { id: "classroom" as TabType, label: "Classroom", icon: GraduationCap },
    { id: "meetings" as TabType, label: "Meetings", icon: Video },
    { id: "members" as TabType, label: "Members", icon: Users },
    { id: "contributions" as TabType, label: "Contributions", icon: HandCoins },
    { id: "rotation" as TabType, label: "Rotation", icon: Repeat },
    { id: "financials" as TabType, label: "Financials", icon: TrendingUp },
    { id: "activity" as TabType, label: "Activity", icon: Activity },
    { id: "documents" as TabType, label: "Documents", icon: FileText },
    { id: "about" as TabType, label: "About", icon: Info },
  ];

  // Calculate visible tabs based on container width
  useLayoutEffect(() => {
    const calculateVisibleTabs = () => {
      if (!tabContainerRef.current) return;

      const containerWidth = tabContainerRef.current.offsetWidth;
      const moreButtonWidth = 100; // Approximate width of More button
      let availableWidth = containerWidth - moreButtonWidth;
      let count = 0;

      for (let i = 0; i < tabRefs.current.length; i++) {
        const tab = tabRefs.current[i];
        if (!tab) continue;

        const tabWidth = tab.offsetWidth + 4; // Add gap
        if (availableWidth >= tabWidth) {
          availableWidth -= tabWidth;
          count++;
        } else {
          break;
        }
      }

      // Ensure at least 3 tabs are visible, or all if they all fit
      setVisibleTabCount(Math.max(3, count));
    };

    // Initial calculation
    calculateVisibleTabs();

    // Recalculate on window resize
    window.addEventListener("resize", calculateVisibleTabs);
    return () => window.removeEventListener("resize", calculateVisibleTabs);
  }, [tabs]);

  const renderTabContent = () => {
    if (!chama) return null;

    switch (activeTab) {
      case "community":
        return (
          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Community Feed</h3>
              <p className="text-gray-600">
                Share updates, ask questions, and engage with your cycle
                members.
              </p>
              <div className="mt-4 space-y-4">
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500">
                    No posts yet. Be the first to share something!
                  </p>
                </div>
              </div>
            </Card>
          </div>
        );

      case "classroom":
        return (
          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Financial Education
              </h3>
              <p className="text-gray-600">
                Access lessons, resources, and training materials.
              </p>
              <div className="mt-4">
                <p className="text-sm text-gray-500">
                  Coming soon: Financial literacy courses and workshops
                </p>
              </div>
            </Card>
          </div>
        );

      case "meetings":
        return (
          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Scheduled Meetings</h3>
              <p className="text-gray-600">
                View upcoming meetings and past meeting minutes.
              </p>
              <div className="mt-4">
                <p className="text-sm text-gray-500">
                  No meetings scheduled yet.
                </p>
              </div>
            </Card>
          </div>
        );

      case "members":
        return (
          <div className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Members ({chama.active_members}/{chama.max_members})
                </h3>
                <Button className="bg-[#083232] hover:bg-[#2e856e]">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite
                </Button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{chama.admin_name || "Admin"}</p>
                    <p className="text-sm text-gray-600">{chama.admin_email}</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );

      case "contributions":
        return (
          <div className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Contribution History</h3>
                <Button className="bg-[#f64d52] hover:bg-[#d43d42]">
                  Make Contribution
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Amount</p>
                  <p className="text-xl font-bold">
                    KSh {formatAmount(chama.contribution_amount)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Frequency</p>
                  <p className="text-xl font-bold">
                    {formatFrequency(chama.contribution_frequency)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Total Collected</p>
                  <p className="text-xl font-bold">
                    KSh {formatAmount(chama.total_contributions)}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                No contributions recorded yet.
              </p>
            </Card>
          </div>
        );

      case "rotation":
        return (
          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Rotation Schedule</h3>
              <p className="text-gray-600">
                Track who receives payouts and when.
              </p>
              <div className="mt-4">
                <p className="text-sm text-gray-500">
                  Rotation schedule will be available once contributions begin.
                </p>
              </div>
            </Card>
          </div>
        );

      case "financials":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-3 rounded-full">
                    <Wallet className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Current Balance</p>
                    <p className="text-2xl font-bold">
                      KSh {formatAmount(chama.current_balance)}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-3 rounded-full">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Contributions</p>
                    <p className="text-2xl font-bold">
                      KSh {formatAmount(chama.total_contributions)}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 p-3 rounded-full">
                    <Calendar className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Next Payout</p>
                    <p className="text-lg font-bold">TBD</p>
                  </div>
                </div>
              </Card>
            </div>
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Transaction History
              </h3>
              <p className="text-sm text-gray-500">No transactions yet.</p>
            </Card>
          </div>
        );

      case "activity":
        return (
          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="bg-green-100 p-2 rounded-full">
                    <Activity className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Cycle Created</p>
                    <p className="text-xs text-gray-600">
                      {new Date(chama.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );

      case "documents":
        return (
          <div className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Documents & Files</h3>
                <Button variant="outline">Upload Document</Button>
              </div>
              <p className="text-sm text-gray-500">
                No documents uploaded yet.
              </p>
            </Card>
          </div>
        );

      case "about":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content Area */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">About This Cycle</h3>
                <div className="space-y-4">
                  {chama.cover_image && (
                    <div className="relative w-full h-64 rounded-lg overflow-hidden mb-4">
                      <Image
                        src={chama.cover_image}
                        alt={chama.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">
                      Description
                    </h4>
                    <p className="text-gray-600 leading-relaxed">
                      {chama.description}
                    </p>
                  </div>

                  {chama.tags && chama.tags.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-gray-600 mb-2">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {chama.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-gray-100 px-3 py-1 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Sidebar */}
            <div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-5 space-y-3.5">
                  {/* Type & Visibility */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Type</p>
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {chama.type?.replace("-", " ") || "Savings"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Visibility</p>
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {chama.is_public ? "Public" : "Private"}
                      </p>
                    </div>
                  </div>

                  {/* Status & Lending */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Status</p>
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {chama.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Lending</p>
                      <p className="text-sm font-medium text-gray-900">
                        {chama.lending_enabled ? "Enabled" : "Disabled"}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-3.5"></div>

                  {/* Created */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Created</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(chama.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Admin */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Admin</p>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {chama.admin_name || chama.admin_email}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#083232] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading cycle details...</p>
        </div>
      </div>
    );
  }

  if (error || !chama) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "Cycle not found"}</p>
          <Button onClick={() => router.push("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <HomeNavbar
        isAuthenticated={!!localStorage.getItem("accessToken")}
        showSearchInNav={false}
        searchQuery=""
        onSearchChange={() => {}}
        title={chama.name}
      />

      {/* Delete Cycle Button (if admin) */}
      {canDeleteCycle() && (
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-lg"
            title="Delete Cycle"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="bg-white border-b sticky top-16 z-10 shadow-sm mt-16">
        <div className="max-w-[1085px] mx-auto px-4" ref={tabContainerRef}>
          {/* First line of tabs */}
          <div className="flex items-center gap-1">
            {tabs.slice(0, visibleTabCount).map((tab, index) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={(el) => (tabRefs.current[index] = el)}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors
                    border-b-2 min-h-12 flex-shrink-0
                    ${
                      isActive
                        ? "border-[#083232] text-[#083232]"
                        : "border-transparent text-gray-600 hover:text-[#083232] hover:border-gray-300"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
            {tabs.length > visibleTabCount && (
              <button
                onClick={() => setShowMoreTabs(!showMoreTabs)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors
                  border-b-2 min-h-12 flex-shrink-0
                  ${
                    showMoreTabs
                      ? "border-[#083232] text-[#083232]"
                      : "border-transparent text-gray-600 hover:text-[#083232] hover:border-gray-300"
                  }
                `}
              >
                <MoreHorizontal className="w-4 h-4" />
                More
              </button>
            )}
          </div>

          {/* Second line of tabs (expandable) */}
          {showMoreTabs && tabs.length > visibleTabCount && (
            <div className="flex items-center gap-1 border-t">
              {tabs.slice(visibleTabCount).map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors
                      border-b-2 min-h-12 flex-shrink-0
                      ${
                        isActive
                          ? "border-[#083232] text-[#083232]"
                          : "border-transparent text-gray-600 hover:text-[#083232] hover:border-gray-300"
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1085px] mx-auto px-4 py-8 flex-1">
        {renderTabContent()}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Delete Cycle?
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to permanently delete &quot;{chama.name}
              &quot;? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDeleteCycle}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <Footer />
    </div>
  );
}
