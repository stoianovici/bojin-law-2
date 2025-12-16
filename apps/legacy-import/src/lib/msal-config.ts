/**
 * MSAL Configuration for Legacy Import App
 * Standalone Azure AD authentication for independent deployment
 */

import type { Configuration } from '@azure/msal-browser';
import { LogLevel, PublicClientApplication } from '@azure/msal-browser';

/**
 * MSAL configuration for browser-based authentication
 * Uses the same Azure AD app registration as the main app
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID || 'common'}`,
    redirectUri:
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : process.env.NEXT_PUBLIC_REDIRECT_URI || 'http://localhost:3001/auth/callback',
    postLogoutRedirectUri:
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001',
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage', // More secure than localStorage
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
            if (process.env.NODE_ENV === 'development') {
              console.info('[MSAL]', message);
            }
            break;
          case LogLevel.Verbose:
            if (process.env.NODE_ENV === 'development') {
              console.debug('[MSAL]', message);
            }
            break;
        }
      },
      logLevel: process.env.NODE_ENV === 'development' ? LogLevel.Info : LogLevel.Warning,
    },
  },
};

/**
 * Scopes required for the application
 * - openid: Required for authentication
 * - profile: Access to user profile info
 * - email: Access to user email
 * - User.Read: Read user profile from Microsoft Graph
 */
export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};

/**
 * Microsoft Graph API scopes for OneDrive access
 * Used when exporting documents to OneDrive
 */
export const graphScopes = {
  scopes: ['Files.ReadWrite.All', 'Sites.ReadWrite.All'],
};

/**
 * Create and initialize MSAL instance
 * Only creates instance on client-side
 */
let msalInstance: PublicClientApplication | null = null;

export function getMsalInstance(): PublicClientApplication | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
  }

  return msalInstance;
}

/**
 * Initialize MSAL instance asynchronously
 * Must be called before using MSAL methods
 */
export async function initializeMsal(): Promise<PublicClientApplication | null> {
  const instance = getMsalInstance();
  if (instance) {
    await instance.initialize();
  }
  return instance;
}
