/**
 * Word Add-in Task Pane Entry Point
 * Story 3.4: Word Integration with Live AI Assistance
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { PublicClientApplication } from '@azure/msal-browser';
import { TaskPane } from './TaskPane';
import '../styles/taskpane.css';

// ============================================================================
// MSAL Popup Handler
// ============================================================================

// Check if this is a popup window redirected from MSAL auth
const isPopupWindow = window.opener && window.opener !== window;
const hasAuthCode = window.location.hash.includes('code=');

if (isPopupWindow && hasAuthCode) {
  console.log('[Word Add-in] Popup auth redirect detected, handling...');

  // Initialize MSAL to handle the redirect
  const clientId = import.meta.env.VITE_AZURE_AD_CLIENT_ID || '';
  const tenantId = import.meta.env.VITE_AZURE_AD_TENANT_ID || '';

  const msal = new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri: window.location.origin + '/word-addin/taskpane.html',
    },
    cache: { cacheLocation: 'sessionStorage' },
  });

  msal
    .initialize()
    .then(() => msal.handleRedirectPromise())
    .then((response) => {
      console.log('[Word Add-in] Popup auth handled:', response ? 'success' : 'no response');
      // Popup will close automatically via MSAL
    })
    .catch((err) => {
      console.error('[Word Add-in] Popup auth error:', err);
    });

  // Don't render the app in the popup - just let MSAL handle it
  throw new Error('MSAL popup handler - stopping execution');
}

// ============================================================================
// Main App Render
// ============================================================================

function renderApp() {
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <TaskPane />
      </React.StrictMode>
    );
  }
}

// Wait for Office.js to be ready
Office.onReady((info) => {
  console.log('[Word Add-in] Office.onReady fired:', info);
  console.log('[Word Add-in] Host:', info.host, 'Platform:', info.platform);

  if (info.host === Office.HostType.Word) {
    console.log('[Word Add-in] Word detected, rendering TaskPane');
    renderApp();
  } else {
    // Fallback: render anyway if host not detected (for debugging)
    console.warn('[Word Add-in] Word not detected, rendering anyway for debugging');
    renderApp();
  }
}).catch((err) => {
  console.error('[Word Add-in] Office.onReady error:', err);
  // Still try to render for debugging
  renderApp();
});
