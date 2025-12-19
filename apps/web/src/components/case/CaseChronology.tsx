/**
 * CaseChronology Component
 * OPS-050: Overview Tab AI Summary UI
 * OPS-054: CaseChronology Integration (tabs, time grouping, collapsible sections)
 *
 * Displays paginated case events timeline with:
 * - Category tabs (Toate, Documente, Comunicări, Sarcini)
 * - Time-grouped sections (Astăzi, Săptămâna aceasta, Luna aceasta, Mai vechi)
 * - Collapsible sections with event counts
 * - Importance scoring badges
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  Calendar,
  FileText,
  Mail,
  MessageSquare,
  CheckCircle,
  UserPlus,
  Users,
  AlertCircle,
  Trash2,
  PenTool,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { clsx } from 'clsx';
import { useCaseEvents, type CaseEventType, type EventImportance } from '../../hooks/useCaseEvents';
import { ChronologyTabBar } from './ChronologyTabBar';
import { TimeSection } from './TimeSection';
import { filterEventsByTab, type ChronologyTab } from './chronologyTabs';
import { groupEventsByTimePeriod, type TimePeriod } from '../../lib/timeGrouping';

// ============================================================================
// Types
// ============================================================================

interface CaseChronologyProps {
  caseId: string;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const EVENT_ICONS: Record<CaseEventType, React.ComponentType<{ className?: string }>> = {
  DocumentUploaded: FileText,
  DocumentSigned: PenTool,
  DocumentDeleted: Trash2,
  EmailReceived: Mail,
  EmailSent: Mail,
  EmailCourt: AlertCircle,
  NoteCreated: MessageSquare,
  NoteUpdated: MessageSquare,
  TaskCreated: CheckCircle,
  TaskCompleted: CheckCircle,
  CaseStatusChanged: AlertCircle,
  TeamMemberAdded: UserPlus,
  ContactAdded: Users,
};

const EVENT_COLORS: Record<CaseEventType, string> = {
  DocumentUploaded: 'text-blue-500',
  DocumentSigned: 'text-green-600',
  DocumentDeleted: 'text-red-500',
  EmailReceived: 'text-blue-500',
  EmailSent: 'text-indigo-500',
  EmailCourt: 'text-red-600',
  NoteCreated: 'text-gray-500',
  NoteUpdated: 'text-gray-500',
  TaskCreated: 'text-yellow-500',
  TaskCompleted: 'text-green-500',
  CaseStatusChanged: 'text-purple-500',
  TeamMemberAdded: 'text-teal-500',
  ContactAdded: 'text-orange-500',
};

const IMPORTANCE_STYLES: Record<EventImportance, string> = {
  High: 'bg-red-100 text-red-700 border-red-200',
  Medium: 'bg-gray-100 text-gray-600 border-gray-200',
  Low: 'bg-gray-50 text-gray-400 border-gray-100',
};

/** Default expand state for time sections - recent sections expanded, older collapsed */
const DEFAULT_EXPANDED: Record<TimePeriod, boolean> = {
  today: true,
  thisWeek: true,
  thisMonth: false,
  older: false,
};

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState() {
  return (
    <div className="px-5 py-8 text-center">
      <Calendar className="h-8 w-8 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">Nu există evenimente înregistrate</p>
      <p className="text-xs text-gray-400 mt-1">
        Evenimentele vor apărea pe măsură ce se adaugă documente, emailuri și sarcini
      </p>
    </div>
  );
}

// ============================================================================
// Empty Tab State Component
// ============================================================================

const EMPTY_TAB_MESSAGES: Record<ChronologyTab, string> = {
  all: 'Nu există evenimente înregistrate',
  documents: 'Nu există documente în cronologie',
  communications: 'Nu există comunicări în cronologie',
  tasks: 'Nu există sarcini în cronologie',
};

function EmptyTabState({ tab }: { tab: ChronologyTab }) {
  return (
    <div className="px-5 py-8 text-center">
      <p className="text-sm text-gray-500">{EMPTY_TAB_MESSAGES[tab]}</p>
    </div>
  );
}

