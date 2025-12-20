"use client";

import { useState, useEffect } from "react";
import { rotationApi, RotationStatus } from "@/lib/rotation-payout-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotationManagement } from "./rotation-management";
import {
  Users,
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
} from "lucide-react";

interface RotationDashboardProps {
  chamaId: string;
  isAdmin?: boolean;
  onRotationCreated?: () => void;
}

export function RotationDashboard({
  chamaId,
  isAdmin = false,
  onRotationCreated,
}: RotationDashboardProps) {
  const [status, setStatus] = useState<RotationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    loadRotationStatus();
  }, [chamaId]);

  const loadRotationStatus = async () => {
    try {
      setLoading(true);
      const data = await rotationApi.getRotationStatus(chamaId);
      setStatus(data);
    } catch (error) {
      console.error("Failed to load rotation status:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#083232]"></div>
      </div>
    );
  }

  if (!status?.rotation) {
    return (
      <>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Users className="h-12 w-12 mx-auto text-gray-400" />
              <p className="text-gray-600">No active rotation configured</p>
              {isAdmin && (
                <Button
                  className="bg-[#083232] hover:bg-[#2e856e]"
                  onClick={() => setShowCreateDialog(true)}
                >
                  Create Rotation
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        {isAdmin && (
          <RotationManagement
            chamaId={chamaId}
            showCreateDialog={showCreateDialog}
            setShowCreateDialog={setShowCreateDialog}
            onRotationCreated={() => {
              loadRotationStatus();
              onRotationCreated?.();
            }}
          />
        )}
      </>
    );
  }

  const { rotation, positions, progress } = status;
  const completionPercentage =
    progress?.totalPositions > 0
      ? (progress.completedCount / progress.totalPositions) * 100
      : 0;
  const currentPosition = positions?.find((p) => p.status === "current");
  const nextPosition = positions?.find(
    (p) =>
      p.position === (progress?.currentPosition || 0) + 1 &&
      p.status === "pending"
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      current: { color: "bg-[#2e856e] text-white", label: "Current" },
      completed: { color: "bg-green-100 text-green-800", label: "Completed" },
      pending: { color: "bg-gray-100 text-gray-800", label: "Pending" },
      skipped: { color: "bg-yellow-100 text-yellow-800", label: "Skipped" },
    };
    const variant = variants[status] || variants.pending;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  const getRotationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      sequential: "Sequential (Join Order)",
      random: "Random",
      merit_based: "Merit-Based",
      custom: "Custom Order",
    };
    return labels[type] || type;
  };

  return (
    <div className="w-full space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
            Type
          </p>
          <p className="text-sm font-semibold text-[#083232] truncate">
            {
              (
                getRotationTypeLabel(rotation?.rotationType || "") ||
                "Sequential"
              ).split(" ")[0]
            }
          </p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
            Members
          </p>
          <p className="text-sm font-semibold text-[#083232]">
            {progress?.totalPositions || 0}
          </p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
            Completed
          </p>
          <p className="text-sm font-semibold text-green-600">
            {progress?.completedCount || 0}
          </p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
            Remaining
          </p>
          <p className="text-sm font-semibold text-[#2e856e]">
            {progress?.remainingCount || 0}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">
            Overall Progress
          </span>
          <span className="text-2xl font-bold text-[#083232]">
            {Math.round(completionPercentage) || 0}%
          </span>
        </div>
        <Progress value={completionPercentage || 0} className="h-2" />
        <p className="text-xs text-gray-500 mt-2">
          {progress?.completedCount || 0} of {progress?.totalPositions || 0}{" "}
          rotations completed
        </p>
      </div>

      {/* Timeline - All Members */}
      <div className="space-y-3">
        {positions && positions.length > 0 ? (
          positions.map((position, index) => (
            <div
              key={position.id}
              className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                position.status === "current"
                  ? "border-[#2e856e] bg-[#2e856e]/5 shadow-md"
                  : position.status === "completed"
                  ? "border-green-200 bg-green-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              {/* Position Badge */}
              <div
                className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                  position.status === "completed"
                    ? "bg-green-500 text-white"
                    : position.status === "current"
                    ? "bg-[#2e856e] text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {position.position}
              </div>

              {/* Member Details */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-gray-900 text-lg">
                    {position.fullName}
                  </p>
                  {getStatusBadge(position.status)}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>{position.phone}</span>
                  {position.meritScore !== undefined && (
                    <span className="flex items-center gap-1">
                      <Trophy className="h-3 w-3 text-yellow-500" />
                      {position.meritScore}/100
                    </span>
                  )}
                </div>
              </div>

              {/* Status Icon */}
              <div className="flex-shrink-0">
                {position.status === "completed" && (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                )}
                {position.status === "current" && (
                  <Clock className="h-6 w-6 text-[#2e856e]" />
                )}
                {position.status === "pending" && (
                  <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center p-8 text-gray-500">
            No rotation positions found
          </div>
        )}
      </div>
    </div>
  );
}
