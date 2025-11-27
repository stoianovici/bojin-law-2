/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@legal-platform/ui', '@legal-platform/types', '@legal-platform/database'],
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['@legal-platform/ui'],
    serverComponentsExternalPackages: ['pst-extractor', 'bull'],
  },
  turbopack: {},

  // Webpack config for backwards compatibility
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
