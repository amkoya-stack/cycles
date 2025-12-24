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
  // Always start as false to match server-side rendering
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

  return { isAuthenticated, validateToken, logout };
}

/**
 * Hook for protected pages - redirects to login if not authenticated
 * Use this ONLY in pages that absolutely require authentication
 * (e.g., create cycle, settings, admin-only pages)
 */
export function useAuthGuard() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    // Only redirect once after hydration completes
    if (!hasRedirected && isAuthenticated === false) {
      setHasRedirected(true);
      // Save intended destination for redirect after login
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== "/auth/login") {
        localStorage.setItem("redirectAfterLogin", currentPath);
      }
      // Redirect to login
      router.push("/auth/login");
    }
  }, [isAuthenticated, router, hasRedirected]);

  return { isAuthenticated };
}
