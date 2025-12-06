/**
 * Time Summary Service Unit Tests
 * Story 4.3: Time Estimation & Manual Time Logging - Task 21
 *
 * Tests for weekly summary calculation, trend analysis, and daily breakdown
 */

import { PrismaClient } from '@legal-platform/database';
import { getWeeklySummary, getWeeklyTrend } from './time-summary.service';
import { startOfWeek, endOfWeek, subWeeks } from 'date-fns';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  PrismaClient: jest.fn(),
}));

describe('TimeSummaryService', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      timeEntry: {
        findMany: jest.fn(),
      },
    } as any;

    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getWeeklySummary', () => {
    const weekStart = startOfWeek(new Date('2025-12-01'), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    it('should calculate weekly summary with billable and non-billable hours', async () => {
      const mockCurrentWeekEntries = [
        {
          date: new Date('2025-12-01'),
          hours: 5.0,
          hourlyRate: 40000,
          billable: true,
        },
        {
          date: new Date('2025-12-02'),
          hours: 3.0,
          hourlyRate: 40000,
          billable: true,
        },
        {
          date: new Date('2025-12-03'),
          hours: 2.0,
          hourlyRate: 40000,
          billable: false,
        },
      ];

      const mockPreviousWeekEntries = [
        { hours: 8.0, billable: true },
        { hours: 1.0, billable: false },
      ];

      // Mock current week entries
      mockPrisma.timeEntry.findMany.mockResolvedValueOnce(mockCurrentWeekEntries as any);
      // Mock previous week entries
      mockPrisma.timeEntry.findMany.mockResolvedValueOnce(mockPreviousWeekEntries as any);

      const result = await getWeeklySummary('user-123', weekStart);

      expect(result).toMatchObject({
        weekStart,
        weekEnd,
        totalHours: 10.0,
        billableHours: 8.0,
        nonBillableHours: 2.0,
        billableAmount: 320000, // (5 + 3) * 40000
        entriesCount: 3,
      });
      expect(result.byDay).toHaveLength(7); // Mon-Sun
    });

    it('should calculate trend as UP when current week > 5% increase', async () => {
      const mockCurrentWeekEntries = [
        { date: new Date('2025-12-01'), hours: 10.0, hourlyRate: 40000, billable: true },
      ];

      const mockPreviousWeekEntries = [
        { hours: 9.0, billable: true },
      ];

      mockPrisma.timeEntry.findMany.mockResolvedValueOnce(mockCurrentWeekEntries as any);
      mockPrisma.timeEntry.findMany.mockResolvedValueOnce(mockPreviousWeekEntries as any);

      const result = await getWeeklySummary('user-123', weekStart);

      expect(result.trend).toBe('up');
      expect(result.totalHours).toBe(10.0);
    });

    it('should calculate trend as DOWN when current week > 5% decrease', async () => {
      const mockCurrentWeekEntries = [
        { date: new Date('2025-12-01'), hours: 8.0, hourlyRate: 40000, billable: true },
      ];

      const mockPreviousWeekEntries = [
        { hours: 10.0, billable: true },
      ];

      mockPrisma.timeEntry.findMany.mockResolvedValueOnce(mockCurrentWeekEntries as any);
      mockPrisma.timeEntry.findMany.mockResolvedValueOnce(mockPreviousWeekEntries as any);

      const result = await getWeeklySummary('user-123', weekStart);

      expect(result.trend).toBe('down');
    });

    it('should calculate trend as STABLE when within 5% range', async () => {
      const mockCurrentWeekEntries = [
        { date: new Date('2025-12-01'), hours: 10.0, hourlyRate: 40000, billable: true },
      ];

      const mockPreviousWeekEntries = [
        { hours: 10.2, billable: true },
      ];

      mockPrisma.timeEntry.findMany.mockResolvedValueOnce(mockCurrentWeekEntries as any);
      mockPrisma.timeEntry.findMany.mockResolvedValueOnce(mockPreviousWeekEntries as any);

      const result = await getWeeklySummary('user-123', weekStart);

      expect(result.trend).toBe('stable');
    });

    it('should group entries by day of week', async () => {
      const mockEntries = [
        {
          date: new Date('2025-12-01'), // Monday
          hours: 5.0,
          hourlyRate: 40000,
          billable: true,
        },
        {
          date: new Date('2025-12-01'), // Monday
          hours: 2.0,
          hourlyRate: 40000,
          billable: false,
        },
        {
          date: new Date('2025-12-03'), // Wednesday
          hours: 3.0,
          hourlyRate: 40000,
          billable: true,
        },
      ];

      mockPrisma.timeEntry.findMany.mockResolvedValueOnce(mockEntries as any);
      mockPrisma.timeEntry.findMany.mockResolvedValueOnce([] as any);

      const result = await getWeeklySummary('user-123', weekStart);

      const monday = result.byDay.find((d: { dayOfWeek: string }) => d.dayOfWeek === 'Monday');
      const wednesday = result.byDay.find((d: { dayOfWeek: string }) => d.dayOfWeek === 'Wednesday');

      expect(monday).toMatchObject({
        totalHours: 7.0,
        billableHours: 5.0,
        nonBillableHours: 2.0,
      });

      expect(wednesday).toMatchObject({
        totalHours: 3.0,
        billableHours: 3.0,
        nonBillableHours: 0.0,
      });
    });

    it('should handle week with no entries', async () => {
      mockPrisma.timeEntry.findMany.mockResolvedValue([] as any);

      const result = await getWeeklySummary('user-123', weekStart);

      expect(result).toMatchObject({
        totalHours: 0,
        billableHours: 0,
        nonBillableHours: 0,
        billableAmount: 0,
        entriesCount: 0,
        trend: 'stable',
      });
      expect(result.byDay).toHaveLength(7);
    });
  });

  describe('getWeeklyTrend', () => {
    it('should return summaries for multiple weeks', async () => {
      const weekCount = 3;

      // Mock entries for 3 weeks
      const mockWeek1 = [
        { date: new Date('2025-11-25'), hours: 10.0, hourlyRate: 40000, billable: true },
      ];
      const mockWeek2 = [
        { date: new Date('2025-12-02'), hours: 12.0, hourlyRate: 40000, billable: true },
      ];
      const mockWeek3 = [
        { date: new Date('2025-12-09'), hours: 11.0, hourlyRate: 40000, billable: true },
      ];

      mockPrisma.timeEntry.findMany
        .mockResolvedValueOnce(mockWeek3 as any) // Current week
        .mockResolvedValueOnce(mockWeek2 as any) // Previous week (for trend)
        .mockResolvedValueOnce(mockWeek2 as any) // Week 2
        .mockResolvedValueOnce(mockWeek1 as any) // Previous week (for trend)
        .mockResolvedValueOnce(mockWeek1 as any) // Week 1
        .mockResolvedValueOnce([] as any); // Previous week (for trend)

      const result = await getWeeklyTrend('user-123', weekCount);

      expect(result).toHaveLength(3);
      expect(result[0].totalHours).toBe(11.0); // Most recent week first
      expect(result[1].totalHours).toBe(12.0);
      expect(result[2].totalHours).toBe(10.0);
    });

    it('should calculate billable amounts correctly', async () => {
      const mockEntries = [
        {
          date: new Date('2025-12-01'),
          hours: 5.0,
          hourlyRate: 50000, // $500/hr
          billable: true,
        },
        {
          date: new Date('2025-12-02'),
          hours: 3.0,
          hourlyRate: 30000, // $300/hr
          billable: true,
        },
      ];

      mockPrisma.timeEntry.findMany.mockResolvedValueOnce(mockEntries as any);
      mockPrisma.timeEntry.findMany.mockResolvedValueOnce([] as any);

      const result = await getWeeklyTrend('user-123', 1);

      expect(result[0].billableAmount).toBe(340000); // (5 * 50000) + (3 * 30000)
    });
  });
});
