/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "3001", // ← change if your backend serves images on a different port
      },
    ],
  },
};

module.exports = nextConfig;
