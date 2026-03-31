import type { NextConfig } from "next";

const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Extract hostname from backend URL for image remotePatterns
let backendHostname = 'localhost';
try {
  backendHostname = new URL(backendUrl).hostname;
} catch {}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: backendHostname },
    ],
  },
  // Proxy /api/* to backend — works in dev and on Vercel
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
