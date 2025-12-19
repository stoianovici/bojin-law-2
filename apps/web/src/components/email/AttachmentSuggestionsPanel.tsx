/**
 * Attachment Suggestions Panel Component
 * Story 5.3: AI-Powered Email Drafting - Task 19
 *
 * Displays suggested attachments with selection support
 */

'use client';

import React from 'react';
import type { AttachmentSuggestion } from '@/hooks/useEmailDraft';

interface AttachmentSuggestionsPanelProps {
  suggestions: AttachmentSuggestion[];
  onToggle: (suggestionId: string, selected: boolean) => void;
}

export function AttachmentSuggestionsPanel({
  suggestions,
  onToggle,
}: AttachmentSuggestionsPanelProps) {
  return (
    <div className="p-4" role="group" aria-label="Suggested attachments">
      <div className="space-y-3">
        {suggestions.map((suggestion) => (
          <AttachmentSuggestionItem
            key={suggestion.id}
            suggestion={suggestion}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

function AttachmentSuggestionItem({
  suggestion,
  onToggle,
}: {
  suggestion: AttachmentSuggestion;
  onToggle: (suggestionId: string, selected: boolean) => void;
}) {
  const relevanceLevel =
    suggestion.relevanceScore >= 0.8 ? 'high' : suggestion.relevanceScore >= 0.6 ? 'medium' : 'low';

  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      {/* Checkbox */}
      <label className="flex cursor-pointer items-center">
        <input
          type="checkbox"
          checked={suggestion.isSelected}
          onChange={(e) => onToggle(suggestion.id, e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
          aria-describedby={`suggestion-reason-${suggestion.id}`}
          aria-label={`Select attachment: ${suggestion.title}`}
        />
      </label>

      {/* Document icon */}
      <div className="flex-shrink-0">
        <DocumentIcon type={suggestion.document?.fileType} className="h-10 w-10 text-gray-400" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-gray-900 dark:text-white">
            {suggestion.title}
          </span>
          <RelevanceIndicator level={relevanceLevel} />
        </div>
        <p
          id={`suggestion-reason-${suggestion.id}`}
          className="mt-1 text-sm text-gray-500 dark:text-gray-400"
        >
          {suggestion.reason}
        </p>
        {suggestion.document && (
          <span className="mt-1 inline-block text-xs text-gray-400 dark:text-gray-500">
            {suggestion.document.fileType}
          </span>
        )}
      </div>
    </div>
  );
}

function RelevanceIndicator({ level }: { level: 'high' | 'medium' | 'low' }) {
  const config = {
    high: {
      label: 'Ridicată',
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    },
    medium: {
      label: 'Medie',
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    low: {
      label: 'Scăzută',
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    },
  };

  const { label, className } = config[level];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function DocumentIcon({ type, className }: { type?: string; className?: string }) {
  const lowerType = (type || '').toLowerCase();

  if (lowerType.includes('pdf')) {
    return (
      <svg className={className} viewBox="0 0 40 40" fill="currentColor">
        <path d="M8 4h16l8 8v24a4 4 0 01-4 4H8a4 4 0 01-4-4V8a4 4 0 014-4z" fill="#EF4444" />
        <path d="M24 4l8 8h-8V4z" fill="#FCA5A5" />
        <text x="12" y="28" fontSize="8" fill="white" fontWeight="bold">
          PDF
        </text>
      </svg>
    );
  }

  if (lowerType.includes('doc') || lowerType.includes('word')) {
    return (
      <svg className={className} viewBox="0 0 40 40" fill="currentColor">
        <path d="M8 4h16l8 8v24a4 4 0 01-4 4H8a4 4 0 01-4-4V8a4 4 0 014-4z" fill="#2563EB" />
        <path d="M24 4l8 8h-8V4z" fill="#93C5FD" />
        <text x="8" y="28" fontSize="8" fill="white" fontWeight="bold">
          DOC
        </text>
      </svg>
    );
  }

  // Default document icon
  return (
    <svg className={className} viewBox="0 0 40 40" fill="currentColor">
      <path d="M8 4h16l8 8v24a4 4 0 01-4 4H8a4 4 0 01-4-4V8a4 4 0 014-4z" fill="#6B7280" />
      <path d="M24 4l8 8h-8V4z" fill="#D1D5DB" />
      <path d="M10 18h20M10 24h20M10 30h12" stroke="white" strokeWidth="2" />
    </svg>
  );
}
