/**
 * TimeSection Component
 * OPS-052: Collapsible TimeSection Component
 *
 * Reusable collapsible section for time-grouped events in the chronology.
 * Displays section header with period label, event count badge, and animated expand/collapse.
 */

'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface TimeSectionProps {
  /** Section label (e.g., "Astăzi", "Săptămâna aceasta") */
  label: string;
  /** Number of events in section */
  count: number;
  /** Whether section starts expanded (default: true) */
  defaultExpanded?: boolean;
  /** Event content to render inside the section */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Collapsible section component for time-grouped chronology events.
 *
 * @param label - Section header label
 * @param count - Number of events displayed as a badge
 * @param defaultExpanded - Initial expand state
 * @param children - Event content
 * @param className - Additional CSS classes
 */
export function TimeSection({
  label,
  count,
  defaultExpanded = true,
  children,
  className,
}: TimeSectionProps) {
  const isEmpty = count === 0;
  const [expanded, setExpanded] = useState(isEmpty ? false : defaultExpanded);

  return (
    <div className={clsx('border-b border-gray-100 last:border-b-0', className)}>
      <button
        onClick={() => !isEmpty && setExpanded(!expanded)}
        className={clsx(
          'w-full px-5 py-3 flex items-center justify-between transition-colors',
          isEmpty ? 'cursor-default' : 'hover:bg-gray-50'
        )}
        aria-expanded={isEmpty ? undefined : expanded}
        disabled={isEmpty}
      >
        <div className="flex items-center gap-2">
          {isEmpty ? (
            <ChevronRight className="h-4 w-4 text-gray-300" />
          ) : expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          <span
            className={clsx('text-sm font-medium', isEmpty ? 'text-gray-400' : 'text-gray-700')}
          >
            {label}
          </span>
        </div>
        <span
          className={clsx(
            'text-xs px-2 py-0.5 rounded-full',
            isEmpty ? 'text-gray-400 bg-gray-50' : 'text-gray-500 bg-gray-100'
          )}
        >
          {count}
        </span>
      </button>

      {expanded && !isEmpty && <div className="divide-y divide-gray-100">{children}</div>}
    </div>
  );
}

TimeSection.displayName = 'TimeSection';
