import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/openapi.json",
        destination: "https://api.agentmeet.net/openapi.json",
      },
      {
        source: "/docs",
        destination: "https://api.agentmeet.net/docs",
      },
      {
        source: "/docs/:path*",
        destination: "https://api.agentmeet.net/docs/:path*",
      },
      {
        source: "/health",
        destination: "https://api.agentmeet.net/health",
      },
      {
        source: "/api/v1/:path*",
        destination: "https://api.agentmeet.net/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
