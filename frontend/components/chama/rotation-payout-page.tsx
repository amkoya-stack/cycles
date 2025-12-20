"use client";

import { useState, useEffect } from "react";
import { RotationDashboard } from "./rotation-dashboard";
import { RotationManagement } from "./rotation-management";
import { PayoutHistory } from "./payout-history";
import { ContributionDashboard } from "./contribution-dashboard";
import { Card } from "@/components/ui/card";
import { Repeat, Settings, History, HandCoins } from "lucide-react";

interface RotationPayoutPageProps {
  chamaId: string;
  isAdmin?: boolean;
}

export function RotationPayoutPage({
  chamaId,
  isAdmin = false,
}: RotationPayoutPageProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeCycle, setActiveCycle] = useState<any>(null);
  const [loadingCycle, setLoadingCycle] = useState(true);

  useEffect(() => {
    fetchActiveCycle();
  }, [chamaId]);

  const fetchActiveCycle = async () => {
    try {
      setLoadingCycle(true);
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

      // Only get active cycle - don't show completed cycles
      const res = await fetch(`${API_URL}/api/chama/${chamaId}/cycles/active`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });

      if (res.ok) {
        const text = await res.text();
        if (text) {
          const data = JSON.parse(text);
          if (data) {
            setActiveCycle(data);
            return;
          }
        }
      }

      // No active cycle found
      setActiveCycle(null);
    } catch (error) {
      console.error("Error fetching active cycle:", error);
      setActiveCycle(null);
    } finally {
      setLoadingCycle(false);
    }
  };

  const handleRotationCreated = () => {
    // Refresh all components by updating key
    setRefreshKey((k) => k + 1);
  };

  return (
    <div
      className="w-full px-6"
      style={{ maxWidth: "1085px", margin: "0 auto" }}
      key={refreshKey}
    >
      {/* Current Cycle - Full Width */}
      <section className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#083232] flex items-center justify-center">
            <HandCoins className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-2xl font-semibold text-[#083232]">
            Current Cycle
          </h2>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loadingCycle ? (
            <div className="flex items-center justify-center min-h-[320px]">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#083232] border-t-transparent"></div>
            </div>
          ) : !activeCycle ? (
            <div className="p-16 text-center">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
                <HandCoins className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-lg text-gray-600 mb-2">
                No active contribution cycle
              </p>
              {isAdmin && (
                <p className="text-sm text-gray-500">
                  Create a rotation in the settings section below to begin
                </p>
              )}
            </div>
          ) : (
            <div className="p-6">
              <ContributionDashboard
                key={refreshKey}
                cycleId={activeCycle.id}
                chamaId={chamaId}
                isAdmin={isAdmin}
                onContributeClick={() => {
                  alert("Make contributions from your Wallet page at /wallet");
                }}
              />
            </div>
          )}
        </div>
      </section>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Rotation Overview Section */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#2e856e] flex items-center justify-center">
              <Repeat className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-[#083232]">
              Rotation Order
            </h2>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden p-6 h-full">
            <RotationDashboard chamaId={chamaId} isAdmin={isAdmin} />
          </div>
        </section>

        {/* Payout History Section */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#2e856e] flex items-center justify-center">
              <History className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-[#083232]">
              Payout History
            </h2>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden p-6 h-full">
            <PayoutHistory chamaId={chamaId} />
          </div>
        </section>
      </div>

      {/* Admin Settings Section - Full Width */}
      {isAdmin && (
        <section className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#f64d52] flex items-center justify-center">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-[#083232]">
              Rotation Settings
            </h2>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden p-6">
            <RotationManagement
              chamaId={chamaId}
              onRotationCreated={handleRotationCreated}
            />
          </div>
        </section>
      )}
    </div>
  );
}
