/**
 * Email Composer Component
 * Story 5.3: AI-Powered Email Drafting - Task 16
 *
 * Rich text editor for draft editing with AI refinement support
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  useUpdateDraft,
  useSendDraft,
  useDiscardDraft,
  useRefineDraft,
  useAttachmentSuggestions,
  useInlineSuggestions,
} from '@/hooks/useEmailDraft';
import type { EmailDraft } from '@/hooks/useEmailDraft';
import { AttachmentSuggestionsPanel } from './AttachmentSuggestionsPanel';
import { RefinementInput } from './RefinementInput';
import { Spinner } from '@/components/ui/Spinner';
import {
  SnippetAutocomplete,
  SnippetPickerButton,
  useSnippetAutocompleteIntegration,
} from '@/components/personalization/SnippetAutocomplete';
import { useRecordDraftEdit } from '@/hooks/useWritingStyle';

interface EmailComposerProps {
  draft: EmailDraft;
  originalEmail: {
    id: string;
    subject: string;
    from: { name?: string; address: string };
    bodyPreview: string;
    receivedDateTime: string;
  };
  onSent: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

export function EmailComposer({
  draft,
  originalEmail,
  onSent,
  onDiscard,
  onClose,
}: EmailComposerProps) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [showRefinement, setShowRefinement] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showAttachments, setShowAttachments] = useState(true);
  const [sendConfirmation, setSendConfirmation] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const { update, autoSave, loading: updating } = useUpdateDraft();
  const { send, loading: sending } = useSendDraft();
  const { discard, loading: discarding } = useDiscardDraft();
  const { refine, loading: refining } = useRefineDraft();
  const { suggestions, toggleSelection } = useAttachmentSuggestions(draft.id);
  const {
    suggestion: inlineSuggestion,
    getSuggestion,
    clearSuggestion,
  } = useInlineSuggestions(draft.id);

  // Snippet autocomplete integration
  const { cursorPosition, handleInsert: handleSnippetInsert } =
    useSnippetAutocompleteIntegration(editorRef, body, setBody);

  // Track draft edits for writing style learning
  const { recordDraftEdit } = useRecordDraftEdit();
  const originalBodyRef = useRef(draft.body);

  // Record edit when body changes significantly (on blur or send)
  const recordEditIfChanged = useCallback(() => {
    if (body !== originalBodyRef.current && body.length > 20) {
      recordDraftEdit({
        draftId: draft.id,
        originalText: originalBodyRef.current,
        editedText: body,
        editLocation: 'full',
      });
      originalBodyRef.current = body;
    }
  }, [body, draft.id, recordDraftEdit]);

  // Auto-save on body change
  useEffect(() => {
    if (body !== draft.body && autoSave) {
      autoSave(body);
    }
  }, [body]);

  // Get inline suggestions as user types
  const handleBodyChange = useCallback(
    (value: string) => {
      setBody(value);
      getSuggestion(value);
    },
    [getSuggestion]
  );

  // Accept inline suggestion
  const handleAcceptSuggestion = useCallback(() => {
    if (inlineSuggestion) {
      setBody((prev) => prev + inlineSuggestion.suggestion);
      clearSuggestion();
      editorRef.current?.focus();
    }
  }, [inlineSuggestion, clearSuggestion]);

  // Handle refinement
  const handleRefine = useCallback(
    async (instruction: string) => {
      const refined = await refine(draft.id, instruction);
      if (refined) {
        setBody(refined.body);
        setShowRefinement(false);
      }
    },
    [draft.id, refine]
  );

  // Handle send
  const handleSend = useCallback(async () => {
    // Record edit for style learning before sending
    recordEditIfChanged();
    // First update to latest content
    await update(draft.id, { subject, body, status: 'Ready' });
    const success = await send(draft.id);
    if (success) {
      onSent();
    }
  }, [draft.id, subject, body, update, send, onSent, recordEditIfChanged]);

  // Handle discard
  const handleDiscard = useCallback(async () => {
    const success = await discard(draft.id);
    if (success) {
      onDiscard();
    }
  }, [draft.id, discard, onDiscard]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Enter') {
          e.preventDefault();
          setSendConfirmation(true);
        } else if (e.key === 's') {
          e.preventDefault();
          update(draft.id, { subject, body });
        }
      }
      if (e.key === 'Tab' && inlineSuggestion) {
        e.preventDefault();
        handleAcceptSuggestion();
      }
      if (e.key === 'Escape') {
        clearSuggestion();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [draft.id, subject, body, update, inlineSuggestion, handleAcceptSuggestion, clearSuggestion]);

  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const charCount = body.length;

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Compose Reply
        </h2>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-800"
          aria-label="Close composer"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Original email reference */}
      <button
        onClick={() => setShowOriginal(!showOriginal)}
        className="flex w-full items-center justify-between border-b border-gray-200 bg-gray-50 p-3 text-left hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-750"
        aria-expanded={showOriginal}
      >
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Replying to: {originalEmail.from.name || originalEmail.from.address}
        </span>
        <ChevronIcon expanded={showOriginal} />
      </button>
      {showOriginal && (
        <div
          className="border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800"
          aria-describedby="original-email"
        >
          <div id="original-email" className="text-sm text-gray-600 dark:text-gray-300">
            <p className="font-medium">{originalEmail.subject}</p>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              {originalEmail.bodyPreview}
            </p>
          </div>
        </div>
      )}

      {/* Subject */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <label htmlFor="email-subject" className="sr-only">
          Subject
        </label>
        <input
          id="email-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full border-0 bg-transparent text-lg font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 dark:text-white dark:placeholder-gray-500"
          placeholder="Subject"
        />
      </div>

      {/* Editor */}
      <div className="relative flex-1 overflow-hidden">
        <label htmlFor="email-body" className="sr-only">
          Email body
        </label>
        <textarea
          ref={editorRef}
          id="email-body"
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          onBlur={recordEditIfChanged}
          className="h-full w-full resize-none border-0 p-4 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-0 dark:bg-gray-900 dark:text-gray-300 dark:placeholder-gray-500"
          placeholder="Write your message... (Type / for snippets)"
          role="textbox"
          aria-multiline="true"
          aria-describedby="original-email"
        />

        {/* Snippet autocomplete dropdown */}
        <SnippetAutocomplete
          text={body}
          cursorPosition={cursorPosition}
          onInsert={handleSnippetInsert}
          className="bottom-20 left-4"
        />

        {/* Inline suggestion overlay */}
        {inlineSuggestion && (
          <div
            className="absolute bottom-4 left-4 right-4 rounded-lg border border-blue-200 bg-blue-50 p-3 shadow-lg dark:border-blue-800 dark:bg-blue-900/50"
            aria-live="polite"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-medium uppercase text-blue-600 dark:text-blue-400">
                  {inlineSuggestion.type === 'Completion'
                    ? 'Suggestion'
                    : inlineSuggestion.type === 'Correction'
                    ? 'Correction'
                    : 'Improvement'}
                </span>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {inlineSuggestion.suggestion}
                </p>
                {inlineSuggestion.reason && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {inlineSuggestion.reason}
                  </p>
                )}
              </div>
              <div className="ml-4 flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Press Tab to accept
                </span>
                <button
                  onClick={clearSuggestion}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label="Dismiss suggestion"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Word count */}
      <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
        <span>
          {wordCount} words · {charCount} characters
        </span>
        {updating && (
          <span className="flex items-center gap-1">
            <Spinner size="xs" /> Saving...
          </span>
        )}
      </div>

      {/* Attachments */}
      {suggestions.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowAttachments(!showAttachments)}
            className="flex w-full items-center justify-between p-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-expanded={showAttachments}
          >
            <span>
              Suggested Attachments ({suggestions.filter((s) => s.isSelected).length}/
              {suggestions.length})
            </span>
            <ChevronIcon expanded={showAttachments} />
          </button>
          {showAttachments && (
            <AttachmentSuggestionsPanel
              suggestions={suggestions}
              onToggle={toggleSelection}
            />
          )}
        </div>
      )}

      {/* Refinement panel */}
      {showRefinement && (
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          <RefinementInput
            onRefine={handleRefine}
            loading={refining}
            refinementHistory={draft.refinements}
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between border-t border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRefinement(!showRefinement)}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <SparklesIcon className="h-4 w-4" />
            AI Refine
          </button>
          <SnippetPickerButton
            onSelect={(content) => {
              const cursorPos = editorRef.current?.selectionStart ?? body.length;
              const newBody = body.slice(0, cursorPos) + content + body.slice(cursorPos);
              setBody(newBody);
              // Focus and move cursor after inserted content
              requestAnimationFrame(() => {
                editorRef.current?.focus();
                const newCursorPos = cursorPos + content.length;
                editorRef.current?.setSelectionRange(newCursorPos, newCursorPos);
              });
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDiscard}
            disabled={discarding}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {discarding ? 'Discarding...' : 'Discard'}
          </button>
          <button
            onClick={() => setSendConfirmation(true)}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? (
              <>
                <Spinner size="xs" /> Sending...
              </>
            ) : (
              <>
                <SendIcon className="h-4 w-4" /> Send
              </>
            )}
          </button>
        </div>
      </div>

      {/* Send confirmation dialog */}
      {sendConfirmation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="send-confirm-title"
        >
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3
              id="send-confirm-title"
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              Send Email?
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              This will send the email to {originalEmail.from.address}. Make sure you&apos;ve
              reviewed the content.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setSendConfirmation(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setSendConfirmation(false);
                  handleSend();
                }}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Icons
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-5 w-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}
