'use client';

// Simple gateway config - no toggle, no complexity
// Dev = local, Prod = production

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const GATEWAY_URL = IS_PRODUCTION
  ? 'https://legal-platform-gateway.onrender.com/graphql'
  : 'http://localhost:4000/graphql';

export function useGateway() {
  return {
    url: GATEWAY_URL,
    isLocal: !IS_PRODUCTION,
  };
}

export function getGatewayUrl(): string {
  return GATEWAY_URL;
}

export function getGatewayMode(): 'local' | 'production' {
  return IS_PRODUCTION ? 'production' : 'local';
}

// For backwards compatibility
export type GatewayMode = 'local' | 'production';
