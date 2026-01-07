const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployments
  // output: 'standalone', // Disabled for local dev

  // Proxy GraphQL requests to gateway (avoids CORS in development)
  async rewrites() {
    const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/graphql',
        destination: `${gatewayUrl}/graphql`,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
