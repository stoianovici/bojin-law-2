/**
 * MSAL Configuration for Web V2
 * Azure AD authentication for browser-based SSO
 */

import type { Configuration } from '@azure/msal-browser';
import { LogLevel, PublicClientApplication } from '@azure/msal-browser';

/**
 * MSAL configuration for browser-based authentication
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID || 'common'}`,
    redirectUri:
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : 'http://localhost:3001/auth/callback',
    postLogoutRedirectUri:
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001',
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: true,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (!containsPii && level === LogLevel.Error) {
          console.error('[MSAL]', message);
        }
      },
      logLevel: LogLevel.Error,
    },
  },
};

/**
 * Scopes required for the application
 */
export const loginRequest = {
  scopes: [
    'openid',
    'profile',
    'email',
    'User.Read',
    'Mail.Read',
    'Mail.ReadBasic',
    'Mail.ReadWrite',
    'Mail.Send',
  ],
  prompt: 'select_account' as const,
};

/**
 * Microsoft Graph API scopes (flat array for consistency)
 */
export const graphScopes = [
  'User.Read',
  'User.ReadBasic.All',
  'Files.ReadWrite.All',
  'Sites.ReadWrite.All',
];

/**
 * Mail-related scopes for Microsoft Graph
 */
export const mailScopes = ['Mail.Read', 'Mail.Send', 'Mail.ReadWrite'];

/**
 * Custom API scopes (for future backend API integration)
 */
export const apiScopes: string[] = [
  // Add custom API scopes here, e.g.:
  // 'api://<client-id>/access_as_user',
];

/**
 * Consent request for re-consent flow with all scopes combined
 * Used when requesting additional permissions or refreshing consent
 */
export const consentRequest = {
  scopes: ['openid', 'profile', 'email', ...graphScopes, ...mailScopes, ...apiScopes],
  prompt: 'consent' as const,
};

// MSAL instance singleton
let msalInstance: PublicClientApplication | null = null;
let msalInitialized = false;

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
 */
export async function initializeMsal(): Promise<PublicClientApplication | null> {
  const instance = getMsalInstance();
  if (instance && !msalInitialized) {
    await instance.initialize();
    msalInitialized = true;
  }
  return instance;
}

/**
 * Handle redirect promise
 */
export async function handleMsalRedirect() {
  if (typeof window === 'undefined') {
    return null;
  }

  const instance = await initializeMsal();
  if (!instance) {
    return null;
  }

  try {
    return await instance.handleRedirectPromise();
  } catch (error) {
    console.error('[MSAL] Error handling redirect:', error);
    return null;
  }
}