// ============================================================================
// Skeleton Component
// ============================================================================

function ChronologySkeleton() {
  return (
    <div className="divide-y divide-gray-100 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="px-5 py-3 flex items-start gap-3">
          <div className="w-16 h-4 bg-gray-200 rounded" />
          <div className="w-4 h-4 bg-gray-200 rounded" />
          <div className="flex-1">
            <div className="h-4 w-3/4 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-1/2 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Event Item Component
// ============================================================================

interface EventItemProps {
  event: {
    id: string;
    eventType: CaseEventType;
    occurredAt: string;
    title: string;
    description?: string;
    importance: EventImportance;
    actor?: {
      firstName?: string;
      lastName?: string;
    };
  };
}

function EventItem({ event }: EventItemProps) {
  const Icon = EVENT_ICONS[event.eventType] || Calendar;
  const iconColor = EVENT_COLORS[event.eventType] || 'text-gray-400';

  return (
    <div className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50">
      <div className="text-xs text-gray-500 w-16 flex-shrink-0 pt-0.5">
        {format(new Date(event.occurredAt), 'dd MMM', { locale: ro })}
      </div>
      <Icon className={clsx('h-4 w-4 flex-shrink-0 mt-0.5', iconColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900">{event.title}</p>
        {event.description && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{event.description}</p>
        )}
        {event.actor && (
          <p className="text-xs text-gray-400 mt-0.5">
            de {event.actor.firstName} {event.actor.lastName}
          </p>
        )}
      </div>
      {event.importance === 'High' && (
        <span
          className={clsx(
            'text-xs px-1.5 py-0.5 rounded border flex-shrink-0',
            IMPORTANCE_STYLES[event.importance]
          )}
        >
          Important
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CaseChronology({ caseId, className }: CaseChronologyProps) {
  const { events, loading, loadMore, hasMore, totalCount, countsByCategory } =
    useCaseEvents(caseId);
  const [activeTab, setActiveTab] = useState<ChronologyTab>('all');

  // Filter events by selected tab
  const filteredEvents = useMemo(() => filterEventsByTab(events, activeTab), [events, activeTab]);

  // Group filtered events by time period (OPS-057: always show all 4 sections)
  const groupedEvents = useMemo(
    () => groupEventsByTimePeriod(filteredEvents, { includeEmptyPeriods: true }),
    [filteredEvents]
  );

  // OPS-055: Use server-side counts for tab badges (not derived from loaded events)
  const tabCounts = countsByCategory;

  const isEmpty = !loading && events.length === 0;

  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200', className)}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-green-500" />
          <h3 className="font-semibold text-gray-900">Cronologie</h3>
        </div>
        {totalCount > 0 && <span className="text-xs text-gray-500">{totalCount} evenimente</span>}
      </div>

      {/* Tab Bar */}
      <ChronologyTabBar activeTab={activeTab} counts={tabCounts} onTabChange={setActiveTab} />

      {/* Content */}
      {loading && events.length === 0 ? (
        <ChronologySkeleton />
      ) : isEmpty ? (
        <EmptyState />
      ) : filteredEvents.length === 0 ? (
        <EmptyTabState tab={activeTab} />
      ) : (
        <>
          {groupedEvents.map((group) => (
            <TimeSection
              key={group.period}
              label={group.label}
              count={group.count}
              defaultExpanded={DEFAULT_EXPANDED[group.period]}
            >
              {group.events.map((event) => (
                <EventItem key={event.id} event={event} />
              ))}
            </TimeSection>
          ))}

          {hasMore && (
            <div className="px-5 py-3 border-t border-gray-100">
              <button
                onClick={loadMore}
                disabled={loading}
                className={clsx(
                  'w-full text-sm text-blue-600 hover:text-blue-700 font-medium',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'flex items-center justify-center gap-2'
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Se încarcă...
                  </>
                ) : (
                  'Încarcă mai multe'
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

CaseChronology.displayName = 'CaseChronology';
