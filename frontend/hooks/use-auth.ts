import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const expirationTime = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= expirationTime;
  } catch (error) {
    return true; // If we can't decode it, treat it as expired
  }
};

export function useAuth() {
  // Always start with false to match server-side rendering
  // This prevents hydration mismatches
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check localStorage after component mounts (client-side only)
  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken || isTokenExpired(accessToken)) {
      // Token is missing or expired, clear storage
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setIsAuthenticated(false);
    } else {
      setIsAuthenticated(true);
    }
  }, []);

  const validateToken = useCallback(async () => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      setIsAuthenticated(false);
      return;
    }

    // Check if token is expired
    if (isTokenExpired(accessToken)) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setIsAuthenticated(false);
      return;
    }

    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setIsAuthenticated(false);
    window.location.href = "/";
  }, []);

  // Return isAuthenticated directly - it starts as false on both server and client
  // This prevents hydration mismatch, then useEffect updates it on client
  return { isAuthenticated, validateToken, logout };
}

/**
 * Hook for protected pages - redirects to login if not authenticated
 * Use this ONLY in pages that absolutely require authentication
 * (e.g., create cycle, settings, admin-only pages)
 */
export function useAuthGuard() {
  const router = useRouter();
  const [hasChecked, setHasChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Wait for client-side hydration before checking
    if (typeof window === "undefined") return;

    // Check authentication status synchronously
    const accessToken = localStorage.getItem("accessToken");
    const authenticated = accessToken ? !isTokenExpired(accessToken) : false;

    setIsAuthenticated(authenticated);
    setHasChecked(true);

    // Only redirect once if not authenticated
    if (!authenticated) {
      // Save intended destination for redirect after login
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== "/auth/login") {
        localStorage.setItem("redirectAfterLogin", currentPath);
      }
      // Use replace instead of push to avoid adding to history
      router.replace("/auth/login");
    }
  }, [router]); // Only depend on router, run once

  return { isAuthenticated };
}
