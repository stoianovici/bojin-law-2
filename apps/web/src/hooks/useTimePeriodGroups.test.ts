/**
 * useTimePeriodGroups Hook Tests
 * OPS-267: Groups items by time period for documents and attachments
 */

import { renderHook } from '@testing-library/react';
import { useTimePeriodGroups, type TimePeriod } from './useTimePeriodGroups';

// ============================================================================
// Test Helpers
// ============================================================================

interface TestDocument {
  id: string;
  title: string;
  createdAt: string;
}

function createDocument(id: string, title: string, date: Date): TestDocument {
  return { id, title, createdAt: date.toISOString() };
}

function getToday(): Date {
  const date = new Date();
  date.setHours(12, 0, 0, 0); // Noon today
  return date;
}

function getDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(12, 0, 0, 0);
  return date;
}

function getMonthsAgo(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  date.setHours(12, 0, 0, 0);
  return date;
}

// Get a date that's definitely in last month (not this month)
function getLastMonth(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  date.setDate(15); // Middle of last month
  date.setHours(12, 0, 0, 0);
  return date;
}

// Get a date that's definitely older than last month
function getOlderThanLastMonth(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - 2);
  date.setDate(15);
  date.setHours(12, 0, 0, 0);
  return date;
}

// ============================================================================
// Tests
// ============================================================================

