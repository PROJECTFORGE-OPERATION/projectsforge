import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack's root to this project. Without it, Next auto-detects the
  // unrelated package.json/package-lock.json sitting in the home directory and
  // warns "ignored package-lock.json ... outside the current Git repository"
  // on every build.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
