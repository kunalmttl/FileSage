import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Silence the "webpack config but no turbopack config" error.
  // Turbopack handles @huggingface/transformers fine without custom config.
  turbopack: {},

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Prevent server-only packages from bundling into the browser build.
        sharp$: false,
        "onnxruntime-node$": false,
      };
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
