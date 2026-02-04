/**
 * BriefingNewspaper Component Tests
 *
 * Tests severity grouping logic and edge cases.
 * Note: These are pure function tests extracted from the component.
 */

// Types inline to avoid import resolution issues in Jest
type BriefingSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
type BriefingCategory = 'CLIENT' | 'TEAM' | 'DEADLINE' | 'EMAIL' | 'CASE';
type BriefingDetailStatus = 'ON_TRACK' | 'AT_RISK' | 'OVERDUE';

interface FirmBriefingDetail {
  id: string;
  title: string;
  subtitle: string;
  dueDate?: string;
  dueDateLabel?: string;
  status?: BriefingDetailStatus;
  href?: string;
}

interface FirmBriefingItem {
  id: string;
  severity: BriefingSeverity;
  category: BriefingCategory;
  icon: string;
  headline: string;
  summary: string;
  details: FirmBriefingDetail[];
  entityType?: string;
  entityId?: string;
  canAskFollowUp: boolean;
}

// ============================================================================
// Test Helpers - Extract grouping logic for testing
// ============================================================================

function groupItemsBySeverity(items: FirmBriefingItem[]) {
  const critical: FirmBriefingItem[] = [];
  const warning: FirmBriefingItem[] = [];
  const info: FirmBriefingItem[] = [];

  for (const item of items) {
    switch (item.severity) {
      case 'CRITICAL':
        critical.push(item);
        break;
      case 'WARNING':
        warning.push(item);
        break;
      case 'INFO':
        info.push(item);
        break;
    }
  }

  return { criticalItems: critical, warningItems: warning, infoItems: info };
}

function createMockItem(
  severity: BriefingSeverity,
  id = `item-${severity.toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`
): FirmBriefingItem {
  return {
    id,
    severity,
    category: 'CASE' as BriefingCategory,
    icon: 'briefcase',
    headline: `Test ${severity} item`,
    summary: `This is a test ${severity.toLowerCase()} item`,
    details: [],
    canAskFollowUp: false,
  };
}

// ============================================================================
// Severity Grouping Tests
// ============================================================================

describe('BriefingNewspaper - Severity Grouping', () => {
  it('should correctly group items by severity (CRITICAL -> WARNING -> INFO)', () => {
    const items: FirmBriefingItem[] = [
      createMockItem('INFO', 'info-1'),
      createMockItem('CRITICAL', 'critical-1'),
      createMockItem('WARNING', 'warning-1'),
      createMockItem('INFO', 'info-2'),
      createMockItem('CRITICAL', 'critical-2'),
      createMockItem('WARNING', 'warning-2'),
    ];

    const { criticalItems, warningItems, infoItems } = groupItemsBySeverity(items);

    expect(criticalItems).toHaveLength(2);
    expect(criticalItems.map((i) => i.id)).toEqual(['critical-1', 'critical-2']);

    expect(warningItems).toHaveLength(2);
    expect(warningItems.map((i) => i.id)).toEqual(['warning-1', 'warning-2']);

    expect(infoItems).toHaveLength(2);
    expect(infoItems.map((i) => i.id)).toEqual(['info-1', 'info-2']);
  });

  it('should handle empty items array', () => {
    const { criticalItems, warningItems, infoItems } = groupItemsBySeverity([]);

    expect(criticalItems).toHaveLength(0);
    expect(warningItems).toHaveLength(0);
    expect(infoItems).toHaveLength(0);
  });

  it('should handle all items being same severity', () => {
    const items: FirmBriefingItem[] = [
      createMockItem('WARNING', 'w-1'),
      createMockItem('WARNING', 'w-2'),
      createMockItem('WARNING', 'w-3'),
    ];

    const { criticalItems, warningItems, infoItems } = groupItemsBySeverity(items);

    expect(criticalItems).toHaveLength(0);
    expect(warningItems).toHaveLength(3);
    expect(infoItems).toHaveLength(0);
  });
});

// ============================================================================
// Hero Overflow Tests
// ============================================================================

describe('BriefingNewspaper - Hero Overflow', () => {
  const MAX_HEROES = 5;

  it('should cap heroes at 5 items', () => {
    const items: FirmBriefingItem[] = Array.from({ length: 7 }, (_, i) =>
      createMockItem('CRITICAL', `critical-${i + 1}`)
    );

    const { criticalItems } = groupItemsBySeverity(items);
    const visibleHeroes = criticalItems.slice(0, MAX_HEROES);
    const overflowCount = criticalItems.length - MAX_HEROES;

    expect(criticalItems).toHaveLength(7);
    expect(visibleHeroes).toHaveLength(5);
    expect(overflowCount).toBe(2);
  });

  it('should show no overflow when 5 or fewer criticals', () => {
    const items: FirmBriefingItem[] = Array.from({ length: 5 }, (_, i) =>
      createMockItem('CRITICAL', `critical-${i + 1}`)
    );

    const { criticalItems } = groupItemsBySeverity(items);
    const overflowCount = criticalItems.length - MAX_HEROES;

    expect(criticalItems).toHaveLength(5);
    expect(overflowCount).toBe(0);
  });

  it('should calculate correct overflow count for 8 criticals', () => {
    const items: FirmBriefingItem[] = Array.from({ length: 8 }, (_, i) =>
      createMockItem('CRITICAL', `critical-${i + 1}`)
    );

    const { criticalItems } = groupItemsBySeverity(items);
    const overflowCount = criticalItems.length - MAX_HEROES;

    expect(overflowCount).toBe(3);
  });
});

// ============================================================================
// Empty State Tests
// ============================================================================

describe('BriefingNewspaper - Empty States', () => {
  it('should identify quiet day when only INFO items exist', () => {
    const items: FirmBriefingItem[] = [
      createMockItem('INFO', 'info-1'),
      createMockItem('INFO', 'info-2'),
    ];

    const { criticalItems, warningItems, infoItems } = groupItemsBySeverity(items);
    const isQuietDay =
      criticalItems.length === 0 && warningItems.length === 0 && infoItems.length > 0;

    expect(isQuietDay).toBe(true);
  });

  it('should not be quiet day when WARNING items exist', () => {
    const items: FirmBriefingItem[] = [
      createMockItem('WARNING', 'warning-1'),
      createMockItem('INFO', 'info-1'),
    ];

    const { criticalItems, warningItems, infoItems } = groupItemsBySeverity(items);
    const isQuietDay =
      criticalItems.length === 0 && warningItems.length === 0 && infoItems.length > 0;

    expect(isQuietDay).toBe(false);
  });

  it('should not be quiet day when CRITICAL items exist', () => {
    const items: FirmBriefingItem[] = [
      createMockItem('CRITICAL', 'critical-1'),
      createMockItem('INFO', 'info-1'),
    ];

    const { criticalItems, warningItems, infoItems } = groupItemsBySeverity(items);
    const isQuietDay =
      criticalItems.length === 0 && warningItems.length === 0 && infoItems.length > 0;

    expect(isQuietDay).toBe(false);
  });

  it('should not be quiet day when no items at all (that is empty state)', () => {
    const { criticalItems, warningItems, infoItems } = groupItemsBySeverity([]);
    const isQuietDay =
      criticalItems.length === 0 && warningItems.length === 0 && infoItems.length > 0;

    expect(isQuietDay).toBe(false); // Empty = no briefing, not quiet day
  });
});
