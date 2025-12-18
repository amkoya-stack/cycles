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
import { useAuth } from "@/hooks/use-auth";
import { ReputationCard } from "@/components/reputation/reputation-card";
import { BadgeGrid } from "@/components/reputation/badge";
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
  Trophy,
  Globe,
  Facebook,
  Twitter,
  Linkedin,
  AlignLeft,
  Settings,
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
}

type TabType =
  | "personal"
  | "security"
  | "settings"
  | "posts"
  | "comments"
  | "stories";

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, validateToken } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("personal");
  const [allReputations, setAllReputations] = useState<any[]>([]);
  const [allBadges, setAllBadges] = useState<any[]>([]);
  const [userChamas, setUserChamas] = useState<any[]>([]);

  // Form state
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [facebook, setFacebook] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");

  useEffect(() => {
    validateToken();
    fetchProfile();
    fetchUserChamas();
  }, [validateToken]);

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
      setDateOfBirth(data.date_of_birth || "");
      setIdNumber(data.id_number || "");
      setBio(data.bio || "");
      setWebsite(data.website || "");
      setFacebook(data.facebook || "");
      setTwitter(data.twitter || "");
      setLinkedin(data.linkedin || "");
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch("http://localhost:3001/api/auth/profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: fullName,
          date_of_birth: dateOfBirth,
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
              <div className="w-24 h-24 rounded-full bg-[#083232] flex items-center justify-center text-white text-3xl font-bold">
                {profile.full_name
                  ? profile.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                  : profile.email[0].toUpperCase()}
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
                    setDateOfBirth(profile.date_of_birth || "");
                    setIdNumber(profile.id_number || "");
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
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
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
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
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
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === "settings"
                      ? "text-blue-600"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </button>
                <button
                  onClick={() => setActiveTab("posts")}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
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
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
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
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
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
