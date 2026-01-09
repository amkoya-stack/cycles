/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  rotationApi,
  payoutApi,
  RotationStatus,
  PayoutSummary,
} from "@/lib/rotation-payout-api";
import {
  Repeat,
  Users,
  Crown,
  Clock,
  TrendingUp,
  CheckCircle,
  XCircle,
  ArrowRight,
  Calendar,
  DollarSign,
  Settings,
  History,
  AlertTriangle,
  Target,
  Trophy,
  Zap,
  Play,
  Pause,
  SkipForward,
  MoreHorizontal,
  Bell,
  Send,
} from "lucide-react";
import { RotationSetup } from "./rotation-setup";
import { PayoutProcessor } from "./payout-processor";
import { RotationOrderManager } from "./rotation-order-manager";

interface RotationPayoutPageProps {
  chamaId: string;
  isAdmin?: boolean;
}

export function RotationPayoutPageNew({
  chamaId,
  isAdmin = false,
}: RotationPayoutPageProps) {
  const [rotationStatus, setRotationStatus] = useState<RotationStatus | null>(
    null
  );
  const [payoutStatus, setPayoutStatus] = useState<PayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadData();
  }, [chamaId, refreshKey]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rotation, payouts] = await Promise.all([
        rotationApi.getRotationStatus(chamaId),
        payoutApi.getPayoutSummary(chamaId),
      ]);
      setRotationStatus(rotation);
      setPayoutStatus(payouts);
    } catch (error) {
      console.error("Failed to load rotation data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#083232] border-t-transparent"></div>
          <p className="text-gray-600">Loading rotation data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {!rotationStatus?.rotation ? (
        <NoRotationState
          chamaId={chamaId}
          isAdmin={isAdmin}
          onSetup={() => setShowSetup(true)}
        />
      ) : (
        <ActiveRotationView
          rotationStatus={rotationStatus}
          payoutStatus={payoutStatus}
          chamaId={chamaId}
          isAdmin={isAdmin}
          onRefresh={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {/* Setup Dialog */}
      <Dialog open={showSetup} onOpenChange={setShowSetup}>
        <DialogContent
          className="max-w-[540px] max-h-[90vh] w-full overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Setup Rotation System</DialogTitle>
          </DialogHeader>
          <RotationSetup
            chamaId={chamaId}
            onComplete={() => {
              setShowSetup(false);
              setRefreshKey((k) => k + 1);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NoRotationState({
  chamaId,
  isAdmin,
  onSetup,
}: {
  chamaId: string;
  isAdmin: boolean;
  onSetup: () => void;
}) {
  return (
    <>
      {/* Mobile View */}
      <div className="md:hidden px-4 py-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <Repeat className="h-8 w-8 text-gray-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-1.5">
              No Rotation Setup
            </h3>
            <p className="text-sm text-gray-600 px-4">
              Set up a rotation system to automatically manage contribution
              cycles and distribute payouts to members.
            </p>
          </div>
          {isAdmin ? (
            <div className="space-y-3 pt-2">
              <Button
                size="sm"
                className="bg-[#083232] hover:bg-[#2e856e]"
                onClick={onSetup}
              >
                <Play className="h-4 w-4 mr-2" />
                Setup Rotation System
              </Button>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Target className="h-3.5 w-3.5" />
                  <span>Automated</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  <span>Smart</span>
                </div>
                <div className="flex items-center gap-1">
                  <Bell className="h-3.5 w-3.5" />
                  <span>Reminders</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded px-3 py-2 mt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                <p className="text-xs text-yellow-800 text-left">
                  Contact your cycle admin to set up the rotation system.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="py-16">
            <div className="text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                <Repeat className="h-10 w-10 text-gray-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No Rotation Setup
                </h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Set up a rotation system to automatically manage contribution
                  cycles and distribute payouts to members.
                </p>
              </div>
              {isAdmin ? (
                <div className="space-y-4">
                  <Button
                    size="lg"
                    className="bg-[#083232] hover:bg-[#2e856e]"
                    onClick={onSetup}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Setup Rotation System
                  </Button>
                  <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Automated cycles
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Smart payouts
                    </div>
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Auto reminders
                    </div>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Contact your cycle admin to set up the rotation system.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ActiveRotationView({
  rotationStatus,
  payoutStatus,
  chamaId,
  isAdmin,
  onRefresh,
}: {
  rotationStatus: RotationStatus;
  payoutStatus: PayoutSummary | null;
  chamaId: string;
  isAdmin: boolean;
  onRefresh: () => void;
}) {
  const { rotation, positions, progress } = rotationStatus;
  const [isPaused, setIsPaused] = useState(false);
  const [activeTab, setActiveTab] = useState("timeline");
  const completionPercentage =
    progress?.totalPositions > 0
      ? (progress.completedCount / progress.totalPositions) * 100
      : 0;

  return (
    <>
      {/* Mobile View - Completely Different UI */}
      <div className="md:hidden">
        {/* Sticky Header with Progress */}
        <div className="sticky top-14 z-10 bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-base font-bold text-[#083232]">
              {Math.round(completionPercentage)}%
            </span>
          </div>
          <Progress value={completionPercentage} className="h-1.5" />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-gray-500">
              {progress?.completedCount || 0} of {progress?.totalPositions || 0} completed
            </span>
            <Badge
              variant={rotation?.status === "active" ? "default" : "secondary"}
              className="text-xs"
            >
              {rotation?.status ?? "Unknown"}
            </Badge>
          </div>
        </div>

        {/* Quick Stats - Evenly Spread (same width as progress bar) */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Total</p>
                <p className="text-sm font-semibold text-gray-900">
                  {progress?.totalPositions || 0}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Done</p>
                <p className="text-sm font-semibold text-green-600">
                  {progress?.completedCount || 0}/{progress?.totalPositions || 0}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-purple-100 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Payouts</p>
                <p className="text-sm font-semibold text-purple-600">
                  KES {payoutStatus?.total_payouts?.toLocaleString() || "0"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="pb-20">
          {activeTab === "timeline" && (
            <RotationTimelineMobile
              positions={positions}
              isAdmin={isAdmin}
              onRefresh={onRefresh}
              isPaused={isPaused}
            />
          )}
          {activeTab === "payouts" && (
            <PayoutHistoryMobile
              chamaId={chamaId}
              payoutStatus={payoutStatus}
              rotationStatus={rotationStatus}
              isAdmin={isAdmin}
            />
          )}
          {activeTab === "analytics" && (
            <RotationAnalyticsMobile
              rotationStatus={rotationStatus}
              payoutStatus={payoutStatus}
            />
          )}
          {activeTab === "settings" && (
            <RotationSettingsMobile
              chamaId={chamaId}
              rotation={rotation}
              positions={positions}
              onUpdate={onRefresh}
              isAdmin={isAdmin}
              isPaused={isPaused}
              setIsPaused={setIsPaused}
            />
          )}
        </div>

        {/* Bottom Tab Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 md:hidden">
          <div className="grid grid-cols-4 h-14">
            <button
              onClick={() => setActiveTab("timeline")}
              className={`flex flex-col items-center justify-center gap-1 ${
                activeTab === "timeline"
                  ? "text-[#083232] bg-gray-50"
                  : "text-gray-500"
              }`}
            >
              <Clock className="h-4 w-4" />
              <span className="text-xs">Timeline</span>
            </button>
            <button
              onClick={() => setActiveTab("payouts")}
              className={`flex flex-col items-center justify-center gap-1 ${
                activeTab === "payouts"
                  ? "text-[#083232] bg-gray-50"
                  : "text-gray-500"
              }`}
            >
              <History className="h-4 w-4" />
              <span className="text-xs">Payouts</span>
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`flex flex-col items-center justify-center gap-1 ${
                activeTab === "analytics"
                  ? "text-[#083232] bg-gray-50"
                  : "text-gray-500"
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Analytics</span>
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex flex-col items-center justify-center gap-1 ${
                activeTab === "settings"
                  ? "text-[#083232] bg-gray-50"
                  : "text-gray-500"
              }`}
            >
              <Settings className="h-4 w-4" />
              <span className="text-xs">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop View - Original UI */}
      <div className="hidden md:block space-y-6">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">Total Members</p>
              <div className="flex items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {progress?.totalPositions || 0}
                </p>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">Completed</p>
              <div className="flex items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-600">
                  {progress?.completedCount || 0}
                </p>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">Remaining</p>
              <div className="flex items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <p className="text-2xl font-bold text-orange-600">
                  {progress?.remainingCount || 0}
                </p>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">Total Payouts</p>
              <div className="flex items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-purple-600">
                  KES {payoutStatus?.total_payouts?.toLocaleString() || "0"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Rotation Progress</span>
            <Badge
              variant={rotation?.status === "active" ? "default" : "secondary"}
            >
              {rotation?.status ?? "Unknown"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Completion</span>
              <span className="text-2xl font-bold text-[#083232]">
                {Math.round(completionPercentage)}%
              </span>
            </div>
            <Progress value={completionPercentage} className="h-3" />
            <p className="text-sm text-gray-600">
              {progress?.completedCount || 0} of {progress?.totalPositions || 0}{" "}
              rotations completed
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="timeline" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <RotationTimeline
            positions={positions}
            isAdmin={isAdmin}
            onRefresh={onRefresh}
            isPaused={isPaused}
          />
        </TabsContent>

        <TabsContent value="payouts">
          <PayoutHistory
            chamaId={chamaId}
            payoutStatus={payoutStatus}
            rotationStatus={rotationStatus}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <RotationAnalytics
            rotationStatus={rotationStatus}
            payoutStatus={payoutStatus}
          />
        </TabsContent>

        <TabsContent value="settings">
          {isAdmin ? (
            <RotationSettings
              chamaId={chamaId}
              rotation={rotation}
              positions={positions}
              onUpdate={onRefresh}
              isPaused={isPaused}
              setIsPaused={setIsPaused}
            />
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-gray-500">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Only admins can access rotation settings</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </>
  );
}

// Mobile Timeline Component
function RotationTimelineMobile({
  positions,
  isAdmin,
  onRefresh,
  isPaused,
}: {
  positions: any[];
  isAdmin: boolean;
  onRefresh: () => void;
  isPaused: boolean;
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "current":
        return "bg-yellow-50 border-l-4 border-l-yellow-500";
      case "completed":
        return "bg-green-50 border-l-4 border-l-green-500";
      case "skipped":
        return "bg-red-50 border-l-4 border-l-red-500";
      default:
        return "bg-white border-l-4 border-l-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "current":
        return <Crown className="h-4 w-4 text-yellow-600" />;
      case "skipped":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className={`space-y-0 ${isPaused ? "blur-sm pointer-events-none" : ""}`}>
      {positions?.map((position, index) => (
        <div
          key={position.id}
          className={`px-4 py-3 border-b border-gray-200 ${getStatusColor(
            position.status
          )}`}
        >
          <div className="flex items-center gap-3">
            {/* Position Number */}
            <div className="w-8 h-8 rounded-full bg-[#083232] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
              {position.position}
            </div>

            {/* Member Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {position.fullName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {getStatusIcon(position.status)}
                <span className="text-xs text-gray-600 capitalize">
                  {position.status}
                </span>
              </div>
            </div>

            {/* Action Button */}
            {isAdmin && position.status === "current" && (
              <Button size="sm" className="bg-[#2e856e] hover:bg-[#083232] h-7 text-xs px-2">
                <Send className="h-3 w-3 mr-1" />
                Process
              </Button>
            )}
            {position.status === "completed" && (
              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RotationTimeline({
  positions,
  isAdmin,
  onRefresh,
  isPaused,
}: {
  positions: any[];
  isAdmin: boolean;
  onRefresh: () => void;
  isPaused: boolean;
}) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "current":
        return <Crown className="h-5 w-5 text-yellow-600" />;
      case "skipped":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      current: "bg-yellow-100 text-yellow-800",
      completed: "bg-green-100 text-green-800",
      pending: "bg-gray-100 text-gray-800",
      skipped: "bg-red-100 text-red-800",
    };
    return (
      <Badge className={variants[status] || variants.pending}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div
      className={`space-y-2 transition-all ${
        isPaused ? "blur-sm pointer-events-none" : ""
      }`}
    >
      {positions?.map((position, index) => (
        <div
          key={position.id}
          className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
            position.status === "current"
              ? "border-yellow-300 bg-yellow-50"
              : position.status === "completed"
              ? "border-green-200 bg-green-50"
              : position.status === "skipped"
              ? "border-red-200 bg-red-50"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          {/* Position Number */}
          <div className="w-10 h-10 rounded-full bg-[#083232] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
            {position.position}
          </div>

          {/* Member Info */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {position.fullName}
            </p>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  position.status === "current" ? "default" : "secondary"
                }
                className="text-xs"
              >
                {position.status}
              </Badge>
              {position.status === "skipped" && (
                <span className="text-xs text-red-600">Skipped this round</span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {isAdmin && position.status === "current" && (
              <Button size="sm" className="bg-[#2e856e] hover:bg-[#083232]">
                <Send className="h-4 w-4 mr-2" />
                Process Payout
              </Button>
            )}

            {position.status === "completed" && (
              <CheckCircle className="h-5 w-5 text-green-600" />
            )}

            {isAdmin && (
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Mobile Payout History Component
function PayoutHistoryMobile({
  chamaId,
  payoutStatus,
  isAdmin,
  rotationStatus,
}: any) {
  const hasActivePayoutCycle =
    rotationStatus &&
    rotationStatus.currentCycle &&
    rotationStatus.status === "active";

  return (
    <div className="space-y-0">
      {hasActivePayoutCycle && isAdmin && (
        <div className="bg-gradient-to-r from-[#083232]/5 to-[#2e856e]/5 border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-[#083232]" />
            <span className="text-sm font-semibold text-gray-900">Current Cycle Payout</span>
          </div>
          <PayoutProcessor
            chamaId={chamaId}
            rotationId={rotationStatus.id}
            currentCycleId={rotationStatus.currentCycle.id}
          />
        </div>
      )}

      <div className="px-4 py-8 text-center bg-white">
        <History className="h-8 w-8 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">Payout history will appear here</p>
        <p className="text-xs text-gray-500 mt-1">
          Track all completed payouts and transactions
        </p>
      </div>
    </div>
  );
}

function PayoutHistory({
  chamaId,
  payoutStatus,
  isAdmin,
  rotationStatus,
}: any) {
  // Check if there's an active rotation with a current cycle that needs processing
  const hasActivePayoutCycle =
    rotationStatus &&
    rotationStatus.currentCycle &&
    rotationStatus.status === "active";

  return (
    <div className="space-y-6">
      {/* Active Payout Processor (if applicable) */}
      {hasActivePayoutCycle && isAdmin && (
        <Card className="border-[#083232] bg-gradient-to-r from-[#083232]/5 to-[#2e856e]/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-[#083232]" />
              Current Cycle Payout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PayoutProcessor
              chamaId={chamaId}
              rotationId={rotationStatus.id}
              currentCycleId={rotationStatus.currentCycle.id}
            />
          </CardContent>
        </Card>
      )}

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Payout History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <History className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">Payout history will appear here</p>
            <p className="text-sm text-gray-500 mt-2">
              Track all completed payouts and transactions
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Mobile Analytics Component
function RotationAnalyticsMobile({ rotationStatus, payoutStatus }: any) {
  return (
    <div className="space-y-0">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-semibold text-gray-900">Performance Metrics</span>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Average Cycle Duration</span>
            <span className="text-sm font-semibold">30 days</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">On-time Contributions</span>
            <span className="text-sm font-semibold text-green-600">95%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Skip Rate</span>
            <span className="text-sm font-semibold text-red-600">2%</span>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-semibold text-gray-900">Top Contributors</span>
        </div>
        <div className="text-center py-6">
          <Trophy className="h-6 w-6 mx-auto text-gray-400 mb-2" />
          <p className="text-xs text-gray-600">Merit scores coming soon</p>
        </div>
      </div>
    </div>
  );
}

function RotationAnalytics({ rotationStatus, payoutStatus }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Average Cycle Duration</span>
              <span className="font-semibold">30 days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">On-time Contributions</span>
              <span className="font-semibold text-green-600">95%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Skip Rate</span>
              <span className="font-semibold text-red-600">2%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Top Contributors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Trophy className="h-8 w-8 mx-auto text-gray-400 mb-2" />
            <p className="text-gray-600">Merit scores coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Mobile Settings Component
function RotationSettingsMobile({
  chamaId,
  rotation,
  positions,
  onUpdate,
  isAdmin,
  isPaused,
  setIsPaused,
}: any) {
  if (!isAdmin) {
    return (
      <div className="px-4 py-12 text-center bg-white">
        <Settings className="h-8 w-8 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">Only admins can access rotation settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <RotationOrderManager
        chamaId={chamaId}
        positions={positions || []}
        onUpdate={onUpdate}
        isPaused={isPaused}
        setIsPaused={setIsPaused}
      />
    </div>
  );
}

function RotationSettings({
  chamaId,
  rotation,
  positions,
  onUpdate,
  isPaused,
  setIsPaused,
}: any) {
  return (
    <div className="space-y-6">
      {/* Rotation Order Management */}
      <RotationOrderManager
        chamaId={chamaId}
        positions={positions || []}
        onUpdate={onUpdate}
        isPaused={isPaused}
        setIsPaused={setIsPaused}
      />
    </div>
  );
}
