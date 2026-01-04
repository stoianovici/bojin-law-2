'use client';

import { useState, useMemo } from 'react';
import {
  FileText,
  Mail,
  CheckSquare,
  Scale,
  FileCheck,
  Users,
  Clock,
  UserCheck,
  RefreshCw,
  Flag,
  ChevronDown,
} from 'lucide-react';
import { formatDistanceToNow, format, isToday } from 'date-fns';
import { ro } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DocumentQuickView } from './DocumentQuickView';

// ============================================================================
// Types (exported for use by TimelineView and other components)
// ============================================================================

export type CaseChapterEventType =
  | 'Document'
  | 'Email'
  | 'Task'
  | 'CourtOutcome'
  | 'ContractSigned'
  | 'Negotiation'
  | 'Deadline'
  | 'ClientDecision'
  | 'TeamChange'
  | 'StatusChange'
  | 'Milestone';

export interface DocumentQuickInfo {
  id: string;
  name: string;
  fileType: string;
  size?: number;
  uploadedAt?: string;
}

export interface EmailQuickInfo {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
}

export interface CaseChapterEvent {
  id: string;
  eventType: CaseChapterEventType;
  title: string;
  summary: string;
  occurredAt: string;
  metadata: {
    documentIds?: string[];
    emailIds?: string[];
    documents?: DocumentQuickInfo[];
    emails?: EmailQuickInfo[];
  };
}

export interface TimelineEventProps {
  event: CaseChapterEvent;
  className?: string;
}

// Unified type for display in the attachments section
interface AttachedItem {
  id: string;
  name: string;
  type: 'document' | 'email';
  mimeType?: string;
}

// ============================================================================
// Event Type Configuration
// ============================================================================

interface EventTypeConfig {
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
}

const eventTypeConfig: Record<CaseChapterEventType, EventTypeConfig> = {
  // Legal events - accent color
  CourtOutcome: {
    icon: Scale,
    colorClass: 'text-linear-accent',
    bgClass: 'bg-linear-accent/10',
  },
  ContractSigned: {
    icon: FileCheck,
    colorClass: 'text-linear-accent',
    bgClass: 'bg-linear-accent/10',
  },

  // Communication events - blue
  Email: {
    icon: Mail,
    colorClass: 'text-blue-500',
    bgClass: 'bg-blue-500/10',
  },
  Negotiation: {
    icon: Users,
    colorClass: 'text-blue-500',
    bgClass: 'bg-blue-500/10',
  },

  // Document events - emerald
  Document: {
    icon: FileText,
    colorClass: 'text-emerald-500',
    bgClass: 'bg-emerald-500/10',
  },

  // Task events - purple
  Task: {
    icon: CheckSquare,
    colorClass: 'text-purple-500',
    bgClass: 'bg-purple-500/10',
  },

  // Status/Admin events - gray
  Deadline: {
    icon: Clock,
    colorClass: 'text-gray-400',
    bgClass: 'bg-gray-500/10',
  },
  ClientDecision: {
    icon: UserCheck,
    colorClass: 'text-gray-400',
    bgClass: 'bg-gray-500/10',
  },
  TeamChange: {
    icon: Users,
    colorClass: 'text-gray-400',
    bgClass: 'bg-gray-500/10',
  },
  StatusChange: {
    icon: RefreshCw,
    colorClass: 'text-gray-400',
    bgClass: 'bg-gray-500/10',
  },
  Milestone: {
    icon: Flag,
    colorClass: 'text-amber-500',
    bgClass: 'bg-amber-500/10',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatEventTime(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  // If today, show relative time for recent events or time
  if (isToday(date)) {
    const hoursAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 12) {
      return formatDistanceToNow(date, { addSuffix: true, locale: ro });
    }
    return format(date, 'HH:mm', { locale: ro });
  }

  // Otherwise show date and time
  return format(date, 'd MMM, HH:mm', { locale: ro });
}

function getAttachedItems(event: CaseChapterEvent): AttachedItem[] {
  const items: AttachedItem[] = [];

  // Add documents from metadata
  if (event.metadata.documents) {
    for (const doc of event.metadata.documents) {
      items.push({
        id: doc.id,
        name: doc.name,
        type: 'document',
        mimeType: doc.fileType,
      });
    }
  }

  // Add emails from metadata
  if (event.metadata.emails) {
    for (const email of event.metadata.emails) {
      items.push({
        id: email.id,
        name: email.subject,
        type: 'email',
      });
    }
  }

  return items;
}

function getAttachmentCountLabel(count: number): string {
  if (count === 1) return '1 document atasat';
  return `${count} documente atasate`;
}

// ============================================================================
// Component
// ============================================================================

export function TimelineEvent({ event, className }: TimelineEventProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const config = eventTypeConfig[event.eventType];
  const Icon = config.icon;
  const formattedTime = formatEventTime(event.occurredAt);
  const attachedItems = useMemo(() => getAttachedItems(event), [event]);
  const hasAttachments = attachedItems.length > 0;

  return (
    <div
      className={cn(
        'bg-linear-bg-elevated border border-linear-border-subtle rounded-lg',
        className
      )}
    >
      {/* Main Content */}
      <div className="p-4">
        {/* Header Row: Icon + Title + Timestamp */}
        <div className="flex items-start gap-3">
          {/* Event Type Icon */}
          <div
            className={cn(
              'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
              config.bgClass
            )}
          >
            <Icon className={cn('w-4 h-4', config.colorClass)} />
          </div>

          {/* Title and Content */}
          <div className="flex-1 min-w-0">
            {/* Title Row */}
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium text-linear-text-primary leading-tight">
                {event.title}
              </h4>
              <span className="text-xs text-linear-text-tertiary shrink-0 mt-0.5">
                {formattedTime}
              </span>
            </div>

            {/* Summary */}
            {event.summary && (
              <p className="mt-1.5 text-sm text-linear-text-secondary line-clamp-3">
                {event.summary}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Attachments Section */}
      {hasAttachments && (
        <div className="border-t border-linear-border-subtle">
          {/* Toggle Button */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              'w-full px-4 py-2.5 flex items-center justify-between',
              'text-sm text-linear-text-secondary',
              'hover:bg-linear-bg-tertiary transition-colors',
              isExpanded && 'bg-linear-bg-tertiary'
            )}
          >
            <span>{getAttachmentCountLabel(attachedItems.length)}</span>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-linear-text-tertiary transition-transform duration-200',
                isExpanded && 'rotate-180'
              )}
            />
          </button>

          {/* Expanded Documents List */}
          {isExpanded && (
            <div className="px-4 pb-3 space-y-2">
              {attachedItems.map((item) => (
                <DocumentQuickView
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  type={item.type}
                  mimeType={item.mimeType}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
