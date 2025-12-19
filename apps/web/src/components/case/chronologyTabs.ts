/**
 * Chronology Tab Configuration
 * OPS-053: Chronology Tab Bar & Event Filtering
 *
 * Constants and filtering functions for chronology tab categories
 */

import type { CaseEventType } from '../../hooks/useCaseEvents';

// ============================================================================
// Types
// ============================================================================

export type ChronologyTab = 'all' | 'documents' | 'communications' | 'tasks';

export interface TabConfig {
  label: string;
  eventTypes: CaseEventType[] | null; // null = all types
}

// ============================================================================
// Constants
// ============================================================================

export const TAB_CONFIG: Record<ChronologyTab, TabConfig> = {
  all: {
    label: 'Toate',
    eventTypes: null,
  },
  documents: {
    label: 'Documente',
    eventTypes: ['DocumentUploaded', 'DocumentSigned', 'DocumentDeleted'],
  },
  communications: {
    label: 'Comunicări',
    eventTypes: ['EmailReceived', 'EmailSent', 'EmailCourt', 'NoteCreated', 'NoteUpdated'],
  },
  tasks: {
    label: 'Sarcini',
    eventTypes: ['TaskCreated', 'TaskCompleted'],
  },
};

export const TAB_ORDER: ChronologyTab[] = ['all', 'documents', 'communications', 'tasks'];

// ============================================================================
// Filtering Functions
// ============================================================================

/**
 * Filter events by tab category
 * Returns all events if tab is 'all', otherwise filters by configured event types
 */
export function filterEventsByTab<T extends { eventType: CaseEventType }>(
  events: T[],
  tab: ChronologyTab
): T[] {
  const config = TAB_CONFIG[tab];
  if (!config.eventTypes) return events;
  return events.filter((e) => config.eventTypes!.includes(e.eventType));
}

/**
 * Count events per tab category
 * Returns a map of tab -> event count
 */
export function countEventsByTab<T extends { eventType: CaseEventType }>(
  events: T[]
): Record<ChronologyTab, number> {
  return {
    all: events.length,
    documents: filterEventsByTab(events, 'documents').length,
    communications: filterEventsByTab(events, 'communications').length,
    tasks: filterEventsByTab(events, 'tasks').length,
  };
}
