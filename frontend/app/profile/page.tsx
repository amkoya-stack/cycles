"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HomeNavbar } from "@/components/home/home-navbar";
import { Footer } from "@/components/footer";
import { useAuthGuard } from "@/hooks/use-auth";
import { ReputationCard } from "@/components/reputation/reputation-card";
import { BadgeGrid } from "@/components/reputation/badge";
import { chatApi, type Conversation, type Message } from "@/lib/chat-api";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  Lock,
  Info,
  FileText,
  MessageSquare,
  MessageCircle,
  Trophy,
  Globe,
  Facebook,
  Twitter,
  Linkedin,
  AlignLeft,
  Settings,
  Camera,
  Trash2,
  Pencil,
} from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  phone: string;
  full_name: string;
  date_of_birth: string;
  id_number: string;
  two_factor_enabled: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  bio?: string;
  website?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  profile_photo_url?: string;
}

type TabType =
  | "personal"
  | "security"
  | "settings"
  | "messages"
  | "posts"
  | "comments"
  | "stories";

export default function ProfilePage() {
  const router = useRouter();

  // Auth guard - redirect to login if token expired
  const { isAuthenticated } = useAuthGuard();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("personal");
  const [allReputations, setAllReputations] = useState<any[]>([]);
  const [allBadges, setAllBadges] = useState<any[]>([]);
  const [userChamas, setUserChamas] = useState<any[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<Message[]>(
    []
  );
  const [messageThreadLoading, setMessageThreadLoading] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [facebook, setFacebook] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState("");

  useEffect(() => {
    fetchProfile();
    fetchUserChamas();
  }, []);

  useEffect(() => {
    if (activeTab === "messages") {
      fetchConversations();
    }
  }, [activeTab]);

  const fetchProfile = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        router.push("/auth/login");
        return;
      }

      const response = await fetch("http://localhost:3001/api/auth/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch profile");
      }

      const data = await response.json();
      setProfile(data);
      setFullName(data.full_name || "");
      // Convert ISO date to YYYY-MM-DD for date input
      setDateOfBirth(
        data.date_of_birth ? data.date_of_birth.split("T")[0] : ""
      );
      setIdNumber(data.id_number || "");
      setBio(data.bio || "");
      setWebsite(data.website || "");
      setFacebook(data.facebook || "");
      setTwitter(data.twitter || "");
      setLinkedin(data.linkedin || "");
      setProfilePhotoUrl(data.profile_photo_url || "");
      setProfilePhotoPreview(data.profile_photo_url || "");
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserChamas = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        "http://localhost:3001/api/chama/my-chamas",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const chamas = await response.json();
        setUserChamas(chamas);

        // Fetch reputation for each chama
        await fetchAllReputations(chamas);
      }
    } catch (error) {
      console.error("Error fetching chamas:", error);
    }
  };

  const fetchAllReputations = async (chamas: any[]) => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken || !profile) return;

    const reputations = [];
    const badges = [];

    for (const chama of chamas) {
      try {
        const repResponse = await fetch(
          `http://localhost:3001/api/reputation/${chama.id}/me`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (repResponse.ok) {
          const repData = await repResponse.json();
          reputations.push({
            ...repData.reputation,
            chamaName: chama.name,
            chamaId: chama.id,
          });
        }

        const badgesResponse = await fetch(
          `http://localhost:3001/api/reputation/${chama.id}/badges/${profile.id}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (badgesResponse.ok) {
          const badgesData = await badgesResponse.json();
          badges.push(...(badgesData.badges || []));
        }
      } catch (err) {
        console.error(`Failed to fetch reputation for chama ${chama.id}:`, err);
      }
    }

    setAllReputations(reputations);
    setAllBadges(badges);
  };

  const fetchConversations = async () => {
    try {
      setMessagesLoading(true);
      const data = await chatApi.getConversations();
      setConversations(data);
      if (data.length === 0) {
        setSelectedConversation(null);
        setConversationMessages([]);
        return;
      }
      if (data.length > 0 && !selectedConversation) {
        await fetchConversationMessages(data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch conversations", err);
    } finally {
      setMessagesLoading(false);
    }
  };

  const fetchConversationMessages = async (conversation: Conversation) => {
    try {
      setMessageThreadLoading(true);
      setConversationMessages([]);
      setSelectedConversation(conversation);
      const msgs = await chatApi.getMessages(conversation.conversation_id);
      setConversationMessages(msgs);
    } catch (err) {
      console.error("Failed to fetch messages", err);
    } finally {
      setMessageThreadLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedConversation || !messageInput.trim()) return;
    try {
      setSendingMessage(true);
      const result = await chatApi.sendMessage({
        recipientId: selectedConversation.other_user_id,
        chamaId: selectedConversation.chama_id,
        content: messageInput.trim(),
      });
      setMessageInput("");
      setConversationMessages((prev) => [...prev, result.message]);
      fetchConversations();
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePhotoFile(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = async () => {
    try {
      // Optimistically update UI
      setProfilePhotoFile(null);
      setProfilePhotoPreview("");

      const accessToken = localStorage.getItem("accessToken");
      await fetch("http://localhost:3001/api/auth/remove-profile-photo", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      await fetchProfile();
    } catch (err) {
      console.error("Failed to remove profile photo", err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const accessToken = localStorage.getItem("accessToken");

      // If there's a new image, upload it first
      let photoUrl = profilePhotoUrl;
      if (profilePhotoFile) {
        const formData = new FormData();
        formData.append("file", profilePhotoFile);

        const uploadResponse = await fetch(
          "http://localhost:3001/api/auth/upload-profile-photo",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            body: formData,
          }
        );

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => null);
          throw new Error(
            errorData?.message || "Failed to upload profile photo"
          );
        }

        const uploadData = await uploadResponse.json();
        photoUrl = uploadData.profile_photo_url;
      }

      // Convert date to ISO 8601 format if provided
      let isoDateOfBirth = dateOfBirth;
      if (dateOfBirth && !dateOfBirth.includes("T")) {
        // If it's just YYYY-MM-DD, convert to ISO 8601
        isoDateOfBirth = new Date(dateOfBirth + "T00:00:00.000Z").toISOString();
      }

      const response = await fetch("http://localhost:3001/api/auth/profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: fullName,
          date_of_birth: isoDateOfBirth || undefined,
          id_number: idNumber,
          bio: bio,
          website: website,
          facebook: facebook,
          twitter: twitter,
          linkedin: linkedin,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("Profile update failed:", response.status, errorData);
        throw new Error(errorData?.message || "Failed to update profile");
      }

      await fetchProfile();
      setEditing(false);
      setProfilePhotoFile(null);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert(
        error instanceof Error ? error.message : "Failed to update profile"
      );
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatConversationTime = (timestamp?: string | null) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const isSameDay = date.toDateString() === now.toDateString();
    if (isSameDay) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
    });
  };

  const formatMessageTime = (timestamp?: string | null) => {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const unreadTotal = conversations.reduce(
    (sum, c) => sum + (Number(c.unread_count) || 0),
    0
  );

  if (loading) {
    return (
      <>
        <HomeNavbar
          isAuthenticated={isAuthenticated}
          showSearchInNav={false}
          searchQuery=""
          onSearchChange={() => {}}
        />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center pt-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#083232] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading profile...</p>
          </div>
        </div>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <HomeNavbar
          isAuthenticated={isAuthenticated}
          showSearchInNav={false}
          searchQuery=""
          onSearchChange={() => {}}
        />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center pt-16">
          <div className="text-center">
            <p className="text-red-600 mb-4">Failed to load profile</p>
            <Button onClick={() => router.push("/")}>Go Home</Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <HomeNavbar
        isAuthenticated={isAuthenticated}
        showSearchInNav={false}
        searchQuery=""
        onSearchChange={() => {}}
      />

      <div className="min-h-screen bg-gray-50 pt-16">
        <main className="max-w-[1085px] mx-auto px-4 py-8">
          {/* Profile Header */}
          <Card className="p-6 mb-6">
            <div className="flex items-center gap-6">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-[#083232] flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
                  {profilePhotoPreview ? (
                    <img
                      src={profilePhotoPreview}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : profile.full_name ? (
                    profile.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                  ) : (
                    profile.email[0].toUpperCase()
                  )}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="flex items-center gap-3">
                    <label
                      className="h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
                      title="Change photo"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <Pencil className="text-white w-5 h-5" />
                    </label>
                    {(profilePhotoPreview || profilePhotoUrl) && (
                      <button
                        className="h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
                        title="Remove photo"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemovePhoto();
                        }}
                      >
                        <Trash2 className="text-white w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {profile.full_name || "User"}
                </h1>
                <p className="text-gray-600 mt-1">
                  Member Since: {formatDate(profile.created_at)}
                </p>
              </div>
            </div>
          </Card>

          {/* Edit/Save Buttons */}
          <div className="mb-6">
            {!editing ? (
              <Button
                onClick={() => setEditing(true)}
                className="bg-white hover:bg-gray-50 text-gray-900 border border-gray-300"
                style={{ width: "273.2px", height: "46.75px" }}
              >
                Edit Profile
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setEditing(false);
                    setFullName(profile.full_name || "");
                    // Convert ISO date to YYYY-MM-DD for date input
                    setDateOfBirth(
                      profile.date_of_birth
                        ? profile.date_of_birth.split("T")[0]
                        : ""
                    );
                    setIdNumber(profile.id_number || "");
                    setProfilePhotoFile(null);
                    setProfilePhotoPreview(profile.profile_photo_url || "");
                  }}
                  className="bg-white hover:bg-gray-50 text-gray-900 border border-gray-300"
                  style={{ width: "273.2px", height: "46.75px" }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-white hover:bg-gray-50 text-gray-900 border border-gray-300"
                  style={{ width: "273.2px", height: "46.75px" }}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            )}
          </div>

          {/* Layout with Sidebar and Content */}
          <div className="flex gap-6">
            {/* Sidebar Navigation */}
            <div className="w-64 flex-shrink-0">
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab("personal")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                    activeTab === "personal"
                      ? "text-blue-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <User className="w-5 h-5" />
                  <span>Personal Information</span>
                </button>
                <button
                  onClick={() => setActiveTab("security")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                    activeTab === "security"
                      ? "text-blue-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Lock className="w-5 h-5" />
                  <span>Account Security</span>
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                    activeTab === "settings"
                      ? "text-blue-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </button>
                <button
                  onClick={() => setActiveTab("messages")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                    activeTab === "messages"
                      ? "text-blue-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <MessageCircle className="w-5 h-5" />
                  <span className="flex-1 text-left">Messages</span>
                  {(unreadTotal > 0 || conversations.length > 0) && (
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-700">
                      {unreadTotal > 0
                        ? `${unreadTotal} new`
                        : conversations.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("posts")}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                    activeTab === "posts"
                      ? "text-blue-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5" />
                    <span>Posts</span>
                  </div>
                  <span className="text-sm">0</span>
                </button>
                <button
                  onClick={() => setActiveTab("comments")}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                    activeTab === "comments"
                      ? "text-blue-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-5 h-5" />
                    <span>Comments</span>
                  </div>
                  <span className="text-sm">0</span>
                </button>
                <button
                  onClick={() => setActiveTab("stories")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                    activeTab === "stories"
                      ? "text-blue-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Trophy className="w-5 h-5" />
                  <span>Success Stories</span>
                </button>
              </nav>
            </div>

            {/* Main Content Area */}
            <div className="flex-1">
              {activeTab === "personal" && (
                <Card className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                    Personal Information
                  </h2>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Full Name */}
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs font-medium text-gray-500 mb-1 block">
                          Full Name
                        </Label>
                        {editing ? (
                          <Input
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Enter your full name"
                            className="h-9 text-sm"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 font-medium truncate">
                            {profile.full_name || (
                              <span className="text-gray-400">Not set</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Email */}
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-2">
                          Email Address
                          {profile.email_verified && (
                            <span className="inline-flex items-center text-[10px] font-medium bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                              ✓ Verified
                            </span>
                          )}
                        </Label>
                        <p className="text-sm text-gray-900 font-medium truncate">
                          {profile.email}
                        </p>
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <Phone className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-2">
                          Phone Number
                          {profile.phone_verified && (
                            <span className="inline-flex items-center text-[10px] font-medium bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                              ✓ Verified
                            </span>
                          )}
                        </Label>
                        <p className="text-sm text-gray-900 font-medium truncate">
                          {profile.phone}
                        </p>
                      </div>
                    </div>

                    {/* Date of Birth */}
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs font-medium text-gray-500 mb-1 block">
                          Date of Birth
                        </Label>
                        {editing ? (
                          <Input
                            type="date"
                            value={dateOfBirth}
                            onChange={(e) => setDateOfBirth(e.target.value)}
                            className="h-9 text-sm"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 font-medium truncate">
                            {formatDate(profile.date_of_birth)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* ID Number */}
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors col-span-2">
                      <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs font-medium text-gray-500 mb-1 block">
                          ID Number
                        </Label>
                        {editing ? (
                          <Input
                            value={idNumber}
                            onChange={(e) => setIdNumber(e.target.value)}
                            placeholder="Enter your ID number"
                            className="h-9 text-sm"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 font-medium truncate">
                            {profile.id_number || (
                              <span className="text-gray-400">Not set</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bio */}
                    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors col-span-2">
                      <div className="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                        <AlignLeft className="w-4 h-4 text-teal-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs font-medium text-gray-500 mb-1 block">
                          Tell other members a little about yourself
                        </Label>
                        {editing ? (
                          <Textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Write a brief bio about yourself..."
                            className="text-sm min-h-[80px] resize-none"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 whitespace-pre-wrap">
                            {bio || (
                              <span className="text-gray-400">Not set</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Website */}
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors col-span-2">
                      <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
                        <Globe className="w-4 h-4 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs font-medium text-gray-500 mb-1 block">
                          Website
                        </Label>
                        {editing ? (
                          <Input
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="http://www.yoursite.com"
                            className="h-9 text-sm"
                          />
                        ) : (
                          <p className="text-sm text-blue-600 font-medium truncate">
                            {website ? (
                              <a
                                href={website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                {website}
                              </a>
                            ) : (
                              <span className="text-gray-400">Not set</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Facebook */}
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Facebook className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs font-medium text-gray-500 mb-1 block">
                          Facebook
                        </Label>
                        {editing ? (
                          <Input
                            value={facebook}
                            onChange={(e) => setFacebook(e.target.value)}
                            placeholder="https://www.facebook.com"
                            className="h-9 text-sm"
                          />
                        ) : (
                          <p className="text-sm text-blue-600 font-medium truncate">
                            {facebook ? (
                              <a
                                href={facebook}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                {facebook}
                              </a>
                            ) : (
                              <span className="text-gray-400">Not set</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Twitter */}
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-sky-50 flex items-center justify-center flex-shrink-0">
                        <Twitter className="w-4 h-4 text-sky-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs font-medium text-gray-500 mb-1 block">
                          Twitter
                        </Label>
                        {editing ? (
                          <Input
                            value={twitter}
                            onChange={(e) => setTwitter(e.target.value)}
                            placeholder="https://twitter.com"
                            className="h-9 text-sm"
                          />
                        ) : (
                          <p className="text-sm text-blue-600 font-medium truncate">
                            {twitter ? (
                              <a
                                href={twitter}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                {twitter}
                              </a>
                            ) : (
                              <span className="text-gray-400">Not set</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* LinkedIn */}
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors col-span-2">
                      <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Linkedin className="w-4 h-4 text-blue-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs font-medium text-gray-500 mb-1 block">
                          LinkedIn
                        </Label>
                        {editing ? (
                          <Input
                            value={linkedin}
                            onChange={(e) => setLinkedin(e.target.value)}
                            placeholder="https://www.linkedin.com"
                            className="h-9 text-sm"
                          />
                        ) : (
                          <p className="text-sm text-blue-600 font-medium truncate">
                            {linkedin ? (
                              <a
                                href={linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                {linkedin}
                              </a>
                            ) : (
                              <span className="text-gray-400">Not set</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Reputation & Badges Section */}
                  {allReputations.length > 0 && (
                    <>
                      <div className="mt-8 pt-6 border-t border-gray-200">
                        <div className="flex items-center gap-2 mb-4">
                          <Trophy className="w-5 h-5 text-[#083232]" />
                          <h3 className="text-lg font-bold text-gray-900">
                            Reputation & Badges
                          </h3>
                        </div>

                        <div className="space-y-6">
                          {/* Reputation Cards */}
                          {allReputations.map((rep) => (
                            <div key={rep.chamaId}>
                              <p className="text-sm font-medium text-gray-700 mb-2">
                                {rep.chamaName}
                              </p>
                              <ReputationCard
                                reputation={rep}
                                badges={allBadges.filter(
                                  (b) => b.chamaId === rep.chamaId
                                )}
                                size="compact"
                              />
                            </div>
                          ))}

                          {/* All Badges */}
                          {allBadges.length > 0 && (
                            <div className="mt-6">
                              <h4 className="text-md font-semibold text-gray-900 mb-4">
                                All Earned Badges ({allBadges.length})
                              </h4>
                              <BadgeGrid badges={allBadges} size="sm" />
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </Card>
              )}

              {activeTab === "security" && (
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-6">
                    Account Security
                  </h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-gray-600">
                          Add an extra layer of security to your account
                        </p>
                      </div>
                      <span
                        className={`text-sm px-3 py-1 rounded ${
                          profile.two_factor_enabled
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {profile.two_factor_enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Password</p>
                        <p className="text-sm text-gray-600">
                          Last changed: Never (or unknown)
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        Change Password
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {activeTab === "settings" && (
                <Card className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                    Settings
                  </h2>

                  <div className="space-y-6">
                    {/* Notification Settings */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">
                        Notifications
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Email Notifications
                            </p>
                            <p className="text-xs text-gray-500">
                              Receive updates via email
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              defaultChecked
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              SMS Notifications
                            </p>
                            <p className="text-xs text-gray-500">
                              Receive updates via SMS
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Privacy Settings */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">
                        Privacy
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Profile Visibility
                            </p>
                            <p className="text-xs text-gray-500">
                              Make profile visible to other members
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              defaultChecked
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Show Activity Status
                            </p>
                            <p className="text-xs text-gray-500">
                              Let others see when you're active
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              defaultChecked
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Account Info */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">
                        Account Information
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between p-3 rounded-lg bg-gray-50">
                          <span className="text-gray-600">Account ID:</span>
                          <span className="font-mono text-xs text-gray-900">
                            {profile.id}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {activeTab === "messages" && (
                <Card className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                    Messages
                  </h2>
                  {messagesLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#083232] mx-auto"></div>
                      <p className="text-gray-500 mt-4">
                        Loading conversations...
                      </p>
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <p className="text-gray-500">Your messages appear here</p>
                      <p className="text-sm text-gray-400 mt-2">
                        Click the chat icon at the bottom right to start a
                        conversation
                      </p>
                    </div>
                  ) : (
                    <div className="lg:flex lg:gap-6">
                      <div className="lg:w-1/3 space-y-2 mb-6 lg:mb-0">
                        {conversations.map((conversation) => {
                          const isActive =
                            selectedConversation?.conversation_id ===
                            conversation.conversation_id;
                          return (
                            <button
                              type="button"
                              key={conversation.conversation_id}
                              onClick={() =>
                                fetchConversationMessages(conversation)
                              }
                              className={`w-full text-left p-4 rounded-2xl border transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#083232] ${
                                isActive
                                  ? "border-[#083232] bg-[#083232]/5"
                                  : "border-gray-200"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm text-gray-900 truncate">
                                    {conversation.other_user_name}
                                  </p>
                                  <p className="text-xs text-gray-600 truncate mt-0.5">
                                    {conversation.is_sent_by_me ? "You: " : ""}
                                    {conversation.last_message ||
                                      "No messages yet"}
                                  </p>
                                  <p className="text-[11px] text-gray-400 mt-1">
                                    {conversation.chama_name}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-[11px] text-gray-400">
                                    {formatConversationTime(
                                      conversation.last_message_at ||
                                        conversation.updated_at
                                    )}
                                  </span>
                                  {Number(conversation.unread_count) > 0 && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f64d52] text-white">
                                      {conversation.unread_count}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex-1">
                        {!selectedConversation ? (
                          <div className="border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-500">
                            Select a conversation to see messages
                          </div>
                        ) : (
                          <div className="border rounded-2xl bg-gray-50 p-4 flex flex-col h-full min-h-[380px]">
                            <div className="pb-4 mb-4 border-b border-gray-200 flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {selectedConversation.other_user_name}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {selectedConversation.chama_name}
                                </p>
                              </div>
                              <span className="text-xs text-gray-400">
                                {formatConversationTime(
                                  selectedConversation.last_message_at ||
                                    selectedConversation.updated_at
                                )}
                              </span>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                              {messageThreadLoading ? (
                                <div className="flex items-center justify-center py-10">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#083232]"></div>
                                </div>
                              ) : conversationMessages.length === 0 ? (
                                <div className="text-center text-sm text-gray-500 py-10">
                                  No messages yet. Say hello!
                                </div>
                              ) : (
                                conversationMessages.map((message) => (
                                  <div
                                    key={message.id}
                                    className={`flex ${
                                      message.is_sent_by_me
                                        ? "justify-end"
                                        : "justify-start"
                                    }`}
                                  >
                                    <div
                                      className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                                        message.is_sent_by_me
                                          ? "bg-[#083232] text-white"
                                          : "bg-white text-gray-900"
                                      }`}
                                    >
                                      {!message.is_sent_by_me && (
                                        <p className="text-xs font-semibold text-gray-500 mb-0.5">
                                          {message.sender_name}
                                        </p>
                                      )}
                                      <p className="whitespace-pre-line break-words">
                                        {message.content}
                                      </p>
                                      <p
                                        className={`text-[11px] mt-1 text-right ${
                                          message.is_sent_by_me
                                            ? "text-white/80"
                                            : "text-gray-400"
                                        }`}
                                      >
                                        {formatMessageTime(message.created_at)}
                                      </p>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="mt-4 flex gap-3">
                              <Input
                                placeholder="Type a message"
                                value={messageInput}
                                onChange={(e) =>
                                  setMessageInput(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                  }
                                }}
                                disabled={
                                  !selectedConversation || sendingMessage
                                }
                              />
                              <Button
                                onClick={handleSendMessage}
                                disabled={
                                  !messageInput.trim() || sendingMessage
                                }
                                className="min-w-[96px] bg-[#083232] hover:bg-[#2e856e]"
                              >
                                {sendingMessage ? "Sending..." : "Send"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {activeTab === "posts" && (
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-6">My Posts</h2>
                  <div className="text-center py-12">
                    <p className="text-gray-500">No posts yet</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Share your thoughts with the community
                    </p>
                  </div>
                </Card>
              )}

              {activeTab === "comments" && (
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-6">My Comments</h2>
                  <div className="text-center py-12">
                    <p className="text-gray-500">No comments yet</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Start engaging with posts
                    </p>
                  </div>
                </Card>
              )}

              {activeTab === "stories" && (
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-6">
                    Success Stories
                  </h2>
                  <div className="text-center py-12">
                    <p className="text-gray-500">No success stories yet</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Share your journey and inspire others
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>

      <Footer />
    </>
  );
}
