/**
 * EditPanel - Conversational document editing interface
 *
 * Allows users to chat with AI to make document edits through natural language.
 * Composes ContextDisplay, ConversationHistory, and PromptInput components.
 */

import { useCallback } from 'react';
import { ContextDisplay } from './ContextDisplay';
import { ConversationHistory } from './ConversationHistory';
import { PromptInput } from './PromptInput';
import { useEditSession, EditContext } from '../../hooks/useEditSession';
import { useSelection } from '../../hooks/useSelection';
import { useDocumentContext } from '../../hooks/useDocumentContext';
import { getDocumentContent } from '../../services/word-api';

export function EditPanel() {
  const { messages, isLoading, commentsSkipped, sendPrompt, reset } = useEditSession();
  const { hasSelection, selectedText } = useSelection();
  const { context: documentContext } = useDocumentContext();

  /**
   * Handle prompt submission
   * Builds context based on current selection state
   */
  const handleSubmit = useCallback(
    async (prompt: string) => {
      let context: EditContext;

      if (hasSelection && selectedText) {
        // Selection-based edit
        context = {
          type: 'selection',
          selectedText,
        };
      } else {
        // Whole document edit
        try {
          const documentContent = await getDocumentContent(15000); // Limit to ~15k chars
          context = {
            type: 'document',
            documentContent,
          };
        } catch (err) {
          console.error('[EditPanel] Failed to get document content:', err);
          context = {
            type: 'document',
            documentContent: '',
          };
        }
      }

      // Pass caseId from document context for case-aware editing
      await sendPrompt(prompt, context, documentContext?.caseId);
    },
    [hasSelection, selectedText, sendPrompt, documentContext?.caseId]
  );

  return (
    <div className="edit-panel">
      {/* Context badge showing current scope */}
      <ContextDisplay />

      {/* Comments skipped notice */}
      {commentsSkipped && (
        <div className="edit-panel__notice">
          Comentariile Word nu au putut fi adăugate (API indisponibil).
        </div>
      )}

      {/* Conversation history */}
      <ConversationHistory messages={messages} onReset={reset} isLoading={isLoading} />

      {/* Prompt input */}
      <PromptInput
        onSubmit={handleSubmit}
        disabled={isLoading}
        placeholder={
          hasSelection ? 'Ce vrei să modifici în selecție?' : 'Ce vrei să modifici în document?'
        }
      />
    </div>
  );
}

// Re-export sub-components for external use
export { ConversationHistory } from './ConversationHistory';
export { ContextDisplay } from './ContextDisplay';
export { PromptInput } from './PromptInput';
