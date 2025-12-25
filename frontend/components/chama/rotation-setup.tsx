/* eslint-disable react/no-unescaped-entities */
"use client";

import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { rotationApi, CreateRotationOrderDto } from "@/lib/rotation-payout-api";
import {
  Calendar,
  Users,
  Settings,
  Shuffle,
  Trophy,
  ArrowUpDown,
  CheckCircle,
  AlertTriangle,
  Info,
  Check,
} from "lucide-react";

interface RotationSetupProps {
  chamaId: string;
  onComplete: () => void;
}

interface Member {
  id: string;
  fullName: string;
  activityScore: number;
  joinedAt: string;
}

export function RotationSetup({ chamaId, onComplete }: RotationSetupProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [formData, setFormData] = useState({
    rotationType: "sequential" as
      | "sequential"
      | "random"
      | "merit_based"
      | "custom",
    cycleDurationMonths: 1,
    startDate: "",
    customOrder: [] as string[],
    autoPayouts: true,
    reminders: true,
    lateFeePenalty: false,
    lateFeePercentage: 5,
  });

  useEffect(() => {
    loadMembers();
    // Set default start date to next Monday
    const nextMonday = getNextMonday();
    setFormData((prev) => ({ ...prev, startDate: nextMonday }));
  }, [chamaId]);

  const loadMembers = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/chama/${chamaId}/members`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (error) {
      console.error("Failed to load members:", error);
    }
  };

  const getNextMonday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(
      today.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000
    );
    return nextMonday.toISOString().split("T")[0];
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const dto: CreateRotationOrderDto = {
        chamaId,
        rotationType: formData.rotationType,
        cycleDurationMonths: formData.cycleDurationMonths,
        startDate: formData.startDate,
        customOrder:
          formData.rotationType === "custom" ? formData.customOrder : undefined,
      };

      await rotationApi.createRotation(dto);
      onComplete();
    } catch (error) {
      console.error("Failed to create rotation:", error);
    } finally {
      setLoading(false);
    }
  };

  const moveCustomOrder = (fromIndex: number, toIndex: number) => {
    const newOrder = [...formData.customOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    setFormData((prev) => ({ ...prev, customOrder: newOrder }));
  };

  return (
    <div className="space-y-4">
      {/* Step 1: Rotation Type & Configuration */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Step 1 of 2</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Rotation Setup
            </h2>
            <p className="text-gray-600">Configure your rotation parameters</p>
          </div>

          <Card>
            <CardContent className="p-6 space-y-6">
              <div>
                <Label htmlFor="rotationType" className="text-sm font-medium">
                  Rotation Type
                </Label>
                <Select
                  value={formData.rotationType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      rotationType: value as any,
                    }))
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select rotation type">
                      {formData.rotationType === "sequential" &&
                        "Sequential Order"}
                      {formData.rotationType === "random" && "Random Order"}
                      {formData.rotationType === "merit_based" && "Merit-Based"}
                      {formData.rotationType === "custom" && "Custom Order"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sequential">
                      <div className="flex flex-col">
                        <span className="font-medium">Sequential Order</span>
                        <span className="text-xs text-gray-500">
                          Order joined
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="random">
                      <div className="flex flex-col">
                        <span className="font-medium">Random Order</span>
                        <span className="text-xs text-gray-500">
                          Randomly assigned
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="merit_based">
                      <div className="flex flex-col">
                        <span className="font-medium">Merit-Based</span>
                        <span className="text-xs text-gray-500">
                          High contributors prioritized
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="custom">
                      <div className="flex flex-col">
                        <span className="font-medium">Custom Order</span>
                        <span className="text-xs text-gray-500">
                          Manually arrange order
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Configuration Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cycleDuration">Cycle Duration</Label>
                  <Select
                    value={formData.cycleDurationMonths.toString()}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        cycleDurationMonths: parseInt(value),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Month</SelectItem>
                      <SelectItem value="2">2 Months</SelectItem>
                      <SelectItem value="3">3 Months</SelectItem>
                      <SelectItem value="6">6 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Custom Order Configuration */}
              {formData.rotationType === "custom" && (
                <div className="space-y-3 pt-2">
                  <Label>Arrange Member Order</Label>
                  <p className="text-sm text-gray-600">
                    Drag and drop to reorder members
                  </p>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {members.map((member, index) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50 hover:bg-gray-100"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#083232] text-white flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <span className="flex-1 font-medium">
                          {member.fullName}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              moveCustomOrder(index, Math.max(0, index - 1))
                            }
                            disabled={index === 0}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              moveCustomOrder(
                                index,
                                Math.min(members.length - 1, index + 1)
                              )
                            }
                            disabled={index === members.length - 1}
                          >
                            ↓
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              className="bg-[#083232] hover:bg-[#2e856e]"
              onClick={() => setStep(2)}
              disabled={!formData.rotationType || !formData.startDate}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Advanced Options */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Step 2 of 2</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Advanced Options
            </h2>
          </div>

          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="autoPayouts"
                    checked={formData.autoPayouts}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        autoPayouts: checked as boolean,
                        reminders: checked ? false : prev.reminders,
                      }))
                    }
                  />
                  <Label htmlFor="autoPayouts" className="font-medium">
                    Automatic Payouts
                  </Label>
                </div>
                <p className="text-sm text-gray-600 ml-6">
                  Automatically transfer funds when cycle completes and all
                  contributions are received
                </p>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="reminders"
                    checked={formData.reminders}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        reminders: checked as boolean,
                        autoPayouts: checked ? false : prev.autoPayouts,
                      }))
                    }
                  />
                  <Label htmlFor="reminders" className="font-medium">
                    Manual Payout
                  </Label>
                </div>
                <p className="text-sm text-gray-600 ml-6">
                  Manually trigger payouts when ready instead of automatic
                  processing
                </p>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="lateFeePenalty"
                    checked={formData.lateFeePenalty}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        lateFeePenalty: checked as boolean,
                      }))
                    }
                  />
                  <Label htmlFor="lateFeePenalty" className="font-medium">
                    Late Fee Penalty
                  </Label>
                </div>

                {formData.lateFeePenalty && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="lateFeePercentage">
                      Penalty Percentage
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="lateFeePercentage"
                        type="number"
                        min="1"
                        max="20"
                        value={formData.lateFeePercentage}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            lateFeePercentage: parseInt(e.target.value) || 0,
                          }))
                        }
                        className="w-20"
                      />
                      <span className="text-sm text-gray-600">
                        % of contribution amount
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              className="bg-[#083232] hover:bg-[#2e856e]"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Rotation"}
            </Button>
          </div>
        </div>
      )}

      {/* Old Step 3 removed - now integrated into Step 2 */}
    </div>
  );
}
