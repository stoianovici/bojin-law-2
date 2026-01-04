/**
 * Tests for useGroupedBriefFeed hook
 * OPS-301: useGroupedBriefFeed Hook
 */

import { groupItems, isUrgent, isMyCases, isRecent } from './useGroupedBriefFeed';
import type { BriefItem } from './useBriefFeed';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockItem(overrides: Partial<BriefItem> = {}): BriefItem {
  const now = new Date();
  return {
    id: `item-${Math.random().toString(36).substr(2, 9)}`,
    type: 'EMAIL_RECEIVED',
    title: 'Test Item',
    subtitle: null,
    preview: null,
    caseName: 'Test Case',
    caseId: 'case-123',
    actorName: 'John Doe',
    actorId: 'user-456',
    entityType: 'Email',
    entityId: 'email-789',
    occurredAt: now.toISOString(),
    relativeTime: 'acum',
    ...overrides,
  };
}

function hoursAgo(hours: number): string {
  const date = new Date();
  date.setTime(date.getTime() - hours * 60 * 60 * 1000);
  return date.toISOString();
}

function hoursFromNow(hours: number): string {
  const date = new Date();
  date.setTime(date.getTime() + hours * 60 * 60 * 1000);
  return date.toISOString();
}

// ============================================================================
// isUrgent Tests
// ============================================================================

describe('isUrgent', () => {
  it('returns true for DEADLINE_SET items created within last 48 hours', () => {
    const item = createMockItem({
      type: 'DEADLINE_SET',
      occurredAt: hoursAgo(24),
    });
    expect(isUrgent(item)).toBe(true);
  });

  it('returns true for DEADLINE_SET items that just occurred', () => {
    const item = createMockItem({
      type: 'DEADLINE_SET',
      occurredAt: new Date().toISOString(),
    });
    expect(isUrgent(item)).toBe(true);
  });

  it('returns false for non-DEADLINE_SET items', () => {
    const item = createMockItem({
      type: 'EMAIL_RECEIVED',
      occurredAt: hoursAgo(1),
    });
    expect(isUrgent(item)).toBe(false);
  });

  it('returns false for DEADLINE_SET items created more than 48 hours ago', () => {
    const item = createMockItem({
      type: 'DEADLINE_SET',
      occurredAt: hoursAgo(72),
    });
    expect(isUrgent(item)).toBe(false);
  });
});

// ============================================================================
// isMyCases Tests
// ============================================================================

describe('isMyCases', () => {
  const currentUserId = 'current-user-123';

  it('returns true when actorId matches current user', () => {
    const item = createMockItem({
      actorId: currentUserId,
    });
    expect(isMyCases(item, currentUserId)).toBe(true);
  });

  it('returns false when actorId does not match current user', () => {
    const item = createMockItem({
      actorId: 'other-user-456',
    });
    expect(isMyCases(item, currentUserId)).toBe(false);
  });

  it('returns false when actorId is null', () => {
    const item = createMockItem({
      actorId: null,
    });
    expect(isMyCases(item, currentUserId)).toBe(false);
  });
});

// ============================================================================
// isRecent Tests
// ============================================================================

describe('isRecent', () => {
  it('returns true for items within last 24 hours', () => {
    const item = createMockItem({
      occurredAt: hoursAgo(12),
    });
    expect(isRecent(item)).toBe(true);
  });

  it('returns true for items just now', () => {
    const item = createMockItem({
      occurredAt: new Date().toISOString(),
    });
    expect(isRecent(item)).toBe(true);
  });

  it('returns false for items older than 24 hours', () => {
    const item = createMockItem({
      occurredAt: hoursAgo(25),
    });
    expect(isRecent(item)).toBe(false);
  });

  it('returns false for items from days ago', () => {
    const item = createMockItem({
      occurredAt: hoursAgo(72),
    });
    expect(isRecent(item)).toBe(false);
  });
});

// ============================================================================
// groupItems Tests
// ============================================================================

