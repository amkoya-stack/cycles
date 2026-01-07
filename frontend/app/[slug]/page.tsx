/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import LoanDashboard from "@/components/chama/loan-dashboard";
import { InvestmentPortfolio } from "@/components/investment/investment-portfolio";
import { ChamaDashboard } from "@/components/chama/chama-dashboard";
import { Footer } from "@/components/footer";
import { HomeNavbar } from "@/components/home/home-navbar";
import { MemberDirectory } from "@/components/chama/member-directory";
import { LeaveChamaComponent } from "@/components/chama/leave-chama";
import { ChamaSettingsModal } from "@/components/chama/chama-settings-modal";
import { RotationPayoutPage } from "@/components/chama/rotation-payout-page";
import { ReputationPage } from "@/components/reputation/reputation-page";
import { ActivityFeed } from "@/components/chama/activity-feed";
import { GovernanceSection } from "@/components/governance/governance-section";
import { CommunityPosts } from "@/components/chama/community-posts";
import { ActivePollsSidebar } from "@/components/chama/active-polls-sidebar";
import { MeetingsSidebar } from "@/components/chama/meetings-sidebar";
import { SpacesMeetingModal } from "@/components/chama/spaces-meeting-modal";
import { FloatingMeetingIndicator } from "@/components/chama/floating-meeting-indicator";
import { ChamaDepositModal } from "@/components/chama/chama-deposit-modal";
import { ChamaTransferModal } from "@/components/chama/chama-transfer-modal";
import { DocumentVault } from "@/components/chama/document-vault";
import { InviteMemberModal } from "@/components/chama/invite-member-modal";
import { DisputeList } from "@/components/dispute/dispute-list";
import { FileDisputeForm } from "@/components/dispute/file-dispute-form";
import { useNotifications } from "@/hooks/use-notifications";
import { apiUrl } from "@/lib/api-config";
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
  Wallet,
  LogOut,
  Upload,
  Trophy,
  History,
  ArrowDownToLine,
  Send,
  Check,
  X,
  PieChart,
  AlertCircle,
  Menu,
  ChevronDown,
  Settings,
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
  interval_days?: number;
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
  user_role?: string;
  user_member_status?: string;
  is_member?: boolean;
  has_pending_request?: boolean;
  cover_image?: string;
}

type TabType =
  | "community"
  | "classroom"
  | "members"
  | "rotation"
  | "financials"
  | "loans"
  | "investments"
  | "disputes"
  | "activity"
  | "documents"
  | "settings"
  | "reputation"
  | "about";

interface UserChama {
  id: string;
  name: string;
  current_balance?: number;
}

interface ChamaTransaction {
  id: string;
  reference: string;
  description: string;
  status: string;
  created_at: string;
  completed_at?: string;
  transaction_type: string;
  transaction_name: string;
  amount: number;
  direction: "debit" | "credit";
  balance_before?: number;
  balance_after?: number;
  counterparty_name?: string;
  counterparty_type?: string;
}

