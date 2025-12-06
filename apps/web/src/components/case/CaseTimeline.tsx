'use client';

/**
 * Case Timeline Component
 * Story 5.2: Communication Intelligence Engine
 *
 * Displays case events chronologically including tasks, documents,
 * extracted items, and risk indicators.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import {
  Clock,
  FileText,
  CheckSquare,
  AlertTriangle,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Filter,
  Loader2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type TimelineEventType = 'task' | 'document' | 'deadline' | 'commitment' | 'risk';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  timestamp: string;
  sourceId: string;
  sourceType: 'email' | 'document' | 'task';
  metadata?: {
    status?: string;
    priority?: string;
    severity?: string;
    dueDate?: string;
    confidence?: number;
  };
}

export interface CaseTimelineProps {
  caseId: string;
  events: TimelineEvent[];
  isLoading?: boolean;
  onEventClick?: (event: TimelineEvent) => void;
}

type FilterType = 'all' | 'deadlines' | 'commitments' | 'risks' | 'tasks' | 'documents';

// ============================================================================
// Helper Functions
// ============================================================================

function formatDateGroup(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

function getEventIcon(type: TimelineEventType): React.ReactNode {
  const iconClass = 'h-4 w-4';
  switch (type) {
    case 'task':
      return <CheckSquare className={`${iconClass} text-blue-500`} aria-hidden="true" />;
    case 'document':
      return <FileText className={`${iconClass} text-green-500`} aria-hidden="true" />;
    case 'deadline':
      return <Clock className={`${iconClass} text-orange-500`} aria-hidden="true" />;
    case 'commitment':
      return <ClipboardList className={`${iconClass} text-purple-500`} aria-hidden="true" />;
    case 'risk':
      return <AlertTriangle className={`${iconClass} text-red-500`} aria-hidden="true" />;
  }
}

function getEventTypeLabel(type: TimelineEventType): string {
  const labels: Record<TimelineEventType, string> = {
    task: 'Task',
    document: 'Document',
    deadline: 'Deadline',
    commitment: 'Commitment',
    risk: 'Risk indicator',
  };
  return labels[type];
}

function getSourceLink(event: TimelineEvent): string {
  switch (event.sourceType) {
    case 'email':
      return `/emails?id=${event.sourceId}`;
    case 'document':
      return `/documents?id=${event.sourceId}`;
    case 'task':
      return `/tasks?id=${event.sourceId}`;
  }
}

// ============================================================================
// Event Card Component
// ============================================================================

interface EventCardProps {
  event: TimelineEvent;
  onClick?: () => void;
  isLast: boolean;
  focusIndex: number;
  currentFocus: number;
}

function EventCard({ event, onClick, isLast, focusIndex, currentFocus }: EventCardProps) {
  const isFocused = focusIndex === currentFocus;

  return (
    <article
      className={`relative pl-8 pb-4 ${!isLast ? 'border-l-2 border-gray-200 ml-2' : 'ml-2'}`}
      aria-label={`${getEventTypeLabel(event.type)} on ${format(parseISO(event.timestamp), 'MMMM d, yyyy')}: ${event.title}`}
      tabIndex={isFocused ? 0 : -1}
      data-focus-index={focusIndex}
    >
      {/* Timeline dot */}
      <div className="absolute left-0 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center">
        {getEventIcon(event.type)}
      </div>

      {/* Event content */}
      <div
        className={`bg-white rounded-lg border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
          isFocused ? 'ring-2 ring-blue-500' : ''
        }`}
        onClick={onClick}
        role="button"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                {getEventTypeLabel(event.type)}
              </span>
              <span className="text-xs text-gray-500">
                {format(parseISO(event.timestamp), 'h:mm a')}
              </span>
            </div>
            <h4 className="font-medium text-sm mt-1">{event.title}</h4>
            {event.description && (
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{event.description}</p>
            )}
            {/* Metadata badges */}
            {event.metadata && (
              <div className="flex items-center gap-2 mt-2">
                {event.metadata.priority && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      event.metadata.priority === 'High' || event.metadata.priority === 'Urgent'
                        ? 'bg-red-100 text-red-800'
                        : event.metadata.priority === 'Medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {event.metadata.priority}
                  </span>
                )}
                {event.metadata.severity && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      event.metadata.severity === 'High'
                        ? 'bg-red-100 text-red-800'
                        : event.metadata.severity === 'Medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                    }`}
                    aria-label={`Severity: ${event.metadata.severity}`}
                  >
                    {event.metadata.severity} severity
                  </span>
                )}
                {event.metadata.status && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    {event.metadata.status}
                  </span>
                )}
              </div>
            )}
          </div>
          <a
            href={getSourceLink(event)}
            className="text-gray-400 hover:text-blue-500 p-1"
            aria-label={`View source ${event.sourceType}`}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  );
}

// ============================================================================
// Date Group Component
// ============================================================================