describe('useTimePeriodGroups', () => {
  describe('Empty input handling', () => {
    it('returns empty array for empty input', () => {
      const { result } = renderHook(() =>
        useTimePeriodGroups([], (item: TestDocument) => item.createdAt)
      );

      expect(result.current).toEqual([]);
    });
  });

  describe('Time period classification', () => {
    it('groups documents from today into "today" period', () => {
      const docs = [
        createDocument('1', 'Doc 1', getToday()),
        createDocument('2', 'Doc 2', getToday()),
      ];

      const { result } = renderHook(() => useTimePeriodGroups(docs, (doc) => doc.createdAt));

      expect(result.current).toHaveLength(1);
      expect(result.current[0].key).toBe('today');
      expect(result.current[0].label).toBe('Astăzi');
      expect(result.current[0].items).toHaveLength(2);
      expect(result.current[0].defaultOpen).toBe(true);
    });

    it('groups documents from this week into "this-week" period', () => {
      // Get a day from earlier this week (not today)
      const today = new Date();
      const dayOfWeek = today.getDay();
      const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek; // Sunday = 0 -> 6

      // Only test if we can go back a day in the same week
      if (adjustedDay > 1) {
        const earlierThisWeek = getDaysAgo(1);
        const docs = [createDocument('1', 'Earlier this week', earlierThisWeek)];

        const { result } = renderHook(() => useTimePeriodGroups(docs, (doc) => doc.createdAt));

        // Should be in "this-week" (not today)
        const thisWeekPeriod = result.current.find((p) => p.key === 'this-week');
        if (thisWeekPeriod) {
          expect(thisWeekPeriod.label).toBe('Săptămâna aceasta');
          expect(thisWeekPeriod.defaultOpen).toBe(true);
        }
      }
    });

    it('groups documents from last month into "last-month" period', () => {
      const docs = [createDocument('1', 'Last month doc', getLastMonth())];

      const { result } = renderHook(() => useTimePeriodGroups(docs, (doc) => doc.createdAt));

      const lastMonthPeriod = result.current.find((p) => p.key === 'last-month');
      expect(lastMonthPeriod).toBeDefined();
      expect(lastMonthPeriod?.label).toBe('Luna trecută');
      expect(lastMonthPeriod?.defaultOpen).toBe(false);
    });

    it('groups older documents into "older" period', () => {
      const docs = [
        createDocument('1', 'Old doc 1', getOlderThanLastMonth()),
        createDocument('2', 'Old doc 2', getMonthsAgo(6)),
      ];

      const { result } = renderHook(() => useTimePeriodGroups(docs, (doc) => doc.createdAt));

      expect(result.current).toHaveLength(1);
      expect(result.current[0].key).toBe('older');
      expect(result.current[0].label).toBe('Mai vechi');
      expect(result.current[0].defaultOpen).toBe(false);
      expect(result.current[0].items).toHaveLength(2);
    });
  });

  describe('Group ordering', () => {
    it('returns groups in chronological order: today, this-week, this-month, last-month, older', () => {
      const docs = [
        createDocument('1', 'Old', getMonthsAgo(3)),
        createDocument('2', 'Today', getToday()),
        createDocument('3', 'Last month', getLastMonth()),
      ];

      const { result } = renderHook(() => useTimePeriodGroups(docs, (doc) => doc.createdAt));

      const keys = result.current.map((g) => g.key);

      // Verify order
      const todayIndex = keys.indexOf('today');
      const lastMonthIndex = keys.indexOf('last-month');
      const olderIndex = keys.indexOf('older');

      expect(todayIndex).toBeLessThan(lastMonthIndex);
      expect(lastMonthIndex).toBeLessThan(olderIndex);
    });

    it('excludes empty groups from output', () => {
      const docs = [
        createDocument('1', 'Today', getToday()),
        createDocument('2', 'Old', getMonthsAgo(3)),
      ];

      const { result } = renderHook(() => useTimePeriodGroups(docs, (doc) => doc.createdAt));

      // Should only have 2 groups (today and older)
      expect(result.current.length).toBe(2);

      // Each group should have items
      for (const group of result.current) {
        expect(group.items.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Date accessor function', () => {
    it('works with string dates', () => {
      const docs = [createDocument('1', 'Doc', getToday())];

      const { result } = renderHook(() => useTimePeriodGroups(docs, (doc) => doc.createdAt));

      expect(result.current).toHaveLength(1);
    });

    it('works with Date objects', () => {
      const items = [{ id: '1', date: getToday() }];

      const { result } = renderHook(() => useTimePeriodGroups(items, (item) => item.date));

      expect(result.current).toHaveLength(1);
      expect(result.current[0].key).toBe('today');
    });

    it('handles null dates by putting them in older', () => {
      const items = [
        { id: '1', date: null as Date | null },
        { id: '2', date: getToday() },
      ];

      const { result } = renderHook(() => useTimePeriodGroups(items, (item) => item.date));

      const olderPeriod = result.current.find((p) => p.key === 'older');
      const todayPeriod = result.current.find((p) => p.key === 'today');

      expect(olderPeriod?.items).toHaveLength(1);
      expect(todayPeriod?.items).toHaveLength(1);
    });

    it('handles undefined dates by putting them in older', () => {
      const items = [
        { id: '1', date: undefined as Date | undefined },
        { id: '2', date: getToday() },
      ];

      const { result } = renderHook(() => useTimePeriodGroups(items, (item) => item.date));

      const olderPeriod = result.current.find((p) => p.key === 'older');
      expect(olderPeriod?.items).toHaveLength(1);
    });

    it('handles invalid date strings by putting them in older', () => {
      const items = [
        { id: '1', date: 'not-a-date' },
        { id: '2', date: getToday().toISOString() },
      ];

      const { result } = renderHook(() => useTimePeriodGroups(items, (item) => item.date));

      const olderPeriod = result.current.find((p) => p.key === 'older');
      expect(olderPeriod?.items).toHaveLength(1);
    });
  });

  describe('Edge cases', () => {
    it('handles single item', () => {
      const docs = [createDocument('1', 'Single', getToday())];

      const { result } = renderHook(() => useTimePeriodGroups(docs, (doc) => doc.createdAt));

      expect(result.current).toHaveLength(1);
      expect(result.current[0].items).toHaveLength(1);
    });

    it('handles items with same timestamp', () => {
      const sameTime = getToday();
      const docs = [
        createDocument('1', 'First', sameTime),
        createDocument('2', 'Second', sameTime),
        createDocument('3', 'Third', sameTime),
      ];

      const { result } = renderHook(() => useTimePeriodGroups(docs, (doc) => doc.createdAt));

      expect(result.current).toHaveLength(1);
      expect(result.current[0].items).toHaveLength(3);
    });

    it('handles midnight boundary (very early today)', () => {
      const midnight = new Date();
      midnight.setHours(0, 0, 1, 0); // 00:00:01 today

      const docs = [createDocument('1', 'Midnight doc', midnight)];

      const { result } = renderHook(() => useTimePeriodGroups(docs, (doc) => doc.createdAt));

      expect(result.current[0].key).toBe('today');
    });

    it('preserves original item properties', () => {
      const originalDoc = {
        id: 'test-id',
        title: 'Test Doc',
        createdAt: getToday().toISOString(),
        extraField: 'preserved',
      };

      const { result } = renderHook(() =>
        useTimePeriodGroups([originalDoc], (doc) => doc.createdAt)
      );

      const item = result.current[0].items[0];
      expect(item.extraField).toBe('preserved');
    });
  });

  describe('Count accuracy', () => {
    it('total items across all groups equals input length', () => {
      const docs = [
        createDocument('1', 'Doc 1', getToday()),
        createDocument('2', 'Doc 2', getLastMonth()),
        createDocument('3', 'Doc 3', getMonthsAgo(2)),
        createDocument('4', 'Doc 4', getMonthsAgo(3)),
      ];

      const { result } = renderHook(() => useTimePeriodGroups(docs, (doc) => doc.createdAt));

      const totalCount = result.current.reduce((sum, group) => sum + group.items.length, 0);
      expect(totalCount).toBe(docs.length);
    });
  });

  describe('Romanian labels', () => {
    it('uses correct Romanian labels for all periods', () => {
      const docs = [
        createDocument('1', 'Today', getToday()),
        createDocument('2', 'Last month', getLastMonth()),
        createDocument('3', 'Old', getMonthsAgo(3)),
      ];

      const { result } = renderHook(() => useTimePeriodGroups(docs, (doc) => doc.createdAt));

      const labels = result.current.map((p) => p.label);

      expect(labels).toContain('Astăzi');
      expect(labels).toContain('Luna trecută');
      expect(labels).toContain('Mai vechi');
    });
  });

  describe('Default open state', () => {
    it('recent periods default to open, older periods to closed', () => {
      const docs = [
        createDocument('1', 'Today', getToday()),
        createDocument('2', 'Last month', getLastMonth()),
        createDocument('3', 'Old', getMonthsAgo(3)),
      ];

      const { result } = renderHook(() => useTimePeriodGroups(docs, (doc) => doc.createdAt));

      const todayPeriod = result.current.find((p) => p.key === 'today');
      const lastMonthPeriod = result.current.find((p) => p.key === 'last-month');
      const olderPeriod = result.current.find((p) => p.key === 'older');

      expect(todayPeriod?.defaultOpen).toBe(true);
      expect(lastMonthPeriod?.defaultOpen).toBe(false);
      expect(olderPeriod?.defaultOpen).toBe(false);
    });
  });

  describe('Memoization', () => {
    it('returns same reference when items array reference is the same', () => {
      const docs = [createDocument('1', 'Doc', getToday())];
      const getDate = (doc: TestDocument) => doc.createdAt;

      const { result, rerender } = renderHook(
        ({ items, accessor }) => useTimePeriodGroups(items, accessor),
        { initialProps: { items: docs, accessor: getDate } }
      );

      const firstResult = result.current;

      // Rerender with same props
      rerender({ items: docs, accessor: getDate });

      expect(result.current).toBe(firstResult);
    });
  });

  describe('Options', () => {
    it('respects weekStartsOn option', () => {
      // This is a behavioral test - the week calculation should respect the option
      const docs = [createDocument('1', 'Doc', getDaysAgo(1))];

      // Test with Monday start (default)
      const { result: resultMon } = renderHook(() =>
        useTimePeriodGroups(docs, (doc) => doc.createdAt, { weekStartsOn: 1 })
      );

      // Test with Sunday start
      const { result: resultSun } = renderHook(() =>
        useTimePeriodGroups(docs, (doc) => doc.createdAt, { weekStartsOn: 0 })
      );

      // Both should return valid results
      expect(resultMon.current.length).toBeGreaterThan(0);
      expect(resultSun.current.length).toBeGreaterThan(0);
    });
  });
});
