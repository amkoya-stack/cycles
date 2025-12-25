/* eslint-disable react-hooks/immutability */
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  Mic,
  MicOff,
  Minus,
  Users,
  Hand,
  UserMinus,
  VolumeX,
} from "lucide-react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
  useRoomInfo,
  useConnectionState,
  ConnectionState,
} from "@livekit/components-react";

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  isSpeaking: boolean;
  isHost: boolean;
  isMuted: boolean;
  handRaised: boolean;
}

interface SpacesMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onParticipantCountChange?: (count: number) => void;
  meetingId: string;
  meetingTitle: string;
  isHost: boolean;
  livekitToken: string;
  livekitUrl: string;
}

export function SpacesMeetingModal({
  isOpen,
  onClose,
  onMinimize,
  onParticipantCountChange,
  meetingId,
  meetingTitle,
  isHost,
  livekitToken,
  livekitUrl,
}: SpacesMeetingModalProps) {
  if (!livekitUrl || !livekitToken) {
    return null;
  }

  return (
    <LiveKitRoom
      token={livekitToken}
      serverUrl={livekitUrl}
      connect={true} // Always stay connected, even when minimized
      audio={false}
      video={false}
      options={{
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
        publishDefaults: {
          simulcast: false, // Disable simulcast for better Edge compatibility
        },
        adaptiveStream: true,
        dynacast: true,
        disconnectOnPageLeave: true,
        // Edge-specific connection options
        reconnectPolicy: {
          maxRetries: 5,
          retryDelayMs: 2000,
        },
        // Force WebSocket transport for Edge compatibility
        rtcConfig: {
          iceTransportPolicy: "all",
          bundlePolicy: "max-bundle",
          rtcpMuxPolicy: "require",
        },
      }}
      onError={(error) => {
        console.error("LiveKit connection error:", error);
        // Handle Edge-specific connection errors
        if (
          error.message?.includes("Failed to fetch") ||
          error.message?.includes("signal connection") ||
          error.message?.includes("publishing rejected") ||
          error.message?.includes("engine not connected")
        ) {
          console.warn("Edge browser compatibility issue:", error.message);
          // Don't throw error, just log it
          return;
        }
      }}
      onDisconnected={(reason) => {
        console.log("LiveKit disconnected:", reason);
        // Auto-reconnect on Edge
        const reasonStr =
          typeof reason === "string" ? reason : String(reason || "");
        if (
          reasonStr.includes("signal") &&
          navigator.userAgent.includes("Edge")
        ) {
          console.log("Attempting Edge reconnection...");
        }
      }}
    >
      <SpacesContent
        isOpen={isOpen}
        onClose={onClose}
        onMinimize={onMinimize}
        onParticipantCountChange={onParticipantCountChange}
        meetingId={meetingId}
        meetingTitle={meetingTitle}
        isHost={isHost}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

interface SpacesContentProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onParticipantCountChange?: (count: number) => void;
  meetingId: string;
  meetingTitle: string;
  isHost: boolean;
}

function SpacesContent({
  isOpen,
  onClose,
  onMinimize,
  onParticipantCountChange,
  meetingId,
  meetingTitle,
  isHost,
}: SpacesContentProps) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const connectionState = useConnectionState();

  const [micEnabled, setMicEnabled] = useState(false);
  const [micPermission, setMicPermission] = useState<
    "granted" | "denied" | "prompt"
  >("prompt");
  const [showReactions, setShowReactions] = useState(false);
  const [activeReaction, setActiveReaction] = useState<string | null>(null);
  const [handRaised, setHandRaised] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);

  const reactions = ["👍", "❤️", "😂", "🎉", "👏", "🔥"];

  // Update parent with participant count - always track, even when minimized
  useEffect(() => {
    if (onParticipantCountChange) {
      console.log(`[DEBUG] Participant count changed: ${participants.length}`);
      onParticipantCountChange(participants.length);
    }
  }, [participants.length, onParticipantCountChange]);

  useEffect(() => {
    checkMicPermission();

    // Suppress Livekit DataChannel errors
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const message = args[0]?.toString() || "";
      // Suppress known harmless Livekit errors
      if (
        message.includes("DataChannel error") ||
        message.includes("leave request while trying to") ||
        message.includes("peerconnection closed")
      ) {
        return; // Suppress these errors
      }
      originalConsoleError.apply(console, args);
    };

    return () => {
      console.error = originalConsoleError; // Restore original
    };
  }, []);

  // Sync microphone state with Livekit participant
  useEffect(() => {
    if (localParticipant) {
      const isMicEnabled = localParticipant.isMicrophoneEnabled;
      setMicEnabled(isMicEnabled);
    }
  }, [localParticipant, localParticipant?.isMicrophoneEnabled]);

  // Auto-close modal when disconnected (meeting ended by host)
  useEffect(() => {
    if (connectionState === ConnectionState.Disconnected) {
      console.log("Livekit room disconnected - meeting ended");
      setMeetingEnded(true);
      // Close modal after showing "Meeting ended" message
      setTimeout(() => {
        onClose();
      }, 2000); // Show message for 2 seconds
    } else if (connectionState === ConnectionState.Connecting) {
      console.log("Connecting to LiveKit room...");
    } else if (connectionState === ConnectionState.Connected) {
      console.log("Successfully connected to LiveKit room");
    } else if (connectionState === ConnectionState.Reconnecting) {
      console.log("Reconnecting to LiveKit room...");
    }
  }, [connectionState, onClose]);

  // Cleanup on unmount - leave meeting and disconnect
  useEffect(() => {
    return () => {
      // Call leave endpoint when component unmounts
      const leaveMeeting = async () => {
        try {
          await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/meetings/${meetingId}/leave`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
              },
            }
          );
        } catch (error) {
          console.error("Failed to leave meeting:", error);
        }
      };

      leaveMeeting();
    };
  }, [meetingId]);

  const checkMicPermission = async () => {
    try {
      const result = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });
      setMicPermission(result.state);

      result.addEventListener("change", () => {
        setMicPermission(result.state);
      });
    } catch (error) {
      console.error("Failed to check mic permission:", error);
    }
  };

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicPermission("granted");
      return true;
    } catch (error) {
      console.error("Mic permission denied:", error);
      setMicPermission("denied");
      return false;
    }
  };

  const toggleMic = async () => {
    try {
      if (micPermission !== "granted") {
        const granted = await requestMicPermission();
        if (!granted) return;
      }

      const enabled = !micEnabled;

      // Enable/disable microphone using Livekit with Edge compatibility
      if (localParticipant) {
        try {
          await localParticipant.setMicrophoneEnabled(enabled);
          console.log(`Microphone ${enabled ? "enabled" : "disabled"}`);
        } catch (error: any) {
          // Handle Edge-specific WebRTC errors
          if (
            error.message?.includes("publishing rejected") ||
            error.message?.includes("engine not connected")
          ) {
            console.warn("Edge WebRTC issue - retrying microphone toggle");
            // Wait and retry once
            setTimeout(async () => {
              try {
                await localParticipant.setMicrophoneEnabled(enabled);
                console.log(
                  `Microphone ${enabled ? "enabled" : "disabled"} (retry)`
                );
              } catch (retryError) {
                console.error(
                  "Failed to toggle microphone after retry:",
                  retryError
                );
              }
            }, 1000);
          } else {
            throw error;
          }
        }
      }

      setMicEnabled(enabled);
    } catch (error) {
      console.error("Failed to toggle microphone:", error);
      setMicEnabled(false);
    }
  };

  const handleReaction = (emoji: string) => {
    setActiveReaction(emoji);
    setShowReactions(false);

    // Clear reaction after 2 seconds
    setTimeout(() => setActiveReaction(null), 2000);
  };

  const toggleHandRaise = () => {
    setHandRaised(!handRaised);
  };

  const handleEndMeeting = async () => {
    if (!confirm("Are you sure you want to end this meeting for everyone?"))
      return;

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
            reason: "Meeting ended by host",
          }),
        }
      );

      if (response.ok) {
        onClose();
      }
    } catch (error) {
      console.error("Failed to end meeting:", error);
    }
  };

  const handleMuteAll = () => {
    if (!confirm("Mute all participants?")) return;
    // TODO: Implement mute all via Livekit
  };

  const handleRemoveParticipant = (participantId: string) => {
    if (!confirm("Remove this participant?")) return;
    // TODO: Implement remove participant via Livekit
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-hidden p-0 bg-gradient-to-b from-[#083232] to-[#0a4444]"
        showCloseButton={false}
      >
        <VisuallyHidden>
          <DialogTitle>{meetingTitle}</DialogTitle>
        </VisuallyHidden>

        {/* Meeting Ended Overlay */}
        {meetingEnded && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-6xl mb-4">👋</div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Meeting Ended
              </h3>
              <p className="text-white/70">
                This meeting has been ended by the host
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="p-6 pb-4 relative">
          <button
            onClick={onMinimize}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
            title="Minimize meeting"
          >
            <Minus className="h-6 w-6" />
          </button>
          <h2 className="text-xl font-bold text-white text-center pr-10">
            {meetingTitle}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-2 text-white/70 text-sm">
            <Users className="h-4 w-4" />
            <span>{participants.length} listening</span>
          </div>
        </div>

        {/* Microphone Permission Warning */}
        {micPermission === "denied" && (
          <div className="mx-6 mt-4 px-4 py-2 bg-[#f64d52] rounded-lg text-white text-sm text-center">
            ⚠️ Microphone access denied. Please enable it in your browser
            settings.
          </div>
        )}

        {/* Active Reaction Display */}
        {activeReaction && (
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-8xl animate-bounce z-50 pointer-events-none">
            {activeReaction}
          </div>
        )}

        {/* Participants List */}
        <div className="px-6 pb-6 max-h-[300px] overflow-y-auto">
          <div className="grid grid-cols-4 gap-4">
            {participants.map((participant) => {
              const isSpeaking = participant.isSpeaking;
              const isMuted = !participant.isMicrophoneEnabled;
              const participantIsHost =
                participant.identity === localParticipant.identity && isHost;

              // Extract avatar from Livekit metadata
              let avatarUrl = null;
              try {
                if (participant.metadata) {
                  const metadata = JSON.parse(participant.metadata);
                  avatarUrl = metadata.avatar;
                }
              } catch (e) {
                // Ignore parsing errors
              }

              return (
                <div
                  key={participant.identity}
                  className="flex flex-col items-center gap-2 relative group"
                >
                  <div className="relative">
                    <Avatar
                      className={`w-16 h-16 transition-all ${
                        isSpeaking
                          ? "ring-4 ring-green-400 ring-offset-2 ring-offset-[#083232] scale-110"
                          : ""
                      }`}
                    >
                      {avatarUrl && (
                        <AvatarImage
                          src={avatarUrl}
                          alt={participant.name || "?"}
                        />
                      )}
                      <AvatarFallback className="bg-[#2e856e] text-white">
                        {getInitials(
                          participant.name && participant.name !== ""
                            ? participant.name
                            : "User"
                        )}
                      </AvatarFallback>
                    </Avatar>

                    {/* Speaking indicator pulse */}
                    {isSpeaking && (
                      <div className="absolute inset-0 rounded-full border-2 border-green-400 animate-ping" />
                    )}

                    {/* Muted indicator */}
                    {isMuted && (
                      <div className="absolute bottom-0 right-0 bg-red-500 rounded-full p-1">
                        <MicOff className="h-3 w-3 text-white" />
                      </div>
                    )}

                    {/* Host badge */}
                    {participantIsHost && (
                      <div className="absolute -top-1 -left-1 bg-yellow-500 rounded-full p-1">
                        <span className="text-xs">👑</span>
                      </div>
                    )}

                    {/* Remove button (host only) */}
                    {isHost && !participantIsHost && (
                      <button
                        onClick={() =>
                          handleRemoveParticipant(participant.identity)
                        }
                        className="absolute -top-2 -right-2 bg-[#f64d52] rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <UserMinus className="h-3 w-3 text-white" />
                      </button>
                    )}
                  </div>
                  <span className="text-white text-xs text-center line-clamp-1 max-w-[70px]">
                    {participant.name && participant.name !== ""
                      ? participant.name
                      : "Loading..."}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="p-6 bg-black/20 border-t border-white/10">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Mic Control */}
            <Button
              onClick={toggleMic}
              variant="ghost"
              className={`text-white hover:bg-white/10 ${
                micEnabled ? "bg-green-600 hover:bg-green-700" : ""
              }`}
              size="sm"
            >
              {micEnabled ? (
                <Mic className="h-5 w-5" />
              ) : (
                <MicOff className="h-5 w-5" />
              )}
            </Button>

            {/* Reactions */}
            <div className="relative">
              <Button
                onClick={() => setShowReactions(!showReactions)}
                variant="ghost"
                className="text-white hover:bg-white/10"
                size="sm"
              >
                ❤️
              </Button>

              {showReactions && (
                <div className="absolute bottom-full mb-2 left-0 bg-white rounded-lg p-2 flex gap-1 shadow-lg">
                  {reactions.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(emoji)}
                      className="text-2xl hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Center: Raise Hand */}
            {!isHost && (
              <Button
                onClick={toggleHandRaise}
                variant="ghost"
                className={`text-white hover:bg-white/10 ${
                  handRaised ? "bg-white/20" : ""
                }`}
                size="sm"
              >
                <Hand className="h-5 w-5" />
              </Button>
            )}

            {/* Host Controls */}
            {isHost && (
              <>
                <Button
                  onClick={handleMuteAll}
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  size="sm"
                >
                  <VolumeX className="h-5 w-5" />
                </Button>
                <Button
                  onClick={handleEndMeeting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  size="sm"
                >
                  End Meeting
                </Button>
              </>
            )}

            {/* Leave Button (for everyone) */}
            <Button
              onClick={onClose}
              className="bg-[#f64d52] hover:bg-[#d43d42] text-white"
              size="sm"
            >
              Leave
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
