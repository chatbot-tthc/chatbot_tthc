import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "ended-oriented-shoot-soon.trycloudflare.com",
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: 'http://34.21.222.53:8000/api/:path*',
      },
    ];
  },
};

export default nextConfig;