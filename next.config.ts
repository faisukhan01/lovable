import type { NextConfig } from "next";

/**
 * trailingSlash: true is REQUIRED for the *.space-z.ai preview edge.
 *
 * The platform's edge proxy reserves /dashboard for its own control plane
 * and hard-redirects it to /dashboard/ (301). With Next's default slash
 * normalization (/dashboard/ -> /dashboard, 308) that produced an infinite
 * redirect loop ending in the browser's network-error page — which made
 * every sign-in / sign-up look broken, because a successful auth lands on
 * /dashboard. Making the trailing-slash form canonical turns the edge's
 * redirect into a no-op: /dashboard/ is served with 200 directly.
 *
 * API calls are unaffected: every backend request carries XTransformPort
 * in its query, and the gateway routes those straight to the backend,
 * bypassing Next.js entirely.
 */
const nextConfig: NextConfig = {
  output: "standalone",
  trailingSlash: true,
  allowedDevOrigins: ["*.space-z.ai"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
