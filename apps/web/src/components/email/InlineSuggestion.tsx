/**
 * Inline Suggestion Component
 * Story 5.3: AI-Powered Email Drafting - Task 22
 *
 * Displays AI-powered inline suggestions during email composition:
 * - Completion suggestions (Tab to accept)
 * - Corrections for grammar/spelling
 * - Improvements for clarity/tone
 */

'use client';

import React from 'react';
import type { InlineSuggestion as InlineSuggestionType } from '@/hooks/useEmailDraft';

interface InlineSuggestionProps {
  suggestion: InlineSuggestionType;
  onAccept: () => void;
  onDismiss: () => void;
}

const SUGGESTION_CONFIG: Record<
  InlineSuggestionType['type'],
  { label: string; color: string; bgColor: string }
> = {
  Completion: {
    label: 'Suggestion',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/50',
  },
  Correction: {
    label: 'Correction',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/50',
  },
  Improvement: {
    label: 'Improvement',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/50',
  },
};

export function InlineSuggestion({ suggestion, onAccept, onDismiss }: InlineSuggestionProps) {
  const config = SUGGESTION_CONFIG[suggestion.type];

  return (
    <div
      className={`rounded-lg border p-3 shadow-lg ${config.bgColor}`}
      role="tooltip"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Type indicator */}
          <span className={`text-xs font-medium uppercase ${config.color}`}>{config.label}</span>

          {/* Suggestion text */}
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{suggestion.suggestion}</p>

          {/* Reason (if available) */}
          {suggestion.reason && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{suggestion.reason}</p>
          )}

          {/* Confidence indicator */}
          <div className="mt-2 flex items-center gap-2">
            <ConfidenceBar confidence={suggestion.confidence} />
            <span className="text-xs text-gray-400">
              {Math.round(suggestion.confidence * 100)}% confident
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Dismiss suggestion"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
          <span className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Press{' '}
            <kbd className="rounded bg-gray-200 px-1 py-0.5 font-mono dark:bg-gray-700">Tab</kbd> to
            accept
          </span>
        </div>
      </div>

      {/* Quick action buttons */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={onAccept}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          <CheckIcon className="h-3 w-3" /> Accept
        </button>
        <button
          onClick={onDismiss}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  const color =
    percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-gray-400';

  return (
    <div className="h-1 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
      <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
    </div>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

/**
 * Positioned inline suggestion overlay for use within text editors
 */
interface InlineSuggestionOverlayProps extends InlineSuggestionProps {
  position?: 'bottom' | 'top';
}

export function InlineSuggestionOverlay({
  suggestion,
  onAccept,
  onDismiss,
  position = 'bottom',
}: InlineSuggestionOverlayProps) {
  return (
    <div className={`absolute left-4 right-4 z-10 ${position === 'bottom' ? 'bottom-4' : 'top-4'}`}>
      <InlineSuggestion suggestion={suggestion} onAccept={onAccept} onDismiss={onDismiss} />
    </div>
  );
}

export default InlineSuggestion;
