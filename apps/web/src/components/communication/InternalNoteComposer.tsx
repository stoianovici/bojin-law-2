/**
 * Internal Note Composer Component
 * Story 5.5: Multi-Channel Communication Hub (AC: 1)
 *
 * Provides a form for creating internal notes with privacy settings
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  useCreateInternalNote,
  type PrivacyLevel,
} from '@/hooks/useCaseTimeline';
import {
  FileText,
  Lock,
  Briefcase,
  Crown,
  Eye,
  Send,
  Paperclip,
  Bold,
  Italic,
  List,
  X,
  ChevronDown,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface InternalNoteComposerProps {
  caseId: string;
  onNoteCreated?: () => void;
  className?: string;
}

const PRIVACY_OPTIONS: { value: PrivacyLevel; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'Normal',
    label: 'All Team',
    description: 'Visible to all case team members',
    icon: <Eye className="h-4 w-4" />,
  },
  {
    value: 'Confidential',
    label: 'Selected Only',
    description: 'Visible to selected users only',
    icon: <Lock className="h-4 w-4" />,
  },
  {
    value: 'AttorneyOnly',
    label: 'Attorneys Only',
    description: 'Visible to Partners and Associates only',
    icon: <Briefcase className="h-4 w-4" />,
  },
  {
    value: 'PartnerOnly',
    label: 'Partners Only',
    description: 'Visible to Partners only',
    icon: <Crown className="h-4 w-4" />,
  },
];

export function InternalNoteComposer({
  caseId,
  onNoteCreated,
  className = '',
}: InternalNoteComposerProps) {
  const [body, setBody] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>('Normal');
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { create, loading, error } = useCreateInternalNote(caseId);

  const handleSubmit = useCallback(async () => {
    if (!body.trim()) return;

    setErrorMessage(null);

    try {
      await create({
        body: body.trim(),
        isPrivate: privacyLevel !== 'Normal',
        privacyLevel,
      });

      setBody('');
      setPrivacyLevel('Normal');
      setIsFocused(false);
      onNoteCreated?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create note');
    }
  }, [body, privacyLevel, create, onNoteCreated]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const insertFormatting = useCallback(
    (prefix: string, suffix: string = prefix) => {
      const textarea = document.getElementById('note-body') as HTMLTextAreaElement;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = body.substring(start, end);
      const newText =
        body.substring(0, start) + prefix + selectedText + suffix + body.substring(end);

      setBody(newText);

      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + prefix.length,
          end + prefix.length
        );
      }, 0);
    },
    [body]
  );

  const selectedPrivacy = PRIVACY_OPTIONS.find((p) => p.value === privacyLevel);

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white transition-shadow ${
        isFocused ? 'shadow-md ring-2 ring-blue-100' : ''
      } ${className}`}
    >
      <fieldset>
        <legend className="sr-only">Create internal note</legend>

        {/* Header */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2">
          <FileText className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Internal Note</span>
        </div>

        {/* Toolbar */}
        {isFocused && (
          <div className="flex items-center gap-1 border-b border-gray-100 px-3 py-1">
            <button
              type="button"
              onClick={() => insertFormatting('**')}
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              title="Bold (Ctrl+B)"
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('_')}
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              title="Italic (Ctrl+I)"
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('\n- ', '')}
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              title="List"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Textarea */}
        <div className="p-3">
          <textarea
            id="note-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={(e) => {
              // Don't blur if clicking on submit or privacy
              if (!e.relatedTarget?.closest('.note-actions')) {
                if (!body.trim()) {
                  setIsFocused(false);
                }
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Add an internal note..."
            className="w-full resize-none border-0 p-0 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
            rows={isFocused ? 4 : 2}
            aria-label="Note content"
          />
        </div>

        {/* Error message */}
        {(error || errorMessage) && (
          <div className="flex items-center gap-2 border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {error?.message || errorMessage}
          </div>
        )}

        {/* Actions */}
        {isFocused && (
          <div className="note-actions flex items-center justify-between border-t border-gray-100 px-3 py-2">
            <div className="flex items-center gap-2">
              {/* Privacy selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPrivacyMenu(!showPrivacyMenu)}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  aria-expanded={showPrivacyMenu}
                  aria-haspopup="listbox"
                >
                  {selectedPrivacy?.icon}
                  <span className="hidden sm:inline">{selectedPrivacy?.label}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>

                {showPrivacyMenu && (
                  <div
                    className="absolute bottom-full left-0 z-10 mb-1 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                    role="listbox"
                  >
                    {PRIVACY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setPrivacyLevel(option.value);
                          setShowPrivacyMenu(false);
                        }}
                        className={`flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-gray-50 ${
                          privacyLevel === option.value ? 'bg-blue-50' : ''
                        }`}
                        role="option"
                        aria-selected={privacyLevel === option.value}
                      >
                        <span className="mt-0.5">{option.icon}</span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {option.label}
                          </div>
                          <div className="text-xs text-gray-500">
                            {option.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Attachment button (placeholder) */}
              <button
                type="button"
                className="rounded-lg border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                title="Attach file"
                disabled
              >
                <Paperclip className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBody('');
                  setIsFocused(false);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!body.trim() || loading}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Save Note
              </button>
            </div>
          </div>
        )}
      </fieldset>

      {/* Keyboard shortcut hint */}
      {isFocused && (
        <div className="border-t border-gray-100 px-3 py-1 text-xs text-gray-400">
          Press <kbd className="rounded bg-gray-100 px-1">Ctrl</kbd>+
          <kbd className="rounded bg-gray-100 px-1">Enter</kbd> to save
        </div>
      )}
    </div>
  );
}

export default InternalNoteComposer;
