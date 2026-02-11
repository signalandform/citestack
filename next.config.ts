import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    // Prevent Next from inferring the OpenClaw workspace root (multiple lockfiles)
    root: __dirname,
  },

  // Keep native / non-placeable assets out of Turbopack server chunks.
  // This is required for pdfjs-dist optional polyfills (e.g., @napi-rs/canvas) in serverless.
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist', 'pdf-parse'],

  async redirects() {
    return [
      { source: '/srtudents', destination: '/students', permanent: true },
    ];
  },
};

export default nextConfig;
