"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Mic, Monitor, Users, Calendar, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Meeting {
  id: string;
  title: string;
  description: string;
  scheduled_start: string;
  scheduled_end: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  meeting_type: "audio" | "video" | "screen_share";
  host_name: string;
  participant_count: number;
  is_invited: boolean;
  is_recording_enabled: boolean;
}

interface MeetingCardProps {
  meeting: Meeting;
  onJoin: (meetingId: string) => void;
  onViewDetails: (meetingId: string) => void;
}

export function MeetingCard({
  meeting,
  onJoin,
  onViewDetails,
}: MeetingCardProps) {
  const getMeetingTypeIcon = () => {
    switch (meeting.meeting_type) {
      case "video":
        return <Video className="h-5 w-5" />;
      case "screen_share":
        return <Monitor className="h-5 w-5" />;
      default:
        return <Mic className="h-5 w-5" />;
    }
  };

  const getStatusColor = () => {
    switch (meeting.status) {
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

  const canJoin =
    meeting.status === "in_progress" || meeting.status === "scheduled";

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[#083232] text-white rounded-lg">
            {getMeetingTypeIcon()}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{meeting.title}</h3>
            <p className="text-sm text-gray-600">
              Hosted by {meeting.host_name}
            </p>
          </div>
        </div>
        <Badge className={getStatusColor()}>
          {meeting.status.replace("_", " ").toUpperCase()}
        </Badge>
      </div>

      {meeting.description && (
        <p className="text-sm text-gray-700 mb-3 line-clamp-2">
          {meeting.description}
        </p>
      )}

      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4" />
          <span>{new Date(meeting.scheduled_start).toLocaleDateString()}</span>
          <Clock className="h-4 w-4 ml-2" />
          <span>
            {new Date(meeting.scheduled_start).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {" - "}
            {new Date(meeting.scheduled_end).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-gray-600">
            <Users className="h-4 w-4" />
            <span>{meeting.participant_count} invited</span>
          </div>
          {meeting.is_recording_enabled && (
            <Badge variant="outline" className="text-xs">
              Recording Enabled
            </Badge>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {canJoin && meeting.is_invited && (
          <Button
            onClick={() => onJoin(meeting.id)}
            className="flex-1 bg-[#083232] hover:bg-[#2e856e]"
          >
            {meeting.status === "in_progress" ? "Join Now" : "Join Meeting"}
          </Button>
        )}
        <Button
          onClick={() => onViewDetails(meeting.id)}
          variant="outline"
          className="flex-1"
        >
          View Details
        </Button>
      </div>

      {meeting.status === "scheduled" && (
        <p className="text-xs text-gray-500 mt-2">
          Starts{" "}
          {formatDistanceToNow(new Date(meeting.scheduled_start), {
            addSuffix: true,
          })}
        </p>
      )}
    </Card>
  );
}
