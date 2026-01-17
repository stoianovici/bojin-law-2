/**
 * Auth Popup - Browser popup for MSAL authentication
 *
 * This runs in a regular browser popup (not Office dialog).
 * After authentication, stores token on server for taskpane to poll.
 *
 * Flow:
 * 1. Taskpane opens this popup with ?sessionId=xxx
 * 2. This popup redirects to Azure AD
 * 3. Azure AD redirects back here with auth code
 * 4. MSAL exchanges code for token
 * 5. We POST the token to server
 * 6. Taskpane polls server and gets the token
 */

import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalConfig, loginScopes, authConfig } from '../services/msal-config';

const msalInstance = new PublicClientApplication(msalConfig);

// Get session ID from URL
function getSessionId(): string | null {
  const params = new URLSearchParams(window.location.search);
  // Also check hash for when returning from redirect
  const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
  return (
    params.get('sessionId') || hashParams.get('state') || localStorage.getItem('auth_session_id')
  );
}

// Use current origin for API calls when on bojin-law.com domains (dev or prod)
const API_BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin.includes('bojin-law.com')) {
      return origin;
    }
  }
  return authConfig.apiBaseUrl;
})();

// ============================================================================
// Server Token Storage
// ============================================================================

async function storeTokenOnServer(
  sessionId: string,
  accessToken: string,
  account: { username?: string; name?: string }
): Promise<boolean> {
  const storeUrl = `${API_BASE_URL}/api/word-addin/auth/store`;
  console.log('[Auth Popup] Storing token on server...');
  console.log('[Auth Popup] - API Base URL:', API_BASE_URL);
  console.log('[Auth Popup] - Store URL:', storeUrl);
  console.log('[Auth Popup] - Session ID:', sessionId);
  console.log('[Auth Popup] - Token length:', accessToken?.length || 0);
  console.log('[Auth Popup] - Account:', JSON.stringify(account));

  try {
    const response = await fetch(storeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, accessToken, account }),
    });

    console.log('[Auth Popup] Store response status:', response.status);
    const data = await response.json();
    console.log('[Auth Popup] Store response data:', JSON.stringify(data));

    if (!response.ok) {
      console.error('[Auth Popup] Server store failed:', data);
      return false;
    }

    console.log('[Auth Popup] Token stored on server successfully');
    return true;
  } catch (error) {
    console.error('[Auth Popup] Server store error:', error);
    console.error('[Auth Popup] Error details:', (error as Error).message);
    return false;
  }
}

// ============================================================================
// UI
// ============================================================================

function showSuccess(): void {
  document.body.innerHTML = `
    <div style="text-align: center; padding: 2rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="width: 48px; height: 48px; background: #107c10; border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      </div>
      <h2 style="margin: 0 0 0.5rem; color: #323130;">Authentication Complete</h2>
      <p style="margin: 0; color: #605e5c;">You can close this window now.</p>
    </div>
  `;
  // Auto-close after 2 seconds
  setTimeout(() => window.close(), 2000);
}

function showError(message: string): void {
  document.body.innerHTML = `
    <div style="text-align: center; padding: 2rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="width: 48px; height: 48px; background: #a80000; border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </div>
      <h2 style="margin: 0 0 0.5rem; color: #323130;">Authentication Failed</h2>
      <p style="margin: 0; color: #605e5c;">${message}</p>
    </div>
  `;
}

function showLoading(message: string): void {
  document.body.innerHTML = `
    <div style="text-align: center; padding: 2rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="width: 40px; height: 40px; border: 3px solid #e0e0e0; border-top-color: #0078d4; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
      <p style="margin: 0; color: #605e5c;">${message}</p>
    </div>
    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  `;
}

// ============================================================================
// Auth Flow
// ============================================================================

