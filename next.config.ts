import { execFileSync } from "node:child_process";
import path from "path";
import type { NextConfig } from "next";

const repoRoot = path.resolve(process.cwd());
execFileSync(process.execPath, [path.join(repoRoot, "scripts/assert-local-repo.cjs")], {
  cwd: repoRoot,
  stdio: "inherit",
});

const nextConfig: NextConfig = {
  // Checkout must stay at ~/Developer/credit-card-stack-optimizer, outside iCloud.
  distDir: ".next",
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          "**/tsconfig.tsbuildinfo",
          "**/tmp/**",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
