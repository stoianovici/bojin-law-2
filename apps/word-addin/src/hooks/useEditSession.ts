/**
 * useEditSession Hook
 * Manages conversational edit session state for the EditPanel.
 *
 * Features:
 * - Conversation history (user/assistant/error messages)
 * - API calls to /api/ai/word/edit endpoint
 * - Auto-apply changes to document
 * - Multi-section change support (processes in reverse order)
 * - Word comments for change history
 * - Loading state management
 * - Reset functionality
 */

import { useState, useCallback } from 'react';
import { apiClient } from '../services/api-client';
import {
  replaceSelectionOoxml,
  replaceSelection,
  replaceTextBySearch,
  replaceDocumentBody,
  insertCommentOnText,
  type CommentInsertResult,
} from '../services/word-api';

// ============================================================================
// Types
// ============================================================================

export interface EditMessage {
  role: 'user' | 'assistant' | 'error';
  content: string;
}

export interface EditChange {
  type: 'replace' | 'insert' | 'delete' | 'full_rewrite';
  originalText?: string;
  newText: string;
  ooxmlContent?: string;
  location?: 'selection' | 'after_selection' | 'document' | { searchText: string };
}

export interface EditContext {
  type: 'selection' | 'document';
  selectedText?: string;
  documentContent?: string;
  cursorPosition?: number;
}

export interface EditSessionState {
  messages: EditMessage[];
  isLoading: boolean;
  error: string | null;
  commentsSkipped: boolean;
  lastChanges: EditChange[] | null;
}

export interface UseEditSessionReturn extends EditSessionState {
  sendPrompt: (prompt: string, context: EditContext, caseId?: string) => Promise<void>;
  reset: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Apply a single change to the document.
 * Returns success status and any skipped comment info.
 */
async function applyChange(
  change: EditChange,
  prompt: string
): Promise<{ success: boolean; commentSkipped: boolean }> {
  let success = false;
  let commentSkipped = false;

  try {
    // Handle full rewrite - replaces entire selection or document
    if (change.type === 'full_rewrite') {
      if (change.location === 'selection') {
        // Replace the current selection with the new text
        await replaceSelection(change.newText);
        success = true;
      } else if (change.location === 'document') {
        // Replace the entire document body
        success = await replaceDocumentBody(change.newText);
      }
      // Skip comments for full rewrites - too much text
      return { success, commentSkipped: true };
    }

    // Apply incremental changes based on location type
    if (change.location === 'selection' && change.ooxmlContent) {
      // Replace selection with OOXML-formatted content
      await replaceSelectionOoxml(change.ooxmlContent);
      success = true;
    } else if (change.originalText) {
      // Search-based replacement
      success = await replaceTextBySearch(change.originalText, change.newText);
    }

    // If change was applied, try to add a comment
    if (success && change.newText) {
      // Format comment: prompt + preview of new text
      const preview =
        change.newText.length > 100 ? change.newText.substring(0, 100) + '...' : change.newText;
      const commentContent = `💬 "${prompt}"\n→ ${preview}`;

      // Search for the new text to attach comment (it was just inserted)
      const searchText = change.newText.substring(0, 100);
      const commentResult: CommentInsertResult = await insertCommentOnText(
        searchText,
        commentContent
      );

      if (commentResult.skipped) {
        commentSkipped = true;
      }
    }
  } catch (err) {
    console.error('[applyChange] Error applying change:', err);
    success = false;
  }

  return { success, commentSkipped };
}

/**
 * Apply multiple changes to the document.
 * Processes in reverse document order to avoid position shifts.
 * Returns summary of successes and failures.
 */
async function applyChanges(
  changes: EditChange[],
  prompt: string
): Promise<{
  successCount: number;
  failureCount: number;
  anyCommentsSkipped: boolean;
}> {
  let successCount = 0;
  let failureCount = 0;
  let anyCommentsSkipped = false;

  // Process changes in reverse order to avoid position shifts
  // (Later changes in document are applied first)
  const reversedChanges = [...changes].reverse();

  for (const change of reversedChanges) {
    const { success, commentSkipped } = await applyChange(change, prompt);

    if (success) {
      successCount++;
    } else {
      failureCount++;
    }

    if (commentSkipped) {
      anyCommentsSkipped = true;
    }
  }

  return { successCount, failureCount, anyCommentsSkipped };
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useEditSession(): UseEditSessionReturn {
  const [messages, setMessages] = useState<EditMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentsSkipped, setCommentsSkipped] = useState(false);
  const [lastChanges, setLastChanges] = useState<EditChange[] | null>(null);

  /**
   * Send a prompt to the edit API and auto-apply changes
   */
  const sendPrompt = useCallback(
    async (prompt: string, context: EditContext, caseId?: string) => {
      if (!prompt.trim()) return;

      setIsLoading(true);
      setError(null);

      // Add user message to conversation
      const userMessage: EditMessage = { role: 'user', content: prompt };
      setMessages((prev) => [...prev, userMessage]);

      try {
        // Build conversation history for API (last 10 turns to manage context window)
        const conversationHistory = messages
          .filter((m) => m.role !== 'error')
          .slice(-10)
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        // Make API call
        const response = await apiClient.editText({
          context,
          conversation: conversationHistory,
          prompt,
          caseId,
        });

        // Store changes
        setLastChanges(response.changes);

        // Auto-apply changes to document
        if (response.changes && response.changes.length > 0) {
          const { successCount, failureCount, anyCommentsSkipped } = await applyChanges(
            response.changes,
            prompt
          );

          // Track if comments were skipped
          if (anyCommentsSkipped) {
            setCommentsSkipped(true);
          }

          // Build assistant message with result summary
          let message = response.message;
          if (failureCount > 0) {
            message += ` (${successCount} modificări aplicate, ${failureCount} eșuate)`;
          }

          const assistantMessage: EditMessage = {
            role: 'assistant',
            content: message,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        } else {
          // No changes to apply - just show the message
          const assistantMessage: EditMessage = {
            role: 'assistant',
            content: response.message,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }
      } catch (err) {
        console.error('[useEditSession] API error:', err);
        const errorMessage = err instanceof Error ? err.message : 'A apărut o eroare la procesare.';

        // Add error to conversation
        const errorMsg: EditMessage = {
          role: 'error',
          content: errorMessage,
        };
        setMessages((prev) => [...prev, errorMsg]);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );

  /**
   * Reset the conversation
   */
  const reset = useCallback(() => {
    setMessages([]);
    setIsLoading(false);
    setError(null);
    setCommentsSkipped(false);
    setLastChanges(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    commentsSkipped,
    lastChanges,
    sendPrompt,
    reset,
  };
}
