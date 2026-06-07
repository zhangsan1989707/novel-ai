import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['47.109.85.168'],
  output: 'standalone',
  serverExternalPackages: [
    '@prisma/client',
    'pino',
    '@auth/prisma-adapter',
    'adm-zip',
    'jszip',
    'epubjs',
    'd3',
    'lru-cache',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'trae-api-cn.mchost.guru',
      },
    ],
  },
};

export default nextConfig;
