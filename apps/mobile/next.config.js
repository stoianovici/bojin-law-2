/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker/Coolify deployments
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,

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

module.exports = nextConfig;
