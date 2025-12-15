import { useState, useCallback } from "react";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const validateToken = useCallback(async () => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      setIsAuthenticated(false);
      return;
    }

    // Validate token by making a test request
    try {
      const response = await fetch("http://localhost:3001/api/wallet/balance", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 401) {
        // Token is invalid/expired
        localStorage.removeItem("accessToken");
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(true);
      }
    } catch (error) {
      // If request fails, assume authenticated (offline scenario)
      setIsAuthenticated(!!accessToken);
    }
  }, []);

  return { isAuthenticated, validateToken };
}