export default function CycleBySlugPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [chama, setChama] = useState<ChamaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    // Initialize from URL query parameter if available
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab") as TabType;
      if (tabParam) return tabParam;
    }
    return "about";
  });
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>(undefined);
  const [isJoining, setIsJoining] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [visibleTabs, setVisibleTabs] = useState<typeof allTabs>([]);
  const [overflowTabs, setOverflowTabs] = useState<typeof allTabs>([]);
  const [showOverflowTabs, setShowOverflowTabs] = useState(false);

  // Chama wallet modals
  const [showChamaDeposit, setShowChamaDeposit] = useState(false);
  const [showChamaTransfer, setShowChamaTransfer] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [userChamas, setUserChamas] = useState<UserChama[]>([]);
  const [chamaMembers, setChamaMembers] = useState<
    { user_id: string; full_name: string; phone?: string }[]
  >([]);
  const [chamaTransactions, setChamaTransactions] = useState<
    ChamaTransaction[]
  >([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [meetingsRefreshKey, setMeetingsRefreshKey] = useState(0);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  // Meeting modal state
  const [showSpacesModal, setShowSpacesModal] = useState(false);
  const [meetingMinimized, setMeetingMinimized] = useState(false);
  const [meetingParticipantCount, setMeetingParticipantCount] = useState(0);
  const [activeMeetingId, setActiveMeetingId] = useState("");
  const [activeMeetingTitle, setActiveMeetingTitle] = useState("");
  const [livekitToken, setLivekitToken] = useState("");
  const [livekitUrl, setLivekitUrl] = useState("");
  const [isHostOfMeeting, setIsHostOfMeeting] = useState(false);

  // Fund request notifications
  const { fundRequests, unreadCount, respondToRequest } = useNotifications();

  useEffect(() => {
    const fetchChamaBySlug = async () => {
      try {
        const accessToken = localStorage.getItem("accessToken");

        if (accessToken) {
          // For authenticated users, first try to get the chama ID from public list, then get full details
          try {
            const response = await fetch(
              apiUrl("chama/public")
            );
            if (!response.ok) {
              throw new Error("Failed to load chamas");
            }

            const chamas = await response.json();
            console.log(`[DEBUG] All available chamas for user:`, chamas);
            const decodedSlug = decodeURIComponent(slug);
            console.log(`[DEBUG] Looking for slug: "${decodedSlug}"`);
            const matchedChama = chamas.find((c: any) => {
              const nameToSlug = c.name.toLowerCase().replace(/\s+/g, "-");
              const nameMatch = nameToSlug === decodedSlug.toLowerCase();
              const directMatch =
                c.name.toLowerCase() === decodedSlug.toLowerCase();
              console.log(
                `[DEBUG] Checking chama: ${c.name} (id: ${c.id}) -> slug: ${nameToSlug}, nameMatch: ${nameMatch}, directMatch: ${directMatch}`
              );
              return nameMatch || directMatch;
            });
            console.log(`[DEBUG] Matched chama:`, matchedChama);

            if (!matchedChama) {
              throw new Error("Cycle not found");
            }

            // Get authenticated user details
            const detailResponse = await fetch(
              apiUrl(`chama/${matchedChama.id}`),
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            );

            if (detailResponse.status === 401) {
              // Token expired, redirect to login
              localStorage.removeItem("accessToken");
              localStorage.removeItem("refreshToken");
              router.push("/auth/login");
              return;
            }

            if (!detailResponse.ok) {
              throw new Error("Failed to load cycle details");
            }

            const data = await detailResponse.json();
            setChama(data);
            setUserRole(data.user_role);
          } catch (authError) {
            // If authenticated call fails, fall back to public endpoint
            const publicResponse = await fetch(
              apiUrl(`chama/public/slug/${encodeURIComponent(slug)}`)
            );

            if (!publicResponse.ok) {
              throw new Error("Failed to load cycle details");
            }

            const data = await publicResponse.json();
            setChama(data);
            setUserRole(null);
          }
        } else {
          // Non-authenticated users use public endpoint by slug
          const publicResponse = await fetch(
            apiUrl(`chama/public/slug/${encodeURIComponent(slug)}`)
          );

          if (!publicResponse.ok) {
            throw new Error("Failed to load cycle details");
          }

          const data = await publicResponse.json();
          setChama(data);
          setUserRole(null);
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

  // Fetch user's chamas for transfer modal
  useEffect(() => {
    const fetchUserChamas = async () => {
      try {
        const accessToken = localStorage.getItem("accessToken");
        if (!accessToken) return;

        const response = await fetch(apiUrl("chama"), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (response.ok) {
          const chamas = await response.json();
          setUserChamas(chamas);
        }
      } catch (err) {
        console.error("Failed to fetch user chamas:", err);
      }
    };

    fetchUserChamas();
  }, []);

  // Fetch chama members for transfer to user
  useEffect(() => {
    const fetchChamaMembers = async () => {
      if (!chama?.id || !chama?.is_member) return;
      try {
        const accessToken = localStorage.getItem("accessToken");
        if (!accessToken) return;

        const response = await fetch(
          apiUrl(`chama/${chama.id}/members`),
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (response.ok) {
          const members = await response.json();
          setChamaMembers(
            members.map((m: any) => ({
              user_id: m.user_id,
              full_name: m.full_name || m.name,
              phone: m.phone,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to fetch chama members:", err);
      }
    };

    fetchChamaMembers();
  }, [chama?.id, chama?.is_member]);

  // Refresh chama data after deposit/transfer
  const refreshChamaData = async () => {
    if (!chama) return;
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(
        apiUrl(`chama/${chama.id}`),
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setChama(data);
      }
      // Also refresh transactions
      fetchChamaTransactions();
    } catch (err) {
      console.error("Failed to refresh chama data:", err);
    }
  };

  // Fetch chama transaction history
  const fetchChamaTransactions = async () => {
    if (!chama) return;
    setLoadingTransactions(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        `${apiUrl(`ledger/chama/${chama.id}/transactions`)}?limit=20`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setChamaTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error("Failed to fetch chama transactions:", err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Fetch transactions when financials tab is active
  useEffect(() => {
    if (activeTab === "financials" && chama?.id) {
      fetchChamaTransactions();
    }
  }, [activeTab, chama?.id]);

  const getJoinButtonText = () => {
    if (isJoining) return "Processing...";
    if (chama?.has_pending_request) return "Request Sent";
    return chama?.is_public ? "Join Cycle" : "Request to Join";
  };

  const getJoinButtonDisabled = () => {
    return isJoining || chama?.has_pending_request;
  };

  const handleJoinCycle = async () => {
    if (!chama) return;

    // Don't allow action if there's already a pending request
    if (chama.has_pending_request) return;

    // Check if user is logged in
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      // Redirect to login page for non-authenticated users
      router.push("/auth/login");
      return;
    }

    try {
      if (chama.is_public) {
        setIsJoining(true);
        // Join public chama directly
        const response = await fetch(
          apiUrl(`chama/${chama.id}/invite/accept-public`),
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || "Failed to join cycle");
        }

        // Refresh the page to update membership status
        window.location.reload();
      } else {
        setIsJoining(true);
        // Request to join private chama
        const response = await fetch(
          apiUrl(`chama/${chama.id}/invite/request`),
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || "Failed to send join request");
        }

        const result = await response.json();

        // Update state to reflect pending request
        setChama((prev: any) => ({
          ...prev,
          has_pending_request: true,
        }));

        alert(result.message || "Join request sent successfully!");
      }
    } catch (err: any) {
      alert(err.message || "Unable to join cycle");
    } finally {
      setIsJoining(false);
    }
  };

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

  const getLastName = (fullName: string | null | undefined): string => {
    if (!fullName) return "";
    const parts = fullName.trim().split(/\s+/);
    // Return last name if multiple names, otherwise return the single name
    return parts.length > 1 ? parts[parts.length - 1] : parts[0];
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    setUploadingImage(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;

        const accessToken = localStorage.getItem("accessToken");
        if (!accessToken) {
          router.push("/auth/login");
          return;
        }

        // Upload to backend
        console.log("Uploading image, length:", base64String.length);
        const response = await fetch(
          apiUrl(`chama/${chama?.id}`),
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              coverImage: base64String,
            }),
          }
        );

        console.log("Upload response status:", response.status);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Upload failed:", errorData);
          throw new Error(errorData.message || "Failed to upload image");
        }

        const updateResult = await response.json();
        console.log("Update result:", updateResult);

        // Refresh chama data
        const detailResponse = await fetch(
          apiUrl(`chama/${chama?.id}`),
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (detailResponse.ok) {
          const updatedChama = await detailResponse.json();
          setChama(updatedChama);
        }

        alert("Cover image updated successfully!");
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      alert(err.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
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
        apiUrl(`chama/${chama.id}`),
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
    // Can delete if user is admin
    return userRole === "admin";
  };

  const handleJoinMeeting = async (meetingId: string, title: string) => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        alert("Please log in to join meetings");
        return;
      }

      // Get current user ID to check if they're the host
      let currentUserId = "";
      try {
        const payload = JSON.parse(atob(accessToken.split(".")[1]));
        currentUserId = payload.sub || payload.userId || "";
      } catch (e) {
        console.error("Failed to parse token:", e);
      }

      // Join the meeting to get Livekit token
      // Backend will fetch user details (name, avatar) from database
      const joinResponse = await fetch(
        apiUrl(`meetings/${meetingId}/join`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({}), // Empty body - backend will use user from JWT
        }
      );

      if (joinResponse.ok) {
        const joinData = await joinResponse.json();
        console.log("Join meeting data:", joinData);

        // Check if current user is the host
        const isUserHost = joinData.meeting?.host_user_id === currentUserId;
        console.log(`User is host: ${isUserHost}`);

        setActiveMeetingId(meetingId);
        setActiveMeetingTitle(title);
        setLivekitToken(joinData.token);
        setLivekitUrl(joinData.wsUrl || joinData.url);
        setIsHostOfMeeting(isUserHost);
        setShowSpacesModal(true);
      } else {
        const error = await joinResponse.json();
        alert(error.message || "Failed to join meeting");
      }
    } catch (error: any) {
      console.error("Error joining meeting:", error);
      alert(error.message || "Failed to join meeting");
    }
  };

  const allTabs = [
    { id: "about" as TabType, label: "About", icon: Info },
    { id: "community" as TabType, label: "Community", icon: MessageSquare },
    { id: "members" as TabType, label: "Members", icon: Users },
    { id: "classroom" as TabType, label: "Classroom", icon: GraduationCap },
    { id: "rotation" as TabType, label: "Rotation", icon: Repeat },
    { id: "financials" as TabType, label: "Financials", icon: TrendingUp },
    { id: "loans" as TabType, label: "Loans", icon: HandCoins },
    { id: "investments" as TabType, label: "Investments", icon: PieChart },
    { id: "disputes" as TabType, label: "Disputes", icon: AlertCircle },
    { id: "activity" as TabType, label: "Activity", icon: Activity },
    { id: "documents" as TabType, label: "Documents", icon: FileText },
  ];

  // Filter tabs based on membership and hidden tabs setting
  const tabs = (() => {
    // Non-members can only see "About" tab
    if (!chama?.is_member) {
      return allTabs.filter((tab) => tab.id === "about");
    }

    // Admins see all tabs
    if (userRole === "admin") {
      return allTabs;
    }

    // Regular members see all tabs except hidden ones
    // "about" tab should always be visible
    const hiddenTabs = chama?.settings?.hiddenTabs || [];
    return allTabs.filter(
      (tab) => tab.id === "about" || !hiddenTabs.includes(tab.id)
    );
  })();

  // Redirect to "about" tab if current activeTab is not available
  useEffect(() => {
    if (chama && tabs.length > 0) {
      const isActiveTabAvailable = tabs.some((tab) => tab.id === activeTab);
      if (!isActiveTabAvailable) {
        setActiveTab("about");
        // Update URL without reload
        const url = new URL(window.location.href);
        url.searchParams.set("tab", "about");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [chama, tabs, activeTab]);

  // Calculate visible and overflow tabs based on container width (1085px max)
  useLayoutEffect(() => {
    const calculateVisibleTabs = () => {
      if (!tabContainerRef.current || tabs.length === 0) {
        setVisibleTabs(tabs);
        setOverflowTabs([]);
        return;
      }

      // Wait for all tab refs to be set
      const allRefsReady = tabs.every((_, i) => tabRefs.current[i] !== null && tabRefs.current[i]?.offsetWidth);
      if (!allRefsReady) {
        // If refs aren't ready, show all tabs temporarily
        setVisibleTabs(tabs);
        setOverflowTabs([]);
        return;
      }

      const maxWidth = 1085 - 32; // Account for padding (16px each side)
      const hamburgerButtonWidth = 52; // Width of hamburger button with padding
      const gapWidth = 4; // Gap between tabs
      
      // Calculate total width if all tabs were visible
      let totalTabsWidth = 0;
      for (let i = 0; i < tabs.length; i++) {
        const tabElement = tabRefs.current[i];
        if (tabElement) {
          totalTabsWidth += tabElement.offsetWidth + (i > 0 ? gapWidth : 0);
        }
      }

      // If all tabs fit without hamburger, show all
      if (totalTabsWidth <= maxWidth) {
        setVisibleTabs(tabs);
        setOverflowTabs([]);
        return;
      }

      // Otherwise, calculate which tabs fit with hamburger
      let totalWidth = hamburgerButtonWidth + gapWidth; // Start with hamburger + gap
      const visible: typeof tabs = [];
      const overflow: typeof tabs = [];

      for (let i = 0; i < tabs.length; i++) {
        const tabElement = tabRefs.current[i];
        if (!tabElement) {
          visible.push(tabs[i]);
          continue;
        }

        const tabWidth = tabElement.offsetWidth;
        const wouldFit = totalWidth + tabWidth <= maxWidth;

        if (wouldFit) {
          visible.push(tabs[i]);
          totalWidth += tabWidth + gapWidth;
        } else {
          // Add remaining tabs to overflow
          overflow.push(...tabs.slice(i));
          break;
        }
      }

      setVisibleTabs(visible);
      setOverflowTabs(overflow);
    };

    // Use requestAnimationFrame for smoother calculation
    let rafId: number;
    const timeoutId = setTimeout(() => {
      rafId = requestAnimationFrame(calculateVisibleTabs);
    }, 150);

    const handleResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(calculateVisibleTabs);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
    };
  }, [tabs, chama]);

  const renderTabContent = () => {
    if (!chama) return null;

    switch (activeTab) {
      case "community":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 md:gap-6">
            {/* Main Content - Posts & Threads */}
            <div className="lg:col-span-3 order-2 lg:order-1">
              <CommunityPosts
                chamaId={chama.id}
                userId={(() => {
                  try {
                    const accessToken = localStorage.getItem("accessToken");
                    if (!accessToken) return "";
                    const payload = JSON.parse(atob(accessToken.split(".")[1]));
                    return payload.sub || payload.userId || "";
                  } catch {
                    return "";
                  }
                })()}
                onMeetingCreated={() =>
                  setMeetingsRefreshKey((prev) => prev + 1)
                }
              />
            </div>

            {/* Right Sidebar - Meetings & Polls */}
            <div className="lg:col-span-1 order-1 lg:order-2">
              <div className="lg:sticky lg:top-20 space-y-3 md:space-y-4 lg:space-y-6">
                <MeetingsSidebar
                  key={meetingsRefreshKey}
                  chamaId={chama.id}
                  onJoinMeeting={handleJoinMeeting}
                />
                <ActivePollsSidebar chamaId={chama.id} />
              </div>
            </div>
          </div>
        );

      case "loans":
        return <LoanDashboard chamaId={chama.id} chamaBalance={chama.current_balance} />;

      case "investments":
        return <InvestmentPortfolio chamaId={chama.id} />;

      case "disputes":
        return (
          <div className="space-y-2 md:space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Disputes</h2>
              <FileDisputeForm
                chamaId={chama.id}
                onDisputeFiled={() => {
                  // Refresh dispute list
                  window.location.reload();
                }}
              />
            </div>
            <DisputeList chamaId={chama.id} showActions={true} />
          </div>
        );

      case "classroom":
        return (
          <div className="space-y-2 md:space-y-4">
            <div className="md:bg-white md:border md:rounded-lg md:shadow-sm p-2 md:p-6">
              <h3 className="text-lg font-semibold mb-2 md:mb-4">
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
            </div>
          </div>
        );

      case "members":
        if (!chama.is_member) {
          return (
            <div className="space-y-2 md:space-y-4">
              <div className="md:bg-white md:border md:rounded-lg md:shadow-sm p-4 md:p-8 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-2 md:mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1 md:mb-2">
                  Member Access Required
                </h3>
                <p className="text-gray-600 mb-3 md:mb-6">
                  You need to be a member to view the member directory.
                </p>
                {!chama.has_pending_request && (
                  <Button
                    onClick={handleJoinCycle}
                    disabled={getJoinButtonDisabled()}
                    className={
                      chama.is_public
                        ? "bg-[#083232] hover:bg-[#2e856e] text-white"
                        : "bg-[#f64d52] hover:bg-[#d43d42] text-white"
                    }
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {getJoinButtonText()}
                  </Button>
                )}
              </div>
            </div>
          );
        }

        const currentUserId = (() => {
          try {
            const accessToken = localStorage.getItem("accessToken");
            if (!accessToken) return null;

            const payload = JSON.parse(atob(accessToken.split(".")[1]));
            return payload.sub || payload.userId;
          } catch {
            return null;
          }
        })();

        return (
          <MemberDirectory
            chamaId={chama.id}
            userRole={userRole}
            currentUserId={currentUserId}
            chamaName={chama.name}
            onInviteMember={() => setShowInviteModal(true)}
            onOpenInviteTab={() => {
              setSettingsInitialTab("invite");
              setShowSettingsModal(true);
            }}
          />
        );

      case "rotation":
        return (
          <RotationPayoutPage
            chamaId={chama.id}
            isAdmin={
              chama.user_role === "admin"
            }
          />
        );

      case "reputation":
        return (
          <ReputationPage
            chamaId={chama.id}
            userId={(() => {
              try {
                const accessToken = localStorage.getItem("accessToken");
                if (!accessToken) return "";
                const payload = JSON.parse(atob(accessToken.split(".")[1]));
                return payload.sub || payload.userId || "";
              } catch {
                return "";
              }
            })()}
            isAdmin={userRole === "admin"}
          />
        );

      case "financials":
        return (
          <div className="space-y-2 md:space-y-6">
            {/* Wallet Header */}
            <div className="bg-[#083232] rounded-xl md:rounded-2xl p-3 md:p-8 text-white shadow-lg border-2 border-[#2e856e]">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm opacity-90">Chama Wallet</p>
                    <h2 className="text-2xl md:text-3xl font-bold">
                      KSh {formatAmount(chama.current_balance)}
                    </h2>
                  </div>
                </div>
                {userRole === "admin" && (
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      onClick={() => setShowChamaDeposit(true)}
                      className="bg-white/20 hover:bg-white/30 border border-white/30 cursor-pointer flex-1 md:flex-initial"
                      size="sm"
                    >
                      <ArrowDownToLine className="w-4 h-4 mr-1 md:mr-2" />
                      <span className="hidden sm:inline">Deposit</span>
                      <span className="sm:hidden">Add</span>
                    </Button>
                    <Button
                      onClick={() => setShowChamaTransfer(true)}
                      className="bg-white/20 hover:bg-white/30 border border-white/30 cursor-pointer flex-1 md:flex-initial"
                      size="sm"
                    >
                      <Send className="w-4 h-4 mr-1 md:mr-2" />
                      <span className="hidden sm:inline">Transfer</span>
                      <span className="sm:hidden">Send</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
              <div className="md:bg-white md:border md:rounded-lg md:shadow-sm md:hover:shadow-lg md:transition-shadow p-2.5 md:p-5 border-l-4 border-l-green-500">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm text-gray-600 mb-1">
                      Available Balance
                    </p>
                    <p className="text-xl md:text-2xl font-bold text-[#083232]">
                      KSh {formatAmount(chama.current_balance)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Ready for payout
                    </p>

                    {/* Fund Request Notifications for this Chama */}
                    {fundRequests.filter(
                      (req) =>
                        req.chama_id === chama.id && req.status === "pending"
                    ).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-orange-600 font-medium mb-2">
                          Pending Fund Requests (
                          {
                            fundRequests.filter(
                              (req) =>
                                req.chama_id === chama.id &&
                                req.status === "pending"
                            ).length
                          }
                          )
                        </p>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {fundRequests
                            .filter(
                              (req) =>
                                req.chama_id === chama.id &&
                                req.status === "pending"
                            )
                            .slice(0, 3)
                            .map((request) => (
                              <div
                                key={request.id}
                                className="bg-orange-50 p-2 rounded-lg border border-orange-200"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-900 truncate">
                                      {request.requester_name}
                                    </p>
                                    <p className="text-xs text-gray-600 truncate">
                                      KSh {formatAmount(request.amount)}
                                    </p>
                                  </div>
                                  <div className="flex gap-1 ml-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0 text-green-600 hover:bg-green-100"
                                      onClick={() =>
                                        respondToRequest(request.id, "approve")
                                      }
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0 text-red-600 hover:bg-red-100"
                                      onClick={() =>
                                        respondToRequest(request.id, "decline")
                                      }
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          {fundRequests.filter(
                            (req) =>
                              req.chama_id === chama.id &&
                              req.status === "pending"
                          ).length > 3 && (
                            <p className="text-xs text-gray-500 text-center">
                              +
                              {fundRequests.filter(
                                (req) =>
                                  req.chama_id === chama.id &&
                                  req.status === "pending"
                              ).length - 3}{" "}
                              more
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="bg-green-100 p-2 md:p-3 rounded-xl flex-shrink-0">
                    <Wallet className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="md:bg-white md:border md:rounded-lg md:shadow-sm md:hover:shadow-lg md:transition-shadow p-2.5 md:p-5 border-l-4 border-l-blue-500">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm text-gray-600 mb-1">
                      Total Collected
                    </p>
                    <p className="text-xl md:text-2xl font-bold text-[#083232]">
                      KSh {formatAmount(chama.total_contributions)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      All-time contributions
                    </p>
                  </div>
                  <div className="bg-blue-100 p-2 md:p-3 rounded-xl flex-shrink-0">
                    <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="md:bg-white md:border md:rounded-lg md:shadow-sm md:hover:shadow-lg md:transition-shadow p-2.5 md:p-5 border-l-4 border-l-purple-500 sm:col-span-2 lg:col-span-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm text-gray-600 mb-1">Next Payout</p>
                    <p className="text-xl md:text-2xl font-bold text-[#083232]">TBD</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Scheduled recipient
                    </p>
                  </div>
                  <div className="bg-purple-100 p-2 md:p-3 rounded-xl flex-shrink-0">
                    <Calendar className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Chama Dashboard Metrics */}
            <ChamaDashboard
              chamaId={chama.id}
              chamaName={chama.name}
              chamaBalance={chama.current_balance}
            />

            {/* Transaction History */}
            <div className="md:bg-white md:border md:rounded-lg md:shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-2 md:px-6 py-2 md:py-4 border-b">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-[#083232] rounded-lg flex items-center justify-center flex-shrink-0">
                      <History className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base md:text-lg font-semibold text-gray-900">
                        Transaction History
                      </h3>
                      {chamaTransactions.length > 0 && (
                        <p className="text-xs text-gray-500">
                          {showAllTransactions
                            ? `Showing all ${chamaTransactions.length} transactions`
                            : `Showing ${Math.min(
                                5,
                                chamaTransactions.length
                              )} of ${chamaTransactions.length}`}
                        </p>
                      )}
                    </div>
                  </div>
                  {chamaTransactions.length > 5 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer flex-shrink-0"
                      onClick={() =>
                        setShowAllTransactions(!showAllTransactions)
                      }
                    >
                      {showAllTransactions ? "Less" : "All"}
                    </Button>
                  )}
                </div>
              </div>
              <div className="divide-y">
                {loadingTransactions ? (
                  <div className="p-2 md:p-6 text-center text-gray-500 text-sm">
                    Loading transactions...
                  </div>
                ) : chamaTransactions.length === 0 ? (
                  <div className="p-2 md:p-6 text-center text-gray-500 text-sm">
                    No transactions yet. Transactions will appear here once
                    members start contributing.
                  </div>
                ) : (
                  (showAllTransactions
                    ? chamaTransactions
                    : chamaTransactions.slice(0, 5)
                  ).map((tx) => (
                    <div
                      key={tx.id}
                      className="p-2 md:p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-2 md:gap-3">
                        <div
                          className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            tx.direction === "credit"
                              ? "bg-green-100"
                              : "bg-red-100"
                          }`}
                        >
                          {tx.direction === "credit" ? (
                            <ArrowDownToLine className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                          ) : (
                            <Send className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm md:text-base truncate">
                                {tx.transaction_name}
                              </p>
                              <p className="text-xs md:text-sm text-gray-500 truncate">
                                {tx.counterparty_name || tx.description}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {new Date(tx.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p
                                className={`font-semibold text-sm md:text-base ${
                                  tx.direction === "credit"
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {tx.direction === "credit" ? "+" : "-"} KSh{" "}
                                {formatAmount(tx.amount)}
                              </p>
                              <p className="text-xs text-gray-400">
                                {tx.status === "completed" ? "✓" : tx.status}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );

      case "activity":
        return <ActivityFeed chamaId={chama.id} />;

      case "documents":
        if (!chama.is_member) {
          return (
            <div className="space-y-2 md:space-y-4">
              <div className="md:bg-white md:border md:rounded-lg md:shadow-sm p-4 md:p-8 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Member Access Required
                </h3>
                <p className="text-gray-600 mb-6">
                  You need to be a member to access the document vault.
                </p>
                {!chama.has_pending_request && (
                  <Button
                    onClick={handleJoinCycle}
                    disabled={getJoinButtonDisabled()}
                    className={
                      chama.is_public
                        ? "bg-[#083232] hover:bg-[#2e856e] text-white"
                        : "bg-[#f64d52] hover:bg-[#d43d42] text-white"
                    }
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {getJoinButtonText()}
                  </Button>
                )}
              </div>
            </div>
          );
        }
        return <DocumentVault chamaId={chama.id} />;

      case "about":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 md:gap-6">
            {/* Main Content Area */}
            <div className="lg:col-span-2 order-1 space-y-2 md:space-y-4">
              <div className="md:bg-white md:border md:rounded-lg md:shadow-sm overflow-hidden">
                {/* Cover Image - Full width, no padding */}
                {userRole === "admin" && !chama.cover_image && (
                  <div className="border-2 border-dashed border-gray-300 p-3 md:p-8 text-center">
                    <input
                      type="file"
                      id="cover-image-upload"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                    <label
                      htmlFor="cover-image-upload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <Upload className="w-10 h-10 md:w-12 md:h-12 text-gray-400 mb-2" />
                      <p className="text-sm font-medium text-gray-700">
                        {uploadingImage
                          ? "Uploading..."
                          : "Upload Cover Image"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        PNG, JPG up to 5MB
                      </p>
                    </label>
                  </div>
                )}

                {chama.cover_image && (
                  <div className="relative w-full h-48 md:h-64 overflow-hidden group">
                    <Image
                      src={chama.cover_image}
                      alt={chama.name}
                      fill
                      className="object-cover"
                    />
                    {userRole === "admin" && (
                      <>
                        <input
                          type="file"
                          id="cover-image-edit"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          disabled={uploadingImage}
                        />
                        <label
                          htmlFor="cover-image-edit"
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 md:group-hover:opacity-100 active:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
                        >
                          <div className="text-white text-center">
                            <Upload className="w-6 h-6 md:w-8 md:h-8 mx-auto mb-2" />
                            <p className="text-xs md:text-sm font-medium">
                              {uploadingImage
                                ? "Uploading..."
                                : "Change Image"}
                            </p>
                          </div>
                        </label>
                      </>
                    )}
                  </div>
                )}

                {/* Content with padding */}
                <div className="p-2 md:p-6 space-y-2 md:space-y-4">

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2 text-sm md:text-base">
                      Description
                    </h4>
                    <div className="text-gray-600 leading-relaxed text-sm md:text-base">
                      {/* Mobile: Show truncated description with "View more" */}
                      <div className="md:hidden">
                        <p className={showFullDescription ? "" : "line-clamp-3"}>
                          {chama.description}
                        </p>
                        {chama.description && chama.description.length > 150 && (
                          <button
                            onClick={() => setShowFullDescription(!showFullDescription)}
                            className="text-[#083232] font-medium text-sm mt-2 hover:underline"
                          >
                            {showFullDescription ? "View less" : "View more"}
                          </button>
                        )}
                      </div>
                      {/* Desktop: Show full description */}
                      <p className="hidden md:block">
                        {chama.description}
                      </p>
                    </div>
                  </div>

                  {/* Mobile: Metadata inline after description - 2 rows of 3 items */}
                  <div className="md:hidden pt-2 border-t border-gray-200">
                    <div className="grid grid-cols-3 gap-2">
                      {/* Row 1: Type, Visibility, Status */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Type</p>
                        <p className="text-sm font-medium text-gray-900 capitalize truncate">
                          {chama.type?.replace("-", " ") || "Savings"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Visibility</p>
                        <p className="text-sm font-medium text-gray-900 capitalize">
                          {chama.is_public ? "Public" : "Private"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Status</p>
                        <p className="text-sm font-medium text-gray-900 capitalize">
                          {chama.status}
                        </p>
                      </div>
                      {/* Row 2: Lending, Created, Admin */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Lending</p>
                        <p className="text-sm font-medium text-gray-900">
                          {chama.lending_enabled ? "Enabled" : "Disabled"}
                        </p>
                      </div>
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
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Admin</p>
                        <p className="text-sm font-medium text-gray-900 truncate" title={chama.admin_name || chama.admin_email}>
                          {chama.admin_name ? getLastName(chama.admin_name) : (chama.admin_email || "")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {chama.tags && chama.tags.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-xs md:text-sm text-gray-600 mb-2">Tags</p>
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
              </div>
            </div>

            {/* Desktop Sidebar */}
            <div className="hidden lg:block order-2 lg:order-1">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 md:p-5 space-y-3 md:space-y-3.5">
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

                  {/* Join/Request to Join Button */}
                  {!chama.is_member && chama.status === "active" && (
                    <div className="pt-4 border-t border-gray-100">
                      <button
                        onClick={handleJoinCycle}
                        disabled={getJoinButtonDisabled()}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                          chama.has_pending_request
                            ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                            : "bg-[#083232] hover:bg-[#2e856e] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        }`}
                      >
                        <UserPlus className="w-4 h-4" />
                        {getJoinButtonText()}
                      </button>
                    </div>
                  )}
                </div>

                {/* Settings Button (All Members) */}
                {chama?.is_member && (
                  <div className="mt-6 pt-6 border-t border-gray-200 px-4 md:px-5 pb-4 md:pb-5">
                    <button
                      onClick={() => setShowSettingsModal(true)}
                      className="flex items-center gap-2 text-gray-700 hover:text-gray-900 cursor-pointer"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>
                  </div>
                )}
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
        isChamaPage={true}
        isAdmin={userRole === "admin"}
        isMember={chama?.is_member || false}
        onSettingsClick={() => setShowSettingsModal(true)}
      />

      {/* Tabs Navigation */}
      <div className="bg-white border-b sticky top-14 md:top-16 z-10 shadow-sm mt-14 md:mt-16 pt-2 md:pt-0">
        {/* Desktop Tabs */}
        <div className="hidden md:block max-w-[1085px] mx-auto px-4 relative" ref={tabContainerRef}>
          {/* Hidden tabs for measurement - render all tabs invisibly to measure widths */}
          <div className="absolute opacity-0 pointer-events-none -z-10" aria-hidden="true" style={{ visibility: 'hidden' }}>
            <div className="flex items-center gap-1">
              {tabs.map((tab, index) => (
                <button
                  key={`measure-${tab.id}`}
                  ref={(el) => {
                    if (el) {
                      tabRefs.current[index] = el;
                    }
                  }}
                  className="px-4 py-3 text-sm font-medium whitespace-nowrap"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* First line - visible tabs */}
          <div className="flex items-center gap-1">
            {(visibleTabs.length > 0 ? visibleTabs : tabs).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    // Update URL with tab parameter
                    const currentUrl = new URL(window.location.href);
                    currentUrl.searchParams.set("tab", tab.id);
                    router.push(currentUrl.pathname + currentUrl.search, {
                      scroll: false,
                    });
                  }}
                  className={`
                    px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors
                    border-b-2 min-h-12 flex-shrink-0 cursor-pointer
                    ${
                      isActive
                        ? "border-[#083232] text-[#083232]"
                        : "border-transparent text-gray-600 hover:text-[#083232] hover:border-gray-300"
                    }
                  `}
                >
                  {tab.label}
                </button>
              );
            })}
            {overflowTabs.length > 0 && (
              <button
                onClick={() => setShowOverflowTabs(!showOverflowTabs)}
                className={`
                  flex items-center justify-center px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors
                  border-b-2 min-h-12 flex-shrink-0 cursor-pointer
                  ${
                    overflowTabs.some((tab) => activeTab === tab.id) || showOverflowTabs
                      ? "border-[#083232] text-[#083232]"
                      : "border-transparent text-gray-600 hover:text-[#083232] hover:border-gray-300"
                  }
                `}
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
          </div>
          
          {/* Second line - overflow tabs (shown when hamburger is clicked) */}
          {overflowTabs.length > 0 && showOverflowTabs && (
            <div className="flex items-center gap-1 pt-1 border-t border-gray-200 mt-1">
              {overflowTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      const currentUrl = new URL(window.location.href);
                      currentUrl.searchParams.set("tab", tab.id);
                      router.push(currentUrl.pathname + currentUrl.search, {
                        scroll: false,
                      });
                    }}
                    className={`
                      px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors
                      border-b-2 min-h-12 flex-shrink-0 cursor-pointer
                      ${
                        isActive
                          ? "border-[#083232] text-[#083232]"
                          : "border-transparent text-gray-600 hover:text-[#083232] hover:border-gray-300"
                      }
                    `}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Mobile Tabs - Horizontal Scroll */}
        <div className="md:hidden overflow-x-auto scrollbar-hide -mx-4 px-4 py-2">
          <div className="flex items-center gap-3" style={{ width: 'max-content' }}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    const currentUrl = new URL(window.location.href);
                    currentUrl.searchParams.set("tab", tab.id);
                    router.push(currentUrl.pathname + currentUrl.search, {
                      scroll: false,
                    });
                  }}
                  className={`
                    px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 border-b-2
                    ${
                      isActive
                        ? "border-[#083232] text-[#083232]"
                        : "border-transparent text-gray-600"
                    }
                  `}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1085px] mx-auto px-2 md:px-4 py-2 md:py-8 flex-1 w-full">
        {renderTabContent()}
      </div>

      {/* Settings Modal */}
      {showSettingsModal && chama && (
        <ChamaSettingsModal
          isOpen={showSettingsModal}
          onClose={() => {
            setShowSettingsModal(false);
            setSettingsInitialTab(undefined);
          }}
          chama={chama}
          isAdmin={userRole === "admin"}
          initialTab={settingsInitialTab as any}
          showOnlyTab={settingsInitialTab === "invite"}
          onSettingsUpdated={async () => {
            // Refetch chama data to get updated settings
            const accessToken = localStorage.getItem("accessToken");
            if (accessToken) {
              const response = await fetch(apiUrl(`chama/${chama.id}`), {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              });
              if (response.ok) {
                const updatedChama = await response.json();
                setChama(updatedChama);
              }
            }
            setShowSettingsModal(false);
          }}
          onDeleteCycle={() => {
            setShowSettingsModal(false);
            setShowDeleteConfirm(true);
          }}
        />
      )}

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

      {/* Chama Deposit Modal */}
      <ChamaDepositModal
        isOpen={showChamaDeposit}
        chamaId={chama?.id || ""}
        chamaName={chama?.name || ""}
        onClose={() => setShowChamaDeposit(false)}
        onSuccess={refreshChamaData}
      />

      {/* Chama Transfer Modal */}
      <ChamaTransferModal
        isOpen={showChamaTransfer}
        sourceChamaId={chama?.id || ""}
        sourceChamaName={chama?.name || ""}
        sourceChamaBalance={chama?.current_balance || 0}
        userChamas={userChamas}
        chamaMembers={chamaMembers}
        onClose={() => setShowChamaTransfer(false)}
        onSuccess={refreshChamaData}
      />

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={showInviteModal}
        chamaId={chama?.id || ""}
        chamaName={chama?.name || ""}
        onClose={() => setShowInviteModal(false)}
        onSuccess={refreshChamaData}
      />

      {/* Floating Meeting Indicator */}
      {meetingMinimized && showSpacesModal && (
        <FloatingMeetingIndicator
          isVisible={meetingMinimized}
          meetingTitle={activeMeetingTitle}
          participantCount={meetingParticipantCount}
          onClick={() => setMeetingMinimized(false)}
        />
      )}

      {/* Spaces Meeting Modal */}
      {showSpacesModal && (
        <SpacesMeetingModal
          isOpen={!meetingMinimized}
          onClose={() => {
            setShowSpacesModal(false);
            setMeetingMinimized(false);
          }}
          onMinimize={() => setMeetingMinimized(true)}
          onParticipantCountChange={setMeetingParticipantCount}
          meetingId={activeMeetingId}
          meetingTitle={activeMeetingTitle}
          livekitToken={livekitToken}
          livekitUrl={livekitUrl}
          isHost={isHostOfMeeting}
        />
      )}

      <Footer />
    </div>
  );
}
