import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin the workspace root to the monorepo root (parent of apps/*) so tracing
  // is deterministic even when a stray lockfile exists further up the tree
  // (e.g. a git worktree nested inside another checkout during local dev).
  turbopack: {
    root: path.join(import.meta.dirname, "..", ".."),
  },
  // Keep these unbundled so the tracer copies real node_modules entries for
  // them into .next/standalone/node_modules — scripts/start.mjs imports them
  // directly (outside Next's bundler) to run migrations before boot.
  serverExternalPackages: ["drizzle-orm", "postgres"],
};

export default nextConfig;
