/**
 * Outlook Add-in Entry Point
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { initializeIcons } from '@fluentui/react';
import { TaskPane } from './TaskPane';

// Initialize Fluent UI icons
initializeIcons();

// Wait for Office to be ready
Office.onReady((info) => {
  console.log('[OutlookAddin] Office ready:', info);
  console.log('[OutlookAddin] Host:', info.host);
  console.log('[OutlookAddin] Platform:', info.platform);

  const container = document.getElementById('root');
  if (!container) {
    console.error('[OutlookAddin] Root element not found');
    return;
  }

  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <TaskPane />
    </React.StrictMode>
  );
});
