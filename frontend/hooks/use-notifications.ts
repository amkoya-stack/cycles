import { useState, useCallback, useEffect } from "react";
import { apiUrl } from "@/lib/api-config";

export interface FundRequestNotification {
  id: string;
  fund_request_id: string;
  notification_type:
    | "request_received"
    | "request_approved"
    | "request_declined";
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  amount: number;
  request_type: "member" | "chama";
  request_status: string;
}

export interface FundRequest {
  id: string;
  requester_id: string;
  recipient_id?: string;
  chama_id?: string;
  amount: number;
  description: string;
  request_type: "member" | "chama";
  status: "pending" | "approved" | "declined" | "expired";
  created_at: string;
  requester_name: string;
  requester_avatar?: string;
  requester_phone?: string;
  chama_name?: string;
  chama_avatar?: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<FundRequestNotification[]>(
    []
  );
  const [fundRequests, setFundRequests] = useState<FundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const accessToken = localStorage.getItem("accessToken");

      if (!accessToken) {
        return;
      }

      const response = await fetch(
        apiUrl("wallet/notifications"),
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
          data.filter((n: FundRequestNotification) => !n.is_read).length
        );
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFundRequests = useCallback(async (status?: string) => {
    try {
      const accessToken = localStorage.getItem("accessToken");

      if (!accessToken) {
        return;
      }

      const queryString = status ? `?status=${status}` : "";
      const response = await fetch(
        `${apiUrl("wallet/requests/received")}${queryString}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFundRequests(data);
      }
    } catch (error) {
      console.error("Error fetching fund requests:", error);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const accessToken = localStorage.getItem("accessToken");

      if (!accessToken) {
        return;
      }

      const response = await fetch(
        apiUrl(`wallet/notifications/${notificationId}/read`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }, []);

  const respondToRequest = useCallback(
    async (requestId: string, action: "approve" | "decline") => {
      try {
        const accessToken = localStorage.getItem("accessToken");

        if (!accessToken) {
          return false;
        }

        const response = await fetch(
          apiUrl(`wallet/requests/${requestId}/respond`),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ action }),
          }
        );

        if (response.ok) {
          // Refresh fund requests
          await fetchFundRequests();
          await fetchNotifications();
          return true;
        } else {
          const error = await response.json();
          throw new Error(error.message || `Failed to ${action} request`);
        }
      } catch (error) {
        console.error(`Error ${action}ing request:`, error);
        throw error;
      }
    },
    [fetchFundRequests, fetchNotifications]
  );

  useEffect(() => {
    fetchNotifications();
    fetchFundRequests("pending"); // Only fetch pending requests initially
  }, [fetchNotifications, fetchFundRequests]);

  return {
    notifications,
    fundRequests,
    loading,
    unreadCount,
    fetchNotifications,
    fetchFundRequests,
    markAsRead,
    respondToRequest,
  };
}
