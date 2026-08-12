import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    const r2Base = process.env.CLOUDFLARE_R2_PUBLIC_URL
    if (!r2Base) return []
    return [
      {
        source: '/decks/:slug/:path*',
        destination: `${r2Base}/decks/:slug/:path*`,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-675abd2580e643e89dde5e766edae1b7.r2.dev',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
