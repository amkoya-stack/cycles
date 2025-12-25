/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  Users,
  Video,
  Mic,
  Monitor,
  Download,
  FileText,
  ArrowLeft,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function MeetingDetailsPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = use(params);
  const router = useRouter();
  const [meeting, setMeeting] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [attendanceReport, setAttendanceReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "attendance" | "recordings"
  >("overview");

  useEffect(() => {
    fetchMeetingDetails();
    fetchParticipants();
    fetchRecordings();
  }, [meetingId]);

  const fetchMeetingDetails = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/meetings/${meetingId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMeeting(data);
      }
    } catch (error) {
      console.error("Failed to fetch meeting:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/meetings/${meetingId}/participants`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setParticipants(data);
      }
    } catch (error) {
      console.error("Failed to fetch participants:", error);
    }
  };

  const fetchRecordings = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/meetings/${meetingId}/recordings`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRecordings(data);
      }
    } catch (error) {
      console.error("Failed to fetch recordings:", error);
    }
  };

  const fetchAttendanceReport = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/meetings/${meetingId}/attendance`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAttendanceReport(data);
      }
    } catch (error) {
      console.error("Failed to fetch attendance:", error);
    }
  };

  const getMeetingTypeIcon = () => {
    switch (meeting?.meeting_type) {
      case "video":
        return <Video className="h-6 w-6" />;
      case "screen_share":
        return <Monitor className="h-6 w-6" />;
      default:
        return <Mic className="h-6 w-6" />;
    }
  };

  const getStatusColor = () => {
    switch (meeting?.status) {
      case "in_progress":
        return "bg-green-100 text-green-800";
      case "scheduled":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-gray-100 text-gray-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#083232]"></div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Meeting not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Button
          onClick={() => router.back()}
          variant="outline"
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Header */}
        <Card className="p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#083232] text-white rounded-lg">
                {getMeetingTypeIcon()}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{meeting.title}</h1>
                <p className="text-gray-600">Hosted by {meeting.host_name}</p>
              </div>
            </div>
            <Badge className={getStatusColor()}>
              {meeting.status.replace("_", " ").toUpperCase()}
            </Badge>
          </div>

          {meeting.description && (
            <p className="text-gray-700 mb-4">{meeting.description}</p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="font-medium">
                  {new Date(meeting.scheduled_start).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">Time</p>
                <p className="font-medium">
                  {new Date(meeting.scheduled_start).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">Participants</p>
                <p className="font-medium">{meeting.participant_count}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="font-medium">
                  {Math.round(
                    (new Date(meeting.scheduled_end).getTime() -
                      new Date(meeting.scheduled_start).getTime()) /
                      60000
                  )}{" "}
                  min
                </p>
              </div>
            </div>
          </div>

          {meeting.status === "scheduled" && (
            <div className="mt-4 flex gap-3">
              <Button
                onClick={() => router.push(`/cycle/meetings/${meetingId}`)}
                className="bg-[#083232] hover:bg-[#2e856e]"
              >
                Join Meeting
              </Button>
            </div>
          )}
        </Card>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "overview"
                ? "text-[#083232] border-b-2 border-[#083232]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => {
              setActiveTab("attendance");
              if (!attendanceReport) fetchAttendanceReport();
            }}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "attendance"
                ? "text-[#083232] border-b-2 border-[#083232]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Attendance
          </button>
          <button
            onClick={() => setActiveTab("recordings")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "recordings"
                ? "text-[#083232] border-b-2 border-[#083232]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Recordings ({recordings.length})
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">
                Participants ({participants.length})
              </h2>
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          participant.profile_photo_url || "/default-avatar.png"
                        }
                        alt={participant.full_name}
                        className="h-10 w-10 rounded-full"
                      />
                      <div>
                        <p className="font-medium">{participant.full_name}</p>
                        <p className="text-sm text-gray-600">
                          {participant.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {participant.is_host && (
                        <Badge className="bg-[#f64d52]">Host</Badge>
                      )}
                      <Badge
                        variant={
                          participant.status === "joined"
                            ? "default"
                            : "outline"
                        }
                      >
                        {participant.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === "attendance" && attendanceReport && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <Card className="p-4">
                <p className="text-sm text-gray-600">Total Invited</p>
                <p className="text-2xl font-bold">
                  {attendanceReport.summary.total_invited}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-gray-600">Attended</p>
                <p className="text-2xl font-bold text-green-600">
                  {attendanceReport.summary.total_attended}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-gray-600">Late Arrivals</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {attendanceReport.summary.total_late}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-gray-600">Avg Duration</p>
                <p className="text-2xl font-bold">
                  {Math.round(
                    attendanceReport.summary.average_duration_minutes
                  )}{" "}
                  min
                </p>
              </Card>
            </div>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Detailed Attendance</h2>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Name</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">Joined At</th>
                      <th className="text-left py-2">Duration</th>
                      <th className="text-left py-2">Late</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceReport.participants.map((p: any) => (
                      <tr key={p.id} className="border-b">
                        <td className="py-3">{p.full_name}</td>
                        <td>
                          <Badge
                            variant={
                              p.attendance_status === "attended"
                                ? "default"
                                : "outline"
                            }
                          >
                            {p.attendance_status}
                          </Badge>
                        </td>
                        <td>
                          {p.joined_at
                            ? new Date(p.joined_at).toLocaleTimeString()
                            : "-"}
                        </td>
                        <td>{Math.round(p.duration_minutes || 0)} min</td>
                        <td>{p.is_late ? "✓" : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "recordings" && (
          <div className="space-y-4">
            {recordings.length === 0 ? (
              <Card className="p-12 text-center">
                <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">No recordings available</p>
              </Card>
            ) : (
              recordings.map((recording) => (
                <Card key={recording.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{recording.file_name}</h3>
                      <p className="text-sm text-gray-600">
                        Duration: {Math.round(recording.duration_seconds / 60)}{" "}
                        minutes
                      </p>
                      <p className="text-sm text-gray-600">
                        Size: {(recording.file_size / 1024 / 1024).toFixed(2)}{" "}
                        MB
                      </p>
                    </div>
                    <Button className="bg-[#083232] hover:bg-[#2e856e]">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
