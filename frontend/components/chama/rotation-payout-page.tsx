"use client";

import { RotationPayoutPageNew } from "./rotation-payout-page-new";

interface RotationPayoutPageProps {
  chamaId: string;
  isAdmin?: boolean;
}

export function RotationPayoutPage({
  chamaId,
  isAdmin = false,
}: RotationPayoutPageProps) {
  return <RotationPayoutPageNew chamaId={chamaId} isAdmin={isAdmin} />;
}