describe('groupItems', () => {
  const currentUserId = 'current-user-123';

  it('returns empty array for empty items', () => {
    const sections = groupItems([], currentUserId);
    expect(sections).toEqual([]);
  });

  it('groups urgent items into urgent section', () => {
    const urgentItem = createMockItem({
      id: 'urgent-1',
      type: 'DEADLINE_SET',
      occurredAt: hoursAgo(12), // Recently set deadline
      actorId: 'other-user',
    });

    const sections = groupItems([urgentItem], currentUserId);

    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('urgent');
    expect(sections[0].title).toBe('Urgente');
    expect(sections[0].items).toHaveLength(1);
    expect(sections[0].items[0].id).toBe('urgent-1');
    expect(sections[0].defaultExpanded).toBe(true);
  });

  it("groups user's items into myCases section", () => {
    const myItem = createMockItem({
      id: 'my-1',
      actorId: currentUserId,
      occurredAt: hoursAgo(1),
    });

    const sections = groupItems([myItem], currentUserId);

    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('myCases');
    expect(sections[0].title).toBe('Dosarele mele');
    expect(sections[0].items).toHaveLength(1);
    expect(sections[0].defaultExpanded).toBe(true);
  });

  it('groups recent team items into team section', () => {
    const teamItem = createMockItem({
      id: 'team-1',
      actorId: 'other-user',
      occurredAt: hoursAgo(6),
    });

    const sections = groupItems([teamItem], currentUserId);

    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('team');
    expect(sections[0].title).toBe('Activitate echipă');
    expect(sections[0].items).toHaveLength(1);
    expect(sections[0].defaultExpanded).toBe(false);
  });

  it('groups older items into archive section', () => {
    const oldItem = createMockItem({
      id: 'old-1',
      actorId: 'other-user',
      occurredAt: hoursAgo(48),
    });

    const sections = groupItems([oldItem], currentUserId);

    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('archive');
    expect(sections[0].title).toBe('Mai vechi');
    expect(sections[0].items).toHaveLength(1);
    expect(sections[0].defaultExpanded).toBe(false);
  });

  it('deduplicates items - each item appears in highest priority section only', () => {
    // This item is both urgent AND belongs to current user
    // It should only appear in urgent (higher priority)
    const urgentMyItem = createMockItem({
      id: 'urgent-my-1',
      type: 'DEADLINE_SET',
      occurredAt: hoursAgo(12), // Recently set deadline
      actorId: currentUserId,
    });

    const sections = groupItems([urgentMyItem], currentUserId);

    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('urgent');
    expect(sections[0].items).toHaveLength(1);

    // Verify item doesn't appear in myCases
    const myCasesSection = sections.find((s) => s.key === 'myCases');
    expect(myCasesSection).toBeUndefined();
  });

  it('correctly categorizes mixed items with proper deduplication', () => {
    const items = [
      // Urgent deadline (priority 1) - recently set
      createMockItem({
        id: 'urgent-1',
        type: 'DEADLINE_SET',
        occurredAt: hoursAgo(12),
        actorId: 'other-user',
      }),
      // My activity (priority 2)
      createMockItem({
        id: 'my-1',
        actorId: currentUserId,
        occurredAt: hoursAgo(2),
      }),
      // Team activity (priority 3)
      createMockItem({
        id: 'team-1',
        actorId: 'other-user',
        occurredAt: hoursAgo(6),
      }),
      // Archive (priority 4)
      createMockItem({
        id: 'old-1',
        actorId: 'other-user',
        occurredAt: hoursAgo(48),
      }),
    ];

    const sections = groupItems(items, currentUserId);

    expect(sections).toHaveLength(4);

    expect(sections[0].key).toBe('urgent');
    expect(sections[0].count).toBe(1);

    expect(sections[1].key).toBe('myCases');
    expect(sections[1].count).toBe(1);

    expect(sections[2].key).toBe('team');
    expect(sections[2].count).toBe(1);

    expect(sections[3].key).toBe('archive');
    expect(sections[3].count).toBe(1);
  });

  it('excludes empty sections', () => {
    // Only provide items for myCases
    const myItem = createMockItem({
      id: 'my-1',
      actorId: currentUserId,
      occurredAt: hoursAgo(1),
    });

    const sections = groupItems([myItem], currentUserId);

    // Should only have myCases section, not empty urgent/team/archive
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('myCases');
  });

  it('preserves order within sections (most recent first)', () => {
    const items = [
      createMockItem({
        id: 'my-1',
        actorId: currentUserId,
        occurredAt: hoursAgo(4),
      }),
      createMockItem({
        id: 'my-2',
        actorId: currentUserId,
        occurredAt: hoursAgo(1),
      }),
      createMockItem({
        id: 'my-3',
        actorId: currentUserId,
        occurredAt: hoursAgo(2),
      }),
    ];

    const sections = groupItems(items, currentUserId);

    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('myCases');

    // Items should preserve original order (as provided from API)
    expect(sections[0].items[0].id).toBe('my-1');
    expect(sections[0].items[1].id).toBe('my-2');
    expect(sections[0].items[2].id).toBe('my-3');
  });

  it('handles empty userId gracefully', () => {
    const item = createMockItem({
      id: 'item-1',
      actorId: 'some-user',
      occurredAt: hoursAgo(6),
    });

    // Empty userId means nothing matches myCases
    const sections = groupItems([item], '');

    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('team');
  });
});
