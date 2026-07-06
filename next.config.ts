import type { NextConfig } from "next";

const dashboardBasePath = process.env.NEXT_PUBLIC_DASHBOARD_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  /* config options here */
  assetPrefix: dashboardBasePath || undefined,
  env: {
    NEXT_PUBLIC_DASHBOARD_BASE_PATH: dashboardBasePath,
  },
};

export default nextConfig;
