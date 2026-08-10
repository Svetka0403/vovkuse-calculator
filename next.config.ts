import type { NextConfig } from "next";

const repositoryName = "vovkuse-calculator";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: process.env.NODE_ENV === "production" ? `/${repositoryName}` : "",
  images: { unoptimized: true },
};

export default nextConfig;
