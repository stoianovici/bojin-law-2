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
    cacheLocation: 'sessionStorage',
    // Enable cookie fallback to prevent auth state loss during redirect
    // This is critical for production where sessionStorage may be cleared
    storeAuthStateInCookie: true,
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
    console.log('[MSAL] Instance initialized');
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
    console.log(
      '[MSAL] Returning cached redirect result:',
      redirectPromiseResult ? 'success' : 'null'
    );
    return redirectPromiseResult;
  }

  const instance = await initializeMsal();
  if (!instance) {
    return null;
  }

  // Log URL hash for debugging (without sensitive data)
  const hasHash = window.location.hash.length > 1;
  const hasCode =
    window.location.hash.includes('code=') || window.location.search.includes('code=');
  console.log('[MSAL] Processing redirect promise, hasHash:', hasHash, 'hasCode:', hasCode);

  try {
    redirectPromiseResult = await instance.handleRedirectPromise();
    redirectPromiseProcessed = true;

    if (redirectPromiseResult) {
      console.log(
        '[MSAL] Redirect promise returned account:',
        redirectPromiseResult.account?.username
      );
    } else {
      console.log('[MSAL] Redirect promise returned null');
    }

    return redirectPromiseResult;
  } catch (error) {
    console.error('[MSAL] Error handling redirect promise:', error);
    redirectPromiseProcessed = true;
    return null;
  }
}
