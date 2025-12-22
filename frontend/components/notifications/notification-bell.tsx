/* eslint-disable react/no-unescaped-entities */
/* eslint-disable react-hooks/immutability */
"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DollarSign, Users, FileText, Settings, Activity } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  priority: string;
  created_at: string;
  status: string;
  activity_title?: string;
  activity_category?: string;
}

const categoryIcons = {
  financial: DollarSign,
  governance: Settings,
  membership: Users,
  document: FileText,
  system: Activity,
};

const categoryColors = {
  financial: "text-green-600",
  governance: "text-blue-600",
  membership: "text-purple-600",
  document: "text-orange-600",
  system: "text-gray-600",
};

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNotifications();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        "http://localhost:3001/api/activity/notifications/me?channel=in_app&limit=20",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        setUnreadCount(
          data.filter((n: Notification) => n.status === "pending").length
        );
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        "http://localhost:3001/api/activity/notifications/mark-all-read",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      if (response.ok) {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, status: "read" })));
      }
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  };

  const getIcon = (category?: string) => {
    if (!category) return Activity;
    return categoryIcons[category as keyof typeof categoryIcons] || Activity;
  };

  const getColor = (category?: string) => {
    if (!category) return "text-gray-600";
    return (
      categoryColors[category as keyof typeof categoryColors] || "text-gray-600"
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[#f64d52] text-white text-xs flex items-center justify-center font-semibold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-[#083232]">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs h-7 px-2"
            >
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No notifications yet</p>
              <p className="text-sm text-gray-500 mt-1">
                You'll see updates about your cycle activities here
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = getIcon(notification.activity_category);
                const color = getColor(notification.activity_category);
                const isUnread = notification.status === "pending";

                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                      isUnread ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <div className="flex gap-3">
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-full ${
                          isUnread ? "bg-blue-100" : "bg-gray-100"
                        } flex items-center justify-center`}
                      >
                        <Icon className={`w-5 h-5 ${color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className={`font-semibold text-sm ${
                              isUnread ? "text-[#083232]" : "text-gray-900"
                            }`}
                          >
                            {notification.title}
                          </h4>
                          {isUnread && (
                            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-[#f64d52]" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatRelativeTime(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-3 border-t text-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-[#2e856e] hover:text-[#083232]"
            >
              View all notifications
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
