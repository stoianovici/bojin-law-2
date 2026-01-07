'use client';

import { useState, useCallback } from 'react';
import { StickyNote, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

interface InternalNoteComposerProps {
  threadId: string;
  onSubmit: (note: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function InternalNoteComposer({
  threadId,
  onSubmit,
  disabled = false,
  className,
}: InternalNoteComposerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!note.trim() || disabled) return;

    setSubmitting(true);
    try {
      await onSubmit(note.trim());
      setNote('');
      setIsExpanded(false);
    } finally {
      setSubmitting(false);
    }
  }, [note, disabled, onSubmit]);

  return (
    <div className={cn('border-t border-linear-border-subtle', className)}>
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between px-4 py-2',
          'text-sm text-linear-text-secondary hover:text-linear-text-primary',
          'hover:bg-linear-bg-hover transition-colors',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className="flex items-center gap-2">
          <StickyNote className="h-4 w-4" />
          Nota interna
        </span>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Scrie o nota pentru echipa (nu va fi trimisa clientului)..."
            disabled={disabled || submitting}
            className={cn(
              'w-full min-h-[80px] p-3 mb-3',
              'bg-linear-bg-tertiary border border-linear-border-subtle rounded-lg',
              'text-sm text-linear-text-primary placeholder:text-linear-text-tertiary',
              'resize-none outline-none',
              'focus:border-linear-accent/50',
              (disabled || submitting) && 'opacity-50 cursor-not-allowed'
            )}
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={disabled || !note.trim()}
              loading={submitting}
              size="sm"
              leftIcon={<StickyNote className="h-4 w-4" />}
            >
              Adauga nota
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
