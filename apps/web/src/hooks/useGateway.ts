'use client';

import { useState, useEffect, useCallback } from 'react';

export type GatewayMode = 'seed' | 'real' | 'production';

// Gateway URLs for different modes
const GATEWAY_URLS: Record<GatewayMode, string> = {
  seed: 'http://localhost:4000/graphql',
  real: 'http://localhost:4001/graphql',
  production: 'https://legal-platform-gateway.onrender.com/graphql',
};

const STORAGE_KEY = 'gateway-mode';

export function useGateway() {
  const [mode, setModeState] = useState<GatewayMode>('seed');
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as GatewayMode | null;
    if (stored && (stored === 'seed' || stored === 'real' || stored === 'production')) {
      setModeState(stored);
    }
    setIsHydrated(true);
  }, []);

  const setMode = useCallback((newMode: GatewayMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
    // Clear auth storage to force re-login with correct user context
    sessionStorage.removeItem('auth-storage');
    // Reload the page to reinitialize Apollo client with new URL
    window.location.reload();
  }, []);

  const toggleMode = useCallback(() => {
    // Cycle through modes: seed -> real -> production -> seed
    const nextMode = mode === 'seed' ? 'real' : mode === 'real' ? 'production' : 'seed';
    setMode(nextMode);
  }, [mode, setMode]);

  return {
    mode,
    url: GATEWAY_URLS[mode],
    isHydrated,
    setMode,
    toggleMode,
    isSeed: mode === 'seed',
    isReal: mode === 'real',
    isProduction: mode === 'production',
  };
}

/**
 * Get the current gateway URL (for use outside React components)
 */
export function getGatewayUrl(): string {
  if (typeof window === 'undefined') {
    return GATEWAY_URLS.seed;
  }
  const stored = localStorage.getItem(STORAGE_KEY) as GatewayMode | null;
  if (stored && (stored === 'seed' || stored === 'real' || stored === 'production')) {
    return GATEWAY_URLS[stored];
  }
  return GATEWAY_URLS.seed;
}

/**
 * Get the current gateway mode (for use outside React components)
 */
export function getGatewayMode(): GatewayMode {
  if (typeof window === 'undefined') {
    return 'seed';
  }
  const stored = localStorage.getItem(STORAGE_KEY) as GatewayMode | null;
  if (stored && (stored === 'seed' || stored === 'real' || stored === 'production')) {
    return stored;
  }
  return 'seed';
}
