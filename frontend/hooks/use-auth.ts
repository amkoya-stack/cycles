import { useState, useCallback, useEffect } from "react";

export function useAuth() {
  // Always start as false to match server-side rendering
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check localStorage after component mounts (client-side only)
  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");
    setIsAuthenticated(!!accessToken);
  }, []);

  const validateToken = useCallback(async () => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      setIsAuthenticated(false);
      return;
    }

    // Just check if token exists - don't validate with API call
    // The backend will reject invalid tokens anyway
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
