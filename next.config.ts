import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/webp"],
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // The beads viewer is a self-contained static bundle in /public/beads.
  // Serve it at /beads (no trailing-slash redirect); a <base href="/beads/">
  // in its index.html keeps its relative asset paths resolving correctly.
  async rewrites() {
    return [{ source: "/beads", destination: "/beads/index.html" }];
  },
};

export default nextConfig;
