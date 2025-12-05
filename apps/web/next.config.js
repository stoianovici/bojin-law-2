const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@legal-platform/ui', '@legal-platform/shared-types'],
  // Don't bundle database package - keep it external for server-side code
  serverExternalPackages: ['@legal-platform/database', '@prisma/client'],
  // reactCompiler: true, // Temporarily disabled - requires babel-plugin-react-compiler setup
  output: 'standalone', // Required for Docker deployment
  experimental: {
    optimizePackageImports: ['@legal-platform/ui'],
  },

  // Webpack config for production build
  webpack: (config, { isServer }) => {
    // Add explicit aliases for workspace packages that need bundling
    config.resolve.alias = {
      ...config.resolve.alias,
      '@legal-platform/ui': path.resolve(__dirname, '../../packages/ui/dist'),
      '@legal-platform/types': path.resolve(__dirname, '../../packages/shared/types/dist'),
      '@legal-platform/shared-types': path.resolve(__dirname, '../../packages/shared/types/dist'),
    };

    // Enable symlink resolution for pnpm workspaces
    config.resolve.symlinks = true;

    // Externalize database package for server-side builds (don't bundle Prisma)
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@legal-platform/database': 'commonjs @legal-platform/database',
        '@prisma/client': 'commonjs @prisma/client',
      });
    }

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

    // Completely exclude stories and test files from webpack processing
    config.module.rules.forEach((rule) => {
      if (rule.test && rule.test.toString().includes('tsx')) {
        if (rule.exclude) {
          rule.exclude = Array.isArray(rule.exclude) ? rule.exclude : [rule.exclude];
          rule.exclude.push(/\.stories\.tsx?$/);
          rule.exclude.push(/\.test\.tsx?$/);
          rule.exclude.push(/\/testing\//);
        } else {
          rule.exclude = [/\.stories\.tsx?$/, /\.test\.tsx?$/, /\/testing\//];
        }
      }
    });

    return config;
  },
};

module.exports = nextConfig;
