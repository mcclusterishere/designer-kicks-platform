import type { NextConfig } from "next";

// Security headers for a public site taking real traffic. These are the
// safe, high-value ones (clickjacking, MIME sniffing, referrer leakage,
// unused browser features, HTTPS pinning). A strict Content-Security-
// Policy is intentionally left off for now — getting it wrong silently
// breaks Google Analytics, Stripe redirects, and Next's inline runtime,
// which is worse than not having it during a launch.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
