"use client";

import { useState, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatModal } from "./chat-modal";
import { chatApi } from "@/lib/chat-api";

export function FloatingChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem("accessToken");
    setIsAuthenticated(!!token);

    if (token) {
      // Fetch unread count
      fetchUnreadCount();

      // Poll for unread count every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const result = await chatApi.getUnreadCount();
      setUnreadCount(result.unread_count);
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  };

  // Don't show chat button if user is not authenticated
  if (!isAuthenticated) return null;

  return (
    <>
      {/* Floating Chat Button */}
      <div
        className={`fixed bottom-6 right-6 z-50 transition-opacity duration-200 ${
          isOpen ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <Button
          onClick={() => setIsOpen(true)}
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
