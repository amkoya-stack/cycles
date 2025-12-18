"use client";

import { useState, useEffect } from "react";
import {
  payoutApi,
  Payout,
  SchedulePayoutDto,
} from "@/lib/rotation-payout-api";
import { rotationApi } from "@/lib/rotation-payout-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, TrendingUp, DollarSign, Plus } from "lucide-react";

interface UpcomingPayoutsProps {
  chamaId: string;
  isAdmin?: boolean;
}

export function UpcomingPayouts({
  chamaId,
  isAdmin = false,
}: UpcomingPayoutsProps) {
  const { toast } = useToast();
  const [upcomingPayouts, setUpcomingPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  // Schedule form state
  const [cycleId, setCycleId] = useState("");
  const [amount, setAmount] = useState("");
  const [scheduledDate, setScheduledDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    loadUpcomingPayouts();
  }, [chamaId]);

  const loadUpcomingPayouts = async () => {
    try {
      setLoading(true);
      const data = await payoutApi.getUpcomingPayouts(chamaId);
      setUpcomingPayouts(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load upcoming payouts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSchedulePayout = async () => {
    try {
      setScheduling(true);

      // Get next recipient from rotation
      const nextRecipient = await rotationApi.getNextRecipient(chamaId);

      if (!nextRecipient.nextRecipient) {
        toast({
          title: "Error",
          description: "No next recipient found in rotation",
          variant: "destructive",
        });
        return;
      }

      const dto: SchedulePayoutDto = {
        cycleId,
        recipientId: nextRecipient.nextRecipient.memberId,
        amount: parseFloat(amount),
        scheduledAt: new Date(scheduledDate).toISOString(),
      };

      await payoutApi.schedulePayout(dto);

      toast({
        title: "Success",
        description: `Payout scheduled for ${nextRecipient.nextRecipient.fullName}`,
      });

      setShowScheduleDialog(false);
      loadUpcomingPayouts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule payout",
        variant: "destructive",
      });
    } finally {
      setScheduling(false);
    }
  };

  const getDaysUntil = (date: string) => {
    const days = Math.ceil(
      (new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  const getCountdownColor = (days: number) => {
    if (days < 0) return "text-red-600";
    if (days <= 3) return "text-[#f64d52]";
    if (days <= 7) return "text-yellow-600";
    return "text-[#2e856e]";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#083232]"></div>
      </div>
    );
  }

  const nextPayout = upcomingPayouts[0];
  const daysUntilNext = nextPayout
    ? getDaysUntil(nextPayout.scheduledAt)
    : null;

  return (
    <div className="w-full space-y-4">
      {/* Next Payout Highlight */}
      {nextPayout && (
        <Card className="w-full border-[#083232] bg-gradient-to-r from-[#083232] to-[#2e856e] text-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Next Payout
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm opacity-90 mb-1">Recipient</p>
                <p className="text-xl font-semibold">
                  {nextPayout.recipientName}
                </p>
                <p className="text-sm opacity-75">
                  {nextPayout.recipientPhone}
                </p>
              </div>
              <div>
                <p className="text-sm opacity-90 mb-1">Amount</p>
                <p className="text-2xl md:text-3xl font-bold">
                  KES {nextPayout.amount.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/20">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">
                  {new Date(nextPayout.scheduledAt).toLocaleDateString(
                    "en-GB",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }
                  )}
                </span>
              </div>
              {daysUntilNext !== null && (
                <Badge className="bg-white text-[#083232] font-semibold">
                  {daysUntilNext === 0
                    ? "Today"
                    : daysUntilNext === 1
                    ? "Tomorrow"
                    : daysUntilNext < 0
                    ? `${Math.abs(daysUntilNext)} days overdue`
                    : `In ${daysUntilNext} days`}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Payouts List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#083232]" />
              Upcoming Schedule
            </CardTitle>
            {isAdmin && (
              <Button
                onClick={() => setShowScheduleDialog(true)}
                size="sm"
                className="bg-[#083232] hover:bg-[#2e856e] w-full md:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Schedule Payout
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {upcomingPayouts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p className="mb-2">No upcoming payouts scheduled</p>
              {isAdmin && (
                <Button
                  onClick={() => setShowScheduleDialog(true)}
                  variant="outline"
                  size="sm"
                  className="border-[#083232] text-[#083232]"
                >
                  Schedule First Payout
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingPayouts.map((payout, index) => {
                const days = getDaysUntil(payout.scheduledAt);
                const countdownColor = getCountdownColor(days);

                return (
                  <div
                    key={payout.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#083232] text-white flex items-center justify-center font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm md:text-base">
                          {payout.recipientName}
                        </p>
                        <p className="text-xs text-gray-500">
                          Cycle {payout.cycleNumber}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-[#083232] text-sm md:text-base">
                        KES {payout.amount.toLocaleString()}
                      </p>
                      <p className={`text-xs font-medium ${countdownColor}`}>
                        {days === 0
                          ? "Today"
                          : days === 1
                          ? "Tomorrow"
                          : days < 0
                          ? `${Math.abs(days)}d overdue`
                          : `${days}d`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Payout Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Payout</DialogTitle>
            <DialogDescription>
              Create a scheduled payout for the next recipient in rotation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Cycle ID */}
            <div className="space-y-2">
              <Label htmlFor="cycleId">Contribution Cycle ID</Label>
              <Input
                id="cycleId"
                value={cycleId}
                onChange={(e) => setCycleId(e.target.value)}
                placeholder="Enter cycle ID"
              />
              <p className="text-xs text-gray-500">
                The cycle this payout is for
              </p>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Payout Amount (KES)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-gray-500">
                Total amount to be paid out
              </p>
            </div>

            {/* Scheduled Date */}
            <div className="space-y-2">
              <Label htmlFor="scheduledDate">Scheduled Date</Label>
              <Input
                id="scheduledDate"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
              <p className="text-xs text-gray-500">
                When the payout should be processed
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                The payout will be automatically assigned to the next recipient
                in the rotation order. Ensure a rotation is configured before
                scheduling.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowScheduleDialog(false)}
              disabled={scheduling}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSchedulePayout}
              disabled={scheduling || !cycleId || !amount}
              className="bg-[#083232] hover:bg-[#2e856e]"
            >
              {scheduling ? "Scheduling..." : "Schedule Payout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
