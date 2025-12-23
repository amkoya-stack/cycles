"use client";

import { useParams } from "next/navigation";
import { DocumentVault } from "@/components/chama/document-vault";

export default function DocumentsPage() {
  const params = useParams();
  const chamaId = params.slug as string;

  return <DocumentVault chamaId={chamaId} />;
}
