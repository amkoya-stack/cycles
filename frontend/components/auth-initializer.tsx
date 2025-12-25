"use client";

import { useEffect } from "react";
import { authManager } from "@/lib/auth-manager";

/**
 * Client-side auth initializer
 * Handles idle timeout and token refresh
 */
export function AuthInitializer() {
  useEffect(() => {
    authManager.initialize();

    return () => {
      authManager.cleanup();
    };
  }, []);

  return null; // This component doesn't render anything
}
