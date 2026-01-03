"use client";

import { useParams } from "next/navigation";
import { DisputeDetail } from "@/components/dispute/dispute-detail";
import { useAuth } from "@/hooks/use-auth";

export default function DisputeDetailPage() {
  const params = useParams();
  const disputeId = params.id as string;
  const { user } = useAuth();

  // Get chamaId from dispute (will be fetched in component)
  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Dispute Details</h1>
      <DisputeDetail
        disputeId={disputeId}
        chamaId="" // Will be fetched from dispute
        userRole={user?.role || undefined}
      />
    </div>
  );
}

