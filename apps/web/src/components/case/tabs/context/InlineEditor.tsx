'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CorrectionType } from '@/graphql/case-context';

interface InlineEditorProps {
  initialContent: string;
  sectionId: string;
  onSave: (data: {
    correctedValue: string;
    correctionType: CorrectionType;
    reason?: string;
  }) => Promise<void>;
  onCancel: () => void;
  className?: string;
}

const CORRECTION_TYPE_LABELS: Record<CorrectionType, { label: string; description: string }> = {
  override: {
    label: 'Inlocuieste',
    description: 'Inlocuieste continutul sectiunii cu textul nou',
  },
  append: {
    label: 'Adauga',
    description: 'Adauga textul la sfarsitul sectiunii',
  },
  remove: {
    label: 'Sterge',
    description: 'Marcheaza continutul ca eliminat',
  },
  note: {
    label: 'Nota',
    description: 'Adauga o nota vizibila pentru AI',
  },
};

export function InlineEditor({
  initialContent,
  sectionId,
  onSave,
  onCancel,
  className,
}: InlineEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [correctionType, setCorrectionType] = useState<CorrectionType>('override');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
    // Select all text for easy replacement
    textareaRef.current?.select();
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to save
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [content, correctionType, reason, onCancel]);

  const handleSave = async () => {
    if (isSaving) return;

    // For override type, content must be different from original
    if (correctionType === 'override' && content.trim() === initialContent.trim()) {
      return; // Nothing to save
    }

    // For note type, content must not be empty
    if (correctionType === 'note' && !content.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        correctedValue: content.trim(),
        correctionType,
        reason: reason.trim() || undefined,
      });
    } catch (error) {
      console.error('Failed to save correction:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={cn('border border-linear-accent/50 rounded-lg bg-linear-bg-secondary', className)}
    >
      {/* Editor header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-linear-border-subtle bg-linear-accent/5">
        <span className="text-xs font-medium text-linear-accent">Editare inline</span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-linear-text-tertiary">
            ⌘+Enter salvare • Esc anulare
          </span>
        </div>
      </div>

      {/* Textarea */}
      <div className="p-4">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full min-h-[120px] p-3 rounded-lg bg-linear-bg-primary border border-linear-border-subtle text-sm text-linear-text-primary placeholder-linear-text-tertiary resize-y focus:outline-none focus:ring-1 focus:ring-linear-accent focus:border-linear-accent"
          placeholder="Introdu continutul corectat..."
          disabled={isSaving}
        />

        {/* Correction type selector */}
        <div className="mt-3">
          <label className="block text-[11px] font-medium text-linear-text-tertiary uppercase tracking-wider mb-2">
            Tip corectie
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CORRECTION_TYPE_LABELS) as CorrectionType[]).map((type) => (
              <button
                key={type}
                onClick={() => setCorrectionType(type)}
                disabled={isSaving}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  correctionType === type
                    ? 'bg-linear-accent text-white'
                    : 'bg-linear-bg-tertiary text-linear-text-secondary hover:bg-linear-bg-hover'
                )}
                title={CORRECTION_TYPE_LABELS[type].description}
              >
                {CORRECTION_TYPE_LABELS[type].label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-linear-text-tertiary">
            {CORRECTION_TYPE_LABELS[correctionType].description}
          </p>
        </div>

        {/* Reason field */}
        <div className="mt-3">
          <label className="block text-[11px] font-medium text-linear-text-tertiary uppercase tracking-wider mb-2">
            Motiv (optional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-linear-bg-primary border border-linear-border-subtle text-sm text-linear-text-primary placeholder-linear-text-tertiary focus:outline-none focus:ring-1 focus:ring-linear-accent focus:border-linear-accent"
            placeholder="De ce faci aceasta corectie?"
            disabled={isSaving}
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-linear-text-secondary hover:bg-linear-bg-hover transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4 inline-block mr-1.5" />
            Anuleaza
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-linear-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 inline-block mr-1.5 animate-spin" />
                Se salveaza...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 inline-block mr-1.5" />
                Salveaza
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InlineEditor;
