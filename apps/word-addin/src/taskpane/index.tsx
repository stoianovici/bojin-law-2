/**
 * Word Add-in Task Pane Entry Point
 * Story 3.4: Word Integration with Live AI Assistance
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { TaskPane } from './TaskPane';
import '../styles/taskpane.css';

// Wait for Office.js to be ready
Office.onReady((info) => {
  if (info.host === Office.HostType.Word) {
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
});
