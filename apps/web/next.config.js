const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@legal-platform/ui', '@legal-platform/shared-types'],
  // reactCompiler: true, // Temporarily disabled - requires babel-plugin-react-compiler setup
  experimental: {
    optimizePackageImports: ['@legal-platform/ui'],
  },

  // Configure Turbopack (default in Next.js 16)
  // Turbopack handles Node.js module fallbacks automatically
  // NOTE: Turbopack in Next.js 16.0.2 has path alias resolution issues
  // Keeping config minimal until fix is available
  turbopack: {},

  // Webpack config kept for backwards compatibility when using --webpack flag
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

    // Completely exclude stories files from webpack processing
    config.module.rules.forEach(rule => {
      if (rule.test && rule.test.toString().includes('tsx')) {
        if (rule.exclude) {
          rule.exclude = Array.isArray(rule.exclude) ? rule.exclude : [rule.exclude];
          rule.exclude.push(/\.stories\.tsx?$/);
        } else {
          rule.exclude = /\.stories\.tsx?$/;
        }
      }
    });

    return config;
  },
};

module.exports = nextConfig;
