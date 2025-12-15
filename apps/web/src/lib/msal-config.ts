/**
 * MSAL Configuration for Legal Platform Web App
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
        : process.env.NEXT_PUBLIC_REDIRECT_URI || 'http://localhost:3000/auth/callback',
    postLogoutRedirectUri:
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    navigateToLoginRequestUrl: true,
  },
  cache: {
    // Use localStorage for persistent login across browser sessions
    // sessionStorage is cleared when browser closes, causing re-login prompts
    cacheLocation: 'localStorage',
    // Enable cookie fallback to prevent auth state loss during redirect
    // This is critical for production where sessionStorage may be cleared
    storeAuthStateInCookie: true,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        // Only log errors and warnings to reduce console noise
        if (level === LogLevel.Error) {
          console.error('[MSAL]', message);
        } else if (level === LogLevel.Warning) {
          console.warn('[MSAL]', message);
        }
      },
      logLevel: LogLevel.Warning,
    },
  },
};

/**
 * Scopes required for the application
 * Includes Mail.Read for email sync functionality (Story 5.1)
 * Note: Mail.Read and Mail.ReadBasic require admin consent for organizational accounts.
 * If admin has pre-granted consent in Azure AD, user won't be prompted.
 */
export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read', 'Mail.Read', 'Mail.ReadBasic'],
  // Don't force consent prompt - use pre-granted admin consent
  prompt: 'select_account' as const,
};

/**
 * Microsoft Graph API scopes
 */
export const graphScopes = {
  scopes: ['Files.ReadWrite.All', 'Sites.ReadWrite.All', 'Mail.Read'],
};

/**
 * Create and initialize MSAL instance
 */
let msalInstance: PublicClientApplication | null = null;
let msalInitialized = false;
let redirectPromiseResult: Awaited<
  ReturnType<PublicClientApplication['handleRedirectPromise']>
> | null = null;
let redirectPromiseProcessed = false;

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
 * Handle redirect promise with singleton pattern
 * This ensures the redirect result is only processed once
 */
export async function handleMsalRedirect(): Promise<Awaited<
  ReturnType<PublicClientApplication['handleRedirectPromise']>
> | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  // Return cached result if already processed
  if (redirectPromiseProcessed) {
    return redirectPromiseResult;
  }

  const instance = await initializeMsal();
  if (!instance) {
    return null;
  }

  try {
    redirectPromiseResult = await instance.handleRedirectPromise();
    redirectPromiseProcessed = true;
    return redirectPromiseResult;
  } catch (error) {
    console.error('[MSAL] Error handling redirect promise:', error);
    redirectPromiseProcessed = true;
    return null;
  }
}
