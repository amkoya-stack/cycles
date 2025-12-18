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
    (progress.completedCount / progress.totalPositions) * 100;
  const currentPosition = positions.find((p) => p.status === "current");
  const nextPosition = positions.find(
    (p) => p.position === progress.currentPosition + 1 && p.status === "pending"
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
    <div className="w-full space-y-4">
      {/* Overview Card */}
      <Card className="w-full border-[#083232]">
        <CardHeader className="bg-gradient-to-r from-[#083232] to-[#2e856e] text-white">
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Rotation Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-600">Rotation Type</p>
              <p className="text-base md:text-lg font-semibold text-[#083232]">
                {getRotationTypeLabel(rotation.rotationType)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">Total Members</p>
              <p className="text-base md:text-lg font-semibold text-[#083232]">
                {progress.totalPositions}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-base md:text-lg font-semibold text-green-600">
                {progress.completedCount}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">Remaining</p>
              <p className="text-base md:text-lg font-semibold text-[#2e856e]">
                {progress.remainingCount}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Overall Progress</span>
              <span className="font-semibold text-[#083232]">
                {Math.round(completionPercentage)}%
              </span>
            </div>
            <Progress value={completionPercentage} className="h-3" />
            <p className="text-xs text-gray-500 text-center">
              {progress.completedCount} of {progress.totalPositions} rotations
              completed
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Current & Next Recipient */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Current Recipient */}
        {currentPosition && (
          <Card className="w-full border-[#2e856e]">
            <CardHeader className="bg-[#2e856e] text-white">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Current Recipient
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold text-[#083232]">
                    {currentPosition.fullName}
                  </p>
                  <Badge className="bg-[#2e856e] text-white">
                    Position {currentPosition.position}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>📞 {currentPosition.phone}</p>
                  <p>📧 {currentPosition.email}</p>
                  {currentPosition.meritScore !== undefined && (
                    <p className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      Merit Score: {currentPosition.meritScore}/100
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Recipient */}
        {nextPosition && (
          <Card className="w-full border-gray-300">
            <CardHeader className="bg-gray-100">
              <CardTitle className="text-base flex items-center gap-2 text-gray-800">
                <ArrowRight className="h-4 w-4" />
                Next in Line
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold text-gray-800">
                    {nextPosition.fullName}
                  </p>
                  <Badge className="bg-gray-200 text-gray-800">
                    Position {nextPosition.position}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>📞 {nextPosition.phone}</p>
                  <p>📧 {nextPosition.email}</p>
                  {nextPosition.meritScore !== undefined && (
                    <p className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      Merit Score: {nextPosition.meritScore}/100
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Rotation Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#083232]" />
            Rotation Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {positions.map((position) => (
              <div
                key={position.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  position.status === "current"
                    ? "bg-[#2e856e] bg-opacity-10 border-[#2e856e]"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                {/* Position Number */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                    position.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : position.status === "current"
                      ? "bg-[#2e856e] text-white"
                      : position.status === "skipped"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {position.position}
                </div>

                {/* Member Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm md:text-base text-gray-900 truncate">
                    {position.fullName}
                  </p>
                  {position.meritScore !== undefined && (
                    <p className="text-xs text-gray-500">
                      Merit: {position.meritScore}/100
                    </p>
                  )}
                </div>

                {/* Status Badge */}
                <div className="flex-shrink-0">
                  {getStatusBadge(position.status)}
                </div>

                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {position.status === "completed" && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  {position.status === "current" && (
                    <Clock className="h-5 w-5 text-[#2e856e]" />
                  )}
                  {position.status === "skipped" && (
                    <XCircle className="h-5 w-5 text-yellow-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
