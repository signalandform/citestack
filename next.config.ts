import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },

  // Keep native / non-placeable assets out of Turbopack server chunks.
  // This is required for pdfjs-dist optional polyfills (e.g., @napi-rs/canvas) in serverless.
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist', 'pdf-parse'],

  // Ensure pdf.js worker file makes it into serverless/standalone output.
  // pdf-parse@2 uses a relative workerSrc ("./pdf.worker.mjs") which Next output tracing
  // can omit unless explicitly included.
  outputFileTracingIncludes: {
    '*': ['node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs'],
  },

  async redirects() {
    return [
      { source: '/srtudents', destination: '/students', permanent: true },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? '',
  project: process.env.SENTRY_PROJECT ?? '',
  silent: true,
});
