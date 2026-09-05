import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    // Norms JSON is read at runtime on the server; keep it in the trace.
    "/**": ["./data/norms/**/*"],
  },
};

export default nextConfig;
