/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@legal-platform/ui', '@legal-platform/types', '@legal-platform/database'],
  // Note: Removed 'output: standalone' - it causes Prisma client issues in monorepo
  // The standard Next.js server works better with external packages like @prisma/client
  // TODO: Remove after fixing TypeScript/ESLint errors in services
  typescript: {
    ignoreBuildErrors: true,
  },
  // Skip ESLint during builds - lint is run separately in CI
  // Note: This is for Next.js 15 compatibility (Render uses 15.x due to --no-frozen-lockfile)
  // In Next.js 16+ this option is ignored with a warning
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['@legal-platform/ui'],
  },
  serverExternalPackages: ['pst-extractor', 'bull', '@prisma/client', '.prisma/client'],

  // Empty turbopack config to silence Next.js 16 warning while keeping webpack config for compatibility
  turbopack: {},

  // Webpack config (used when --webpack flag is passed)
  webpack: (config, { isServer }) => {
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

    // Exclude test files
    config.module.rules.forEach((rule) => {
      if (rule.test && rule.test.toString().includes('tsx')) {
        if (rule.exclude) {
          rule.exclude = Array.isArray(rule.exclude) ? rule.exclude : [rule.exclude];
          rule.exclude.push(/\.stories\.tsx?$/);
          rule.exclude.push(/\.test\.tsx?$/);
        } else {
          rule.exclude = [/\.stories\.tsx?$/, /\.test\.tsx?$/];
        }
      }
    });

    return config;
  },
};

module.exports = nextConfig;
