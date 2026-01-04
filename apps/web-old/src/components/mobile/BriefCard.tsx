/**
 * BriefCard Component
 * OPS-298: Mobile Home - Fresh Build
 *
 * Individual card in the Brief feed showing activity items.
 * Supports different types: email, document, note, deadline.
 */

'use client';

import React from 'react';
import { clsx } from 'clsx';
import { Mail, MailOpen, FileText, CheckCircle, Upload, StickyNote, Clock } from 'lucide-react';
import type { BriefItem, BriefItemType } from '../../hooks/useBriefFeed';

// ============================================================================
// Types
// ============================================================================

export interface BriefCardProps {
  item: BriefItem;
  onTap?: (item: BriefItem) => void;
}

// ============================================================================
// Icon Mapping
// ============================================================================

function getIcon(type: BriefItemType) {
  switch (type) {
    case 'EMAIL_RECEIVED':
      return <Mail className="w-5 h-5" />;
    case 'EMAIL_SENT':
      return <MailOpen className="w-5 h-5" />;
    case 'DOCUMENT_APPROVED':
      return <CheckCircle className="w-5 h-5" />;
    case 'DOCUMENT_UPLOADED':
    case 'DOCUMENT_RECEIVED':
      return <Upload className="w-5 h-5" />;
    case 'NOTE_ADDED':
      return <StickyNote className="w-5 h-5" />;
    case 'DEADLINE_SET':
      return <Clock className="w-5 h-5" />;
    default:
      return <FileText className="w-5 h-5" />;
  }
}

function getIconStyle(type: BriefItemType): string {
  switch (type) {
    case 'EMAIL_RECEIVED':
      return 'bg-blue-500/15 text-blue-400';
    case 'EMAIL_SENT':
      return 'bg-linear-success/15 text-linear-success';
    case 'DOCUMENT_APPROVED':
      return 'bg-linear-success/15 text-linear-success';
    case 'DOCUMENT_UPLOADED':
    case 'DOCUMENT_RECEIVED':
      return 'bg-linear-accent-muted text-linear-accent';
    case 'NOTE_ADDED':
      return 'bg-linear-warning/15 text-linear-warning';
    case 'DEADLINE_SET':
      return 'bg-linear-error/15 text-linear-error';
    default:
      return 'bg-linear-bg-tertiary text-linear-text-secondary';
  }
}

// ============================================================================
// Component
// ============================================================================

export function BriefCard({ item, onTap }: BriefCardProps) {
  const handleClick = () => {
    onTap?.(item);
  };

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'w-full text-left bg-linear-bg-secondary rounded-xl p-4 border border-linear-border-subtle',
        'transition-all duration-150 ease-out',
        'hover:border-linear-border-default hover:bg-linear-bg-tertiary',
        'active:scale-[0.98]',
        'focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-2 focus:ring-offset-linear-bg-primary'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={clsx('p-2 rounded-lg flex-shrink-0', getIconStyle(item.type))}
          aria-hidden="true"
        >
          {getIcon(item.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Type label */}
          <div className="text-xs text-linear-text-tertiary mb-0.5">{item.title}</div>

          {/* Title/subtitle */}
          <div className="font-medium text-linear-text-primary truncate">
            {item.subtitle || item.preview}
          </div>

          {/* Preview or case name */}
          {item.preview && item.subtitle && (
            <div className="text-sm text-linear-text-secondary truncate">{item.preview}</div>
          )}

          {/* Case name if different from subtitle */}
          {item.caseName && (
            <div className="text-xs text-linear-text-muted mt-1 truncate">
              Dosar: {item.caseName}
            </div>
          )}
        </div>

        {/* Relative time */}
        <div className="text-xs text-linear-text-muted flex-shrink-0 whitespace-nowrap">
          {item.relativeTime}
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

export function BriefCardSkeleton() {
  return (
    <div className="bg-linear-bg-secondary rounded-xl p-4 border border-linear-border-subtle animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-linear-bg-tertiary rounded-lg flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-3 bg-linear-bg-tertiary rounded w-16" />
          <div className="h-4 bg-linear-bg-tertiary rounded w-3/4" />
          <div className="h-3 bg-linear-bg-tertiary rounded w-1/2" />
        </div>
        <div className="h-3 bg-linear-bg-tertiary rounded w-12 flex-shrink-0" />
      </div>
    </div>
  );
}
