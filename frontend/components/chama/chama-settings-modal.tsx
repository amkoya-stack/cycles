/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api-config";
import {
  Loader2,
  Copy,
  CheckCircle,
  Mail,
  Share2,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
} from "lucide-react";

interface ChamaSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chama: any;
  onSettingsUpdated: () => void;
  onDeleteCycle: () => void;
  isAdmin?: boolean;
  initialTab?: TabType; // Optional prop to set initial tab
  showOnlyTab?: boolean; // If true, hide tabs and show only the initialTab content
}

type Frequency = "daily" | "weekly" | "monthly" | "custom";

type TabType =
  | "general"
  | "rules"
  | "visibility"
  | "advanced"
  | "invite"
  | "tabs"
  | "membership"
  | "chat"
  | "notifications";

export function ChamaSettingsModal({
  isOpen,
  onClose,
  chama,
  onSettingsUpdated,
  onDeleteCycle,
  isAdmin = false,
  initialTab,
  showOnlyTab = false,
}: ChamaSettingsModalProps) {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);
  const [restrictTabsFromMembers, setRestrictTabsFromMembers] = useState(false);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showSaveMessage, setShowSaveMessage] = useState(false);
  const saveMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Member settings state
  const [memberJoinedDate, setMemberJoinedDate] = useState<string | null>(null);
  const [notificationEmailFrequency, setNotificationEmailFrequency] = useState<
    "hourly" | "daily" | "weekly" | "never"
  >("daily");
  const [adminAnnouncements, setAdminAnnouncements] = useState(true);
  const [eventReminderEmail, setEventReminderEmail] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(true);

  // Update activeTab when modal opens or isAdmin changes
  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      } else {
        setActiveTab(isAdmin ? "general" : "membership");
      }
    }
  }, [isOpen, isAdmin, initialTab]);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    contributionAmount: "",
    frequency: "monthly" as Frequency,
    customIntervalDays: "7",
    maxMembers: "",
    // Settings
    auto_payout: false,
    late_penalty_enabled: false,
    allow_partial_contributions: false,
    members_can_invite: false,
    invite_requires_approval: false,
    minMembers: "2",
    joiningFee: "",
    latePenaltyAmount: "",
    latePenaltyDays: "3",
    is_public: true,
    hidden: false,
  });

  // Fetch member join date and chat settings
  useEffect(() => {
    const fetchMemberInfo = async () => {
      if (!chama?.id || isAdmin) return;

      try {
        const accessToken = localStorage.getItem("accessToken");
        if (!accessToken) return;

        // Get current user ID
        let currentUserId = "";
        try {
          const payload = JSON.parse(atob(accessToken.split(".")[1]));
          currentUserId = payload.sub || payload.userId || "";
        } catch (e) {
          console.error("Failed to parse token:", e);
          return;
        }

        // Fetch member info
        const response = await fetch(apiUrl(`chama/${chama.id}/members`), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const members = await response.json();
          const currentMember = members.find(
            (m: any) => m.user_id === currentUserId
          );
          if (currentMember?.joined_at) {
            setMemberJoinedDate(currentMember.joined_at);
          }
        }

        // Fetch chat settings
        const chatSettingsResponse = await fetch(
          apiUrl(`activity/preferences/me?chamaId=${chama.id}`),
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (chatSettingsResponse.ok) {
          const chatSettings = await chatSettingsResponse.json();
          setChatEnabled(chatSettings.chat_enabled !== false); // Default to true
        }
      } catch (error) {
        console.error("Failed to fetch member info:", error);
      }
    };

    if (isOpen && !isAdmin) {
      fetchMemberInfo();
    }
  }, [chama?.id, isOpen, isAdmin]);

  // Initialize form data from chama
  useEffect(() => {
    if (chama) {
      const settings = chama.settings || {};
      const intervalDays = chama.interval_days || 7;
      let frequency: Frequency = "monthly";
      if (intervalDays === 1) frequency = "daily";
      else if (intervalDays === 7) frequency = "weekly";
      else if (intervalDays === 30) frequency = "monthly";
      else frequency = "custom";

      setFormData({
        name: chama.name || "",
        description: chama.description || "",
        contributionAmount: chama.contribution_amount?.toString() || "",
        frequency,
        customIntervalDays: intervalDays.toString(),
        maxMembers: chama.max_members?.toString() || "50",
        auto_payout: settings.auto_payout || false,
        late_penalty_enabled: settings.late_penalty_enabled || false,
        allow_partial_contributions:
          settings.allow_partial_contributions || false,
        members_can_invite: settings.members_can_invite || false,
        invite_requires_approval: settings.invite_requires_approval || false,
        minMembers: settings.minMembers?.toString() || "2",
        joiningFee: settings.joiningFee?.toString() || "",
        latePenaltyAmount: settings.latePenalty?.amount?.toString() || "",
        latePenaltyDays: settings.latePenalty?.graceDays?.toString() || "3",
        is_public: chama.is_public !== undefined ? chama.is_public : true,
        hidden: settings.hidden === true,
      });
      setRestrictTabsFromMembers(settings.restrictTabsFromMembers || false);
      setHiddenTabs(settings.hiddenTabs || []);
      setHasChanges(false);
      setShowSaveMessage(false);
    }
  }, [chama, isOpen]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // Auto-save function
  const performSave = async (showToast = false) => {
    if (!chama || !hasChanges) return;

    // Validate required fields
    if (!formData.name.trim() || !formData.contributionAmount) {
      return;
    }

    setIsSaving(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        if (showToast) {
        toast({
          title: "Authentication required",
          description: "Please log in to update settings",
          variant: "destructive",
        });
        }
        return;
      }

      // Prepare contribution frequency and interval days
      let intervalDays = parseInt(formData.customIntervalDays);
      if (formData.frequency === "daily") {
        intervalDays = 1;
      } else if (formData.frequency === "weekly") {
        intervalDays = 7;
      } else if (formData.frequency === "monthly") {
        intervalDays = 30;
      }

      // Prepare settings object
      const settings = {
        ...(chama.settings || {}),
        auto_payout: formData.auto_payout,
        late_penalty_enabled: formData.late_penalty_enabled,
        allow_partial_contributions: formData.allow_partial_contributions,
        members_can_invite: formData.members_can_invite,
        invite_requires_approval: formData.invite_requires_approval,
        minMembers: parseInt(formData.minMembers) || 2,
        joiningFee: parseFloat(formData.joiningFee) || 0,
        latePenalty: {
          amount: parseFloat(formData.latePenaltyAmount) || 0,
          graceDays: parseInt(formData.latePenaltyDays) || 3,
        },
        hidden: formData.hidden,
        visibility: formData.is_public ? "public" : "private",
        restrictTabsFromMembers: restrictTabsFromMembers,
        hiddenTabs: hiddenTabs,
      };

      const payload: any = {
        name: formData.name,
        description: formData.description,
        contributionAmount: parseFloat(formData.contributionAmount),
        contributionFrequency: formData.frequency,
        contributionIntervalDays: intervalDays,
        maxMembers: parseInt(formData.maxMembers) || 50,
        is_public: formData.is_public,
        settings,
      };

      const response = await fetch(apiUrl(`chama/${chama.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to update settings (${response.status})`
        );
      }

      if (showToast) {
      toast({
        title: "Settings Updated",
        description: "Chama settings have been updated successfully",
        variant: "default",
      });
      }

      setHasChanges(false);
      // Show save message and hide after 10 seconds
      setShowSaveMessage(true);
      if (saveMessageTimeoutRef.current) {
        clearTimeout(saveMessageTimeoutRef.current);
      }
      saveMessageTimeoutRef.current = setTimeout(() => {
        setShowSaveMessage(false);
      }, 10000);
      // Only call onSettingsUpdated for manual saves (when showToast is true)
      // For auto-save, we skip the callback to avoid closing the modal or redirecting
      if (showToast) {
      onSettingsUpdated();
      }
      // For auto-save (showToast = false), we don't call onSettingsUpdated
      // This prevents the modal from closing and any potential redirects
    } catch (error: any) {
      console.error("Settings update error:", error);
      if (showToast) {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save chat settings when changed
  useEffect(() => {
    if (!chama?.id || isAdmin) return;

    const saveChatSettings = async () => {
      try {
        const accessToken = localStorage.getItem("accessToken");
        if (!accessToken) return;

        const response = await fetch(apiUrl("activity/preferences/me"), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            chamaId: chama.id,
            chatEnabled: chatEnabled,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(
            "Failed to save chat settings:",
            response.status,
            errorData
          );
          toast({
            title: "Error",
            description: "Failed to save chat settings. Please try again.",
            variant: "destructive",
          });
        } else {
          console.log("Chat settings saved successfully:", chatEnabled);
        }
      } catch (error) {
        console.error("Failed to save chat settings:", error);
        toast({
          title: "Error",
          description: "Failed to save chat settings. Please try again.",
          variant: "destructive",
        });
      }
    };

    // Debounce chat settings save
    const timeoutId = setTimeout(() => {
      saveChatSettings();
    }, 1000);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatEnabled, chama?.id, isAdmin]);

  // Auto-save with debouncing
  useEffect(() => {
    if (!hasChanges || !chama) return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save (1.5 seconds after last change)
    autoSaveTimeoutRef.current = setTimeout(() => {
      performSave(false);
    }, 1500);

    // Cleanup on unmount
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (saveMessageTimeoutRef.current) {
        clearTimeout(saveMessageTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, hiddenTabs, restrictTabsFromMembers, hasChanges, chama?.id]);

  // Get cycle URL
  const getCycleUrl = () => {
    if (!chama) return "";
    const slug = chama.name?.toLowerCase().replace(/\s+/g, "-") || "";
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/${encodeURIComponent(slug)}?tab=about`;
  };

  // Copy cycle link to clipboard
  const copyCycleLink = async () => {
    try {
      const url = getCycleUrl();
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Cycle link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy link",
      });
    }
  };

  // Share to social media
  const shareToSocial = async (platform: string) => {
    const url = getCycleUrl();
    const text = `Check out ${chama?.name || "this cycle"} on Cycles!`;
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(text);
    const fullText = `${text} ${url}`;
    const encodedFullText = encodeURIComponent(fullText);

    try {
      switch (platform) {
        case "facebook":
          window.open(
            `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
            "_blank",
            "width=600,height=400"
          );
          break;

        case "twitter":
          window.open(
            `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
            "_blank",
            "width=600,height=400"
          );
          break;

        case "linkedin":
          window.open(
            `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
            "_blank",
            "width=600,height=400"
          );
          break;

        case "whatsapp":
          // WhatsApp Web/Desktop
          if (window.innerWidth > 768) {
            window.open(
              `https://web.whatsapp.com/send?text=${encodedFullText}`,
              "_blank"
            );
    } else {
            // Mobile WhatsApp
            window.open(`https://wa.me/?text=${encodedFullText}`, "_blank");
          }
          break;

        case "instagram":
          // Instagram doesn't support direct URL sharing
          // Copy link to clipboard and show message
          await navigator.clipboard.writeText(url);
          toast({
            title: "Link Copied!",
            description:
              "Link copied to clipboard. Paste it in your Instagram post or story.",
          });
          break;

        case "tiktok":
          // TikTok doesn't support direct URL sharing
          // Copy link to clipboard and show message
          await navigator.clipboard.writeText(url);
          toast({
            title: "Link Copied!",
            description:
              "Link copied to clipboard. Paste it in your TikTok video description.",
          });
          break;

        default:
      toast({
        title: "Share",
        description: `Please copy the link and share it on ${platform}`,
          });
      }
    } catch (err) {
      console.error("Error sharing:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to share. Please try copying the link manually.",
      });
    }
  };

  // Send invite via email
  const sendEmailInvite = async () => {
    if (!inviteEmail || !inviteEmail.includes("@")) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: "Please enter a valid email address",
      });
      return;
    }

    setSendingInvite(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        toast({
          variant: "destructive",
          title: "Authentication required",
          description: "Please log in to send invites",
        });
        return;
      }

      const response = await fetch(apiUrl(`chama/${chama.id}/invite`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email: inviteEmail }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to send invite");
      }

      toast({
        title: "Invite Sent!",
        description: `Invite sent to ${inviteEmail}`,
      });
      setInviteEmail("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send invite",
      });
    } finally {
      setSendingInvite(false);
    }
  };

  // Check scroll position and update arrow visibility
  const checkScrollPosition = () => {
    const container = tabsScrollRef.current;
    if (!container) return;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  };

  // Check scroll position on mount and when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        checkScrollPosition();
      }, 100);
    }
  }, [isOpen]);

  // Scroll tabs left
  const scrollTabsLeft = () => {
    const container = tabsScrollRef.current;
    if (container) {
      container.scrollBy({ left: -200, behavior: "smooth" });
      setTimeout(() => checkScrollPosition(), 300);
    }
  };

  // Scroll tabs right
  const scrollTabsRight = () => {
    const container = tabsScrollRef.current;
    if (container) {
      container.scrollBy({ left: 200, behavior: "smooth" });
      setTimeout(() => checkScrollPosition(), 300);
    }
  };

  // On mobile, render as full page, on desktop as modal
  if (!isOpen) return null;

  // Define tabs based on user role
  const adminTabs = [
    { id: "general" as TabType, label: "General" },
    { id: "rules" as TabType, label: "Rules" },
    { id: "visibility" as TabType, label: "Visibility" },
    { id: "advanced" as TabType, label: "Advanced" },
    { id: "invite" as TabType, label: "Invite" },
    { id: "tabs" as TabType, label: "Tabs" },
  ];

  // Mobile tabs for members include Membership, desktop doesn't
  const memberTabsMobile = [
    { id: "membership" as TabType, label: "Membership" },
    { id: "chat" as TabType, label: "Chat" },
    { id: "notifications" as TabType, label: "Notifications" },
    { id: "invite" as TabType, label: "Invite" },
  ];

  const memberTabsDesktop = [
    { id: "chat" as TabType, label: "Chat" },
    { id: "notifications" as TabType, label: "Notifications" },
    { id: "invite" as TabType, label: "Invite" },
  ];

  const tabs = isAdmin ? adminTabs : memberTabsMobile;

  // Mobile: Full page view
  const mobileView = (
    <div className="md:hidden fixed inset-0 z-[100] bg-white flex flex-col pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">Cycle Settings</h1>
        </div>
      </div>

      {/* Tabs - Hide if showOnlyTab is true */}
      {!showOnlyTab && (
      <div className="border-b bg-white relative">
        {/* Left Arrow - Mobile Only */}
        {canScrollLeft && (
          <button
            onClick={scrollTabsLeft}
            className="md:hidden absolute left-0 top-0 bottom-0 z-10 bg-white/90 hover:bg-white px-2 flex items-center shadow-sm"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        )}

        {/* Right Arrow - Mobile Only */}
        {canScrollRight && (
          <button
            onClick={scrollTabsRight}
            className="md:hidden absolute right-0 top-0 bottom-0 z-10 bg-white/90 hover:bg-white px-2 flex items-center shadow-sm"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        )}

        <div
          ref={tabsScrollRef}
          className="overflow-x-auto scrollbar-hide -mx-4 px-4 py-2"
          onScroll={checkScrollPosition}
        >
          <div
            className="flex items-center gap-3"
            style={{ width: "max-content" } as React.CSSProperties}
          >
              {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                activeTab === tab.id
                  ? "border-[#083232] text-[#083232]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
          </div>
        </div>
      </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Mobile Tab Content - same as before */}
          {activeTab === "general" && (
            <div className="space-y-4">
              {/* Basic Information */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name-mobile" className="text-xs">
                    Cycle Name *
                  </Label>
                  <Input
                    id="name-mobile"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Enter cycle name"
                    className="mt-1 h-9 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="description-mobile" className="text-xs">
                    Description
                  </Label>
                  <Textarea
                    id="description-mobile"
                    value={formData.description}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value)
                    }
                    placeholder="Enter cycle description"
                    className="mt-1 min-h-[80px] text-sm"
                    maxLength={150}
                  />
                </div>
              </div>

              {/* Contribution Settings */}
              <div className="space-y-3 border-t pt-4">
                <div>
                  <Label
                    htmlFor="contributionAmount-mobile"
                    className="text-xs"
                  >
                    Contribution Amount *
                  </Label>
                  <Input
                    id="contributionAmount-mobile"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.contributionAmount}
                    onChange={(e) =>
                      handleInputChange("contributionAmount", e.target.value)
                    }
                    placeholder="0.00"
                    className="mt-1 h-9 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="frequency-mobile" className="text-xs">
                    Contribution Frequency *
                  </Label>
                  <select
                    id="frequency-mobile"
                    value={formData.frequency}
                    onChange={(e) =>
                      handleInputChange(
                        "frequency",
                        e.target.value as Frequency
                      )
                    }
                    className="mt-1 w-full px-3 py-2 h-9 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#083232] text-sm"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                {formData.frequency === "custom" && (
                  <div>
                    <Label
                      htmlFor="customIntervalDays-mobile"
                      className="text-xs"
                    >
                      Interval (Days) *
                    </Label>
                    <Input
                      id="customIntervalDays-mobile"
                      type="number"
                      min="1"
                      value={formData.customIntervalDays}
                      onChange={(e) =>
                        handleInputChange("customIntervalDays", e.target.value)
                      }
                      placeholder="7"
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "rules" && (
            <div className="space-y-4">
              {/* Membership Settings */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="minMembers-mobile" className="text-xs">
                      Minimum Members
                    </Label>
                    <Input
                      id="minMembers-mobile"
                      type="number"
                      min="2"
                      value={formData.minMembers}
                      onChange={(e) =>
                        handleInputChange("minMembers", e.target.value)
                      }
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxMembers-mobile" className="text-xs">
                      Maximum Members *
                    </Label>
                    <Input
                      id="maxMembers-mobile"
                      type="number"
                      min="2"
                      value={formData.maxMembers}
                      onChange={(e) =>
                        handleInputChange("maxMembers", e.target.value)
                      }
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="joiningFee-mobile" className="text-xs">
                    Joining Fee
                  </Label>
                  <Input
                    id="joiningFee-mobile"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.joiningFee}
                    onChange={(e) =>
                      handleInputChange("joiningFee", e.target.value)
                    }
                    placeholder="0.00"
                    className="mt-1 h-9 text-sm"
                  />
                </div>
              </div>

              {/* Late Penalty */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-start justify-between space-x-3">
                  <div className="flex-1 space-y-0.5">
                    <Label
                      htmlFor="late-penalty-mobile"
                      className="text-xs font-medium"
                    >
                      Late Payment Penalties
                    </Label>
                  </div>
                  <Switch
                    id="late-penalty-mobile"
                    checked={formData.late_penalty_enabled}
                    onCheckedChange={(checked) =>
                      handleInputChange("late_penalty_enabled", checked)
                    }
                    disabled={isSaving}
                  />
                </div>
                {formData.late_penalty_enabled && (
                  <div className="grid grid-cols-2 gap-3 pl-3 border-l-2 border-gray-200">
                    <div>
                      <Label
                        htmlFor="latePenaltyAmount-mobile"
                        className="text-xs"
                      >
                        Penalty Amount
                      </Label>
                      <Input
                        id="latePenaltyAmount-mobile"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.latePenaltyAmount}
                        onChange={(e) =>
                          handleInputChange("latePenaltyAmount", e.target.value)
                        }
                        className="mt-1 h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="latePenaltyDays-mobile"
                        className="text-xs"
                      >
                        Grace Period (Days)
                      </Label>
                      <Input
                        id="latePenaltyDays-mobile"
                        type="number"
                        min="0"
                        value={formData.latePenaltyDays}
                        onChange={(e) =>
                          handleInputChange("latePenaltyDays", e.target.value)
                        }
                        className="mt-1 h-9 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Partial Contributions */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-start justify-between space-x-3">
                  <div className="flex-1 space-y-0.5">
                    <Label
                      htmlFor="partial-contributions-mobile"
                      className="text-xs font-medium"
                    >
                      Allow Partial Contributions
                    </Label>
                  </div>
                  <Switch
                    id="partial-contributions-mobile"
                    checked={formData.allow_partial_contributions}
                    onCheckedChange={(checked) =>
                      handleInputChange("allow_partial_contributions", checked)
                    }
                    disabled={isSaving}
                  />
                </div>
              </div>

              {/* Invite Settings */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-start justify-between space-x-3 pb-3 border-b">
                  <div className="flex-1 space-y-0.5">
                    <Label
                      htmlFor="members-can-invite-mobile"
                      className="text-xs font-medium"
                    >
                      Members Can Invite
                    </Label>
                  </div>
                  <Switch
                    id="members-can-invite-mobile"
                    checked={formData.members_can_invite}
                    onCheckedChange={(checked) =>
                      handleInputChange("members_can_invite", checked)
                    }
                    disabled={isSaving}
                  />
                </div>
                <div className="flex items-start justify-between space-x-3">
                  <div className="flex-1 space-y-0.5">
                    <Label
                      htmlFor="invite-approval-mobile"
                      className="text-xs font-medium"
                    >
                      Invite Requires Approval
                    </Label>
                  </div>
                  <Switch
                    id="invite-approval-mobile"
                    checked={formData.invite_requires_approval}
                    onCheckedChange={(checked) =>
                      handleInputChange("invite_requires_approval", checked)
                    }
                    disabled={isSaving || !formData.members_can_invite}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "visibility" && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between space-x-3 pb-3 border-b">
                  <div className="flex-1 space-y-0.5">
                    <Label
                      htmlFor="is-public-mobile"
                      className="text-xs font-medium"
                    >
                      Public Cycle
                    </Label>
                    <p className="text-xs text-gray-600">
                      Anyone can see and request to join this cycle.
                    </p>
                  </div>
                  <Switch
                    id="is-public-mobile"
                    checked={formData.is_public}
                    onCheckedChange={(checked) =>
                      handleInputChange("is_public", checked)
                    }
                    disabled={isSaving}
                  />
                </div>
                <div className="flex items-start justify-between space-x-3">
                  <div className="flex-1 space-y-0.5">
                    <Label
                      htmlFor="hidden-mobile"
                      className="text-xs font-medium"
                    >
                      Hide from Homepage
                    </Label>
                    <p className="text-xs text-gray-600">
                      Hide this cycle from appearing on the homepage.
                    </p>
                  </div>
                  <Switch
                    id="hidden-mobile"
                    checked={formData.hidden}
                    onCheckedChange={(checked) =>
                      handleInputChange("hidden", checked)
                    }
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "advanced" && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between space-x-3">
                  <div className="flex-1 space-y-0.5">
                    <Label
                      htmlFor="auto-payout-mobile"
                      className="text-xs font-medium"
                    >
                      Automatic Payouts
                    </Label>
                    <p className="text-xs text-gray-600">
                      Automatically process payouts when all members have
                      contributed.
                    </p>
                  </div>
                  <Switch
                    id="auto-payout-mobile"
                    checked={formData.auto_payout}
                    onCheckedChange={(checked) =>
                      handleInputChange("auto_payout", checked)
                    }
                    disabled={isSaving}
                  />
                </div>
                <div className="border-t pt-4">
                  <button
                    onClick={onDeleteCycle}
                    className="text-red-600 hover:text-red-700 text-sm font-medium cursor-pointer w-full text-left"
                  >
                    Delete Cycle
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "invite" && (
            <div className="space-y-4">
              {/* Share your cycle link */}
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium">
                    Share your cycle link
                  </Label>
                  <p className="text-xs text-gray-600 mt-1">
                    When people click this link, they will be redirected to your
                    cycle&apos;s About page where they can join or request
                    membership.
                  </p>
              </div>

                {/* Cycle URL with Copy button */}
                <div className="flex gap-2">
                  <Input
                    value={getCycleUrl()}
                    readOnly
                    className="font-mono text-xs flex-1"
                  />
                  <Button
                    onClick={copyCycleLink}
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 px-3"
                  >
                    {copied ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span className="ml-1 text-xs">COPY</span>
                  </Button>
                </div>

                {/* Social Media Share Buttons */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">
                    Share to Facebook, Instagram, Twitter, LinkedIn, TikTok, etc
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => shareToSocial("facebook")}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      <Share2 className="w-3 h-3 mr-1" />
                      Facebook
                    </Button>
                    <Button
                      onClick={() => shareToSocial("twitter")}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      <Share2 className="w-3 h-3 mr-1" />
                      Twitter
                    </Button>
                    <Button
                      onClick={() => shareToSocial("linkedin")}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      <Share2 className="w-3 h-3 mr-1" />
                      LinkedIn
                    </Button>
                    <Button
                      onClick={() => shareToSocial("instagram")}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      <Share2 className="w-3 h-3 mr-1" />
                      Instagram
                    </Button>
                    <Button
                      onClick={() => shareToSocial("tiktok")}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      <Share2 className="w-3 h-3 mr-1" />
                      TikTok
                    </Button>
                    <Button
                      onClick={() => shareToSocial("whatsapp")}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      <MessageCircle className="w-3 h-3 mr-1" />
                      WhatsApp
                    </Button>
                  </div>
                </div>
              </div>

              {/* Send invite through Email */}
              <div className="space-y-3 border-t pt-4">
                <Label className="text-xs font-medium">
                  Send invite through Email
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 text-xs"
                  />
                  <Button
                    onClick={sendEmailInvite}
                    disabled={sendingInvite || !inviteEmail}
                    size="sm"
                    className="bg-[#083232] hover:bg-[#2e856e] text-white flex-shrink-0"
                  >
                    {sendingInvite ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-3 h-3 mr-1" />
                        Send
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "tabs" && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium">
                    Show/hide tabs from members
                  </Label>
                  <p className="text-xs text-gray-600 mt-1">
                    Control which tabs are visible to members of this cycle.
                    Toggle off to hide sensitive tabs like Financials or
                    Documents from members.
                  </p>
                </div>

                {/* List all tabs with toggles */}
                <div className="space-y-3 border-t pt-4">
                  {[
                    { id: "community", label: "Community" },
                    { id: "classroom", label: "Classroom" },
                    { id: "members", label: "Members" },
                    { id: "rotation", label: "Rotation" },
                    { id: "financials", label: "Financials" },
                    { id: "loans", label: "Loans" },
                    { id: "investments", label: "Investments" },
                    { id: "disputes", label: "Disputes" },
                    { id: "activity", label: "Activity" },
                    { id: "documents", label: "Documents" },
                    { id: "reputation", label: "Reputation" },
                  ].map((tab) => (
                    <div
                      key={tab.id}
                      className="flex items-center justify-between space-x-3 pb-3 border-b last:border-b-0 last:pb-0"
                    >
                      <Label
                        htmlFor={`tab-${tab.id}-mobile`}
                        className="text-xs font-medium flex-1"
                      >
                        {tab.label}
                      </Label>
                      <Switch
                        id={`tab-${tab.id}-mobile`}
                        checked={!hiddenTabs.includes(tab.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            // Show tab - remove from hidden list
                            setHiddenTabs(
                              hiddenTabs.filter((id) => id !== tab.id)
                            );
                          } else {
                            // Hide tab - add to hidden list
                            if (!hiddenTabs.includes(tab.id)) {
                              setHiddenTabs([...hiddenTabs, tab.id]);
                            }
                          }
                          setHasChanges(true);
                        }}
                        disabled={isSaving}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "membership" && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium">Membership</Label>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div>
                    <p className="text-xs text-gray-600">
                      You&apos;ve been a member of {chama?.name || "this cycle"}{" "}
                      since{" "}
                      {memberJoinedDate
                        ? new Date(memberJoinedDate).toLocaleDateString(
                            "en-US",
                            {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            }
                          )
                        : "joining"}
                      .
                    </p>
                  </div>

                  <div className="pt-4">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (
                          confirm(
                            "Are you sure you want to leave this cycle? This action cannot be undone."
                          )
                        ) {
                          window.location.href = `/${encodeURIComponent(
                            chama?.name?.toLowerCase().replace(/\s+/g, "-") ||
                              ""
                          )}?action=leave`;
                        }
                      }}
                    >
                      Leave Cycle
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "chat" && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium">Chat</Label>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-start justify-between space-x-3">
                    <div className="flex-1 space-y-0.5">
                      <Label
                        htmlFor="chat-enabled-mobile"
                        className="text-xs font-medium"
                      >
                        Choose whether members of this cycle can message you or
                        not (chat on/off)
                      </Label>
                    </div>
                    <Switch
                      id="chat-enabled-mobile"
                      checked={chatEnabled}
                      onCheckedChange={setChatEnabled}
                      disabled={isSaving}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium">Notifications</Label>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="notification-email-frequency-mobile"
                      className="text-xs font-medium"
                    >
                      Notifications email
                    </Label>
                    <Select
                      value={notificationEmailFrequency}
                      onValueChange={(
                        value: "hourly" | "daily" | "weekly" | "never"
                      ) => setNotificationEmailFrequency(value)}
                    >
                      <SelectTrigger
                        id="notification-email-frequency-mobile"
                        className="h-9 text-xs"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="never">Never</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-start justify-between space-x-3 pt-2">
                    <div className="flex-1 space-y-0.5">
                      <Label
                        htmlFor="admin-announcements-mobile"
                        className="text-xs font-medium"
                      >
                        Admin announcements
                      </Label>
                    </div>
                    <Switch
                      id="admin-announcements-mobile"
                      checked={adminAnnouncements}
                      onCheckedChange={setAdminAnnouncements}
                      disabled={isSaving}
                    />
                  </div>

                  <div className="flex items-start justify-between space-x-3">
                    <div className="flex-1 space-y-0.5">
                      <Label
                        htmlFor="event-reminder-email-mobile"
                        className="text-xs font-medium"
                      >
                        Event reminder email
                      </Label>
                    </div>
                    <Switch
                      id="event-reminder-email-mobile"
                      checked={eventReminderEmail}
                      onCheckedChange={setEventReminderEmail}
                      disabled={isSaving}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving changes...</span>
              </>
            ) : hasChanges ? (
              <span>Changes will be saved automatically</span>
            ) : showSaveMessage ? (
              <span className="text-green-600">All changes saved</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  // Desktop: Modal view
  return (
    <>
      {mobileView}
      <div className="hidden md:block">
        <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="hidden md:flex flex-col !m-0 !p-0 chama-settings-modal !rounded-lg"
            style={
              {
                width: "1044px",
                height: "600px",
                maxWidth: "1044px",
                maxHeight: "600px",
              } as React.CSSProperties
            }
          onInteractOutside={(e) => {
            e.preventDefault();
          }}
        >
        <DialogHeader className="px-4 pt-4 pb-0">
              <DialogTitle className="text-xl">
                {showOnlyTab && initialTab === "invite"
                  ? "Invite Members"
                  : "Cycle Settings"}
              </DialogTitle>
        </DialogHeader>

            {/* Tabs - Mobile Only - Hide if showOnlyTab is true */}
            {!showOnlyTab && (
        <div className="md:hidden border-b">
              <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 py-2">
                <div
                  className="flex items-center gap-3"
                  style={{ width: "max-content" } as React.CSSProperties}
                >
                    {(isAdmin ? adminTabs : memberTabsDesktop).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 border-b-2 ${
                  activeTab === tab.id
                    ? "border-[#083232] text-[#083232]"
                    : "border-transparent text-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
            </div>
          </div>
        </div>
            )}

        <div className="flex-1 overflow-y-auto py-4 px-4">
          {/* Mobile: Tab Content */}
          <div className="md:hidden space-y-4">
            {activeTab === "general" && (
              <div className="space-y-4">
                {/* Basic Information */}
                <div className="space-y-3">
                  <div>
                        <Label htmlFor="name" className="text-xs">
                          Cycle Name *
                        </Label>
                    <Input
                      id="name"
                      value={formData.name}
                          onChange={(e) =>
                            handleInputChange("name", e.target.value)
                          }
                      placeholder="Enter cycle name"
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                  <div>
                        <Label htmlFor="description" className="text-xs">
                          Description
                        </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                          onChange={(e) =>
                            handleInputChange("description", e.target.value)
                          }
                      placeholder="Enter cycle description"
                      className="mt-1 min-h-[80px] text-sm"
                      maxLength={150}
                    />
                  </div>
                </div>

                {/* Contribution Settings */}
                <div className="space-y-3 border-t pt-4">
                  <div>
                        <Label htmlFor="contributionAmount" className="text-xs">
                          Contribution Amount *
                        </Label>
                    <Input
                      id="contributionAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.contributionAmount}
                          onChange={(e) =>
                            handleInputChange(
                              "contributionAmount",
                              e.target.value
                            )
                          }
                      placeholder="0.00"
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                  <div>
                        <Label htmlFor="frequency" className="text-xs">
                          Contribution Frequency *
                        </Label>
                    <select
                      id="frequency"
                      value={formData.frequency}
                          onChange={(e) =>
                            handleInputChange(
                              "frequency",
                              e.target.value as Frequency
                            )
                          }
                      className="mt-1 w-full px-3 py-2 h-9 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#083232] text-sm"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  {formData.frequency === "custom" && (
                    <div>
                          <Label
                            htmlFor="customIntervalDays"
                            className="text-xs"
                          >
                            Interval (Days) *
                          </Label>
                      <Input
                        id="customIntervalDays"
                        type="number"
                        min="1"
                        value={formData.customIntervalDays}
                            onChange={(e) =>
                              handleInputChange(
                                "customIntervalDays",
                                e.target.value
                              )
                            }
                        placeholder="7"
                        className="mt-1 h-9 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "rules" && (
              <div className="space-y-4">
                {/* Membership Settings */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                          <Label htmlFor="minMembers" className="text-xs">
                            Minimum Members
                          </Label>
                      <Input
                        id="minMembers"
                        type="number"
                        min="2"
                        value={formData.minMembers}
                            onChange={(e) =>
                              handleInputChange("minMembers", e.target.value)
                            }
                        className="mt-1 h-9 text-sm"
                      />
                    </div>
                    <div>
                          <Label htmlFor="maxMembers" className="text-xs">
                            Maximum Members *
                          </Label>
                      <Input
                        id="maxMembers"
                        type="number"
                        min="2"
                        value={formData.maxMembers}
                            onChange={(e) =>
                              handleInputChange("maxMembers", e.target.value)
                            }
                        className="mt-1 h-9 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                        <Label htmlFor="joiningFee" className="text-xs">
                          Joining Fee
                        </Label>
                    <Input
                      id="joiningFee"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.joiningFee}
                          onChange={(e) =>
                            handleInputChange("joiningFee", e.target.value)
                          }
                      placeholder="0.00"
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Late Penalty */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-start justify-between space-x-3">
                    <div className="flex-1 space-y-0.5">
                          <Label
                            htmlFor="late-penalty"
                            className="text-xs font-medium"
                          >
                            Late Payment Penalties
                          </Label>
                    </div>
                    <Switch
                      id="late-penalty"
                      checked={formData.late_penalty_enabled}
                          onCheckedChange={(checked) =>
                            handleInputChange("late_penalty_enabled", checked)
                          }
                          disabled={isSaving}
                    />
                  </div>
                  {formData.late_penalty_enabled && (
                    <div className="grid grid-cols-2 gap-3 pl-3 border-l-2 border-gray-200">
                      <div>
                            <Label
                              htmlFor="latePenaltyAmount"
                              className="text-xs"
                            >
                              Penalty Amount
                            </Label>
                        <Input
                          id="latePenaltyAmount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.latePenaltyAmount}
                              onChange={(e) =>
                                handleInputChange(
                                  "latePenaltyAmount",
                                  e.target.value
                                )
                              }
                          className="mt-1 h-9 text-sm"
                        />
                      </div>
                      <div>
                            <Label
                              htmlFor="latePenaltyDays"
                              className="text-xs"
                            >
                              Grace Period (Days)
                            </Label>
                        <Input
                          id="latePenaltyDays"
                          type="number"
                          min="0"
                          value={formData.latePenaltyDays}
                              onChange={(e) =>
                                handleInputChange(
                                  "latePenaltyDays",
                                  e.target.value
                                )
                              }
                          className="mt-1 h-9 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Partial Contributions */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-start justify-between space-x-3">
                    <div className="flex-1 space-y-0.5">
                          <Label
                            htmlFor="partial-contributions"
                            className="text-xs font-medium"
                          >
                            Allow Partial Contributions
                          </Label>
                    </div>
                    <Switch
                      id="partial-contributions"
                      checked={formData.allow_partial_contributions}
                          onCheckedChange={(checked) =>
                            handleInputChange(
                              "allow_partial_contributions",
                              checked
                            )
                          }
                          disabled={isSaving}
                    />
                  </div>
                </div>

                {/* Invite Settings */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-start justify-between space-x-3 pb-3 border-b">
                    <div className="flex-1 space-y-0.5">
                          <Label
                            htmlFor="members-can-invite"
                            className="text-xs font-medium"
                          >
                            Members Can Invite
                          </Label>
                    </div>
                    <Switch
                      id="members-can-invite"
                      checked={formData.members_can_invite}
                          onCheckedChange={(checked) =>
                            handleInputChange("members_can_invite", checked)
                          }
                          disabled={isSaving}
                    />
                  </div>
                  <div className="flex items-start justify-between space-x-3">
                    <div className="flex-1 space-y-0.5">
                          <Label
                            htmlFor="invite-approval"
                            className="text-xs font-medium"
                          >
                            Invite Requires Approval
                          </Label>
                    </div>
                    <Switch
                      id="invite-approval"
                      checked={formData.invite_requires_approval}
                          onCheckedChange={(checked) =>
                            handleInputChange(
                              "invite_requires_approval",
                              checked
                            )
                          }
                          disabled={isSaving || !formData.members_can_invite}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "visibility" && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between space-x-3 pb-3 border-b">
                    <div className="flex-1 space-y-0.5">
                          <Label
                            htmlFor="is-public"
                            className="text-xs font-medium"
                          >
                            Public Cycle
                          </Label>
                          <p className="text-xs text-gray-600">
                            Anyone can see and request to join this cycle.
                          </p>
                    </div>
                    <Switch
                      id="is-public"
                      checked={formData.is_public}
                          onCheckedChange={(checked) =>
                            handleInputChange("is_public", checked)
                          }
                          disabled={isSaving}
                    />
                  </div>
                  <div className="flex items-start justify-between space-x-3">
                    <div className="flex-1 space-y-0.5">
                          <Label
                            htmlFor="hidden"
                            className="text-xs font-medium"
                          >
                            Hide from Homepage
                          </Label>
                          <p className="text-xs text-gray-600">
                            Hide this cycle from appearing on the homepage.
                          </p>
                    </div>
                    <Switch
                      id="hidden"
                      checked={formData.hidden}
                          onCheckedChange={(checked) =>
                            handleInputChange("hidden", checked)
                          }
                          disabled={isSaving}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "advanced" && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between space-x-3">
                    <div className="flex-1 space-y-0.5">
                          <Label
                            htmlFor="auto-payout"
                            className="text-xs font-medium"
                          >
                            Automatic Payouts
                          </Label>
                          <p className="text-xs text-gray-600">
                            Automatically process payouts when all members have
                            contributed.
                          </p>
                    </div>
                    <Switch
                      id="auto-payout"
                      checked={formData.auto_payout}
                          onCheckedChange={(checked) =>
                            handleInputChange("auto_payout", checked)
                          }
                          disabled={isSaving}
                    />
                  </div>
                  <div className="border-t pt-4">
                    <button
                      onClick={onDeleteCycle}
                      className="text-red-600 hover:text-red-700 text-sm font-medium cursor-pointer w-full text-left"
                    >
                      Delete Cycle
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "invite" && (
              <div className="space-y-4">
                    {/* Share your cycle link */}
                <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">
                          Share your cycle link
                        </Label>
                        <p className="text-xs text-gray-600 mt-1">
                          When people click this link, they will be redirected
                          to your cycle&apos;s About page where they can join or
                          request membership.
                        </p>
                </div>

                      {/* Cycle URL with Copy button */}
                      <div className="flex gap-2">
                        <Input
                          value={getCycleUrl()}
                          readOnly
                          className="font-mono text-sm flex-1"
                        />
                        <Button
                          onClick={copyCycleLink}
                          variant="outline"
                          size="sm"
                          className="flex-shrink-0 px-3"
                        >
                          {copied ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                          <span className="ml-1 text-xs">COPY</span>
                        </Button>
                      </div>

                      {/* Social Media Share Buttons */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Share to Facebook, Instagram, Twitter, LinkedIn,
                          TikTok, etc
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => shareToSocial("facebook")}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            <Share2 className="w-3 h-3 mr-1" />
                            Facebook
                          </Button>
                          <Button
                            onClick={() => shareToSocial("twitter")}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            <Share2 className="w-3 h-3 mr-1" />
                            Twitter
                          </Button>
                          <Button
                            onClick={() => shareToSocial("linkedin")}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            <Share2 className="w-3 h-3 mr-1" />
                            LinkedIn
                          </Button>
                          <Button
                            onClick={() => shareToSocial("instagram")}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            <Share2 className="w-3 h-3 mr-1" />
                            Instagram
                          </Button>
                          <Button
                            onClick={() => shareToSocial("tiktok")}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            <Share2 className="w-3 h-3 mr-1" />
                            TikTok
                          </Button>
                          <Button
                            onClick={() => shareToSocial("whatsapp")}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            <MessageCircle className="w-3 h-3 mr-1" />
                            WhatsApp
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Send invite through Email */}
                    <div className="space-y-3 border-t pt-4">
                      <Label className="text-sm font-medium">
                        Send invite through Email
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="Email address"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          onClick={sendEmailInvite}
                          disabled={sendingInvite || !inviteEmail}
                          className="bg-[#083232] hover:bg-[#2e856e] text-white flex-shrink-0"
                        >
                          {sendingInvite ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Mail className="w-4 h-4 mr-1" />
                              Send
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
              </div>
            )}

            {activeTab === "tabs" && (
              <div className="space-y-4">
                    {/* Show/hide tabs from members */}
                <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">
                          Show/hide tabs from members
                        </Label>
                        <p className="text-xs text-gray-600 mt-1">
                          Control which tabs are visible to members of this
                          cycle. Toggle off to hide sensitive tabs like
                          Financials or Documents from members.
                        </p>
                      </div>

                      {/* List all tabs with toggles */}
                      <div className="space-y-3 border-t pt-4">
                        {[
                          { id: "community", label: "Community" },
                          { id: "classroom", label: "Classroom" },
                          { id: "members", label: "Members" },
                          { id: "rotation", label: "Rotation" },
                          { id: "financials", label: "Financials" },
                          { id: "loans", label: "Loans" },
                          { id: "investments", label: "Investments" },
                          { id: "disputes", label: "Disputes" },
                          { id: "activity", label: "Activity" },
                          { id: "documents", label: "Documents" },
                          { id: "reputation", label: "Reputation" },
                        ].map((tab) => (
                          <div
                            key={tab.id}
                            className="flex items-center justify-between space-x-3 pb-3 border-b last:border-b-0 last:pb-0"
                          >
                            <Label
                              htmlFor={`tab-${tab.id}`}
                              className="text-sm font-medium flex-1"
                            >
                              {tab.label}
                            </Label>
                            <Switch
                              id={`tab-${tab.id}`}
                              checked={!hiddenTabs.includes(tab.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  // Show tab - remove from hidden list
                                  setHiddenTabs(
                                    hiddenTabs.filter((id) => id !== tab.id)
                                  );
                                } else {
                                  // Hide tab - add to hidden list
                                  if (!hiddenTabs.includes(tab.id)) {
                                    setHiddenTabs([...hiddenTabs, tab.id]);
                                  }
                                }
                                setHasChanges(true);
                              }}
                              disabled={isSaving}
                            />
                          </div>
                        ))}
                      </div>
                </div>
              </div>
            )}

                {/* Membership tab - hide on desktop for regular members */}
                {activeTab === "membership" && isAdmin && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">
                          Membership
                        </Label>
          </div>

                      <div className="border-t pt-4 space-y-4">
                        <div>
                          <p className="text-sm text-gray-600">
                            You&apos;ve been a member of{" "}
                            {chama?.name || "this cycle"} since{" "}
                            {memberJoinedDate
                              ? new Date(memberJoinedDate).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                  }
                                )
                              : "joining"}
                            .
                          </p>
                        </div>

                        <div className="pt-4">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (
                                confirm(
                                  "Are you sure you want to leave this cycle? This action cannot be undone."
                                )
                              ) {
                                window.location.href = `/${encodeURIComponent(
                                  chama?.name
                                    ?.toLowerCase()
                                    .replace(/\s+/g, "-") || ""
                                )}?action=leave`;
                              }
                            }}
                          >
                            Leave Cycle
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "chat" && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Chat</Label>
                      </div>

                      <div className="border-t pt-4 space-y-3">
                        <div className="flex items-start justify-between space-x-3">
                          <div className="flex-1 space-y-0.5">
                            <Label
                              htmlFor="chat-enabled"
                              className="text-sm font-medium"
                            >
                              Choose whether members of this cycle can message
                              you or not (chat on/off)
                            </Label>
                          </div>
                          <Switch
                            id="chat-enabled"
                            checked={chatEnabled}
                            onCheckedChange={setChatEnabled}
                            disabled={isSaving}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "notifications" && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">
                          Notifications
                        </Label>
                      </div>

                      <div className="border-t pt-4 space-y-4">
                        <div className="space-y-2">
                          <Label
                            htmlFor="notification-email-frequency"
                            className="text-sm font-medium"
                          >
                            Notifications email
                          </Label>
                          <Select
                            value={notificationEmailFrequency}
                            onValueChange={(
                              value: "hourly" | "daily" | "weekly" | "never"
                            ) => setNotificationEmailFrequency(value)}
                          >
                            <SelectTrigger
                              id="notification-email-frequency"
                              className="h-9 text-sm"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hourly">Hourly</SelectItem>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="never">Never</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-start justify-between space-x-3 pt-2">
                          <div className="flex-1 space-y-0.5">
                            <Label
                              htmlFor="admin-announcements"
                              className="text-sm font-medium"
                            >
                              Admin announcements
                            </Label>
                          </div>
                          <Switch
                            id="admin-announcements"
                            checked={adminAnnouncements}
                            onCheckedChange={setAdminAnnouncements}
                            disabled={isSaving}
                          />
                        </div>

                        <div className="flex items-start justify-between space-x-3">
                          <div className="flex-1 space-y-0.5">
                            <Label
                              htmlFor="event-reminder-email"
                              className="text-sm font-medium"
                            >
                              Event reminder email
                            </Label>
                          </div>
                          <Switch
                            id="event-reminder-email"
                            checked={eventReminderEmail}
                            onCheckedChange={setEventReminderEmail}
                            disabled={isSaving}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop: Admin 2-column layout */}
              {isAdmin && (
          <div className="hidden md:grid md:grid-cols-2 gap-6 px-4">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Basic Information */}
              <div className="space-y-3">
                <div>
                      <Label htmlFor="name" className="text-sm">
                        Cycle Name *
                      </Label>
                  <Input
                    id="name"
                    value={formData.name}
                        onChange={(e) =>
                          handleInputChange("name", e.target.value)
                        }
                    placeholder="Enter cycle name"
                    className="mt-1 h-9"
                  />
                </div>

                <div>
                      <Label htmlFor="description" className="text-sm">
                        Description
                      </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                        onChange={(e) =>
                          handleInputChange("description", e.target.value)
                        }
                    placeholder="Enter cycle description"
                    className="mt-1 min-h-[80px] text-sm"
                    maxLength={150}
                  />
                </div>
              </div>

              {/* Contribution Settings */}
              <div className="space-y-3 border-t pt-4">
                <div>
                      <Label htmlFor="contributionAmount" className="text-sm">
                        Contribution Amount *
                      </Label>
                  <Input
                    id="contributionAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.contributionAmount}
                    onChange={(e) =>
                          handleInputChange(
                            "contributionAmount",
                            e.target.value
                          )
                    }
                    placeholder="0.00"
                    className="mt-1 h-9"
                  />
                </div>

                <div>
                      <Label htmlFor="frequency" className="text-sm">
                        Contribution Frequency *
                      </Label>
                  <select
                    id="frequency"
                    value={formData.frequency}
                    onChange={(e) =>
                          handleInputChange(
                            "frequency",
                            e.target.value as Frequency
                          )
                    }
                    className="mt-1 w-full px-3 py-2 h-9 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#083232] text-sm"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                {formData.frequency === "custom" && (
                  <div>
                          <Label
                            htmlFor="customIntervalDays"
                            className="text-sm"
                          >
                          Interval (Days) *
                        </Label>
                    <Input
                      id="customIntervalDays"
                      type="number"
                      min="1"
                      value={formData.customIntervalDays}
                      onChange={(e) =>
                            handleInputChange(
                              "customIntervalDays",
                              e.target.value
                            )
                      }
                      placeholder="7"
                      className="mt-1 h-9"
                    />
                  </div>
                )}
              </div>

              {/* Membership Settings */}
              <div className="space-y-3 border-t pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                        <Label htmlFor="minMembers" className="text-sm">
                          Minimum Members
                        </Label>
                    <Input
                      id="minMembers"
                      type="number"
                      min="2"
                      value={formData.minMembers}
                          onChange={(e) =>
                            handleInputChange("minMembers", e.target.value)
                          }
                      className="mt-1 h-9"
                    />
                  </div>

                  <div>
                        <Label htmlFor="maxMembers" className="text-sm">
                          Maximum Members *
                        </Label>
                    <Input
                      id="maxMembers"
                      type="number"
                      min="2"
                      value={formData.maxMembers}
                          onChange={(e) =>
                            handleInputChange("maxMembers", e.target.value)
                          }
                      className="mt-1 h-9"
                    />
                  </div>
                </div>

                <div>
                      <Label htmlFor="joiningFee" className="text-sm">
                        Joining Fee
                      </Label>
                  <Input
                    id="joiningFee"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.joiningFee}
                        onChange={(e) =>
                          handleInputChange("joiningFee", e.target.value)
                        }
                    placeholder="0.00"
                    className="mt-1 h-9"
                  />
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Advanced Settings */}
              <div className="space-y-3">
                {/* Auto-Payout Setting */}
                <div className="flex items-start justify-between space-x-3 pb-3 border-b">
                  <div className="flex-1 space-y-0.5">
                        <Label
                          htmlFor="auto-payout"
                          className="text-sm font-medium"
                        >
                      Automatic Payouts
                    </Label>
                    <p className="text-xs text-gray-600">
                          Automatically process payouts when all members have
                          contributed.
                    </p>
                  </div>
                  <Switch
                    id="auto-payout"
                    checked={formData.auto_payout}
                    onCheckedChange={(checked) =>
                      handleInputChange("auto_payout", checked)
                    }
                        disabled={isSaving}
                  />
                </div>

                {/* Delete Cycle */}
                <div className="pb-3 border-b">
                  <button
                    onClick={onDeleteCycle}
                    className="text-red-600 hover:text-red-700 text-sm font-medium cursor-pointer w-full text-left"
                  >
                    Delete Cycle
                  </button>
                </div>

                {/* Late Penalty Setting */}
                <div className="flex items-start justify-between space-x-3 pb-3 border-b">
                  <div className="flex-1 space-y-0.5">
                        <Label
                          htmlFor="late-penalty"
                          className="text-sm font-medium"
                        >
                      Late Payment Penalties
                    </Label>
                  </div>
                  <Switch
                    id="late-penalty"
                    checked={formData.late_penalty_enabled}
                    onCheckedChange={(checked) =>
                      handleInputChange("late_penalty_enabled", checked)
                    }
                        disabled={isSaving}
                  />
                </div>

                {formData.late_penalty_enabled && (
                  <div className="grid grid-cols-2 gap-3 pl-3 border-l-2 border-gray-200 mb-3">
                    <div>
                          <Label
                            htmlFor="latePenaltyAmount"
                            className="text-sm"
                          >
                            Penalty Amount
                          </Label>
                      <Input
                        id="latePenaltyAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.latePenaltyAmount}
                        onChange={(e) =>
                              handleInputChange(
                                "latePenaltyAmount",
                                e.target.value
                              )
                        }
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                            <Label
                              htmlFor="latePenaltyDays"
                              className="text-sm"
                            >
                            Grace Period (Days)
                          </Label>
                      <Input
                        id="latePenaltyDays"
                        type="number"
                        min="0"
                        value={formData.latePenaltyDays}
                        onChange={(e) =>
                              handleInputChange(
                                "latePenaltyDays",
                                e.target.value
                              )
                        }
                        className="mt-1 h-9"
                      />
                    </div>
                  </div>
                )}

                {/* Partial Contributions Setting */}
                <div className="flex items-start justify-between space-x-3 pb-3 border-b">
                  <div className="flex-1 space-y-0.5">
                    <Label
                      htmlFor="partial-contributions"
                      className="text-sm font-medium"
                    >
                      Allow Partial Contributions
                    </Label>
                  </div>
                  <Switch
                    id="partial-contributions"
                    checked={formData.allow_partial_contributions}
                    onCheckedChange={(checked) =>
                          handleInputChange(
                            "allow_partial_contributions",
                            checked
                          )
                    }
                        disabled={isSaving}
                  />
                </div>

                {/* Members Can Invite Setting */}
                <div className="flex items-start justify-between space-x-3 pb-3 border-b">
                  <div className="flex-1 space-y-0.5">
                    <Label
                      htmlFor="members-can-invite"
                      className="text-sm font-medium"
                    >
                      Members Can Invite
                    </Label>
                    <p className="text-xs text-gray-600">
                            Allow regular members to invite new people to join
                            the cycle.
                    </p>
                  </div>
                  <Switch
                    id="members-can-invite"
                    checked={formData.members_can_invite}
                    onCheckedChange={(checked) =>
                      handleInputChange("members_can_invite", checked)
                    }
                        disabled={isSaving}
                  />
                </div>

                {/* Invite Requires Approval Setting */}
                <div className="flex items-start justify-between space-x-3">
                  <div className="flex-1 space-y-0.5">
                    <Label
                      htmlFor="invite-approval"
                      className="text-sm font-medium"
                    >
                      Invite Requires Approval
                    </Label>
                    <p className="text-xs text-gray-600">
                          Require admin approval for invites sent by regular
                          members.
                    </p>
                  </div>
                  <Switch
                    id="invite-approval"
                    checked={formData.invite_requires_approval}
                    onCheckedChange={(checked) =>
                            handleInputChange(
                              "invite_requires_approval",
                              checked
                            )
                    }
                        disabled={isSaving || !formData.members_can_invite}
                  />
                </div>
              </div>
            </div>
          </div>
              )}

              {/* Desktop: Member settings layout */}
              {!isAdmin && (
                <div className="hidden md:block px-4">
                  <div className="max-w-2xl mx-auto space-y-6">
                    {/* Chat Settings */}
                    <div className="space-y-4">
                      <div>
                        <Label className="text-base font-semibold">Chat</Label>
                      </div>
                      <div className="border-t pt-4">
                        <div className="flex items-start justify-between space-x-3">
                          <div className="flex-1 space-y-0.5">
                            <Label
                              htmlFor="chat-enabled-desktop"
                              className="text-sm font-medium"
                            >
                              Choose whether members of this cycle can message
                              you or not (chat on/off)
                            </Label>
                          </div>
                          <Switch
                            id="chat-enabled-desktop"
                            checked={chatEnabled}
                            onCheckedChange={setChatEnabled}
                            disabled={isSaving}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Notifications Settings */}
                    <div className="space-y-4">
                      <div>
                        <Label className="text-base font-semibold">
                          Notifications
                        </Label>
                      </div>
                      <div className="border-t pt-4 space-y-4">
                        <div className="space-y-2">
                          <Label
                            htmlFor="notification-email-frequency-desktop"
                            className="text-sm font-medium"
                          >
                            Notifications email
                          </Label>
                          <Select
                            value={notificationEmailFrequency}
                            onValueChange={(
                              value: "hourly" | "daily" | "weekly" | "never"
                            ) => setNotificationEmailFrequency(value)}
                          >
                            <SelectTrigger
                              id="notification-email-frequency-desktop"
                              className="h-9 text-sm"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hourly">Hourly</SelectItem>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="never">Never</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-start justify-between space-x-3">
                          <div className="flex-1 space-y-0.5">
                            <Label
                              htmlFor="admin-announcements-desktop"
                              className="text-sm font-medium"
                            >
                              Admin announcements
                            </Label>
                          </div>
                          <Switch
                            id="admin-announcements-desktop"
                            checked={adminAnnouncements}
                            onCheckedChange={setAdminAnnouncements}
                            disabled={isSaving}
                          />
                        </div>

                        <div className="flex items-start justify-between space-x-3">
                          <div className="flex-1 space-y-0.5">
                            <Label
                              htmlFor="event-reminder-email-desktop"
                              className="text-sm font-medium"
                            >
                              Event reminder email
                            </Label>
                          </div>
                          <Switch
                            id="event-reminder-email-desktop"
                            checked={eventReminderEmail}
                            onCheckedChange={setEventReminderEmail}
                            disabled={isSaving}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Membership */}
                    <div className="space-y-4">
                      <div>
                        <Label className="text-base font-semibold">
                          Membership
                        </Label>
                      </div>
                      <div className="border-t pt-4">
                        <p className="text-sm text-gray-600">
                          You&apos;ve been a member of{" "}
                          {chama?.name || "this cycle"} since{" "}
                          {memberJoinedDate
                            ? new Date(memberJoinedDate).toLocaleDateString(
                                "en-US",
                                {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )
                            : "joining"}
                          .
                        </p>
                      </div>
                    </div>

                    {/* Invite */}
                    <div className="space-y-4">
                      <div>
                        <Label className="text-base font-semibold">
                          Invite
                        </Label>
                      </div>
                      <div className="border-t pt-4 space-y-4">
                        {/* Share your cycle link */}
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm font-medium">
                              Share your cycle link
                            </Label>
                            <p className="text-xs text-gray-600 mt-1">
                              When people click this link, they will be
                              redirected to your cycle&apos;s About page where
                              they can join or request membership.
                            </p>
                          </div>

                          {/* Cycle URL with Copy button */}
                          <div className="flex gap-2">
                            <Input
                              value={getCycleUrl()}
                              readOnly
                              className="font-mono text-sm flex-1"
                            />
                            <Button
                              onClick={copyCycleLink}
                              variant="outline"
                              size="sm"
                              className="flex-shrink-0 px-3"
                            >
                              {copied ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                              <span className="ml-1 text-xs">COPY</span>
                            </Button>
                          </div>

                          {/* Social Media Share Buttons */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Share to Facebook, Instagram, Twitter, LinkedIn,
                              TikTok, etc
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={() => shareToSocial("facebook")}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                <Share2 className="w-3 h-3 mr-1" />
                                Facebook
                              </Button>
                              <Button
                                onClick={() => shareToSocial("twitter")}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                <Share2 className="w-3 h-3 mr-1" />
                                Twitter
                              </Button>
                              <Button
                                onClick={() => shareToSocial("linkedin")}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                <Share2 className="w-3 h-3 mr-1" />
                                LinkedIn
                              </Button>
                              <Button
                                onClick={() => shareToSocial("instagram")}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                <Share2 className="w-3 h-3 mr-1" />
                                Instagram
                              </Button>
                              <Button
                                onClick={() => shareToSocial("tiktok")}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                <Share2 className="w-3 h-3 mr-1" />
                                TikTok
                              </Button>
                              <Button
                                onClick={() => shareToSocial("whatsapp")}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                <MessageCircle className="w-3 h-3 mr-1" />
                                WhatsApp
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Send invite through Email */}
                        <div className="space-y-3 border-t pt-4">
                          <Label className="text-sm font-medium">
                            Send invite through Email
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              type="email"
                              placeholder="Email address"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              onClick={sendEmailInvite}
                              disabled={sendingInvite || !inviteEmail}
                              className="bg-[#083232] hover:bg-[#2e856e] text-white flex-shrink-0"
                            >
                              {sendingInvite ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <Mail className="w-4 h-4 mr-1" />
                                  Send
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Leave Cycle - Last item */}
                    <div className="pt-4 border-t">
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to leave this cycle? This action cannot be undone."
                            )
                          ) {
                            window.location.href = `/${encodeURIComponent(
                              chama?.name?.toLowerCase().replace(/\s+/g, "-") ||
                                ""
                            )}?action=leave`;
                          }
                        }}
                        className="text-sm text-red-600 hover:text-red-700 cursor-pointer"
                      >
                        Leave Cycle
                      </button>
                    </div>
                  </div>
                </div>
              )}
        </div>

        {/* Footer - Sticky at bottom */}
        <div className="border-t pt-3 pb-2 mt-auto bg-white px-4">
              {/* Delete Cycle - Admin only */}
              {isAdmin && (
          <div className="mb-3">
            <button
              onClick={onDeleteCycle}
              className="text-red-600 hover:text-red-700 text-sm font-medium cursor-pointer"
            >
              Delete Cycle
            </button>
          </div>
              )}

              {/* Auto-save Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {isSaving ? (
                <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving changes...</span>
                </>
                  ) : hasChanges ? (
                    <span>Changes will be saved automatically</span>
                  ) : showSaveMessage ? (
                    <span className="text-green-600">All changes saved</span>
                  ) : null}
                </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
      </div>
    </>
  );
}
