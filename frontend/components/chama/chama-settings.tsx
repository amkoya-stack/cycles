/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings, Loader2, CheckCircle2 } from "lucide-react";

interface ChamaSettingsProps {
  chamaId: string;
  chamaName: string;
  currentSettings: any;
  isAdmin: boolean;
  onSettingsUpdated?: () => void;
}

export function ChamaSettings({
  chamaId,
  chamaName,
  currentSettings,
  isAdmin,
  onSettingsUpdated,
}: ChamaSettingsProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    auto_payout: currentSettings?.auto_payout || false,
    late_penalty_enabled: currentSettings?.late_penalty_enabled || false,
    allow_partial_contributions:
      currentSettings?.allow_partial_contributions || false,
  });
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Update when currentSettings change
    setSettings({
      auto_payout: currentSettings?.auto_payout || false,
      late_penalty_enabled: currentSettings?.late_penalty_enabled || false,
      allow_partial_contributions:
        currentSettings?.allow_partial_contributions || false,
    });
  }, [currentSettings]);

  const handleToggle = (key: string, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!isAdmin) {
      toast({
        title: "Permission Denied",
        description: "Only admins can update chama settings",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${API_URL}/api/chama/${chamaId}/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          settings: {
            ...currentSettings,
            ...settings,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to update settings (${response.status})`
        );
      }

      const data = await response.json();

      toast({
        title: "Settings Updated",
        description: "Chama settings have been updated successfully",
        variant: "default",
      });

      setHasChanges(false);
      onSettingsUpdated?.();
    } catch (error: any) {
      console.error("Settings update error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-[#083232]" />
            Chama Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-Payout Setting */}
          <div className="flex items-start justify-between space-x-4 pb-4 border-b">
            <div className="flex-1 space-y-1">
              <Label htmlFor="auto-payout" className="text-base font-medium">
                Automatic Payouts
              </Label>
              <p className="text-sm text-gray-600">
                Automatically process payouts when all members have contributed
                to a cycle. The designated recipient will receive funds
                immediately after the cycle is complete.
              </p>
              {settings.auto_payout && (
                <div className="flex items-center gap-2 mt-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    Payouts will be processed automatically upon cycle
                    completion
                  </span>
                </div>
              )}
            </div>
            <Switch
              id="auto-payout"
              checked={settings.auto_payout}
              onCheckedChange={(checked) =>
                handleToggle("auto_payout", checked)
              }
              disabled={!isAdmin || loading}
            />
          </div>

          {/* Late Penalty Setting */}
          <div className="flex items-start justify-between space-x-4 pb-4 border-b">
            <div className="flex-1 space-y-1">
              <Label htmlFor="late-penalty" className="text-base font-medium">
                Late Payment Penalties
              </Label>
              <p className="text-sm text-gray-600">
                Charge penalties for contributions made after the due date.
                Penalties are calculated based on the configured percentage.
              </p>
            </div>
            <Switch
              id="late-penalty"
              checked={settings.late_penalty_enabled}
              onCheckedChange={(checked) =>
                handleToggle("late_penalty_enabled", checked)
              }
              disabled={!isAdmin || loading}
            />
          </div>

          {/* Partial Contributions Setting */}
          <div className="flex items-start justify-between space-x-4">
            <div className="flex-1 space-y-1">
              <Label
                htmlFor="partial-contributions"
                className="text-base font-medium"
              >
                Allow Partial Contributions
              </Label>
              <p className="text-sm text-gray-600">
                Allow members to contribute less than the full expected amount.
                Useful for flexible contribution chamas.
              </p>
            </div>
            <Switch
              id="partial-contributions"
              checked={settings.allow_partial_contributions}
              onCheckedChange={(checked) =>
                handleToggle("allow_partial_contributions", checked)
              }
              disabled={!isAdmin || loading}
            />
          </div>

          {/* Save Button */}
          {isAdmin && (
            <div className="pt-4 flex gap-3">
              <Button
                onClick={handleSave}
                disabled={!hasChanges || loading}
                className="bg-[#083232] hover:bg-[#2e856e]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
              {hasChanges && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSettings({
                      auto_payout: currentSettings?.auto_payout || false,
                      late_penalty_enabled:
                        currentSettings?.late_penalty_enabled || false,
                      allow_partial_contributions:
                        currentSettings?.allow_partial_contributions || false,
                    });
                    setHasChanges(false);
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
              )}
            </div>
          )}

          {!isAdmin && (
            <div className="pt-4">
              <p className="text-sm text-gray-500 italic">
                Only chama admins can modify these settings
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
