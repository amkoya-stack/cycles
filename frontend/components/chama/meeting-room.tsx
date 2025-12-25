/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/immutability */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Phone,
  Hand,
  MessageSquare,
  Users,
  Settings,
} from "lucide-react";

interface MeetingRoomProps {
  meetingId: string;
}

export function MeetingRoom({ meetingId }: MeetingRoomProps) {
  const router = useRouter();
  const [meeting, setMeeting] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [livekitToken, setLivekitToken] = useState("");
  const [livekitUrl, setLivekitUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMeetingDetails();
    joinMeeting();
    const interval = setInterval(fetchParticipants, 5000); // Update every 5s
    return () => clearInterval(interval);
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
    }
  };

  const joinMeeting = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/meetings/${meetingId}/join`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          body: JSON.stringify({}),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setLivekitToken(data.token);
        setLivekitUrl(data.url);
        setLoading(false);
      } else {
        const error = await response.json();
        alert(error.message);
        router.back();
      }
    } catch (error: any) {
      alert(error.message);
      router.back();
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

  const leaveMeeting = async () => {
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/meetings/${meetingId}/leave`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        }
      );
    } catch (error) {
      console.error("Failed to leave meeting:", error);
    }
    router.back();
  };

  const sendChatMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/meetings/${meetingId}/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          body: JSON.stringify({
            content: newMessage,
            messageType: "text",
          }),
        }
      );

      if (response.ok) {
        const message = await response.json();
        setChatMessages([...chatMessages, message]);
        setNewMessage("");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const raiseHand = async () => {
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/meetings/${meetingId}/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          body: JSON.stringify({
            content: "",
            messageType: "hand_raised",
          }),
        }
      );
    } catch (error) {
      console.error("Failed to raise hand:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#083232] mx-auto mb-4"></div>
          <p className="text-gray-600">Joining meeting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Main meeting area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-white text-xl font-semibold">
              {meeting?.title}
            </h1>
            <p className="text-gray-400 text-sm">{meeting?.chama_name}</p>
          </div>
          <Badge className="bg-green-600 text-white">
            Live • {participants.filter((p) => p.status === "joined").length}{" "}
            participants
          </Badge>
        </div>

        {/* Video/Audio grid */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {participants
              .filter((p) => p.status === "joined")
              .map((participant) => (
                <Card
                  key={participant.id}
                  className="aspect-video bg-gray-800 flex items-center justify-center relative"
                >
                  <Avatar className="h-16 w-16">
                    <img
                      src={
                        participant.profile_photo_url || "/default-avatar.png"
                      }
                      alt={participant.full_name}
                    />
                  </Avatar>
                  <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-white text-sm flex items-center gap-1">
                    {participant.is_host && (
                      <Badge className="bg-[#f64d52] text-xs mr-1">Host</Badge>
                    )}
                    {participant.full_name}
                    {participant.is_muted && <MicOff className="h-3 w-3" />}
                  </div>
                  {participant.hand_raised_count > 0 && (
                    <div className="absolute top-2 right-2">
                      <Hand className="h-6 w-6 text-yellow-400 animate-bounce" />
                    </div>
                  )}
                </Card>
              ))}
          </div>

          {/* Placeholder for Livekit integration */}
          <div className="mt-4 p-4 bg-gray-800 rounded-lg text-center text-gray-400">
            <p>Livekit WebRTC integration will render here</p>
            <p className="text-sm">
              Token: {livekitToken ? "✓ Ready" : "Loading..."}
            </p>
            <p className="text-sm">URL: {livekitUrl || "Configuring..."}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 px-6 py-4 flex items-center justify-center gap-4">
          <Button
            onClick={() => setIsMuted(!isMuted)}
            variant="outline"
            size="icon"
            className={`rounded-full h-12 w-12 ${
              isMuted
                ? "bg-red-600 hover:bg-red-700"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            {isMuted ? (
              <MicOff className="h-5 w-5 text-white" />
            ) : (
              <Mic className="h-5 w-5 text-white" />
            )}
          </Button>

          {meeting?.meeting_type === "video" && (
            <Button
              onClick={() => setIsVideoOff(!isVideoOff)}
              variant="outline"
              size="icon"
              className={`rounded-full h-12 w-12 ${
                isVideoOff
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              {isVideoOff ? (
                <VideoOff className="h-5 w-5 text-white" />
              ) : (
                <Video className="h-5 w-5 text-white" />
              )}
            </Button>
          )}

          {meeting?.meeting_type === "screen_share" && (
            <Button
              onClick={() => setIsScreenSharing(!isScreenSharing)}
              variant="outline"
              size="icon"
              className={`rounded-full h-12 w-12 ${
                isScreenSharing
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              {isScreenSharing ? (
                <MonitorOff className="h-5 w-5 text-white" />
              ) : (
                <Monitor className="h-5 w-5 text-white" />
              )}
            </Button>
          )}

          <Button
            onClick={raiseHand}
            variant="outline"
            size="icon"
            className="rounded-full h-12 w-12 bg-gray-700 hover:bg-gray-600"
          >
            <Hand className="h-5 w-5 text-white" />
          </Button>

          <Button
            onClick={() => setShowChat(!showChat)}
            variant="outline"
            size="icon"
            className="rounded-full h-12 w-12 bg-gray-700 hover:bg-gray-600"
          >
            <MessageSquare className="h-5 w-5 text-white" />
          </Button>

          <Button
            onClick={() => setShowParticipants(!showParticipants)}
            variant="outline"
            size="icon"
            className="rounded-full h-12 w-12 bg-gray-700 hover:bg-gray-600"
          >
            <Users className="h-5 w-5 text-white" />
          </Button>

          <div className="flex-1" />

          <Button
            onClick={leaveMeeting}
            className="rounded-full h-12 px-6 bg-red-600 hover:bg-red-700 text-white"
          >
            <Phone className="h-5 w-5 mr-2 rotate-135" />
            Leave
          </Button>
        </div>
      </div>

      {/* Sidebar (Chat/Participants) */}
      {(showChat || showParticipants) && (
        <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowChat(true);
                  setShowParticipants(false);
                }}
                variant={showChat ? "default" : "outline"}
                className="flex-1"
              >
                Chat
              </Button>
              <Button
                onClick={() => {
                  setShowChat(false);
                  setShowParticipants(true);
                }}
                variant={showParticipants ? "default" : "outline"}
                className="flex-1"
              >
                Participants (
                {participants.filter((p) => p.status === "joined").length})
              </Button>
            </div>
          </div>

          {showChat && (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {chatMessages.map((msg, i) => (
                  <div key={i} className="bg-gray-700 p-3 rounded-lg">
                    <p className="text-sm font-semibold text-white">
                      {msg.sender_name}
                    </p>
                    <p className="text-sm text-gray-300">{msg.content}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-gray-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && sendChatMessage()}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#083232]"
                  />
                  <Button
                    onClick={sendChatMessage}
                    className="bg-[#083232] hover:bg-[#2e856e]"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>
          )}

          {showParticipants && (
            <div className="flex-1 p-4 overflow-y-auto">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700 mb-2"
                >
                  <Avatar className="h-10 w-10">
                    <img
                      src={
                        participant.profile_photo_url || "/default-avatar.png"
                      }
                      alt={participant.full_name}
                    />
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">
                      {participant.full_name}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {participant.status === "joined"
                        ? "In meeting"
                        : participant.status}
                    </p>
                  </div>
                  {participant.is_host && (
                    <Badge className="bg-[#f64d52] text-xs">Host</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
