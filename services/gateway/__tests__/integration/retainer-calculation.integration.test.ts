/**
 * Retainer Calculation Integration Test
 * Story 2.11.2: Retainer Billing Support
 * Story 2.11.5: Comprehensive Testing - Task 8
 *
 * Tests the complete integration of retainer period calculations,
 * usage tracking, and rollover logic across the service layer.
 */

import { RetainerService } from '../../src/services/retainer.service';
import type { RetainerPeriod } from '@prisma/client';

// Mock Prisma
jest.mock('@legal-platform/database', () => ({
  prisma: {
    case: {
      findFirst: jest.fn(),
    },
    retainerPeriodUsage: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    timeEntry: {
      aggregate: jest.fn(),
    },
  },
}));

import { prisma } from '@legal-platform/database';

// Test fixtures
const mockRetainerCase = {
  id: 'case-retainer-1',
  firmId: 'firm-1',
  title: 'Monthly Retainer Client',
  billingType: 'Retainer',
  retainerAmount: 500000, // $5,000 per month
  retainerPeriod: 'Monthly' as RetainerPeriod,
  retainerRollover: true,
  customRates: null,
  firm: {
    defaultRates: {
      partnerRate: 30000, // $300/hr
      associateRate: 20000,
      paralegalRate: 10000,
    },
  },
};

const mockQuarterlyCase = {
  id: 'case-retainer-2',
  firmId: 'firm-1',
  title: 'Quarterly Retainer Client',
  billingType: 'Retainer',
  retainerAmount: 1500000, // $15,000 per quarter
  retainerPeriod: 'Quarterly' as RetainerPeriod,
  retainerRollover: false,
  customRates: {
    partnerRate: 35000, // Custom rate: $350/hr
  },
  firm: {
    defaultRates: {
      partnerRate: 30000,
      associateRate: 20000,
      paralegalRate: 10000,
    },
  },
};

