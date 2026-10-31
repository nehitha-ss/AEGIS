import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the public Node build separate from the local Vinext preview cache.
  distDir: process.env.AEGIS_PUBLIC_BUILD === "true" ? ".next-public" : ".next",
};

export default nextConfig;
