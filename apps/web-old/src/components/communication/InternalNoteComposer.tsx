/**
 * Internal Note Composer Component
 * Story 5.5: Multi-Channel Communication Hub (AC: 1)
 *
 * Provides a form for creating internal notes with privacy settings
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useCreateInternalNote, type PrivacyLevel } from '@/hooks/useCaseTimeline';
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
  ChevronDown,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface InternalNoteComposerProps {
  caseId: string;
  onNoteCreated?: () => void;
  className?: string;
}

const PRIVACY_OPTIONS: {
  value: PrivacyLevel;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'Normal',
    label: 'Toată Echipa',
    description: 'Vizibil pentru toți membrii echipei',
    icon: <Eye className="h-4 w-4" />,
  },
  {
    value: 'Confidential',
    label: 'Doar Selectați',
    description: 'Vizibil doar pentru utilizatorii selectați',
    icon: <Lock className="h-4 w-4" />,
  },
  {
    value: 'AttorneyOnly',
    label: 'Doar Avocați',
    description: 'Vizibil doar pentru Parteneri și Asociați',
    icon: <Briefcase className="h-4 w-4" />,
  },
  {
    value: 'PartnerOnly',
    label: 'Doar Parteneri',
    description: 'Vizibil doar pentru Parteneri',
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
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      }, 0);
    },
    [body]
  );

  const selectedPrivacy = PRIVACY_OPTIONS.find((p) => p.value === privacyLevel);

  return (
    <div
      className={`rounded-lg border border-linear-border-subtle bg-linear-bg-secondary transition-shadow ${
        isFocused ? 'shadow-md ring-2 ring-linear-accent/20' : ''
      } ${className}`}
    >
      <fieldset>
        <legend className="sr-only">Create internal note</legend>

        {/* Header */}
        <div className="flex items-center gap-2 border-b border-linear-border-subtle px-4 py-2">
          <FileText className="h-4 w-4 text-linear-text-muted" />
          <span className="text-sm font-medium text-linear-text-secondary">Notă Internă</span>
        </div>

        {/* Toolbar */}
        {isFocused && (
          <div className="flex items-center gap-1 border-b border-linear-border-subtle px-3 py-1">
            <button
              type="button"
              onClick={() => insertFormatting('**')}
              className="rounded p-1.5 text-linear-text-tertiary hover:bg-linear-bg-hover hover:text-linear-text-secondary"
              title="Bold (Ctrl+B)"
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('_')}
              className="rounded p-1.5 text-linear-text-tertiary hover:bg-linear-bg-hover hover:text-linear-text-secondary"
              title="Italic (Ctrl+I)"
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('\n- ', '')}
              className="rounded p-1.5 text-linear-text-tertiary hover:bg-linear-bg-hover hover:text-linear-text-secondary"
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
            placeholder="Adaugă o notă internă..."
            className="w-full resize-none border-0 p-0 text-sm text-linear-text-primary placeholder:text-linear-text-muted focus:outline-none focus:ring-0"
            rows={isFocused ? 4 : 2}
            aria-label="Note content"
          />
        </div>

        {/* Error message */}
        {(error || errorMessage) && (
          <div className="flex items-center gap-2 border-t border-linear-error/20 bg-linear-error/10 px-4 py-2 text-sm text-linear-error">
            <AlertCircle className="h-4 w-4" />
            {error?.message || errorMessage}
          </div>
        )}

        {/* Actions */}
        {isFocused && (
          <div className="note-actions flex items-center justify-between border-t border-linear-border-subtle px-3 py-2">
            <div className="flex items-center gap-2">
              {/* Privacy selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPrivacyMenu(!showPrivacyMenu)}
                  className="flex items-center gap-1 rounded-lg border border-linear-border bg-linear-bg-secondary px-2 py-1.5 text-sm text-linear-text-secondary hover:bg-linear-bg-tertiary"
                  aria-expanded={showPrivacyMenu}
                  aria-haspopup="listbox"
                >
                  {selectedPrivacy?.icon}
                  <span className="hidden sm:inline">{selectedPrivacy?.label}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>

                {showPrivacyMenu && (
                  <div
                    className="absolute bottom-full left-0 z-10 mb-1 w-64 rounded-lg border border-linear-border-subtle bg-linear-bg-secondary py-1 shadow-lg"
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
                        className={`flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-linear-bg-tertiary ${
                          privacyLevel === option.value ? 'bg-linear-accent/10' : ''
                        }`}
                        role="option"
                        aria-selected={privacyLevel === option.value}
                      >
                        <span className="mt-0.5">{option.icon}</span>
                        <div>
                          <div className="text-sm font-medium text-linear-text-primary">
                            {option.label}
                          </div>
                          <div className="text-xs text-linear-text-tertiary">
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
                className="rounded-lg border border-linear-border bg-linear-bg-secondary p-1.5 text-linear-text-tertiary hover:bg-linear-bg-tertiary hover:text-linear-text-secondary"
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
                className="text-sm text-linear-text-tertiary hover:text-linear-text-secondary"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!body.trim() || loading}
                className="flex items-center gap-1 rounded-lg bg-linear-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-linear-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Salvează
              </button>
            </div>
          </div>
        )}
      </fieldset>

      {/* Keyboard shortcut hint */}
      {isFocused && (
        <div className="border-t border-linear-border-subtle px-3 py-1 text-xs text-linear-text-muted">
          Apasă <kbd className="rounded bg-linear-bg-tertiary px-1">Ctrl</kbd>+
          <kbd className="rounded bg-linear-bg-tertiary px-1">Enter</kbd> pentru a salva
        </div>
      )}
    </div>
  );
}

export default InternalNoteComposer;
