"use client";

import { MeetingRoom } from "@/components/chama/meeting-room";
import { use } from "react";

export default function MeetingPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = use(params);

  return <MeetingRoom meetingId={meetingId} />;
}
