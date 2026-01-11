/**
 * Auth Dialog Entry Point
 *
 * Runs inside Office dialog, handles MSAL authentication,
 * sends tokens back to parent via messageParent.
 */

import {
  PublicClientApplication,
  AuthenticationResult,
  InteractionRequiredAuthError,
} from '@azure/msal-browser';
import { msalConfig, loginScopes } from '../services/msal-config';

const msalInstance = new PublicClientApplication(msalConfig);

// ============================================================================
// Message Handling
// ============================================================================

function sendToParent(message: object): void {
  const messageStr = JSON.stringify(message);
  console.log('[Auth Dialog] Sending to parent:', message);

  if (typeof Office !== 'undefined' && Office.context?.ui?.messageParent) {
    Office.context.ui.messageParent(messageStr);
  } else {
    console.error('[Auth Dialog] No way to communicate with parent');
    document.body.innerHTML = `
      <div style="text-align: center; padding: 2rem; font-family: sans-serif;">
        <h2>Authentication Complete</h2>
        <p>Please close this window and try again.</p>
      </div>
    `;
  }
}

function handleSuccess(result: AuthenticationResult): void {
  console.log('[Auth Dialog] Success');
  sendToParent({
    success: true,
    accessToken: result.accessToken,
    account: {
      username: result.account?.username,
      name: result.account?.name,
    },
  });
}

function handleError(error: Error): void {
  console.error('[Auth Dialog] Error:', error);
  sendToParent({
    success: false,
    error: error.name,
    errorMessage: error.message,
  });
}

// ============================================================================
// Login Flow
// ============================================================================

async function login(): Promise<void> {
  try {
    console.log('[Auth Dialog] Starting login...');
    await msalInstance.initialize();

    // Check if returning from redirect
    const redirectResult = await msalInstance.handleRedirectPromise();
    if (redirectResult) {
      console.log('[Auth Dialog] Handling redirect result');
      handleSuccess(redirectResult);
      return;
    }

    // Check for existing session
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      try {
        const silentResult = await msalInstance.acquireTokenSilent({
          scopes: loginScopes,
          account: accounts[0],
        });
        handleSuccess(silentResult);
        return;
      } catch (e) {
        if (!(e instanceof InteractionRequiredAuthError)) throw e;
        console.log('[Auth Dialog] Silent auth failed, need interactive');
      }
    }

    // Interactive login via popup (redirect doesn't work in Office dialog)
    console.log('[Auth Dialog] Starting interactive login...');
    const result = await msalInstance.loginPopup({
      scopes: loginScopes,
      prompt: 'select_account',
    });
    handleSuccess(result);
  } catch (error) {
    handleError(error as Error);
  }
}

// ============================================================================
// Initialize
// ============================================================================

if (typeof Office !== 'undefined') {
  Office.onReady(() => login());
} else {
  login();
}
