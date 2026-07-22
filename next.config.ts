import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/webp"],
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/beads/graph": ["./public/beads/index.html"],
  },
  // The beads viewer is a self-contained static bundle in /public/beads.
  // Serve it at /beads and expose clean entry paths for the viewer's static
  // routes. A <base href="/beads/"> in index.html keeps relative assets
  // resolving correctly when a deep link is rewritten to the bundle shell.
  async rewrites() {
    return [
      { source: "/beads", destination: "/beads/index.html" },
      { source: "/beads/issues", destination: "/beads/index.html" },
      { source: "/beads/insights", destination: "/beads/index.html" },
    ];
  },
};

export default nextConfig;
