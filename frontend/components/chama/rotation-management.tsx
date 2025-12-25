"use client";

import { useState } from "react";
import { rotationApi, CreateRotationOrderDto } from "@/lib/rotation-payout-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Settings, Shuffle, ArrowRightLeft, XCircle } from "lucide-react";

interface RotationManagementProps {
  chamaId: string;
  onRotationCreated?: () => void;
  showCreateDialog?: boolean;
  setShowCreateDialog?: (show: boolean) => void;
}

export function RotationManagement({
  chamaId,
  onRotationCreated,
  showCreateDialog: externalShowCreateDialog,
  setShowCreateDialog: externalSetShowCreateDialog,
}: RotationManagementProps) {
  const { toast } = useToast();
  const [internalShowCreateDialog, setInternalShowCreateDialog] =
    useState(false);
  const [creating, setCreating] = useState(false);

  // Use external dialog state if provided, otherwise use internal state
  const showCreateDialog =
    externalShowCreateDialog !== undefined
      ? externalShowCreateDialog
      : internalShowCreateDialog;
  const setShowCreateDialog =
    externalSetShowCreateDialog || setInternalShowCreateDialog;

  // Form state
  const [rotationType, setRotationType] = useState<
    "sequential" | "random" | "merit_based" | "custom"
  >("sequential");
  const [cycleDurationMonths, setCycleDurationMonths] = useState("1");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const handleCreateRotation = async () => {
    try {
      setCreating(true);

      const dto: CreateRotationOrderDto = {
        chamaId,
        rotationType,
        cycleDurationMonths: parseInt(cycleDurationMonths),
        startDate: new Date(startDate).toISOString(),
      };

      await rotationApi.createRotation(dto);

      toast({
        title: "Success",
        description: "Rotation order created successfully",
      });

      setShowCreateDialog(false);
      onRotationCreated?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create rotation",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const rotationTypeDescriptions = {
    sequential:
      "Members receive payouts in the order they joined the cycle. Fair and predictable.",
    random:
      "Random selection using cryptographically secure shuffle. Completely unbiased.",
    merit_based:
      "Members with better contribution history receive payouts earlier. Rewards consistency.",
    custom:
      "Manually define the payout order. Full control for specific needs.",
  };

  return (
    <div className="w-full space-y-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-[#083232]" />
            Rotation Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Manage rotation settings and configure how payout recipients are
            determined.
          </p>

          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-[#083232] hover:bg-[#2e856e] w-full md:w-auto"
          >
            <Shuffle className="h-4 w-4 mr-2" />
            Create New Rotation
          </Button>

          {/* Action Buttons - For future skip/swap functionality */}
          <div className="grid md:grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="border-[#083232] text-[#083232]"
              disabled
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Swap Positions
            </Button>
            <Button
              variant="outline"
              className="border-yellow-600 text-yellow-600"
              disabled
            >
              <XCircle className="h-4 w-4 mr-2" />
              Skip Position
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Advanced management options coming soon
          </p>
        </CardContent>
      </Card>

      {/* Create Rotation Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Rotation Order</DialogTitle>
            <DialogDescription>
              Configure how payout recipients will be determined for this cycle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Rotation Type */}
            <div className="space-y-2">
              <Label htmlFor="rotationType">Rotation Type</Label>
              <Select
                value={rotationType}
                onValueChange={(value: any) => setRotationType(value)}
              >
                <SelectTrigger id="rotationType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">
                    Sequential (Join Order)
                  </SelectItem>
                  <SelectItem value="random">Random</SelectItem>
                  <SelectItem value="merit_based">Merit-Based</SelectItem>
                  <SelectItem value="custom" disabled>
                    Custom Order (Coming Soon)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {rotationTypeDescriptions[rotationType]}
              </p>
            </div>

            {/* Cycle Duration */}
            <div className="space-y-2">
              <Label htmlFor="cycleDuration">Cycle Duration (Months)</Label>
              <Input
                id="cycleDuration"
                type="number"
                min="1"
                max="12"
                value={cycleDurationMonths}
                onChange={(e) => setCycleDurationMonths(e.target.value)}
                placeholder="1"
              />
              <p className="text-xs text-gray-500">
                How often payouts occur (typically 1 month)
              </p>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
              <p className="text-xs text-gray-500">
                When the rotation should begin
              </p>
            </div>

            {/* Merit-Based Info */}
            {rotationType === "merit_based" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800 font-medium mb-1">
                  Merit Score Calculation:
                </p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• On-time contributions: 40 points</li>
                  <li>• Activity score: 30 points</li>
                  <li>• Penalty-free record: 30 points</li>
                </ul>
              </div>
            )}

            {/* Random Info */}
            {rotationType === "random" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-green-800">
                  Uses cryptographically secure randomization to ensure complete
                  fairness. The order cannot be predicted or manipulated.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateRotation}
              disabled={creating}
              className="bg-[#083232] hover:bg-[#2e856e]"
            >
              {creating ? "Creating..." : "Create Rotation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
