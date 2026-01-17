/**
 * MSAL Configuration for Word Add-in
 */

import { Configuration, LogLevel } from '@azure/msal-browser';

// ============================================================================
// Environment
// ============================================================================

const clientId = import.meta.env.VITE_AZURE_AD_CLIENT_ID || '';
const tenantId = import.meta.env.VITE_AZURE_AD_TENANT_ID || '';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://localhost:4000';

// Determine redirect URI based on current page
function getRedirectUri(): string {
  if (typeof window !== 'undefined' && window.location.pathname.includes('auth-dialog')) {
    // Auth dialog redirects back to itself
    return import.meta.env.DEV
      ? 'https://localhost:3005/auth-dialog.html'
      : `${apiBaseUrl}/word-addin/auth-dialog.html`;
  }
  // Default to taskpane
  return import.meta.env.DEV
    ? 'https://localhost:3005/taskpane.html'
    : `${apiBaseUrl}/word-addin/taskpane.html`;
}

const redirectUri = getRedirectUri();

// ============================================================================
// MSAL Configuration
// ============================================================================

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: true, // Required for popup/redirect flows in iframes
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (level === LogLevel.Error) console.error('[MSAL]', message);
        else if (level === LogLevel.Warning) console.warn('[MSAL]', message);
        else if (import.meta.env.DEV) console.log('[MSAL]', message);
      },
      logLevel: import.meta.env.DEV ? LogLevel.Info : LogLevel.Warning,
    },
  },
};

// ============================================================================
// Scopes
// ============================================================================

export const loginScopes = ['openid', 'profile', 'email', 'User.Read'];

// ============================================================================
// Exports
// ============================================================================

export const authConfig = {
  clientId,
  tenantId,
  redirectUri,
  apiBaseUrl,
};
