/**
 * Word Add-in Commands
 * Story 3.4: Word Integration with Live AI Assistance
 *
 * Command handlers for ribbon buttons that execute without opening task pane.
 */

import { apiClient } from '../services/api-client';
import { getSelectedText, getDocumentProperties } from '../services/word-api';

// Initialize Office
Office.onReady(() => {
  // Commands are ready
});

/**
 * Explain selection command
 * Called from ribbon button
 */
async function explainSelection(event: Office.AddinCommands.Event) {
  try {
    const { selectedText } = await getSelectedText();

    if (!selectedText) {
      showNotification('Please select some text to explain');
      event.completed();
      return;
    }

    const properties = await getDocumentProperties();
    const documentId = properties['PlatformDocumentId'] || 'unknown';

    const result = await apiClient.explainText({
      documentId,
      selectedText,
    });

    // Show explanation in a dialog
    showExplanationDialog(selectedText, result);
  } catch (error: any) {
    showNotification(`Error: ${error.message}`);
  }

  event.completed();
}

/**
 * Sync document command
 * Called from ribbon button
 */
async function syncDocument(event: Office.AddinCommands.Event) {
  try {
    const properties = await getDocumentProperties();
    const documentId = properties['PlatformDocumentId'];

    if (!documentId) {
      showNotification('This document is not linked to the platform');
      event.completed();
      return;
    }

    showNotification('Syncing document...');

    const result = await apiClient.syncDocument(documentId);

    if (result.success) {
      showNotification('Document synced successfully');
    } else {
      showNotification(`Sync failed: ${result.message}`);
    }
  } catch (error: any) {
    showNotification(`Sync error: ${error.message}`);
  }

  event.completed();
}

/**
 * Show a notification to the user
 */
function showNotification(message: string) {
  // Use Office notification API
  if (Office.context.mailbox) {
    // In Outlook
    Office.context.mailbox.item?.notificationMessages.addAsync('notification', {
      type: Office.MailboxEnums.ItemNotificationMessageType.InformationalMessage,
      message,
      icon: 'Icon.16x16',
      persistent: false,
    });
  } else {
    // In Word - use console and hope for the best
    console.log('Notification:', message);

    // Could also use a dialog for important messages
    try {
      Office.context.ui.displayDialogAsync(
        `data:text/html,<html><body style="font-family:Segoe UI;padding:20px;"><p>${message}</p><button onclick="Office.context.ui.messageParent('close')">OK</button></body></html>`,
        { height: 20, width: 30 },
        (result: Office.AsyncResult<Office.Dialog>) => {
          if (result.status === Office.AsyncResultStatus.Succeeded) {
            const dialog = result.value;
            dialog.addEventHandler(Office.EventType.DialogMessageReceived, () => {
              dialog.close();
            });
            // Auto-close after 3 seconds
            setTimeout(() => {
              try {
                dialog.close();
              } catch {}
            }, 3000);
          }
        }
      );
    } catch {
      // Fallback - do nothing
    }
  }
}

/**
 * Show explanation in a dialog
 */
function showExplanationDialog(originalText: string, result: any) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 20px; margin: 0; }
        h2 { font-size: 16px; color: #323130; margin-top: 0; }
        .original { background: #f3f2f1; padding: 12px; border-radius: 4px; margin-bottom: 16px; font-style: italic; }
        .explanation { line-height: 1.6; margin-bottom: 16px; }
        .legal-basis { background: #e1f5fe; padding: 12px; border-radius: 4px; margin-bottom: 16px; }
        .references { font-size: 12px; color: #605e5c; }
        .tag { display: inline-block; background: #e1dfdd; padding: 4px 8px; border-radius: 4px; margin: 2px; }
        button { background: #0078d4; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
        button:hover { background: #106ebe; }
      </style>
    </head>
    <body>
      <h2>Explanation</h2>
      <div class="original">"${escapeHtml(originalText.substring(0, 200))}${originalText.length > 200 ? '...' : ''}"</div>
      <div class="explanation">${escapeHtml(result.explanation)}</div>
      ${result.legalBasis ? `<div class="legal-basis"><strong>Legal Basis:</strong> ${escapeHtml(result.legalBasis)}</div>` : ''}
      ${result.sourceReferences?.length ? `
        <div class="references">
          <strong>References:</strong><br>
          ${result.sourceReferences.map((r: string) => `<span class="tag">${escapeHtml(r)}</span>`).join('')}
        </div>
      ` : ''}
      <br>
      <button onclick="Office.context.ui.messageParent('close')">Close</button>
    </body>
    </html>
  `;

  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

  Office.context.ui.displayDialogAsync(
    dataUrl,
    { height: 50, width: 40 },
    (result: Office.AsyncResult<Office.Dialog>) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        const dialog = result.value;
        dialog.addEventHandler(Office.EventType.DialogMessageReceived, () => {
          dialog.close();
        });
      }
    }
  );
}

/**
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Register commands globally
(window as any).explainSelection = explainSelection;
(window as any).syncDocument = syncDocument;

// For Office.js command registration
Office.actions.associate('explainSelection', explainSelection);
Office.actions.associate('syncDocument', syncDocument);
