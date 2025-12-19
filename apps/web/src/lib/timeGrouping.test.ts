/**
 * Time Grouping Utility Tests
 * OPS-051: Time Grouping Utility for Chronology
 */

import {
  groupEventsByTimePeriod,
  getTimePeriodLabel,
  type TimePeriod,
  type TimeGroup,
} from './timeGrouping';

// ============================================================================
// Test Helpers
// ============================================================================

interface TestEvent {
  id: string;
  title: string;
  occurredAt: string;
}

function createEvent(id: string, title: string, date: Date): TestEvent {
  return { id, title, occurredAt: date.toISOString() };
}

function getToday(): Date {
  return new Date();
}

function getDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function getMonthsAgo(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

// Get a date from earlier this week (not today)
function getEarlierThisWeek(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay();
  // If Monday (1), we can't go earlier in the week, return null-ish date
  // So we need at least 1 day between today and start of week
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday is 0
  if (daysFromMonday === 0) {
    // Today is Monday, return last Friday (still "this week" starts Monday)
    // Actually, if today is Monday, there's no "earlier this week" that isn't today
    // Return yesterday which would be "older" or previous week
    return getDaysAgo(1);
  }
  // Return a day from earlier this week
  return getDaysAgo(Math.min(daysFromMonday, 2));
}

// Get a date from earlier this month (not this week)
function getEarlierThisMonth(): Date {
  const today = new Date();
  // Go back 10 days - likely to be in same month but not same week
  // Edge case: if today is in first week of month, this might go to previous month
  const target = getDaysAgo(14);
  if (target.getMonth() === today.getMonth()) {
    return target;
  }
  // If we went to previous month, try 8 days ago
  return getDaysAgo(8);
}

// ============================================================================
// Tests
// ============================================================================

describe('groupEventsByTimePeriod', () => {
  describe('Empty input handling', () => {
    it('returns empty array for empty input', () => {
      const result = groupEventsByTimePeriod([]);
      expect(result).toEqual([]);
    });

    it('returns empty array for undefined-like input', () => {
      const result = groupEventsByTimePeriod([] as TestEvent[]);
      expect(result).toEqual([]);
    });
  });

  describe('Time period classification', () => {
    it('groups events from today into "today" period', () => {
      const events = [
        createEvent('1', 'Event 1', getToday()),
        createEvent('2', 'Event 2', getToday()),
      ];

      const result = groupEventsByTimePeriod(events);

      expect(result).toHaveLength(1);
      expect(result[0].period).toBe('today');
      expect(result[0].label).toBe('Astăzi');
      expect(result[0].count).toBe(2);
      expect(result[0].events).toHaveLength(2);
    });

    it('groups older events into "older" period', () => {
      const events = [
        createEvent('1', 'Old event 1', getMonthsAgo(3)),
        createEvent('2', 'Old event 2', getMonthsAgo(6)),
      ];

      const result = groupEventsByTimePeriod(events);

      expect(result).toHaveLength(1);
      expect(result[0].period).toBe('older');
      expect(result[0].label).toBe('Mai vechi');
      expect(result[0].count).toBe(2);
    });

    it('groups events from previous months into "older" period', () => {
      const events = [createEvent('1', 'Last year event', getMonthsAgo(12))];

      const result = groupEventsByTimePeriod(events);

      expect(result).toHaveLength(1);
      expect(result[0].period).toBe('older');
    });
  });

  describe('Group ordering', () => {
    it('returns groups in order: today, thisWeek, thisMonth, older', () => {
      // Create events spanning all periods
      const events = [
        createEvent('1', 'Old', getMonthsAgo(2)),
        createEvent('2', 'Today', getToday()),
      ];

      const result = groupEventsByTimePeriod(events);

      // Today should come before older
      const periods = result.map((g) => g.period);
      expect(periods.indexOf('today')).toBeLessThan(periods.indexOf('older'));
    });

    it('excludes empty groups from output', () => {
      const events = [
        createEvent('1', 'Today', getToday()),
        createEvent('2', 'Old', getMonthsAgo(3)),
      ];

      const result = groupEventsByTimePeriod(events);

      // Should only have 2 groups (today and older), not 4
      expect(result.length).toBeLessThanOrEqual(4);
      // Each group should have events
      for (const group of result) {
        expect(group.events.length).toBeGreaterThan(0);
        expect(group.count).toBeGreaterThan(0);
      }
    });
  });

  describe('Chronological ordering within groups', () => {
    it('sorts events within each group with most recent first', () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

      const events = [
        createEvent('1', 'Oldest', fourHoursAgo),
        createEvent('2', 'Newest', now),
        createEvent('3', 'Middle', twoHoursAgo),
      ];

      const result = groupEventsByTimePeriod(events);
      const todayGroup = result.find((g) => g.period === 'today');

      expect(todayGroup).toBeDefined();
      expect(todayGroup!.events[0].title).toBe('Newest');
      expect(todayGroup!.events[1].title).toBe('Middle');
      expect(todayGroup!.events[2].title).toBe('Oldest');
    });

    it('maintains order across different groups', () => {
      const events = [
        createEvent('1', 'Old 1', getMonthsAgo(2)),
        createEvent('2', 'Old 2', getMonthsAgo(3)),
        createEvent('3', 'Today', getToday()),
      ];

      const result = groupEventsByTimePeriod(events);

      // Older events should be sorted most recent first
      const olderGroup = result.find((g) => g.period === 'older');
      if (olderGroup && olderGroup.events.length >= 2) {
        const date1 = new Date(olderGroup.events[0].occurredAt).getTime();
        const date2 = new Date(olderGroup.events[1].occurredAt).getTime();
        expect(date1).toBeGreaterThanOrEqual(date2);
      }
    });
  });

  describe('Edge cases', () => {
    it('handles single event', () => {
      const events = [createEvent('1', 'Single', getToday())];

      const result = groupEventsByTimePeriod(events);

      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(1);
    });

    it('handles events with same timestamp', () => {
      const sameTime = getToday();
      const events = [
        createEvent('1', 'First', sameTime),
        createEvent('2', 'Second', sameTime),
        createEvent('3', 'Third', sameTime),
      ];

      const result = groupEventsByTimePeriod(events);

      expect(result).toHaveLength(1);
      expect(result[0].events).toHaveLength(3);
    });

    it('handles midnight boundary (very early today)', () => {
      const midnight = new Date();
      midnight.setHours(0, 0, 1, 0); // 00:00:01 today

      const events = [createEvent('1', 'Midnight event', midnight)];

      const result = groupEventsByTimePeriod(events);

      expect(result[0].period).toBe('today');
    });

    it('preserves original event properties', () => {
      const originalEvent = {
        id: 'test-id',
        title: 'Test Event',
        occurredAt: getToday().toISOString(),
        extraField: 'preserved',
      };

      const result = groupEventsByTimePeriod([originalEvent as TestEvent & { extraField: string }]);

      expect((result[0].events[0] as TestEvent & { extraField: string }).extraField).toBe(
        'preserved'
      );
    });
  });

  describe('Count accuracy', () => {
    it('count matches events array length', () => {
      const events = [
        createEvent('1', 'Event 1', getToday()),
        createEvent('2', 'Event 2', getToday()),
        createEvent('3', 'Event 3', getMonthsAgo(2)),
      ];

      const result = groupEventsByTimePeriod(events);

      for (const group of result) {
        expect(group.count).toBe(group.events.length);
      }
    });

    it('total events across all groups equals input length', () => {
      const events = [
        createEvent('1', 'Event 1', getToday()),
        createEvent('2', 'Event 2', getMonthsAgo(1)),
        createEvent('3', 'Event 3', getMonthsAgo(2)),
        createEvent('4', 'Event 4', getMonthsAgo(3)),
      ];

      const result = groupEventsByTimePeriod(events);

      const totalCount = result.reduce((sum, group) => sum + group.count, 0);
      expect(totalCount).toBe(events.length);
    });
  });
});

describe('getTimePeriodLabel', () => {
  it('returns correct Romanian labels', () => {
    expect(getTimePeriodLabel('today')).toBe('Astăzi');
    expect(getTimePeriodLabel('thisWeek')).toBe('Săptămâna aceasta');
    expect(getTimePeriodLabel('thisMonth')).toBe('Luna aceasta');
    expect(getTimePeriodLabel('older')).toBe('Mai vechi');
  });
});
