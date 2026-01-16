/**
 * API Configuration
 * Centralized configuration for API endpoints
 */

// Get base URL from env, default to localhost:3001
const envApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Normalize: extract just the base URL (host + port), removing any /api/v1 or /api
let API_BASE_URL = envApiUrl.trim().replace(/\/+$/, ""); // Remove trailing slashes

// Remove /api/v1 or /api if present (handle multiple occurrences)
while (API_BASE_URL.includes("/api/v1")) {
  API_BASE_URL = API_BASE_URL.replace(/\/api\/v1.*$/, "").replace(
    /\/api\/v1$/,
    ""
  );
}
if (API_BASE_URL.includes("/api") && !API_BASE_URL.includes("/api/v1")) {
  API_BASE_URL = API_BASE_URL.replace(/\/api.*$/, "").replace(/\/api$/, "");
}

const API_VERSION = "v1";
export const API_URL = `${API_BASE_URL}/api/${API_VERSION}`;
export { API_BASE_URL };

// Log API URL for debugging
if (typeof window !== "undefined") {
  console.log(
    "[API Config] NEXT_PUBLIC_API_URL env var:",
    process.env.NEXT_PUBLIC_API_URL
  );
  console.log("[API Config] API_BASE_URL:", API_BASE_URL);
  console.log("[API Config] API_URL:", API_URL);
  console.log("[API Config] NODE_ENV:", process.env.NODE_ENV);
}

// Helper function to build API URLs
export const apiUrl = (path: string): string => {
  if (!path) return API_URL;

  // Remove leading slash if present
  let cleanPath = path.startsWith("/") ? path.slice(1) : path;

  // Remove any /api/v1 or /api prefixes if accidentally included
  cleanPath = cleanPath.replace(/^(api\/v1\/)+/, "").replace(/^(api\/)+/, "");

  // Remove http:// or https:// if accidentally included
  cleanPath = cleanPath.replace(/^https?:\/\//, "");

  // Remove domain if accidentally included
  if (cleanPath.includes("localhost:3001")) {
    cleanPath = cleanPath.split("localhost:3001").pop() || cleanPath;
    cleanPath = cleanPath.replace(/^\/+/, "");
  }

  // Final cleanup: remove any remaining /api/v1 or /api
  cleanPath = cleanPath.replace(/^(api\/v1\/)+/, "").replace(/^(api\/)+/, "");

  return `${API_URL}/${cleanPath}`;
};

// Legacy support - for gradual migration
export const legacyApiUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${API_BASE_URL}/api/${cleanPath}`;
};
