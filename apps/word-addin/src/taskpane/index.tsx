/**
 * Word Add-in Task Pane Entry Point
 * Story 3.4: Word Integration with Live AI Assistance
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { TaskPane } from './TaskPane';
import '../styles/taskpane.css';

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
