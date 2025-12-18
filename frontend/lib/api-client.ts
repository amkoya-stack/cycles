/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Enhanced API client with better error handling
 */

export class ApiError extends Error {
  constructor(message: string, public status: number, public response?: any) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = localStorage.getItem("accessToken");

  const headers = {
    "Content-Type": "application/json",
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(url, { ...options, headers });

    // Check if response is ok
    if (!response.ok) {
      // Try to parse error message
      let errorMessage = `Request failed with status ${response.status}`;

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Failed to parse JSON error
        }
      } else {
        // Response is not JSON (likely HTML error page)
        const text = await response.text();
        console.error("Non-JSON response:", text.substring(0, 200));

        if (response.status === 404) {
          errorMessage = "API endpoint not found";
        } else if (response.status === 401) {
          errorMessage = "Authentication failed. Please login again.";
          // Clear tokens and redirect to login
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          window.location.href = "/auth/login";
        } else if (response.status === 403) {
          errorMessage = "You don't have permission to access this resource";
        } else if (response.status >= 500) {
          errorMessage = "Server error. Please try again later.";
        }
      }

      throw new ApiError(errorMessage, response.status);
    }

    // Check content type before parsing JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error(
        "Expected JSON response but got:",
        contentType,
        "Text:",
        text.substring(0, 200)
      );
      throw new ApiError(
        "Invalid response format from server",
        response.status
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Network error or other issues
    console.error("API request failed:", error);
    throw new ApiError("Network error. Please check your connection.", 0);
  }
}

// Convenience methods
export const api = {
  get: <T>(url: string, options?: RequestInit) =>
    apiRequest<T>(url, { ...options, method: "GET" }),

  post: <T>(url: string, data?: any, options?: RequestInit) =>
    apiRequest<T>(url, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(url: string, data?: any, options?: RequestInit) =>
    apiRequest<T>(url, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(url: string, options?: RequestInit) =>
    apiRequest<T>(url, { ...options, method: "DELETE" }),
};
