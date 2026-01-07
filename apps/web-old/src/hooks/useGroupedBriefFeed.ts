/**
 * Grouped Brief Feed Hook
 * OPS-301: useGroupedBriefFeed Hook
 *
 * Transforms the flat BriefFeed into meaningful sections:
 * - Urgente (urgent): Deadlines within 48h, high-priority items, overdue tasks
 * - Dosarele mele (myCases): Items from cases where user is actor or assigned
 * - Activitate echipă (team): Items from other team members
 * - Mai vechi (archive): Items older than 24 hours
 */

import { useMemo } from 'react';
import { useBriefFeed, type BriefItem, type BriefFeedInput } from './useBriefFeed';
import { useAuth } from '../lib/hooks/useAuth';

// ============================================================================
// Types
// ============================================================================

export interface BriefSection {
  key: 'urgent' | 'myCases' | 'team' | 'archive';
  title: string;
  items: BriefItem[];
  count: number;
  defaultExpanded: boolean;
}

export interface GroupedBriefFeed {
  sections: BriefSection[];
  totalCount: number;
  loading: boolean;
  error?: Error;
  refetch: () => void;
  fetchMore: () => void;
  hasMore: boolean;
}

// ============================================================================
// Section Configuration
// ============================================================================

const SECTION_CONFIG: Record<BriefSection['key'], { title: string; defaultExpanded: boolean }> = {
  urgent: { title: 'Urgente', defaultExpanded: true },
  myCases: { title: 'Dosarele mele', defaultExpanded: true },
  team: { title: 'Activitate echipă', defaultExpanded: false },
  archive: { title: 'Mai vechi', defaultExpanded: false },
};

// ============================================================================
// Grouping Logic
// ============================================================================

/**
 * Check if an item is urgent:
 * - DEADLINE_SET type created within last 48 hours (newly set deadlines need attention)
 *
 * Note: BriefItem.occurredAt is when the event happened, not the deadline date.
 * So for DEADLINE_SET, a recent occurredAt means "deadline was just set" - worth surfacing.
 */
function isUrgent(item: BriefItem): boolean {
  if (item.type === 'DEADLINE_SET') {
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const itemDate = new Date(item.occurredAt);
    // Deadline items are urgent if recently set (within 48h)
    return itemDate > fortyEightHoursAgo;
  }
  return false;
}

/**
 * Check if item belongs to current user's cases
 */
function isMyCases(item: BriefItem, userId: string): boolean {
  return item.actorId === userId;
}

/**
 * Check if item is recent (within last 24 hours)
 */
function isRecent(item: BriefItem): boolean {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const itemDate = new Date(item.occurredAt);
  return itemDate > yesterday;
}

/**
 * Group items into sections with deduplication.
 * Items appear in highest priority section only.
 * Priority: urgent > myCases > team > archive
 */
function groupItems(items: BriefItem[], userId: string): BriefSection[] {
  const categorized = new Set<string>();

  const urgent: BriefItem[] = [];
  const myCases: BriefItem[] = [];
  const team: BriefItem[] = [];
  const archive: BriefItem[] = [];

  for (const item of items) {
    // Skip if already categorized
    if (categorized.has(item.id)) continue;

    // Check categories in priority order
    if (isUrgent(item)) {
      urgent.push(item);
      categorized.add(item.id);
    } else if (isMyCases(item, userId)) {
      myCases.push(item);
      categorized.add(item.id);
    } else if (isRecent(item)) {
      // Recent items from other team members
      team.push(item);
      categorized.add(item.id);
    } else {
      // Older items
      archive.push(item);
      categorized.add(item.id);
    }
  }

  // Build sections, filtering out empty ones
  const sections: BriefSection[] = [];

  if (urgent.length > 0) {
    sections.push({
      key: 'urgent',
      title: SECTION_CONFIG.urgent.title,
      items: urgent,
      count: urgent.length,
      defaultExpanded: SECTION_CONFIG.urgent.defaultExpanded,
    });
  }

  if (myCases.length > 0) {
    sections.push({
      key: 'myCases',
      title: SECTION_CONFIG.myCases.title,
      items: myCases,
      count: myCases.length,
      defaultExpanded: SECTION_CONFIG.myCases.defaultExpanded,
    });
  }

  if (team.length > 0) {
    sections.push({
      key: 'team',
      title: SECTION_CONFIG.team.title,
      items: team,
      count: team.length,
      defaultExpanded: SECTION_CONFIG.team.defaultExpanded,
    });
  }

  if (archive.length > 0) {
    sections.push({
      key: 'archive',
      title: SECTION_CONFIG.archive.title,
      items: archive,
      count: archive.length,
      defaultExpanded: SECTION_CONFIG.archive.defaultExpanded,
    });
  }

  return sections;
}

// ============================================================================
// Hook
// ============================================================================

export function useGroupedBriefFeed(input?: BriefFeedInput): GroupedBriefFeed {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const { items, totalCount, hasMore, loading, error, refetch, fetchMore } = useBriefFeed(input);

  // Memoize grouping to avoid recalculation on every render
  const sections = useMemo(() => groupItems(items, userId), [items, userId]);

  return {
    sections,
    totalCount,
    loading,
    error,
    refetch,
    fetchMore,
    hasMore,
  };
}

// ============================================================================
// Exports for Testing
// ============================================================================

export { groupItems, isUrgent, isMyCases, isRecent };
