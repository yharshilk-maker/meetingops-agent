import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev overlay badge so screen recordings of /movie stay clean.
  devIndicators: false,
};

export default nextConfig;
