/**
 * useSelection Hook
 * Polls the Word document for text selection changes.
 *
 * Features:
 * - 200ms debounced polling
 * - Only polls when task pane is visible
 * - Returns selection state and text
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface SelectionState {
  hasSelection: boolean;
  selectedText: string;
  cursorContext: string;
  isLoading: boolean;
}

const POLL_INTERVAL = 200; // ms
const MAX_SELECTION_LENGTH = 5000; // Limit to prevent memory issues
const CONTEXT_BEFORE_CHARS = 200; // Characters of context before selection

export function useSelection(): SelectionState {
  const [state, setState] = useState<SelectionState>({
    hasSelection: false,
    selectedText: '',
    cursorContext: '',
    isLoading: false,
  });

  const pollTimeoutRef = useRef<number | null>(null);
  const isPollingRef = useRef(false);
  const lastSelectionRef = useRef<string>('');

  // Check document visibility
  const isVisible = useCallback(() => {
    // In Office add-ins, we check if the document is hidden
    return !document.hidden;
  }, []);

  // Get selection from Word
  const getSelection = useCallback(async (): Promise<{
    text: string;
    context: string;
  } | null> => {
    if (typeof Word === 'undefined' || !Word.run) {
      return null;
    }

    try {
      return await Word.run(async (context: Word.RequestContext) => {
        const selection = context.document.getSelection();
        selection.load('text');

        // Get paragraph for context
        const paragraph = selection.paragraphs.getFirst();
        paragraph.load('text');

        await context.sync();

        const text = selection.text?.trim() || '';
        const paragraphText = paragraph.text?.trim() || '';

        // Build context (text around the selection)
        let cursorContext = '';
        if (paragraphText) {
          const selectionStart = paragraphText.indexOf(text);
          if (selectionStart > 0) {
            const contextStart = Math.max(0, selectionStart - CONTEXT_BEFORE_CHARS);
            cursorContext = paragraphText.substring(contextStart, selectionStart);
          }
        }

        return {
          text: text.substring(0, MAX_SELECTION_LENGTH),
          context: cursorContext,
        };
      });
    } catch (err) {
      console.warn('[useSelection] Failed to get selection:', err);
      return null;
    }
  }, []);

  // Poll for selection changes
  const poll = useCallback(async () => {
    if (!isVisible() || isPollingRef.current) {
      return;
    }

    isPollingRef.current = true;

    try {
      const result = await getSelection();

      if (result) {
        // Only update state if selection changed
        if (result.text !== lastSelectionRef.current) {
          lastSelectionRef.current = result.text;
          setState({
            hasSelection: result.text.length > 0,
            selectedText: result.text,
            cursorContext: result.context,
            isLoading: false,
          });
        }
      }
    } catch (err) {
      console.warn('[useSelection] Poll error:', err);
    } finally {
      isPollingRef.current = false;
    }
  }, [getSelection, isVisible]);

  // Set up polling interval
  useEffect(() => {
    const startPolling = () => {
      if (pollTimeoutRef.current) {
        window.clearInterval(pollTimeoutRef.current);
      }
      pollTimeoutRef.current = window.setInterval(poll, POLL_INTERVAL);
    };

    const stopPolling = () => {
      if (pollTimeoutRef.current) {
        window.clearInterval(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };

    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

    // Start polling
    startPolling();

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [poll]);

  return state;
}

/**
 * Lightweight hook that just returns whether there's a selection.
 * More efficient when you don't need the actual text.
 */
export function useHasSelection(): boolean {
  const { hasSelection } = useSelection();
  return hasSelection;
}