describe('Story 2.11.2: Retainer Calculation Integration', () => {
  let retainerService: RetainerService;

  beforeEach(() => {
    jest.clearAllMocks();
    retainerService = new RetainerService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Retainer Period Dates', () => {
    it('calculates monthly period dates correctly', () => {
      const testDate = new Date('2024-03-15');
      const { start, end } = retainerService.getRetainerPeriodDates('Monthly', testDate);

      expect(start.getFullYear()).toBe(2024);
      expect(start.getMonth()).toBe(2); // March (0-indexed)
      expect(start.getDate()).toBe(1);
      expect(end.getDate()).toBe(31);
    });

    it('calculates quarterly period dates correctly', () => {
      const testDate = new Date('2024-05-15'); // Q2
      const { start, end } = retainerService.getRetainerPeriodDates('Quarterly', testDate);

      expect(start.getMonth()).toBe(3); // April (Q2 start)
      expect(end.getMonth()).toBe(5); // June (Q2 end)
    });

    it('calculates annual period dates correctly', () => {
      const testDate = new Date('2024-07-15');
      const { start, end } = retainerService.getRetainerPeriodDates('Annually', testDate);

      expect(start.getMonth()).toBe(0); // January
      expect(start.getDate()).toBe(1);
      expect(end.getMonth()).toBe(11); // December
      expect(end.getDate()).toBe(31);
    });

    it('handles leap year February correctly', () => {
      const testDate = new Date('2024-02-15'); // 2024 is a leap year
      const { start, end } = retainerService.getRetainerPeriodDates('Monthly', testDate);

      expect(end.getDate()).toBe(29); // Leap year has 29 days
    });
  });

  describe('Included Hours Calculation', () => {
    it('calculates hours from retainer amount and rate', () => {
      // $5,000 retainer / $300/hr = 16.67 hours
      const hours = retainerService.getIncludedHours(500000, 30000);
      expect(hours).toBeCloseTo(16.67, 1);
    });

    it('handles decimal precision correctly', () => {
      // $7,500 / $350 = 21.43 hours
      const hours = retainerService.getIncludedHours(750000, 35000);
      expect(hours).toBeCloseTo(21.43, 1);
    });

    it('throws error for zero rate', () => {
      expect(() => retainerService.getIncludedHours(500000, 0)).toThrow();
    });
  });

  describe('Rollover Calculation', () => {
    it('calculates rollover from unused hours when enabled', async () => {
      jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue({
        id: 'usage-1',
        caseId: 'case-retainer-1',
        periodStart: new Date('2024-02-01'),
        periodEnd: new Date('2024-02-29'),
        hoursIncluded: 16.67,
        hoursUsed: 10,
        remaining: 6.67,
        rolledOver: 0,
      } as any);

      const rollover = await retainerService.calculateRollover(
        'case-retainer-1',
        new Date('2024-03-01'),
        true
      );

      // Previous period had 6.67 unused hours
      expect(rollover).toBeCloseTo(6.67, 1);
    });

    it('returns 0 when rollover is disabled', async () => {
      jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue({
        id: 'usage-1',
        caseId: 'case-retainer-2',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-03-31'),
        hoursIncluded: 50,
        hoursUsed: 30,
        remaining: 20,
        rolledOver: 0,
      } as any);

      const rollover = await retainerService.calculateRollover(
        'case-retainer-2',
        new Date('2024-04-01'),
        false
      );

      expect(rollover).toBe(0);
    });

    it('returns 0 when no previous period exists', async () => {
      jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue(null);

      const rollover = await retainerService.calculateRollover(
        'case-retainer-1',
        new Date('2024-01-01'),
        true
      );

      expect(rollover).toBe(0);
    });
  });

  describe('Current Usage Calculation', () => {
    it('calculates current period usage with time entries', async () => {
      jest.mocked(prisma.case.findFirst).mockResolvedValue(mockRetainerCase as any);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: 8 },
      } as any);
      jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue(null);

      const usage = await retainerService.calculateCurrentUsage('case-retainer-1', 'firm-1');

      expect(usage).not.toBeNull();
      expect(usage?.hoursUsed).toBe(8);
      expect(usage?.hoursIncluded).toBeCloseTo(16.67, 1);
      expect(usage?.utilizationPercent).toBeCloseTo(48, 0); // 8/16.67 * 100
    });

    it('returns null for non-retainer cases', async () => {
      jest.mocked(prisma.case.findFirst).mockResolvedValue(null);

      const usage = await retainerService.calculateCurrentUsage('case-hourly-1', 'firm-1');

      expect(usage).toBeNull();
    });

    it('uses custom rates when available', async () => {
      jest.mocked(prisma.case.findFirst).mockResolvedValue(mockQuarterlyCase as any);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: 15 },
      } as any);
      jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue(null);

      const usage = await retainerService.calculateCurrentUsage('case-retainer-2', 'firm-1');

      expect(usage).not.toBeNull();
      // $15,000 / $350 = 42.86 hours
      expect(usage?.hoursIncluded).toBeCloseTo(42.86, 1);
    });
  });

  describe('Edge Cases', () => {
    it('handles 0% utilization (no hours used)', async () => {
      jest.mocked(prisma.case.findFirst).mockResolvedValue(mockRetainerCase as any);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: 0 },
      } as any);
      jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue(null);

      const usage = await retainerService.calculateCurrentUsage('case-retainer-1', 'firm-1');

      expect(usage?.utilizationPercent).toBe(0);
      expect(usage?.hoursUsed).toBe(0);
    });

    it('handles overutilization (>100%)', async () => {
      jest.mocked(prisma.case.findFirst).mockResolvedValue(mockRetainerCase as any);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: 25 }, // More than 16.67 included hours
      } as any);
      jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue(null);

      const usage = await retainerService.calculateCurrentUsage('case-retainer-1', 'firm-1');

      expect(usage?.utilizationPercent).toBeGreaterThan(100);
      expect(usage?.hoursUsed).toBe(25);
    });

    it('handles year boundary transitions', () => {
      const december = new Date('2024-12-15');
      const decemberPeriod = retainerService.getRetainerPeriodDates('Monthly', december);

      const january = new Date('2025-01-15');
      const januaryPeriod = retainerService.getRetainerPeriodDates('Monthly', january);

      expect(decemberPeriod.end.getFullYear()).toBe(2024);
      expect(januaryPeriod.start.getFullYear()).toBe(2025);
    });

    it('handles null time entry sum', async () => {
      jest.mocked(prisma.case.findFirst).mockResolvedValue(mockRetainerCase as any);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: null },
      } as any);
      jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue(null);

      const usage = await retainerService.calculateCurrentUsage('case-retainer-1', 'firm-1');

      expect(usage?.hoursUsed).toBe(0);
    });
  });

  describe('Period Boundary Accuracy', () => {
    it('Q1 boundaries are correct', () => {
      const q1 = retainerService.getRetainerPeriodDates('Quarterly', new Date('2024-02-15'));
      expect(q1.start.getMonth()).toBe(0); // Jan
      expect(q1.end.getMonth()).toBe(2); // Mar
    });

    it('Q2 boundaries are correct', () => {
      const q2 = retainerService.getRetainerPeriodDates('Quarterly', new Date('2024-05-15'));
      expect(q2.start.getMonth()).toBe(3); // Apr
      expect(q2.end.getMonth()).toBe(5); // Jun
    });

    it('Q3 boundaries are correct', () => {
      const q3 = retainerService.getRetainerPeriodDates('Quarterly', new Date('2024-08-15'));
      expect(q3.start.getMonth()).toBe(6); // Jul
      expect(q3.end.getMonth()).toBe(8); // Sep
    });

    it('Q4 boundaries are correct', () => {
      const q4 = retainerService.getRetainerPeriodDates('Quarterly', new Date('2024-11-15'));
      expect(q4.start.getMonth()).toBe(9); // Oct
      expect(q4.end.getMonth()).toBe(11); // Dec
    });
  });
});
