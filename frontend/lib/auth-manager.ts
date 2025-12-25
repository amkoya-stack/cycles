/**
 * Auth Manager - Handles token lifecycle with idle timeout
 *
 * Features:
 * - Token refresh on user activity
 * - Idle timeout (only counts time when user is away)
 * - Auto-redirect to login on expiry
 * - Global error handling for 401 responses
 */

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // Refresh token every 5 minutes when active
const LAST_ACTIVITY_KEY = "lastActivityTime";
const TOKEN_REFRESH_KEY = "tokenRefreshTime";

class AuthManager {
  private activityTimer: NodeJS.Timeout | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  /**
   * Initialize auth manager
   * Call this once in your app root
   */
  initialize() {
    if (this.isInitialized || typeof window === "undefined") return;

    this.isInitialized = true;

    // Check if token expired while user was away
    this.checkIdleTimeout();

    // Start activity tracking
    this.startActivityTracking();

    // Start periodic token refresh
    this.startTokenRefresh();

    // Listen for storage events (logout from another tab)
    window.addEventListener("storage", this.handleStorageChange);

    // Track when user leaves the page
    window.addEventListener("beforeunload", this.handleBeforeUnload);
  }

  /**
   * Clean up listeners
   */
  cleanup() {
    this.stopActivityTracking();
    this.stopTokenRefresh();
    window.removeEventListener("storage", this.handleStorageChange);
    window.removeEventListener("beforeunload", this.handleBeforeUnload);
    this.isInitialized = false;
  }

  /**
   * Check if user was idle for too long
   */
  private checkIdleTimeout = () => {
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);

    if (!lastActivity) {
      // First visit, mark as active
      this.markActivity();
      return;
    }

    const lastActivityTime = parseInt(lastActivity, 10);
    const timeSinceLastActivity = Date.now() - lastActivityTime;

    if (timeSinceLastActivity > IDLE_TIMEOUT_MS) {
      // User was idle too long, clear auth
      this.logout("Session expired due to inactivity");
    } else {
      // User came back in time, reset timer
      this.markActivity();
    }
  };

  /**
   * Track user activity
   */
  private startActivityTracking = () => {
    // Mark activity on these events
    const activityEvents = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    const handleActivity = () => {
      this.markActivity();
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial activity mark
    this.markActivity();
  };

  /**
   * Stop activity tracking
   */
  private stopActivityTracking = () => {
    const activityEvents = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    const handleActivity = () => {
      this.markActivity();
    };

    activityEvents.forEach((event) => {
      window.removeEventListener(event, handleActivity);
    });

    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }
  };

  /**
   * Mark current time as last activity
   */
  private markActivity = () => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  };

  /**
   * Handle page unload (user leaving)
   */
  private handleBeforeUnload = () => {
    // Update last activity time when leaving
    this.markActivity();
  };

  /**
   * Handle storage changes (multi-tab sync)
   */
  private handleStorageChange = (e: StorageEvent) => {
    if (e.key === "accessToken" && !e.newValue) {
      // Token was removed in another tab, redirect to login
      window.location.href = "/auth/login";
    }
  };

  /**
   * Start periodic token refresh
   */
  private startTokenRefresh = () => {
    // Refresh immediately if needed
    this.refreshTokenIfNeeded();

    // Set up periodic refresh
    this.refreshTimer = setInterval(() => {
      this.refreshTokenIfNeeded();
    }, REFRESH_INTERVAL_MS);
  };

  /**
   * Stop token refresh timer
   */
  private stopTokenRefresh = () => {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  };

  /**
   * Refresh token if user is active
   */
  private async refreshTokenIfNeeded() {
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");

    if (!accessToken || !refreshToken) return;

    // Check if token is close to expiry (within 2 minutes)
    if (this.isTokenExpiringSoon(accessToken)) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          localStorage.setItem("accessToken", data.accessToken);
          localStorage.setItem("refreshToken", data.refreshToken);
          localStorage.setItem(TOKEN_REFRESH_KEY, Date.now().toString());
          console.log("Token refreshed successfully");
        } else {
          // Refresh failed, logout
          this.logout("Session expired");
        }
      } catch (error) {
        console.error("Token refresh failed:", error);
      }
    }
  }

  /**
   * Check if token is expiring soon
   */
  private isTokenExpiringSoon(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expirationTime = payload.exp * 1000;
      const twoMinutes = 2 * 60 * 1000;
      return Date.now() >= expirationTime - twoMinutes;
    } catch {
      return true;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expirationTime = payload.exp * 1000;
      return Date.now() >= expirationTime;
    } catch {
      return true;
    }
  }

  /**
   * Logout and redirect to login
   */
  logout(reason?: string) {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem(TOKEN_REFRESH_KEY);

    this.cleanup();

    if (reason) {
      console.log(`Logged out: ${reason}`);
    }

    window.location.href = "/auth/login";
  }

  /**
   * Handle 401 errors globally
   */
  async handleUnauthorized() {
    const refreshToken = localStorage.getItem("refreshToken");

    if (refreshToken) {
      // Try to refresh token once
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          localStorage.setItem("accessToken", data.accessToken);
          localStorage.setItem("refreshToken", data.refreshToken);
          return true; // Token refreshed, retry the request
        }
      } catch (error) {
        console.error("Token refresh on 401 failed:", error);
      }
    }

    // Refresh failed or no refresh token, logout
    this.logout("Session expired");
    return false;
  }
}

// Export singleton instance
export const authManager = new AuthManager();

/**
 * Fetch wrapper with automatic auth handling
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const accessToken = localStorage.getItem("accessToken");

  if (!accessToken) {
    authManager.logout("No access token");
    throw new Error("Not authenticated");
  }

  // Add auth header
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${accessToken}`,
  };

  // Make request
  const response = await fetch(url, { ...options, headers });

  // Handle 401
  if (response.status === 401) {
    const refreshed = await authManager.handleUnauthorized();
    if (refreshed) {
      // Retry with new token
      const newToken = localStorage.getItem("accessToken");
      const retryHeaders = {
        ...options.headers,
        Authorization: `Bearer ${newToken}`,
      };
      return fetch(url, { ...options, headers: retryHeaders });
    }
  }

  return response;
}
