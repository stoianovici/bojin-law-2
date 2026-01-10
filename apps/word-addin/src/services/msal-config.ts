/**
 * MSAL Configuration for Word Add-in
 * Uses @azure/msal-browser for Office Add-in authentication
 */

import { Configuration, LogLevel } from '@azure/msal-browser';

// Environment configuration
const clientId = import.meta.env.VITE_AZURE_AD_CLIENT_ID || '';
const tenantId = import.meta.env.VITE_AZURE_AD_TENANT_ID || '';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://localhost:4000';

// Redirect URI for the auth dialog
const redirectUri = import.meta.env.DEV
  ? 'https://localhost:3005/auth-dialog.html'
  : `${apiBaseUrl}/word-addin/auth-dialog.html`;

/**
 * MSAL Configuration
 */
export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    postLogoutRedirectUri: redirectUri,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error('[MSAL]', message);
            break;
          case LogLevel.Warning:
            console.warn('[MSAL]', message);
            break;
          case LogLevel.Info:
            console.info('[MSAL]', message);
            break;
          case LogLevel.Verbose:
            console.debug('[MSAL]', message);
            break;
        }
      },
      logLevel: import.meta.env.DEV ? LogLevel.Verbose : LogLevel.Warning,
    },
  },
};

/**
 * Scopes to request during login
 */
export const loginScopes = ['openid', 'profile', 'email', 'User.Read'];

/**
 * Export configuration values for use in other modules
 */
export const authConfig = {
  clientId,
  tenantId,
  redirectUri,
  apiBaseUrl,
};
