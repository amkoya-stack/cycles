/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from "react";

export function useChamas() {
  const [chamas, setChamas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChamas = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch public chamas
      const publicResponse = await fetch(
        "http://localhost:3001/api/chama/public"
      );
      let publicChamas = [];

      if (publicResponse.ok) {
        publicChamas = await publicResponse.json();
      }

      // Fetch user's chamas if authenticated
      const accessToken = localStorage.getItem("accessToken");
      let userChamas = [];

      if (accessToken) {
        try {
          const userResponse = await fetch("http://localhost:3001/api/chama", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (userResponse.ok) {
            userChamas = await userResponse.json();
          }
        } catch (error) {
          console.error("Error fetching user chamas:", error);
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
    } catch (error) {
      console.error("Error fetching chamas:", error);
      // Set empty array if API fails
      setChamas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { chamas, loading, fetchChamas };
}
