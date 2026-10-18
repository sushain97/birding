import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  poweredByHeader: false,
  output: "standalone",
};

export default nextConfig;
