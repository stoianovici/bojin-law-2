/**
 * Case Chapters Components
 *
 * Components for the archival case history browsing experience.
 * Includes AI-generated chapter accordion, timeline views, and search.
 */

// ============================================================================
// Core Components
// ============================================================================

export { ChapterAccordion } from './ChapterAccordion';
export type { ChapterAccordionProps } from './ChapterAccordion';

export { ChapterHeader } from './ChapterHeader';
export type { ChapterHeaderProps } from './ChapterHeader';

export { TimelineView } from './TimelineView';
export type { TimelineViewProps } from './TimelineView';

export { TimelineEvent } from './TimelineEvent';
export type { TimelineEventProps } from './TimelineEvent';

export { RawActivityFallback } from './RawActivityFallback';
export type { RawActivityFallbackProps, RawActivity } from './RawActivityFallback';

// ============================================================================
// Support Components
// ============================================================================

export { DocumentQuickView } from './DocumentQuickView';
export type { DocumentQuickViewProps } from './DocumentQuickView';

export { CaseHistorySearchBar } from './CaseHistorySearchBar';
export type { CaseHistorySearchBarProps, SearchResult } from './CaseHistorySearchBar';

// ============================================================================
// Types
// ============================================================================

export type {
  CaseChapter,
  CaseChapterEvent,
  CaseChapterEventType,
  DocumentQuickInfo,
  EmailQuickInfo,
  CasePhase,
} from './ChapterAccordion';
