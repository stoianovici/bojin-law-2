/**
 * Auth Dialog Entry Point
 *
 * This page runs inside the Office dialog and handles MSAL authentication.
 * After successful auth, it sends the tokens back to the parent via messageParent.
 */

import {
  PublicClientApplication,
  AuthenticationResult,
  InteractionRequiredAuthError,
} from '@azure/msal-browser';
import { msalConfig, loginScopes } from '../services/msal-config';

// Initialize MSAL
const msalInstance = new PublicClientApplication(msalConfig);

/**
 * Send message back to parent Office add-in
 */
function sendMessageToParent(message: object): void {
  const messageStr = JSON.stringify(message);
  console.log('[Auth Dialog] Sending message to parent:', messageStr);

  // Office.context.ui.messageParent is available in the dialog
  if (typeof Office !== 'undefined' && Office.context?.ui?.messageParent) {
    Office.context.ui.messageParent(messageStr);
  } else {
    console.error('[Auth Dialog] Office.context.ui.messageParent not available');
    // Fallback: try window.opener.postMessage
    if (window.opener) {
      window.opener.postMessage(message, '*');
    }
  }
}

/**
 * Handle successful authentication
 */
function handleAuthSuccess(result: AuthenticationResult): void {
  console.log('[Auth Dialog] Authentication successful');

  sendMessageToParent({
    success: true,
    accessToken: result.accessToken,
    idToken: result.idToken,
    account: {
      username: result.account?.username,
      name: result.account?.name,
      localAccountId: result.account?.localAccountId,
    },
    expiresOn: result.expiresOn?.toISOString(),
  });
}

/**
 * Handle authentication error
 */
function handleAuthError(error: Error): void {
  console.error('[Auth Dialog] Authentication failed:', error);

  sendMessageToParent({
    success: false,
    error: error.name,
    errorMessage: error.message,
  });
}

/**
 * Perform login
 */
async function login(): Promise<void> {
  try {
    console.log('[Auth Dialog] Starting MSAL login...');

    // Initialize MSAL
    await msalInstance.initialize();
    console.log('[Auth Dialog] MSAL initialized');

    // Handle redirect response (if coming back from Microsoft login)
    const response = await msalInstance.handleRedirectPromise();
    console.log(
      '[Auth Dialog] handleRedirectPromise result:',
      response ? 'got response' : 'no response'
    );

    if (response) {
      // We got a response from redirect - auth succeeded
      handleAuthSuccess(response);
      return;
    }

    // Check if user is already signed in
    const accounts = msalInstance.getAllAccounts();
    console.log('[Auth Dialog] Existing accounts:', accounts.length);

    if (accounts.length > 0) {
      // Try silent token acquisition first
      try {
        const silentResult = await msalInstance.acquireTokenSilent({
          scopes: loginScopes,
          account: accounts[0],
        });
        handleAuthSuccess(silentResult);
        return;
      } catch (silentError) {
        if (!(silentError instanceof InteractionRequiredAuthError)) {
          throw silentError;
        }
        // Fall through to interactive login
        console.log('[Auth Dialog] Silent auth failed, proceeding to interactive login');
      }
    }

    // Perform interactive login via redirect
    console.log('[Auth Dialog] Initiating redirect login...');
    await msalInstance.loginRedirect({
      scopes: loginScopes,
      prompt: 'select_account',
    });

    // Note: The page will redirect, so we won't reach here until we come back
  } catch (error) {
    handleAuthError(error as Error);
  }
}

/**
 * Initialize when Office is ready
 */
function initialize(): void {
  console.log('[Auth Dialog] Initializing...');

  // Check if we're in the Office context
  if (typeof Office !== 'undefined') {
    Office.onReady((info) => {
      console.log('[Auth Dialog] Office.onReady:', info);
      login();
    });
  } else {
    // Office.js not loaded - might be standalone browser for testing
    console.log('[Auth Dialog] Office.js not detected, starting login directly');
    login();
  }
}

// Start initialization
initialize();
