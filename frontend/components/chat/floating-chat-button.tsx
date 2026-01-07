/* eslint-disable react-hooks/immutability */
"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatModal } from "./chat-modal";
import { chatApi } from "@/lib/chat-api";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api-config";

const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const expirationTime = payload.exp * 1000;
    return Date.now() >= expirationTime;
  } catch (error) {
    return true;
  }
};

export function FloatingChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();
  const chatEnabledCacheRef = useRef<{ result: boolean; timestamp: number } | null>(null);
  const CACHE_DURATION = 60000; // Cache for 1 minute

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem("accessToken");
    const authenticated = token ? !isTokenExpired(token) : false;
    setIsAuthenticated(authenticated);

    if (authenticated) {
      // Fetch unread count
      fetchUnreadCount();

      // Poll for unread count every 60 seconds (reduced frequency to avoid rate limits)
      const interval = setInterval(fetchUnreadCount, 60000);
      return () => clearInterval(interval);
    }
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const result = await chatApi.getUnreadCount();
      setUnreadCount(result.unread_count);
    } catch (error: any) {
      // Silently handle rate limit errors for polling
      if (error.message?.includes("Rate limit") || error.message?.includes("429")) {
        console.warn("Rate limit reached for unread count polling");
        return;
      }
      console.error("Failed to fetch unread count:", error);
    }
  };

  // Check if user has chat enabled in at least one chama
  // Uses caching to avoid excessive API calls
  const checkChatEnabled = async (): Promise<boolean> => {
    // Check cache first
    if (chatEnabledCacheRef.current) {
      const { result, timestamp } = chatEnabledCacheRef.current;
      if (Date.now() - timestamp < CACHE_DURATION) {
        return result;
      }
    }

    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        chatEnabledCacheRef.current = { result: false, timestamp: Date.now() };
        return false;
      }

      // Fetch user's chamas
      const chamasResponse = await fetch(apiUrl("chama"), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!chamasResponse.ok) {
        // If we can't fetch chamas, allow opening (fail open)
        chatEnabledCacheRef.current = { result: true, timestamp: Date.now() };
        return true;
      }

      const chamas = await chamasResponse.json();
      if (!Array.isArray(chamas) || chamas.length === 0) {
        // No chamas, can't chat anyway
        chatEnabledCacheRef.current = { result: false, timestamp: Date.now() };
        return false;
      }

      // For rate limiting, only check first few chamas or use a simpler approach
      // Default to true if user has chamas (optimistic approach)
      // This reduces API calls significantly
      const result = true; // Optimistic: if user has chamas, assume chat is enabled
      chatEnabledCacheRef.current = { result, timestamp: Date.now() };
      return result;
    } catch (error: any) {
      console.error("Failed to check chat settings:", error);
      // If rate limited, use cached value or default to true
      if (error.message?.includes("Rate limit") || error.message?.includes("429")) {
        if (chatEnabledCacheRef.current) {
          return chatEnabledCacheRef.current.result;
        }
      }
      // Default to allowing if check fails (to avoid blocking legitimate chats)
      chatEnabledCacheRef.current = { result: true, timestamp: Date.now() };
      return true;
    }
  };

  const handleOpenChat = async () => {
    const canOpen = await checkChatEnabled();
    if (!canOpen) {
      toast({
        title: "Chat Disabled",
        description: "You have disabled chat messages in all your cycles. Please enable chat in Cycle Settings to use this feature.",
        variant: "destructive",
      });
      return;
    }
    setIsOpen(true);
  };

  // Don't show chat button if user is not authenticated
  if (!isAuthenticated) return null;

  return (
    <>
      {/* Floating Chat Button - Hidden on mobile (using bottom nav instead) */}
      <div
        className={`hidden md:block fixed bottom-0 right-6 z-50 transition-opacity duration-200 ${
          isOpen ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        style={{ marginBottom: "80px" }}
      >
        <Button
          onClick={handleOpenChat}
          size="lg"
          className="h-14 w-14 rounded-full bg-[#083232] hover:bg-[#2e856e] shadow-lg hover:shadow-xl transition-all duration-200 relative"
          aria-label="Open chat"
        >
          <MessageCircle className="h-6 w-6 text-white" />
          {unreadCount > 0 && (
            <div className="absolute -top-2 -right-2 h-6 w-6 bg-[#f64d52] text-white text-xs font-bold rounded-full flex items-center justify-center min-w-[1.5rem]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </div>
          )}
        </Button>
      </div>

      {/* Chat Modal */}
      <ChatModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onNewMessage={() => fetchUnreadCount()} // Refresh unread count when new message
      />
    </>
  );
}
