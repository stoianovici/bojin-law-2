'use client';

import { useState, useEffect, useCallback } from 'react';

export type GatewayMode = 'local' | 'production';

// In production builds, always use production gateway
const IS_PRODUCTION_BUILD = process.env.NODE_ENV === 'production';

// Gateway URLs for different modes
const GATEWAY_URLS: Record<GatewayMode, string> = {
  local: 'http://localhost:4000/graphql',
  production: 'https://legal-platform-gateway.onrender.com/graphql',
};

const STORAGE_KEY = 'gateway-mode';

export function useGateway() {
  // In production, always use production mode
  const [mode, setModeState] = useState<GatewayMode>(IS_PRODUCTION_BUILD ? 'production' : 'local');
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount (only in development)
  useEffect(() => {
    // In production, always force production mode
    if (IS_PRODUCTION_BUILD) {
      setModeState('production');
      setIsHydrated(true);
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY) as GatewayMode | null;
    if (stored && (stored === 'local' || stored === 'production')) {
      setModeState(stored);
    } else {
      // Migrate old modes to new defaults
      const legacyMode = localStorage.getItem(STORAGE_KEY);
      if (legacyMode === 'seed' || legacyMode === 'real') {
        localStorage.setItem(STORAGE_KEY, 'local');
        setModeState('local');
      }
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
    const nextMode = mode === 'local' ? 'production' : 'local';
    setMode(nextMode);
  }, [mode, setMode]);

  return {
    mode,
    url: GATEWAY_URLS[mode],
    isHydrated,
    setMode,
    toggleMode,
    isLocal: mode === 'local',
    isProduction: mode === 'production',
  };
}

/**
 * Get the current gateway URL (for use outside React components)
 */
export function getGatewayUrl(): string {
  // In production, always use production gateway
  if (IS_PRODUCTION_BUILD) {
    return GATEWAY_URLS.production;
  }
  if (typeof window === 'undefined') {
    return GATEWAY_URLS.local;
  }
  const stored = localStorage.getItem(STORAGE_KEY) as GatewayMode | null;
  if (stored && (stored === 'local' || stored === 'production')) {
    return GATEWAY_URLS[stored];
  }
  return GATEWAY_URLS.local;
}

/**
 * Get the current gateway mode (for use outside React components)
 */
export function getGatewayMode(): GatewayMode {
  // In production, always use production mode
  if (IS_PRODUCTION_BUILD) {
    return 'production';
  }
  if (typeof window === 'undefined') {
    return 'local';
  }
  const stored = localStorage.getItem(STORAGE_KEY) as GatewayMode | null;
  if (stored && (stored === 'local' || stored === 'production')) {
    return stored;
  }
  return 'local';
}
