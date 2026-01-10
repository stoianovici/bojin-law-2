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
 * Send message back to parent Office add-in and close this dialog
 */
function sendMessageToParent(message: object): void {
  const messageStr = JSON.stringify(message);
  console.log('[Auth Dialog] Sending message to parent:', messageStr);

  // Office.context.ui.messageParent is available in the dialog
  if (typeof Office !== 'undefined' && Office.context?.ui?.messageParent) {
    Office.context.ui.messageParent(messageStr);
    // Office will close the dialog automatically
  } else if (window.opener) {
    // Fallback: we were opened via window.open
    console.log('[Auth Dialog] Using window.opener.postMessage');
    // Use '*' for origin since cross-origin access to opener.location throws
    const targetOrigin = '*';
    window.opener.postMessage(message, targetOrigin);
    // Close this popup window
    window.close();
  } else {
    console.error('[Auth Dialog] No way to communicate with parent!');
    // Display error to user
    document.body.innerHTML = `
      <div style="text-align: center; padding: 2rem; font-family: sans-serif;">
        <h2>Authentication Complete</h2>
        <p>Please close this window and try again.</p>
      </div>
    `;
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
 * Uses loginRedirect to stay in the same window (Office dialog)
 * This preserves Office.context.ui.messageParent availability
 */
async function login(): Promise<void> {
  try {
    console.log('[Auth Dialog] Starting MSAL login...');

    // Initialize MSAL
    await msalInstance.initialize();
    console.log('[Auth Dialog] MSAL initialized');

    // FIRST: Check if we're returning from a redirect
    // This happens when Microsoft login redirects back to this page
    const redirectResult = await msalInstance.handleRedirectPromise();
    if (redirectResult) {
      console.log('[Auth Dialog] Redirect response received');
      handleAuthSuccess(redirectResult);
      return;
    }
    console.log('[Auth Dialog] No redirect response, checking accounts...');

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

    // Perform interactive login via redirect (NOT popup)
    // This keeps us in the same window so Office.context.ui.messageParent stays available
    console.log('[Auth Dialog] Initiating redirect login...');
    await msalInstance.loginRedirect({
      scopes: loginScopes,
      prompt: 'select_account',
    });
    // Page will navigate away - when it comes back, handleRedirectPromise above will catch it
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
