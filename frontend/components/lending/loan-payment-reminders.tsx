"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  AlertCircle,
  CheckCircle,
  Clock,
  Calendar,
  DollarSign,
  Loader2,
} from "lucide-react";
import { apiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface LoanReminder {
  id: string;
  loanId: string;
  repaymentId: string;
  reminderType: string;
  daysOffset: number;
  channel: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  dueDate: string;
  installmentNumber: number;
  amountDue: number;
  amountPaid: number;
  repaymentStatus: string;
  chamaName: string;
  outstandingBalance: number;
}

interface LoanPaymentRemindersProps {
  loanId?: string;
  limit?: number;
  showTitle?: boolean;
}

export function LoanPaymentReminders({
  loanId,
  limit = 10,
  showTitle = true,
}: LoanPaymentRemindersProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [reminders, setReminders] = useState<LoanReminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReminders();
  }, [loanId]);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      let url: string;
      if (loanId) {
        url = apiUrl(`lending/loans/${loanId}/reminders`);
      } else {
        url = apiUrl(`lending/reminders/me?limit=${limit}`);
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setReminders(data.data || []);
        }
      } else {
        throw new Error("Failed to fetch reminders");
      }
    } catch (error) {
      console.error("Failed to fetch reminders:", error);
      toast({
        title: "Error",
        description: "Failed to load payment reminders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getReminderTypeBadge = (type: string) => {
    const typeLower = type.toLowerCase();
    if (typeLower === "before_due") {
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          <Clock className="w-3 h-3 mr-1" />
          Upcoming
        </Badge>
      );
    } else if (typeLower === "due_date") {
      return (
        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
          <Calendar className="w-3 h-3 mr-1" />
          Due Today
        </Badge>
      );
    } else if (typeLower === "overdue") {
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Overdue
        </Badge>
      );
    }
    return <Badge>{type}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === "sent") {
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle className="w-3 h-3 mr-1" />
          Sent
        </Badge>
      );
    } else if (statusLower === "pending") {
      return (
        <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    } else if (statusLower === "failed") {
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      );
    }
    return <Badge>{status}</Badge>;
  };

  const getChannelIcon = (channel: string) => {
    switch (channel.toLowerCase()) {
      case "sms":
        return "📱";
      case "email":
        return "📧";
      case "push":
        return "🔔";
      case "whatsapp":
        return "💬";
      default:
        return "📬";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Loading reminders...</p>
        </CardContent>
      </Card>
    );
  }

  if (reminders.length === 0) {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Payment Reminders
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-8">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No payment reminders found</p>
            <p className="text-sm text-gray-500 mt-1">
              Reminders will appear here when payments are due
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group reminders by status
  const upcomingReminders = reminders.filter(
    (r) => r.reminderType === "before_due" && r.status === "pending"
  );
  const dueTodayReminders = reminders.filter(
    (r) => r.reminderType === "due_date" && r.status === "pending"
  );
  const overdueReminders = reminders.filter(
    (r) => r.reminderType === "overdue" && r.status === "pending"
  );
  const sentReminders = reminders.filter((r) => r.status === "sent");

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Payment Reminders
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {/* Overdue Reminders */}
        {overdueReminders.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Overdue ({overdueReminders.length})
            </h3>
            <div className="space-y-2">
              {overdueReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="bg-red-50 border border-red-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getReminderTypeBadge(reminder.reminderType)}
                        <span className="text-xs text-gray-600">
                          {getChannelIcon(reminder.channel)} {reminder.channel}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {reminder.chamaName} - Installment #
                        {reminder.installmentNumber}
                      </p>
                      <p className="text-sm text-gray-700">
                        Amount Due:{" "}
                        <span className="font-semibold">
                          {formatAmount(
                            reminder.amountDue - reminder.amountPaid
                          )}
                        </span>
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Due: {formatDate(reminder.dueDate)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => router.push(`/loans/${reminder.loanId}`)}
                      className="bg-[#083232] hover:bg-[#2e856e]"
                    >
                      Pay Now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Due Today Reminders */}
        {dueTodayReminders.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-yellow-700 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Due Today ({dueTodayReminders.length})
            </h3>
            <div className="space-y-2">
              {dueTodayReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getReminderTypeBadge(reminder.reminderType)}
                        <span className="text-xs text-gray-600">
                          {getChannelIcon(reminder.channel)} {reminder.channel}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {reminder.chamaName} - Installment #
                        {reminder.installmentNumber}
                      </p>
                      <p className="text-sm text-gray-700">
                        Amount Due:{" "}
                        <span className="font-semibold">
                          {formatAmount(
                            reminder.amountDue - reminder.amountPaid
                          )}
                        </span>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => router.push(`/loans/${reminder.loanId}`)}
                      className="bg-[#083232] hover:bg-[#2e856e]"
                    >
                      Pay Now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Reminders */}
        {upcomingReminders.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Upcoming ({upcomingReminders.length})
            </h3>
            <div className="space-y-2">
              {upcomingReminders.slice(0, 5).map((reminder) => (
                <div
                  key={reminder.id}
                  className="bg-blue-50 border border-blue-200 rounded-lg p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getReminderTypeBadge(reminder.reminderType)}
                        <span className="text-xs text-gray-600">
                          {getChannelIcon(reminder.channel)} {reminder.channel}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {reminder.chamaName} - Installment #
                        {reminder.installmentNumber}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Due: {formatDate(reminder.dueDate)} • Amount:{" "}
                        {formatAmount(reminder.amountDue - reminder.amountPaid)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sent Reminders (History) */}
        {sentReminders.length > 0 && !loanId && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Recent Reminders
            </h3>
            <div className="space-y-2">
              {sentReminders.slice(0, 3).map((reminder) => (
                <div
                  key={reminder.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusBadge(reminder.status)}
                        <span className="text-xs text-gray-600">
                          {getChannelIcon(reminder.channel)} {reminder.channel}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">
                        {reminder.chamaName} - Installment #
                        {reminder.installmentNumber}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Sent: {reminder.sentAt ? formatDate(reminder.sentAt) : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

