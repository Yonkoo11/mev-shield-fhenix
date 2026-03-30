/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: "/mev-shield-fhenix",
  images: { unoptimized: true },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false, os: false };
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};
module.exports = nextConfig;
