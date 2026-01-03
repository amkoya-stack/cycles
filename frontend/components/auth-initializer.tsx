"use client";

import { useEffect } from "react";
import { authManager } from "@/lib/auth-manager";
import { pushNotificationManager } from "@/lib/push-notifications";

/**
 * Client-side auth initializer
 * Handles idle timeout, token refresh, and push notifications
 */
export function AuthInitializer() {
  useEffect(() => {
    authManager.initialize();

    // Initialize push notifications after a short delay to ensure auth is ready
    const initPush = async () => {
      const accessToken = localStorage.getItem("accessToken");
      if (accessToken && pushNotificationManager.isSupported()) {
        // Wait a bit for auth to be fully initialized
        setTimeout(() => {
          pushNotificationManager.initialize().catch((error) => {
            console.error("Failed to initialize push notifications:", error);
          });
        }, 2000);
      }
    };

    initPush();

    return () => {
      authManager.cleanup();
    };
  }, []);

  return null; // This component doesn't render anything
}
