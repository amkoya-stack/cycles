/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, User, Trash2, LogIn, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MeetingsSidebarProps {
  chamaId: string;
  onJoinMeeting?: (meetingId: string, title: string) => void;
}

const POLLING_INTERVAL_MS = 10000; // Poll every 10 seconds for ongoing meetings

export function MeetingsSidebar({
  chamaId,
  onJoinMeeting,
}: MeetingsSidebarProps) {
  const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([]);
  const [ongoingMeetings, setOngoingMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    // Get current user ID from token
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (accessToken) {
        const payload = JSON.parse(atob(accessToken.split(".")[1]));
        setCurrentUserId(payload.sub || payload.userId || "");
      }
    } catch (error) {
      console.error("Failed to parse token:", error);
    }

    fetchUpcomingMeetings();
    fetchOngoingMeetings();
  }, [chamaId]);

  // Poll for ongoing meetings every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOngoingMeetings();
    }, POLLING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [chamaId, currentUserId]);

  // Poll for upcoming meetings every 30 seconds (to show cancelled meetings disappearing)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchUpcomingMeetings();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [chamaId]);

  const fetchUpcomingMeetings = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        console.error("No access token found - user not authenticated");
        setLoading(false);
        return;
      }

      console.log(`[DEBUG] Fetching upcoming meetings for chamaId: ${chamaId}`);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/meetings/chama/${chamaId}?status=scheduled`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const meetings = await response.json();
        console.log("Upcoming meetings data:", meetings);
        console.log(
          `Found ${meetings.length} upcoming meetings for chama ${chamaId}`
        );
        console.log(
          `[DEBUG] API URL called: /meetings/chama/${chamaId}?status=scheduled`
        );
        setUpcomingMeetings(meetings);
      } else {
        const errorText = await response.text();
        console.error(
          "Failed to fetch upcoming meetings:",
          response.status,
          errorText
        );
        if (response.status === 403) {
          console.error("User is not a member of this chama");
        }
      }
    } catch (error) {
      console.error("Failed to fetch upcoming meetings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOngoingMeetings = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        console.error("No access token found - user not authenticated");
        return;
      }

      console.log(`[DEBUG] Fetching ongoing meetings for chamaId: ${chamaId}`);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/meetings/chama/${chamaId}?status=in_progress`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const meetings = await response.json();
        console.log("[DEBUG] Ongoing meetings API response:", meetings);
        console.log(
          `[DEBUG] API URL called: /meetings/chama/${chamaId}?status=in_progress`
        );
        setOngoingMeetings(meetings);
      } else {
        const errorText = await response.text();
        console.error(
          "[DEBUG] Failed to fetch ongoing meetings:",
          response.status,
          errorText
        );
      }
    } catch (error) {
      console.error("[DEBUG] Exception in fetchOngoingMeetings:", error);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Time";
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleDeleteMeeting = async (
    meetingId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    if (!confirm("Are you sure you want to cancel this meeting?")) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/meetings/${meetingId}/cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          body: JSON.stringify({
            reason: "Cancelled by organizer",
          }),
        }
      );

      if (response.ok) {
        // Remove from UI
        setUpcomingMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      } else {
        alert("Failed to cancel meeting");
      }
    } catch (error) {
      console.error("Failed to cancel meeting:", error);
      alert("Failed to cancel meeting");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-[#f64d52]" />
            <h3 className="font-semibold text-base">Live Now</h3>
          </div>
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#083232]" />
            <h3 className="font-semibold text-base">Upcoming</h3>
          </div>
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ongoing Meetings Section */}
      {ongoingMeetings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-[#f64d52] animate-pulse" />
            <h3 className="font-semibold text-base text-[#f64d52]">Live Now</h3>
          </div>
          <div className="space-y-3">
            {ongoingMeetings.map((meeting) => {
              const scheduledStart = meeting.scheduled_start;
              const organizerName = meeting.host_name || "Unknown";
              // meeting.is_joined: true if user is already in the meeting (backend should provide this, or use is_invited if joined means invited+joined)
              const isJoined =
                meeting.is_joined ||
                (meeting.status === "in_progress" && meeting.is_invited); // fallback for now

              return (
                <div
                  key={meeting.id}
                  className="p-3 bg-[#f64d52]/5 border border-[#f64d52]/20 rounded-lg hover:bg-[#f64d52]/10 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-medium text-sm text-gray-900 flex-1">
                      {meeting.title}
                    </h4>
                    <Radio className="h-4 w-4 text-[#f64d52] animate-pulse flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-600 mb-3">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(scheduledStart)}</span>
                    </div>
                    <span className="text-gray-400">•</span>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{organizerName}</span>
                    </div>
                  </div>
                  {!isJoined ? (
                    <Button
                      onClick={() => onJoinMeeting?.(meeting.id, meeting.title)}
                      size="sm"
                      className="w-full bg-[#f64d52] hover:bg-[#f64d52]/90 text-white h-8 text-xs font-medium"
                    >
                      <LogIn className="h-3 w-3 mr-1" />
                      Join Meeting
                    </Button>
                  ) : (
                    <div className="w-full h-8 flex items-center justify-center text-xs font-medium text-[#f64d52] bg-[#f64d52]/10 rounded">
                      You are in this meeting
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Meetings Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-[#083232]" />
          <h3 className="font-semibold text-base">Upcoming Meetings</h3>
        </div>

        {upcomingMeetings.length === 0 ? (
          <p className="text-sm text-gray-500">No upcoming meetings</p>
        ) : (
          <div className="space-y-3">
            {upcomingMeetings.map((meeting) => {
              // Backend returns: scheduled_start, host_name, host_user_id
              const scheduledStart = meeting.scheduled_start;
              const organizerName = meeting.host_name || "Unknown";
              const isHost = meeting.host_user_id === currentUserId;

              return (
                <div
                  key={meeting.id}
                  className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer group relative"
                >
                  <h4 className="font-medium text-sm text-gray-900 mb-2 pr-8">
                    {meeting.title}
                  </h4>
                  {isHost && (
                    <button
                      onClick={(e) => handleDeleteMeeting(meeting.id, e)}
                      className="absolute top-3 right-3 text-gray-400 hover:text-[#f64d52] opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Cancel meeting"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(scheduledStart)}</span>
                    </div>
                    <span className="text-gray-400">•</span>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(scheduledStart)}</span>
                    </div>
                    <span className="text-gray-400">•</span>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{organizerName}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
