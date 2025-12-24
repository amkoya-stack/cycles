"use client";

import { useParams } from "next/navigation";
import { useAuthGuard } from "@/hooks/use-auth";
import { DocumentVault } from "@/components/chama/document-vault";

export default function DocumentsPage() {
  const params = useParams();
  const chamaId = params.slug as string;

  // Auth guard - redirect to login if token expired
  useAuthGuard();

  return <DocumentVault chamaId={chamaId} />;
}
