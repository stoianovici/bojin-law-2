/**
 * Draft Indicator Component
 * Story 5.3: AI-Powered Email Drafting - Task 24
 *
 * Shows visual indication of draft status in thread list:
 * - Draft in progress
 * - Draft ready to send
 * - AI confidence score
 * - Last updated timestamp
 */

'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { DraftStatus, EmailTone } from '@/hooks/useEmailDraft';

interface DraftIndicatorProps {
  status: DraftStatus;
  confidence?: number;
  tone?: EmailTone;
  updatedAt?: string;
  showDetails?: boolean;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<
  DraftStatus,
  { label: string; color: string; bgColor: string; icon: 'edit' | 'check' | 'send' | 'x' }
> = {
  Generated: {
    label: 'Draft AI',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: 'edit',
  },
  Editing: {
    label: 'În editare',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    icon: 'edit',
  },
  Ready: {
    label: 'Gata',
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    icon: 'check',
  },
  Sent: {
    label: 'În Ciorne',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: 'send',
  },
  Discarded: {
    label: 'Anulat',
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: 'x',
  },
};

const TONE_LABELS: Record<EmailTone, string> = {
  Formal: 'Formal',
  Professional: 'Professional',
  Brief: 'Brief',
  Detailed: 'Detailed',
};

export function DraftIndicator({
  status,
  confidence,
  tone,
  updatedAt,
  showDetails = false,
  size = 'md',
}: DraftIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';

  return (
    <div className="inline-flex items-center gap-2">
      {/* Status badge */}
      <span
        className={`inline-flex items-center gap-1 rounded-full font-medium ${config.color} ${config.bgColor} ${sizeClasses}`}
      >
        <StatusIcon type={config.icon} size={size} />
        {config.label}
      </span>

      {/* Additional details */}
      {showDetails && (
        <>
          {/* Confidence score */}
          {confidence !== undefined && status !== 'Sent' && status !== 'Discarded' && (
            <ConfidenceBadge confidence={confidence} size={size} />
          )}

          {/* Tone indicator */}
          {tone && status !== 'Sent' && status !== 'Discarded' && (
            <span
              className={`rounded-full border border-gray-200 bg-white font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 ${sizeClasses}`}
            >
              {TONE_LABELS[tone]}
            </span>
          )}

          {/* Timestamp */}
          {updatedAt && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
            </span>
          )}
        </>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence, size }: { confidence: number; size: 'sm' | 'md' }) {
  const percentage = Math.round(confidence * 100);
  const color =
    percentage >= 80
      ? 'text-green-700 dark:text-green-300'
      : percentage >= 60
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-gray-600 dark:text-gray-400';
  const sizeClasses = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <span className={`font-medium ${color} ${sizeClasses}`} title="AI confidence score">
      {percentage}%
    </span>
  );
}

function StatusIcon({ type, size }: { type: 'edit' | 'check' | 'send' | 'x'; size: 'sm' | 'md' }) {
  const className = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  switch (type) {
    case 'edit':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      );
    case 'check':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'send':
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
    case 'x':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      );
  }
}

/**
 * Compact draft indicator for thread list items
 */
export function DraftIndicatorCompact({
  hasDraft,
  status,
}: {
  hasDraft: boolean;
  status?: DraftStatus;
}) {
  if (!hasDraft) return null;

  const config = status ? STATUS_CONFIG[status] : STATUS_CONFIG.Generated;

  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${config.bgColor}`}
      title={`Draft: ${config.label}`}
    >
      <svg
        className={`h-3 w-3 ${config.color}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
    </span>
  );
}

export default DraftIndicator;
