import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "ended-oriented-shoot-soon.trycloudflare.com",
  ],
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://35.187.240.100:8000/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;