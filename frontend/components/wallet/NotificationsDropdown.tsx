/* eslint-disable react/no-unescaped-entities */
import { useState } from "react";
import { Bell, Check, X, Clock, User, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNotifications, type FundRequest } from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";

export function NotificationsDropdown() {
  const { fundRequests, unreadCount, respondToRequest, loading } =
    useNotifications();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(amount);
  };

  const handleResponse = async (
    requestId: string,
    action: "approve" | "decline"
  ) => {
    try {
      setActionLoading(`${requestId}-${action}`);
      await respondToRequest(requestId, action);
      // Show success message
      alert(`Request ${action}d successfully!`);
    } catch (error) {
      console.error(`Failed to ${action} request:`, error);
      alert(`Failed to ${action} request. Please try again.`);
    } finally {
      setActionLoading(null);
    }
  };

  const renderFundRequest = (request: FundRequest) => (
    <div
      key={request.id}
      className="p-4 border-b border-gray-100 hover:bg-gray-50"
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage
            src={
              request.request_type === "member"
                ? request.requester_avatar
                : request.chama_avatar
            }
          />
          <AvatarFallback>
            {request.request_type === "member"
              ? request.requester_name?.charAt(0)?.toUpperCase()
              : request.chama_name?.charAt(0)?.toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {request.request_type === "member" ? (
              <User className="w-4 h-4 text-blue-500" />
            ) : (
              <Users className="w-4 h-4 text-green-500" />
            )}
            <p className="text-sm font-medium text-gray-900">
              {request.request_type === "member"
                ? request.requester_name
                : request.chama_name}
            </p>
            <Badge variant="outline" className="text-xs">
              {formatAmount(request.amount)}
            </Badge>
          </div>

          <p className="text-sm text-gray-600 mb-2 line-clamp-2">
            {request.description}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(request.created_at), {
                addSuffix: true,
              })}
            </span>

            {request.status === "pending" && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleResponse(request.id, "decline")}
                  disabled={actionLoading === `${request.id}-decline`}
                >
                  <X className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-2 bg-green-600 hover:bg-green-700"
                  onClick={() => handleResponse(request.id, "approve")}
                  disabled={actionLoading === `${request.id}-approve`}
                >
                  <Check className="w-3 h-3" />
                </Button>
              </div>
            )}

            {request.status !== "pending" && (
              <Badge
                variant={
                  request.status === "approved" ? "default" : "destructive"
                }
                className="text-xs"
              >
                {request.status}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-900">Fund Requests</h3>
          <p className="text-sm text-gray-600">
            {fundRequests.length === 0
              ? "No pending requests"
              : `${
                  fundRequests.filter((r) => r.status === "pending").length
                } pending requests`}
          </p>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Loading requests...
            </div>
          ) : fundRequests.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No fund requests</p>
              <p className="text-sm mt-1">
                You'll see requests from your chama members here
              </p>
            </div>
          ) : (
            fundRequests.map(renderFundRequest)
          )}
        </div>

        {fundRequests.length > 0 && (
          <div className="p-3 border-t text-center">
            <Button variant="ghost" size="sm" className="text-xs text-gray-600">
              View all requests
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