interface DateGroupProps {
  date: string;
  events: TimelineEvent[];
  isExpanded: boolean;
  onToggle: () => void;
  onEventClick?: (event: TimelineEvent) => void;
  startFocusIndex: number;
  currentFocus: number;
}

function DateGroup({
  date,
  events,
  isExpanded,
  onToggle,
  onEventClick,
  startFocusIndex,
  currentFocus,
}: DateGroupProps) {
  const dateObj = parseISO(date);
  const dateLabel = formatDateGroup(dateObj);

  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 py-2 px-3 bg-gray-50 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-expanded={isExpanded}
        aria-controls={`events-${date}`}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500" aria-hidden="true" />
        )}
        <span className="font-medium text-sm">{dateLabel}</span>
        <span className="text-xs text-gray-500">({events.length} events)</span>
      </button>

      {isExpanded && (
        <div id={`events-${date}`} className="mt-2 ml-4">
          {events.map((event, idx) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={() => onEventClick?.(event)}
              isLast={idx === events.length - 1}
              focusIndex={startFocusIndex + idx}
              currentFocus={currentFocus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Timeline Component
// ============================================================================

export function CaseTimeline({ caseId: _caseId, events, isLoading, onEventClick }: CaseTimelineProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [currentFocus, setCurrentFocus] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;

    const filterMap: Record<FilterType, TimelineEventType[]> = {
      all: ['task', 'document', 'deadline', 'commitment', 'risk'],
      deadlines: ['deadline'],
      commitments: ['commitment'],
      risks: ['risk'],
      tasks: ['task'],
      documents: ['document'],
    };

    return events.filter((e) => filterMap[filter].includes(e.type));
  }, [events, filter]);

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {};

    filteredEvents.forEach((event) => {
      const dateKey = format(parseISO(event.timestamp), 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });

    // Sort groups by date (most recent first)
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    // Sort events within each group by time (most recent first)
    sortedDates.forEach((date) => {
      groups[date].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    });

    return { groups, sortedDates };
  }, [filteredEvents]);

  // Auto-expand today and yesterday
  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
    setExpandedDates(new Set([today, yesterday]));
  }, []);

  // Toggle date group
  const toggleDateGroup = useCallback((date: string) => {
    setExpandedDates((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const totalEvents = filteredEvents.length;
      if (totalEvents === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setCurrentFocus((prev) => Math.min(prev + 1, totalEvents - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setCurrentFocus((prev) => Math.max(prev - 1, 0));
          break;
        case 'Home':
          e.preventDefault();
          setCurrentFocus(0);
          break;
        case 'End':
          e.preventDefault();
          setCurrentFocus(totalEvents - 1);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          const focusedEvent = filteredEvents[currentFocus];
          if (focusedEvent) {
            onEventClick?.(focusedEvent);
          }
          break;
      }
    },
    [filteredEvents, currentFocus, onEventClick]
  );

  // Focus management
  useEffect(() => {
    if (containerRef.current) {
      const focusedElement = containerRef.current.querySelector(
        `[data-focus-index="${currentFocus}"]`
      ) as HTMLElement;
      focusedElement?.focus();
    }
  }, [currentFocus]);

  // Loading state
  if (isLoading) {
    return (
      <div
        className="p-4 flex items-center justify-center"
        role="feed"
        aria-busy="true"
        aria-label="Case timeline loading"
      >
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" aria-hidden="true" />
        <span className="ml-2 text-sm text-gray-600">Loading timeline...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="p-4"
      role="feed"
      aria-busy={isLoading}
      aria-label="Case timeline"
      onKeyDown={handleKeyDown}
    >
      {/* Header with filter */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">Case Timeline</h2>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" aria-hidden="true" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter timeline events"
          >
            <option value="all">All events</option>
            <option value="deadlines">Deadlines</option>
            <option value="commitments">Commitments</option>
            <option value="risks">Risk indicators</option>
            <option value="tasks">Tasks</option>
            <option value="documents">Documents</option>
          </select>
        </div>
      </div>

      {/* Empty state */}
      {filteredEvents.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" aria-hidden="true" />
          <p className="text-sm">No events found</p>
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="text-sm text-blue-500 hover:underline mt-2"
            >
              Show all events
            </button>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-2">
        {groupedEvents.sortedDates.map((date, groupIndex) => {
          // Calculate starting focus index for this group
          let startFocusIndex = 0;
          for (let i = 0; i < groupIndex; i++) {
            startFocusIndex += groupedEvents.groups[groupedEvents.sortedDates[i]].length;
          }

          return (
            <DateGroup
              key={date}
              date={date}
              events={groupedEvents.groups[date]}
              isExpanded={expandedDates.has(date)}
              onToggle={() => toggleDateGroup(date)}
              onEventClick={onEventClick}
              startFocusIndex={startFocusIndex}
              currentFocus={currentFocus}
            />
          );
        })}
      </div>
    </div>
  );
}

export default CaseTimeline;
