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

async function sendToParent(message: object): Promise<void> {
  const messageStr = JSON.stringify(message);
  console.log('[Auth Dialog] Sending to parent:', message);

  // Wait a moment for Office to fully initialize after redirect
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Try Office.context.ui.messageParent first (Office dialog)
  if (typeof Office !== 'undefined' && Office.context?.ui?.messageParent) {
    console.log('[Auth Dialog] Using Office.context.ui.messageParent');
    try {
      // Use targetOrigin for cross-domain messaging after redirect
      // This is required when the dialog navigated away (to Azure AD) and back
      // Dialog Origin 1.1 requirement set enables this
      const targetOrigin = window.location.origin;
      console.log('[Auth Dialog] Using targetOrigin:', targetOrigin);
      Office.context.ui.messageParent(messageStr, { targetOrigin });
      console.log('[Auth Dialog] messageParent called successfully with targetOrigin');
      return;
    } catch (e) {
      console.error('[Auth Dialog] messageParent failed:', e);
      // Fall through to try other methods
    }
  }

  // Fallback: try window.opener.postMessage (for popup windows)
  if (window.opener && !window.opener.closed) {
    console.log('[Auth Dialog] Using window.opener.postMessage');
    window.opener.postMessage({ type: 'auth-result', ...message }, window.location.origin);
    window.close();
    return;
  }

  // Try BroadcastChannel (works across same-origin iframes)
  if (typeof BroadcastChannel !== 'undefined') {
    console.log('[Auth Dialog] Using BroadcastChannel');
    const channel = new BroadcastChannel('auth-channel');
    channel.postMessage(message);
    channel.close();
  }

  // Also store in localStorage as backup
  console.log('[Auth Dialog] Storing in localStorage');
  localStorage.setItem('auth-dialog-result', messageStr);

  document.body.innerHTML = `
    <div style="text-align: center; padding: 2rem; font-family: sans-serif;">
      <h2>Authentication Complete</h2>
      <p>You can close this window now.</p>
    </div>
  `;
}

async function handleSuccess(result: AuthenticationResult): Promise<void> {
  console.log('[Auth Dialog] Success');
  await sendToParent({
    success: true,
    accessToken: result.accessToken,
    account: {
      username: result.account?.username,
      name: result.account?.name,
    },
  });
}

async function handleError(error: Error): Promise<void> {
  console.error('[Auth Dialog] Error:', error);
  await sendToParent({
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
    console.log('[Auth Dialog] Current URL:', window.location.href);
    console.log('[Auth Dialog] Has opener:', !!window.opener);

    await msalInstance.initialize();

    // Check if we're the popup window returning with an auth code
    // The URL will have #code= if we're the popup returning from Azure AD
    const hasAuthCode = window.location.hash.includes('code=');
    console.log('[Auth Dialog] Has auth code in URL:', hasAuthCode);

    // Check if returning from redirect (this handles the auth code in URL)
    const redirectResult = await msalInstance.handleRedirectPromise();
    if (redirectResult) {
      console.log(
        '[Auth Dialog] Handling redirect result, account:',
        redirectResult.account?.username
      );
      await handleSuccess(redirectResult);
      return;
    }

    // If we have an auth code but handleRedirectPromise didn't process it,
    // we might be the popup. Try to notify opener and close.
    if (hasAuthCode && window.opener) {
      console.log('[Auth Dialog] Popup with code, notifying opener');
      // The code is in the hash, MSAL in the parent should handle it
      // Just close this popup - MSAL monitors for the redirect
      window.close();
      return;
    }

    // Check for existing session
    const accounts = msalInstance.getAllAccounts();
    console.log('[Auth Dialog] Existing accounts:', accounts.length);
    if (accounts.length > 0) {
      try {
        const silentResult = await msalInstance.acquireTokenSilent({
          scopes: loginScopes,
          account: accounts[0],
        });
        console.log('[Auth Dialog] Silent auth succeeded');
        await handleSuccess(silentResult);
        return;
      } catch (e) {
        if (!(e instanceof InteractionRequiredAuthError)) throw e;
        console.log('[Auth Dialog] Silent auth failed, need interactive');
      }
    }

    // Interactive login via REDIRECT
    // Redirects to auth-redirect.html which sends the code back to taskpane
    console.log('[Auth Dialog] Starting redirect login...');
    await msalInstance.loginRedirect({
      scopes: loginScopes,
      prompt: 'select_account',
    });
    // Code after loginRedirect won't execute - page navigates away
  } catch (error) {
    await handleError(error as Error);
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
