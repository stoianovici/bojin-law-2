/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@legal-platform/ui', '@legal-platform/shared-types'],
  experimental: {
    optimizePackageImports: ['@legal-platform/ui'],
  },

  // Configure webpack for browser compatibility
  webpack: (config, { isServer }) => {
    // Add fallbacks for Node.js modules that shouldn't be bundled in client code
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        util: false,
        buffer: false,
        child_process: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
