import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["planmyworkday.dev"],
  serverExternalPackages: ["better-sqlite3"],
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("better-sqlite3");
    }

    return config;
  },
};

export default nextConfig;