async function handleAuth(): Promise<void> {
  try {
    console.log('[Auth Popup] ========================================');
    console.log('[Auth Popup] Starting auth flow...');
    console.log('[Auth Popup] URL:', window.location.href);
    console.log('[Auth Popup] Origin:', window.location.origin);
    console.log('[Auth Popup] Pathname:', window.location.pathname);
    console.log('[Auth Popup] Search:', window.location.search);
    console.log('[Auth Popup] Hash:', window.location.hash);

    let sessionId = getSessionId();
    console.log('[Auth Popup] Initial sessionId from getSessionId():', sessionId);
    console.log(
      '[Auth Popup] localStorage auth_session_id:',
      localStorage.getItem('auth_session_id')
    );

    // Store sessionId for after redirect
    if (sessionId) {
      console.log('[Auth Popup] Storing sessionId in localStorage');
      localStorage.setItem('auth_session_id', sessionId);
    } else {
      sessionId = localStorage.getItem('auth_session_id');
      console.log('[Auth Popup] Retrieved sessionId from localStorage:', sessionId);
    }

    if (!sessionId) {
      console.error('[Auth Popup] No sessionId found anywhere!');
      showError('Missing session ID. Please close and try again.');
      return;
    }

    console.log('[Auth Popup] Using sessionId:', sessionId);
    showLoading('Signing in...');

    console.log('[Auth Popup] Initializing MSAL...');
    await msalInstance.initialize();
    console.log('[Auth Popup] MSAL initialized');

    // Check if returning from Azure AD redirect
    console.log('[Auth Popup] Calling handleRedirectPromise...');
    const result = await msalInstance.handleRedirectPromise();
    console.log('[Auth Popup] handleRedirectPromise result:', result ? 'GOT TOKEN' : 'null');

    if (result) {
      console.log('[Auth Popup] Got token from redirect!');
      console.log('[Auth Popup] - Account:', result.account?.username);
      console.log('[Auth Popup] - Token type:', result.tokenType);
      console.log('[Auth Popup] - Token length:', result.accessToken?.length);
      localStorage.removeItem('auth_session_id');

      console.log('[Auth Popup] Calling storeTokenOnServer...');
      const success = await storeTokenOnServer(sessionId, result.accessToken, {
        username: result.account?.username,
        name: result.account?.name,
      });
      console.log('[Auth Popup] storeTokenOnServer result:', success);

      if (success) {
        showSuccess();
      } else {
        showError('Failed to complete authentication.');
      }
      return;
    }

    // Try silent auth first
    const accounts = msalInstance.getAllAccounts();
    console.log('[Auth Popup] Existing accounts:', accounts.length);
    if (accounts.length > 0) {
      try {
        console.log('[Auth Popup] Trying silent auth...');
        const silentResult = await msalInstance.acquireTokenSilent({
          scopes: loginScopes,
          account: accounts[0],
        });
        console.log('[Auth Popup] Silent auth succeeded!');

        localStorage.removeItem('auth_session_id');
        const success = await storeTokenOnServer(sessionId, silentResult.accessToken, {
          username: silentResult.account?.username,
          name: silentResult.account?.name,
        });

        if (success) {
          showSuccess();
          return;
        }
      } catch (e) {
        if (!(e instanceof InteractionRequiredAuthError)) throw e;
        console.log('[Auth Popup] Silent auth failed, need interactive');
      }
    }

    // Start interactive login via redirect
    console.log('[Auth Popup] Starting redirect login...');
    console.log('[Auth Popup] Redirect URI:', msalConfig.auth.redirectUri);
    showLoading('Redirecting to Microsoft sign-in...');

    await msalInstance.loginRedirect({
      scopes: loginScopes,
      prompt: 'select_account',
    });
    // Page navigates away
  } catch (error) {
    console.error('[Auth Popup] Error:', error);
    console.error('[Auth Popup] Error stack:', (error as Error).stack);
    showError((error as Error).message);
  }
}

// ============================================================================
// Initialize
// ============================================================================

handleAuth();
