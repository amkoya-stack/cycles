"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RotationDashboard } from "./rotation-dashboard";
import { RotationManagement } from "./rotation-management";
import { PayoutHistory } from "./payout-history";
import { UpcomingPayouts } from "./upcoming-payouts";
import { Card, CardContent } from "@/components/ui/card";
import { Repeat, Settings, History, Calendar } from "lucide-react";

interface RotationPayoutPageProps {
  chamaId: string;
  isAdmin?: boolean;
}

export function RotationPayoutPage({
  chamaId,
  isAdmin = false,
}: RotationPayoutPageProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRotationCreated = () => {
    // Refresh all components by updating key
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="w-full" key={refreshKey}>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#083232] mb-2">
          Rotation & Payouts
        </h1>
        <p className="text-gray-600">
          Manage rotation orders and track payout distributions
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
          <TabsTrigger
            value="dashboard"
            className="flex items-center gap-2 py-3 data-[state=active]:bg-[#083232] data-[state=active]:text-white"
          >
            <Repeat className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger
            value="upcoming"
            className="flex items-center gap-2 py-3 data-[state=active]:bg-[#083232] data-[state=active]:text-white"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Upcoming</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="flex items-center gap-2 py-3 data-[state=active]:bg-[#083232] data-[state=active]:text-white"
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger
              value="management"
              className="flex items-center gap-2 py-3 data-[state=active]:bg-[#083232] data-[state=active]:text-white"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="dashboard" className="w-full space-y-6">
          <RotationDashboard chamaId={chamaId} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="upcoming" className="w-full space-y-6">
          <UpcomingPayouts chamaId={chamaId} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="history" className="w-full space-y-6">
          <PayoutHistory chamaId={chamaId} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="management" className="w-full space-y-6">
            <RotationManagement
              chamaId={chamaId}
              onRotationCreated={handleRotationCreated}
            />

            {/* Quick Stats - Optional */}
            <Card className="w-full">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-4 text-[#083232]">
                  Admin Quick Actions
                </h3>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-blue-800 font-medium mb-1">
                      Sequential Rotation
                    </p>
                    <p className="text-blue-600 text-xs">
                      Members receive payouts in join order. Most predictable
                      option.
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-green-800 font-medium mb-1">
                      Merit-Based Rotation
                    </p>
                    <p className="text-green-600 text-xs">
                      Rewards consistent contributors with earlier positions.
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-purple-800 font-medium mb-1">
                      Random Rotation
                    </p>
                    <p className="text-purple-600 text-xs">
                      Crypto-secure randomization ensures complete fairness.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
