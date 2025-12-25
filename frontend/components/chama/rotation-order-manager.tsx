/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  GripVertical,
  SkipForward,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  AlertTriangle,
  Pause,
} from "lucide-react";

interface RotationOrderManagerProps {
  chamaId: string;
  positions: any[];
  onUpdate: () => void;
  isPaused: boolean;
  setIsPaused: (isPaused: boolean) => void;
}

export function RotationOrderManager({
  chamaId,
  positions,
  onUpdate,
  isPaused,
  setIsPaused,
}: RotationOrderManagerProps) {
  const [orderedPositions, setOrderedPositions] = useState(positions);
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [skipReason, setSkipReason] = useState("");

  const movePosition = (fromIndex: number, toIndex: number) => {
    const newPositions = [...orderedPositions];
    const [moved] = newPositions.splice(fromIndex, 1);
    newPositions.splice(toIndex, 0, moved);

    // Update position numbers
    const reordered = newPositions.map((pos, index) => ({
      ...pos,
      position: index + 1,
    }));

    setOrderedPositions(reordered);
  };

  const handleSkipRequest = (member: any) => {
    setSelectedMember(member);
    setShowSkipDialog(true);
  };

  const confirmSkip = async () => {
    if (!selectedMember) return;

    try {
      setSaving(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/rotation/skip-member`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          body: JSON.stringify({
            chamaId,
            userId: selectedMember.userId,
            reason: skipReason,
          }),
        }
      );

      if (response.ok) {
        setShowSkipDialog(false);
        setSkipReason("");
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to skip member:", error);
    } finally {
      setSaving(false);
    }
  };

  const saveReorderedPositions = async () => {
    try {
      setSaving(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/rotation/reorder`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          body: JSON.stringify({
            chamaId,
            positions: orderedPositions.map((p) => ({
              userId: p.userId,
              position: p.position,
            })),
          }),
        }
      );

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to save reordered positions:", error);
    } finally {
      setSaving(false);
    }
  };

  const handlePauseRotation = async () => {
    setIsPaused(!isPaused);
    if (!isPaused) {
      // When pausing, save the reordered positions
      await saveReorderedPositions();
    }
  };

  const hasChanges =
    JSON.stringify(orderedPositions) !== JSON.stringify(positions);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Manage Rotation Order</CardTitle>
            <Button
              variant="outline"
              onClick={handlePauseRotation}
              disabled={saving}
            >
              <Pause className="h-4 w-4 mr-2" />
              {saving
                ? "Pausing..."
                : isPaused
                ? "Resume Rotation"
                : "Pause Rotation"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Use the arrows to reorder members or skip someone's turn upon
              their request.
              <strong>
                {" "}
                Note: Position 2 is locked - members at this position can only
                move down.
              </strong>
              Changes will only affect future rotations.
            </AlertDescription>
          </Alert>

          <div
            className={`space-y-2 transition-all ${
              isPaused ? "blur-sm pointer-events-none" : ""
            }`}
          >
            {orderedPositions.map((position, index) => (
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
                {/* Drag Handle */}
                <div className="cursor-grab active:cursor-grabbing text-gray-400">
                  <GripVertical className="h-5 w-5" />
                </div>

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
                      <span className="text-xs text-red-600">
                        Skipped this round
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {/* Movement arrows - not shown for position 1 */}
                  {index > 0 && (
                    <>
                      {/* Move Up */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          movePosition(index, Math.max(0, index - 1))
                        }
                        disabled={
                          index === 1 || position.status === "completed"
                        }
                        title={
                          index === 1 ? "Position 2 cannot move up" : "Move up"
                        }
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>

                      {/* Move Down */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          movePosition(
                            index,
                            Math.min(orderedPositions.length - 1, index + 1)
                          )
                        }
                        disabled={
                          index === orderedPositions.length - 1 ||
                          position.status === "completed"
                        }
                        title="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </>
                  )}

                  {/* Skip Button */}
                  {position.status === "pending" && index > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSkipRequest(position)}
                      className="text-orange-600 border-orange-300 hover:bg-orange-50"
                    >
                      <SkipForward className="h-4 w-4 mr-1" />
                      Skip
                    </Button>
                  )}

                  {/* Position 2 cannot be skipped - show badge */}
                  {position.status === "pending" && index === 1 && (
                    <Badge variant="outline" className="text-xs text-gray-500">
                      Next in line
                    </Badge>
                  )}

                  {position.status === "completed" && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Skip Confirmation Dialog */}
      <Dialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip Member's Turn</DialogTitle>
            <DialogDescription>
              Are you sure you want to skip {selectedMember?.fullName}'s turn?
              This member will be moved to the end of the rotation queue.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for skipping (optional)
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#083232] focus:border-transparent"
                rows={3}
                placeholder="E.g., Member requested to skip due to personal circumstances..."
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
              />
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                The member will be notified and their turn will be postponed to
                the end of the current rotation cycle.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSkipDialog(false);
                setSkipReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmSkip}
              disabled={saving}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {saving ? "Processing..." : "Confirm Skip"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
