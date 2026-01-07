/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect } from "react";
import { apiUrl } from "@/lib/api-config";

export function useChamas() {
  const [chamas, setChamas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChamas = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch public chamas
      const publicUrl = apiUrl("chama/public");
      console.log("[useChamas] Fetching public chamas from:", publicUrl);
      
      let publicChamas = [];
      try {
        const publicResponse = await fetch(publicUrl);
        if (publicResponse.ok) {
          publicChamas = await publicResponse.json();
        } else {
          console.error("[useChamas] Public chamas fetch failed:", publicResponse.status, publicResponse.statusText);
        }
      } catch (error: any) {
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
          console.error("[useChamas] Network error - Backend may not be running. URL:", publicUrl);
        } else {
          console.error("[useChamas] Error fetching public chamas:", error);
        }
      }

      // Fetch user's chamas if authenticated
      const accessToken = localStorage.getItem("accessToken");
      let userChamas = [];

      if (accessToken) {
        try {
          const userUrl = apiUrl("chama");
          console.log("[useChamas] Fetching user chamas from:", userUrl);
          
          const userResponse = await fetch(userUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (userResponse.ok) {
            userChamas = await userResponse.json();
          } else {
            console.error("[useChamas] User chamas fetch failed:", userResponse.status, userResponse.statusText);
          }
        } catch (error: any) {
          if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            console.error("[useChamas] Network error - Backend may not be running. URL:", userUrl);
          } else {
            console.error("[useChamas] Error fetching user chamas:", error);
          }
        }
      }

      // Combine and deduplicate chamas
      const chamaMap = new Map();

      // Add user chamas first (they have role info)
      userChamas.forEach((chama: any) => {
        chamaMap.set(chama.id, chama);
      });

      // Add public chamas (only if not already in map)
      publicChamas.forEach((chama: any) => {
        if (!chamaMap.has(chama.id)) {
          chamaMap.set(chama.id, chama);
        }
      });

      const allChamas = Array.from(chamaMap.values());
      setChamas(allChamas);
    } catch (error: any) {
      console.error("Error fetching chamas:", error);
      // Log more details about the error
      if (error.message) {
        console.error("Error message:", error.message);
      }
      if (error.cause) {
        console.error("Error cause:", error.cause);
      }
      // Set empty array if API fails
      setChamas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch chamas when hook is used
  useEffect(() => {
    fetchChamas();
  }, [fetchChamas]);

  return { chamas, loading, fetchChamas };
}
