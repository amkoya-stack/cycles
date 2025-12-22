"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HomeNavbar } from "@/components/home/home-navbar";
import { Footer } from "@/components/footer";
import { useAuth } from "@/hooks/use-auth";
import { ReputationBadge } from "@/components/reputation/reputation-badge";
import {
  User,
  Mail,
  Phone,
  Calendar,
  ArrowLeft,
  MapPin,
  MessageCircle,
  Clock,
  Trophy,
  Star,
  MessageSquare,
  FileText,
  Activity,
} from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  phone: string;
  full_name: string;
  date_of_birth: string;
  bio: string;
  profile_photo_url: string;
  location: string;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  last_activity_at?: string;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  chama_name: string;
  chama_slug: string;
}

interface Reply {
  id: string;
  content: string;
  created_at: string;
  chama_name: string;
  chama_slug: string;
}

interface Vote {
  id: string;
  proposal_name: string;
  created_at: string;
  chama_name: string;
  chama_slug: string;
}

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;
  const { isAuthenticated, validateToken } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [commonChamas, setCommonChamas] = useState<any[]>([]);
  const [reputation, setReputation] = useState<any>(null);
  const [recentComments, setRecentComments] = useState<Comment[]>([]);
  const [recentReplies, setRecentReplies] = useState<Reply[]>([]);
  const [recentVotes, setRecentVotes] = useState<Vote[]>([]);
  const [bioExpanded, setBioExpanded] = useState(false);

  useEffect(() => {
    validateToken();
    fetchUserProfile();
    fetchCommonChamas();
    fetchUserReputation();
    fetchRecentActivity();
  }, [validateToken, userId]);

  const fetchUserProfile = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        router.push("/auth/login");
        return;
      }

      console.log("Fetching profile for userId:", userId);
      const response = await fetch(
        `http://localhost:3001/api/users/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(
          `Failed to fetch profile: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      console.log("Profile data received:", data);
      setProfile(data);
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCommonChamas = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch("http://localhost:3001/api/chama", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const chamas = await response.json();
        console.log("Fetched chamas:", chamas);
        // In production, filter to show only common chamas between current user and viewed user
        setCommonChamas(chamas);
      }
    } catch (error) {
      console.error("Error fetching chamas:", error);
    }
  };

  const fetchUserReputation = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken || commonChamas.length === 0) return;

      // Fetch reputation from first common chama
      const chamaId = commonChamas[0]?.id;
      if (!chamaId) return;

      const response = await fetch(
        `http://localhost:3001/api/reputation/${chamaId}/user/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setReputation(data);
      }
    } catch (error) {
      console.error("Error fetching reputation:", error);
    }
  };

  const fetchRecentActivity = async () => {
    // In production, fetch from backend endpoints:
    // GET /api/users/:userId/comments
    // GET /api/users/:userId/replies
    // GET /api/users/:userId/votes
    // For now, using mock data
    setRecentComments([]);
    setRecentReplies([]);
    setRecentVotes([]);
  };

  const handleMessageUser = () => {
    if (commonChamas.length === 0) {
      alert(
        "You don't have any cycles in common with this user to message them."
      );
      return;
    }

    // Store recipient info in localStorage for the chat modal to use
    localStorage.setItem(
      "pendingMessage",
      JSON.stringify({
        recipientId: userId,
        recipientName: profile?.full_name,
        chamaId: commonChamas[0].id, // Use first common chama
        chamName: commonChamas[0].name,
      })
    );

    // Trigger the floating chat button
    const chatButton = document.querySelector(
      "button[aria-label='Open chat']"
    ) as HTMLButtonElement;
    if (chatButton) {
      chatButton.click();
    }
  };

  const getActivityStatus = () => {
    if (!profile?.last_activity_at) return "Active recently";

    const lastActive = new Date(profile.last_activity_at);
    const now = new Date();
    const diffMinutes = Math.floor(
      (now.getTime() - lastActive.getTime()) / (1000 * 60)
    );

    if (diffMinutes < 5) return "Active now";
    if (diffMinutes < 60) return `Active ${diffMinutes}m ago`;
    if (diffMinutes < 1440)
      return `Active ${Math.floor(diffMinutes / 60)}h ago`;
    return `Active ${Math.floor(diffMinutes / 1440)}d ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <HomeNavbar
          isAuthenticated={isAuthenticated}
          showSearchInNav={false}
          searchQuery=""
          onSearchChange={() => {}}
        />
        <main className="max-w-[1085px] mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#083232] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading profile...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <HomeNavbar
          isAuthenticated={isAuthenticated}
          showSearchInNav={false}
          searchQuery=""
          onSearchChange={() => {}}
        />
        <main className="max-w-[1085px] mx-auto px-4 py-8">
          <div className="text-center py-12">
            <User className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600">User not found</p>
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="mt-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <HomeNavbar
        isAuthenticated={isAuthenticated}
        showSearchInNav={false}
        searchQuery=""
        onSearchChange={() => {}}
      />
      <main className="max-w-[1085px] mx-auto px-4 py-8">
        {/* Back Button */}
        <Button
          onClick={() => router.back()}
          variant="outline"
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="flex gap-6">
          {/* Left Sidebar - Profile Info */}
          <div className="w-[275px] flex-shrink-0">
            <Card className="p-6 sticky top-6">
              {/* Profile Photo */}
              <div className="flex justify-center mb-4">
                <div className="w-24 h-24 rounded-full bg-[#083232] flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
                  {profile.profile_photo_url ? (
                    <img
                      src={profile.profile_photo_url}
                      alt={profile.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    profile.full_name?.charAt(0).toUpperCase()
                  )}
                </div>
              </div>

              {/* User Info Block */}
              <div className="mb-6 pb-6 border-b">
                {/* Reputation Badge */}
                <div className="flex mb-2">
                  <Badge className="bg-[#083232] text-white text-xs">
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    {reputation ? (
                      <>
                        {reputation.tier?.toUpperCase()} •{" "}
                        {reputation.totalScore}
                      </>
                    ) : (
                      <>NA • 0</>
                    )}
                  </Badge>
                </div>

                {/* Full Name */}
                <h1 className="text-xl font-bold text-gray-900 mb-2">
                  {profile.full_name}
                </h1>

                {/* Active Status */}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>{getActivityStatus()}</span>
                </div>
              </div>

              {/* About */}
              {profile.bio && (
                <div className="mb-6 pb-6 border-b">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    About
                  </h3>
                  <p
                    className={`text-sm text-gray-600 leading-relaxed ${
                      bioExpanded ? "" : "line-clamp-4"
                    }`}
                  >
                    {profile.bio}
                  </p>
                  {profile.bio.length > 150 && (
                    <button
                      onClick={() => setBioExpanded(!bioExpanded)}
                      className="text-xs text-[#083232] hover:text-[#2e856e] font-medium mt-2 cursor-pointer"
                    >
                      {bioExpanded ? "View less" : "View more"}
                    </button>
                  )}
                </div>
              )}

              {/* Details */}
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-gray-500 text-xs mb-0.5">Date Joined</p>
                    <p className="text-gray-900 font-medium">
                      {new Date(profile.created_at).toLocaleDateString(
                        "en-US",
                        {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </p>
                  </div>
                </div>
                {profile.location && (
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-gray-500 text-xs mb-0.5">Location</p>
                      <p className="text-gray-900 font-medium">
                        {profile.location}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Message Button */}
              <Button
                onClick={handleMessageUser}
                className="w-full bg-[#083232] hover:bg-[#2e856e]"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Message
              </Button>
            </Card>
          </div>

          {/* Right Content - Cycles in Common & Activity */}
          <div className="flex-1 space-y-6 min-w-0">
            {/* min-w-0 allows flex child to shrink */}
            {/* Cycles in Common */}
            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#f64d52]" />
                Cycles in Common
              </h2>
              {commonChamas.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {commonChamas.map((chama) => (
                    <div
                      key={chama.id}
                      className="h-[91px] min-w-[220px] flex items-center gap-3 p-3"
                    >
                      {/* Avatar with cover image */}
                      <div className="w-[42px] h-[42px] rounded-lg bg-[#083232] flex items-center justify-center text-white font-bold text-lg flex-shrink-0 overflow-hidden">
                        {chama.cover_image ? (
                          <img
                            src={chama.cover_image}
                            alt={chama.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          chama.name?.charAt(0).toUpperCase()
                        )}
                      </div>

                      {/* Cycle info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm truncate mb-1">
                          {chama.name}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {chama.active_members || 0} members
                          </span>
                          <Badge className="bg-[#083232] text-white text-xs px-2 py-0">
                            <Star className="w-2.5 h-2.5 mr-1 fill-current" />
                            {chama.reputation_score || "N/A"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No cycles in common</p>
                </div>
              )}
            </Card>

            {/* Recent Activities */}
            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#083232]" />
                Recent Activities
              </h2>
              {recentComments.length > 0 ||
              recentReplies.length > 0 ||
              recentVotes.length > 0 ? (
                <div className="space-y-4">
                  {/* Combine and sort comments, replies, and votes by date */}
                  {[
                    ...recentComments.map((c) => ({ ...c, type: "comment" })),
                    ...recentReplies.map((r) => ({ ...r, type: "reply" })),
                    ...recentVotes.map((v) => ({ ...v, type: "vote" })),
                  ]
                    .sort(
                      (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                    )
                    .map((activity: any) => (
                      <div
                        key={activity.id}
                        className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                        onClick={() =>
                          router.push(`/cycle/${activity.chama_slug}`)
                        }
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {activity.type === "comment" ? (
                            <MessageSquare className="w-4 h-4 text-[#083232]" />
                          ) : activity.type === "reply" ? (
                            <FileText className="w-4 h-4 text-[#2e856e]" />
                          ) : (
                            <Star className="w-4 h-4 text-[#f64d52]" />
                          )}
                          <span className="text-xs font-medium text-gray-500">
                            {activity.type === "comment"
                              ? "Commented"
                              : activity.type === "reply"
                              ? "Replied"
                              : "Voted"}
                          </span>
                        </div>
                        {activity.type === "vote" ? (
                          <p className="text-sm text-gray-700 mb-2">
                            {profile?.full_name?.split(" ")[0] || "User"} voted
                            on{" "}
                            <span className="font-medium">
                              {activity.proposal_name}
                            </span>
                          </p>
                        ) : (
                          <p className="text-sm text-gray-700 mb-2">
                            {activity.content}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="font-medium">
                            {activity.chama_name}
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(activity.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No recent activity</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
