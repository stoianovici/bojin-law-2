/**
 * Word Add-in Task Pane Entry Point
 * Story 3.4: Word Integration with Live AI Assistance
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { TaskPane } from './TaskPane';
import '../styles/taskpane.css';

// Check if this is an OAuth callback (opened in dialog for login)
function handleOAuthCallback(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const error = urlParams.get('error');

  if (code || error) {
    console.log('[Word Add-in] OAuth callback detected');
    // This page was opened in a dialog for OAuth
    // Send the result back to the parent
    if (Office.context.ui && Office.context.ui.messageParent) {
      if (code) {
        Office.context.ui.messageParent(JSON.stringify({ code }));
      } else {
        Office.context.ui.messageParent(JSON.stringify({ error: error || 'Unknown error' }));
      }
    }
    return true; // Don't render the app, this is just for OAuth
  }
  return false;
}

// Render the app
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

  // Check for OAuth callback first
  if (handleOAuthCallback()) {
    console.log('[Word Add-in] OAuth callback handled, not rendering TaskPane');
    return;
  }

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
