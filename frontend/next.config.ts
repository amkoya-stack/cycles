import type { NextConfig } from "next";

// Force rebuild: v3
const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  env: {
    // Explicitly expose the API URL
    // In production, always use Railway. In development, use localhost
    NEXT_PUBLIC_API_URL:
      process.env.NODE_ENV === "production"
        ? "https://cycles-production.up.railway.app"
        : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "3001", // ← change if your backend serves images on a different port
      },
      {
        protocol: "https",
        hostname: "cycles-production.up.railway.app",
      },
    ],
  },
};

module.exports = nextConfig;
