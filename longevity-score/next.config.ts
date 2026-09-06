import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    // The benchmark table is read at runtime on the server; keep it in the trace.
    "/**": ["./data/benchmarks/**/*"],
  },
};

export default nextConfig;
