import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Files attached to emails in the approval queue (contracts for signing) are uploaded via a Server Action.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  // The lead detail page reads the research prompt template from /prompts at runtime.
  outputFileTracingIncludes: {
    "/leads/*": ["./prompts/**/*"],
    // Contract PDFs embed the Noto Sans fonts.
    "/api/contracts/*": ["./assets/fonts/**/*"],
    "/messaging/*": ["./assets/fonts/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
