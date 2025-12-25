"use client";

import { Mic, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FloatingMeetingIndicatorProps {
  isVisible: boolean;
  meetingTitle: string;
  participantCount: number;
  onClick: () => void;
}

export function FloatingMeetingIndicator({
  isVisible,
  meetingTitle,
  participantCount,
  onClick,
}: FloatingMeetingIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-0 right-20 z-50"
      style={{ marginBottom: "80px" }}
    >
      <Button
        onClick={onClick}
        className="h-14 px-4 rounded-full bg-[#083232] hover:bg-[#2e856e] shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
        aria-label="Open meeting"
      >
        {/* Pulsing indicator */}
        <div className="relative">
          <Mic className="h-5 w-5 text-white" />
          <span className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-xs font-medium text-white truncate max-w-[120px]">
            {meetingTitle}
          </span>
          <span className="text-[10px] text-white/80 flex items-center gap-1">
            <Users className="h-3 w-3" />
            {participantCount} listening
          </span>
        </div>
      </Button>
    </div>
  );
}
