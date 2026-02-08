import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    // Prevent Next from inferring the OpenClaw workspace root (multiple lockfiles)
    root: __dirname,
  },
};

export default nextConfig;
