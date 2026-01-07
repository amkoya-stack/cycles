"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HomeNavbar } from "@/components/home/home-navbar";
import { ChatModal } from "@/components/chat/chat-modal";
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

export default function ChatPage() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const { toast } = useToast();

  // Check if user has chat enabled in at least one chama
  const checkChatEnabled = async (): Promise<boolean> => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return false;

      // Fetch user's chamas
      const chamasResponse = await fetch(apiUrl("chama"), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!chamasResponse.ok) {
        // If we can't fetch chamas, allow opening (fail open)
        return true;
      }

      const chamas = await chamasResponse.json();
      if (!Array.isArray(chamas) || chamas.length === 0) {
        // No chamas, can't chat anyway
        return false;
      }

      // Check if user has chat enabled in at least one chama
      const chatChecks = await Promise.all(
        chamas.map(async (chama: any) => {
          try {
            const prefsResponse = await fetch(
              apiUrl(`activity/preferences/me?chamaId=${chama.id}`),
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            );

            if (prefsResponse.ok) {
              const prefs = await prefsResponse.json();
              return prefs.chat_enabled !== false; // Default to true if not set
            }
            return true; // Default to enabled if we can't check
          } catch (error) {
            console.error(`Failed to check chat settings for chama ${chama.id}:`, error);
            return true; // Default to enabled on error
          }
        })
      );

      // Return true if chat is enabled in at least one chama
      return chatChecks.some((enabled) => enabled === true);
    } catch (error) {
      console.error("Failed to check chat settings:", error);
      // Default to allowing if check fails (to avoid blocking legitimate chats)
      return true;
    }
  };

  useEffect(() => {
    // Check authentication status after component mounts
    if (typeof window === "undefined") return;

    const accessToken = localStorage.getItem("accessToken");
    const authenticated = accessToken ? !isTokenExpired(accessToken) : false;
    
    setIsAuthenticated(authenticated);
    setIsChecking(false);

    if (!authenticated) {
      // Save redirect path and go to login
      localStorage.setItem("redirectAfterLogin", "/chat");
      router.replace("/auth/login");
      return;
    }

    // Check chat settings before opening
    if (authenticated) {
      checkChatEnabled().then((canOpen) => {
        if (canOpen) {
          setIsOpen(true);
        } else {
          toast({
            title: "Chat Disabled",
            description: "You have disabled chat messages in all your cycles. Please enable chat in Cycle Settings to use this feature.",
            variant: "destructive",
          });
          // Redirect to home after a short delay
          setTimeout(() => {
            router.push("/");
          }, 2000);
        }
      });
    }
  }, [router, toast]);

  // Show loading while checking
  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#083232] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, don't render (redirect is happening)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hide navbar on mobile when chat is open */}
      <div className="hidden md:block">
        <HomeNavbar isAuthenticated={isAuthenticated} />
      </div>
      
      <div className="flex-1 pt-0 md:pt-16 pb-0 md:pb-0">
        {/* Chat Modal - Always open on this page */}
        <ChatModal
          isOpen={isOpen}
          onClose={() => router.push("/")}
          onNewMessage={() => {}}
          isPageMode={true}
        />
      </div>
    </div>
  );
}

