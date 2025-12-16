/**
 * Retainer Service Unit Tests
 * Story 2.11.2: Retainer Billing Support - Task 11
 *
 * Tests for retainer period calculations, usage tracking, and rollover logic.
 */

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

import { RetainerService } from './retainer.service';
import { prisma } from '@legal-platform/database';

describe('RetainerService', () => {
  let retainerService: RetainerService;

  beforeEach(() => {
    jest.clearAllMocks();
    retainerService = new RetainerService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getRetainerPeriodDates', () => {
    describe('Monthly period', () => {
      it('should return first and last day of the month', () => {
        // Test with date in middle of January 2024
        const referenceDate = new Date('2024-01-15');
        const { start, end } = retainerService.getRetainerPeriodDates('Monthly', referenceDate);

        expect(start.getFullYear()).toBe(2024);
        expect(start.getMonth()).toBe(0); // January
        expect(start.getDate()).toBe(1);

        expect(end.getFullYear()).toBe(2024);
        expect(end.getMonth()).toBe(0); // January
        expect(end.getDate()).toBe(31);
      });

      it('should handle February correctly', () => {
        const referenceDate = new Date('2024-02-15'); // 2024 is leap year
        const { start, end } = retainerService.getRetainerPeriodDates('Monthly', referenceDate);

        expect(start.getDate()).toBe(1);
        expect(end.getDate()).toBe(29); // Leap year
      });

      it('should handle non-leap year February', () => {
        const referenceDate = new Date('2023-02-15');
        const { start, end } = retainerService.getRetainerPeriodDates('Monthly', referenceDate);

        expect(end.getDate()).toBe(28);
      });
    });

    describe('Quarterly period', () => {
      it('should return Q1 dates for January', () => {
        const referenceDate = new Date('2024-01-15');
        const { start, end } = retainerService.getRetainerPeriodDates('Quarterly', referenceDate);

        expect(start.getMonth()).toBe(0); // January
        expect(start.getDate()).toBe(1);
        expect(end.getMonth()).toBe(2); // March
        expect(end.getDate()).toBe(31);
      });

      it('should return Q1 dates for March', () => {
        const referenceDate = new Date('2024-03-20');
        const { start, end } = retainerService.getRetainerPeriodDates('Quarterly', referenceDate);

        expect(start.getMonth()).toBe(0); // January
        expect(end.getMonth()).toBe(2); // March
      });

      it('should return Q2 dates for April', () => {
        const referenceDate = new Date('2024-04-15');
        const { start, end } = retainerService.getRetainerPeriodDates('Quarterly', referenceDate);

        expect(start.getMonth()).toBe(3); // April
        expect(start.getDate()).toBe(1);
        expect(end.getMonth()).toBe(5); // June
        expect(end.getDate()).toBe(30);
      });

      it('should return Q3 dates for August', () => {
        const referenceDate = new Date('2024-08-15');
        const { start, end } = retainerService.getRetainerPeriodDates('Quarterly', referenceDate);

        expect(start.getMonth()).toBe(6); // July
        expect(end.getMonth()).toBe(8); // September
        expect(end.getDate()).toBe(30);
      });

      it('should return Q4 dates for December', () => {
        const referenceDate = new Date('2024-12-15');
        const { start, end } = retainerService.getRetainerPeriodDates('Quarterly', referenceDate);

        expect(start.getMonth()).toBe(9); // October
        expect(end.getMonth()).toBe(11); // December
        expect(end.getDate()).toBe(31);
      });
    });

    describe('Annually period', () => {
      it('should return Jan 1 to Dec 31 of the year', () => {
        const referenceDate = new Date('2024-06-15');
        const { start, end } = retainerService.getRetainerPeriodDates('Annually', referenceDate);

        expect(start.getMonth()).toBe(0); // January
        expect(start.getDate()).toBe(1);
        expect(end.getMonth()).toBe(11); // December
        expect(end.getDate()).toBe(31);
        expect(start.getFullYear()).toBe(2024);
        expect(end.getFullYear()).toBe(2024);
      });
    });
  });

  describe('getIncludedHours', () => {
    it('should calculate included hours correctly', () => {
      // $5000 retainer at $250/hour = 20 hours
      const hours = retainerService.getIncludedHours(500000, 25000);
      expect(hours).toBe(20);
    });

    it('should handle fractional hours', () => {
      // $5000 retainer at $300/hour = 16.67 hours
      const hours = retainerService.getIncludedHours(500000, 30000);
      expect(hours).toBeCloseTo(16.67, 2);
    });

    it('should throw error for zero rate', () => {
      expect(() => {
        retainerService.getIncludedHours(500000, 0);
      }).toThrow('Effective rate must be greater than zero');
    });

    it('should throw error for negative rate', () => {
      expect(() => {
        retainerService.getIncludedHours(500000, -100);
      }).toThrow('Effective rate must be greater than zero');
    });
  });

  describe('calculateRollover', () => {
    it('should return 0 when rollover is disabled', async () => {
      const rollover = await retainerService.calculateRollover(
        'case-123',
        new Date('2024-02-01'),
        false // Rollover disabled
      );

      expect(rollover).toBe(0);
      expect(prisma.retainerPeriodUsage.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no previous period exists', async () => {
      jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue(null);

      const rollover = await retainerService.calculateRollover(
        'case-123',
        new Date('2024-02-01'),
        true
      );

      expect(rollover).toBe(0);
    });

    it('should calculate rollover from previous period', async () => {
      // Previous period: 20 hours included + 5 rolled over, 15 used = 10 unused
      jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue({
        id: 'usage-1',
        caseId: 'case-123',
        firmId: 'firm-1',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
        hoursUsed: 15 as any,
        hoursIncluded: 20 as any,
        rolledOver: 5 as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const rollover = await retainerService.calculateRollover(
        'case-123',
        new Date('2024-02-01'),
        true
      );

      expect(rollover).toBe(10);
    });

    it('should not rollover negative amounts', async () => {
      // Previous period: 20 hours included, 25 used (overage)
      jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue({
        id: 'usage-1',
        caseId: 'case-123',
        firmId: 'firm-1',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
        hoursUsed: 25 as any,
        hoursIncluded: 20 as any,
        rolledOver: 0 as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const rollover = await retainerService.calculateRollover(
        'case-123',
        new Date('2024-02-01'),
        true
      );

      expect(rollover).toBe(0); // Should not be negative
    });
  });

  describe('calculateCurrentUsage', () => {
    it('should return null for non-retainer cases', async () => {
      jest.mocked(prisma.case.findFirst).mockResolvedValue(null);

      const usage = await retainerService.calculateCurrentUsage('case-123', 'firm-1');

      expect(usage).toBeNull();
    });

    it('should return null when retainer configuration is incomplete', async () => {
      jest.mocked(prisma.case.findFirst).mockResolvedValue({
        id: 'case-123',
        billingType: 'Retainer',
        retainerPeriod: null, // Missing period
        retainerAmount: 500000 as any,
        firm: { defaultRates: { partnerRate: 25000 } },
      } as any);

      const usage = await retainerService.calculateCurrentUsage('case-123', 'firm-1');

      expect(usage).toBeNull();
    });

    it('should return null when effective rate is zero', async () => {
      jest.mocked(prisma.case.findFirst).mockResolvedValue({
        id: 'case-123',
        billingType: 'Retainer',
        retainerPeriod: 'Monthly',
        retainerAmount: 500000 as any,
        retainerRollover: false,
        customRates: null,
        firm: { defaultRates: null },
      } as any);

      const usage = await retainerService.calculateCurrentUsage('case-123', 'firm-1');

      expect(usage).toBeNull();
    });

    it('should calculate usage with no time entries', async () => {
      jest.mocked(prisma.case.findFirst).mockResolvedValue({
        id: 'case-123',
        billingType: 'Retainer',
        retainerPeriod: 'Monthly',
        retainerAmount: 500000 as any,
        retainerRollover: false,
        customRates: null,
        firm: { defaultRates: { partnerRate: 25000 } },
      } as any);

      jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue(null);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: null },
      } as any);

      const usage = await retainerService.calculateCurrentUsage('case-123', 'firm-1');

      expect(usage).not.toBeNull();
      expect(usage!.hoursUsed).toBe(0);
      expect(usage!.hoursIncluded).toBe(20); // 500000/25000 = 20
      expect(usage!.rolledOver).toBe(0);
      expect(usage!.remaining).toBe(20);
      expect(usage!.utilizationPercent).toBe(0);
    });

    it('should calculate usage with time entries', async () => {
      jest.mocked(prisma.case.findFirst).mockResolvedValue({
        id: 'case-123',
        billingType: 'Retainer',
        retainerPeriod: 'Monthly',
        retainerAmount: 500000 as any,
        retainerRollover: false,
        customRates: null,
        firm: { defaultRates: { partnerRate: 25000 } },
      } as any);

      jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue(null);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: 10 as any },
      } as any);

      const usage = await retainerService.calculateCurrentUsage('case-123', 'firm-1');

      expect(usage).not.toBeNull();
      expect(usage!.hoursUsed).toBe(10);
      expect(usage!.hoursIncluded).toBe(20);
      expect(usage!.remaining).toBe(10);
      expect(usage!.utilizationPercent).toBe(50);
    });

    it('should use custom rates when available', async () => {
      jest.mocked(prisma.case.findFirst).mockResolvedValue({
        id: 'case-123',
        billingType: 'Retainer',
        retainerPeriod: 'Monthly',
        retainerAmount: 500000 as any,
        retainerRollover: false,
        customRates: { partnerRate: 50000 }, // Custom rate: $500/hour
        firm: { defaultRates: { partnerRate: 25000 } },
      } as any);

      jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue(null);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: null },
      } as any);

      const usage = await retainerService.calculateCurrentUsage('case-123', 'firm-1');

      expect(usage).not.toBeNull();
      expect(usage!.hoursIncluded).toBe(10); // 500000/50000 = 10 (using custom rate)
    });
  });

  describe('getUsageHistory', () => {
    it('should return empty array for non-retainer cases', async () => {
      jest.mocked(prisma.case.findFirst).mockResolvedValue(null);

      const history = await retainerService.getUsageHistory('case-123', 'firm-1');

      expect(history).toEqual([]);
    });

    it('should include current period if not in history', async () => {
      jest.mocked(prisma.case.findFirst).mockResolvedValue({
        id: 'case-123',
        billingType: 'Retainer',
        retainerPeriod: 'Monthly',
        retainerAmount: 500000 as any,
        retainerRollover: false,
        customRates: null,
        firm: { defaultRates: { partnerRate: 25000 } },
      } as any);

      jest.mocked(prisma.retainerPeriodUsage.findMany).mockResolvedValue([]);
      jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue(null);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: null },
      } as any);

      const history = await retainerService.getUsageHistory('case-123', 'firm-1');

      expect(history.length).toBe(1);
      expect(history[0].hoursIncluded).toBe(20);
    });

    it('should respect limit parameter', async () => {
      jest.mocked(prisma.case.findFirst).mockResolvedValue({
        id: 'case-123',
        billingType: 'Retainer',
        retainerPeriod: 'Monthly',
        retainerAmount: 500000 as any,
        retainerRollover: false,
        customRates: null,
        firm: { defaultRates: { partnerRate: 25000 } },
      } as any);

      // Generate 15 records
      const records = Array.from({ length: 15 }, (_, i) => ({
        id: `usage-${i}`,
        caseId: 'case-123',
        firmId: 'firm-1',
        periodStart: new Date(`2024-${String(i + 1).padStart(2, '0')}-01`),
        periodEnd: new Date(`2024-${String(i + 1).padStart(2, '0')}-28`),
        hoursUsed: 10 as any,
        hoursIncluded: 20 as any,
        rolledOver: 0 as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      jest.mocked(prisma.retainerPeriodUsage.findMany).mockResolvedValue(records.slice(0, 5));
      jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue(null);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: null },
      } as any);

      const history = await retainerService.getUsageHistory('case-123', 'firm-1', 5);

      expect(history.length).toBeLessThanOrEqual(5);
    });
  });

  // ============================================================================
  // Story 2.11.5 - Additional Edge Cases (Task 2)
  // ============================================================================

  describe('Edge Cases - Story 2.11.5', () => {
    describe('Retainer with 0 hours used', () => {
      it('should calculate 0% utilization when no hours used', async () => {
        jest.mocked(prisma.case.findFirst).mockResolvedValue({
          id: 'case-123',
          billingType: 'Retainer',
          retainerPeriod: 'Monthly',
          retainerAmount: 500000 as any, // $5,000
          retainerRollover: false,
          customRates: null,
          firm: { defaultRates: { partnerRate: 25000 } }, // $250/hr
        } as any);

        jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue(null);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _sum: { hours: null }, // No hours used
        } as any);

        const usage = await retainerService.calculateCurrentUsage('case-123', 'firm-1');

        expect(usage).not.toBeNull();
        expect(usage!.hoursUsed).toBe(0);
        expect(usage!.hoursIncluded).toBe(20); // 500000/25000 = 20 hours
        expect(usage!.utilizationPercent).toBe(0);
        expect(usage!.remaining).toBe(20);
      });

      it('should maintain full remaining hours when nothing used', async () => {
        jest.mocked(prisma.case.findFirst).mockResolvedValue({
          id: 'case-123',
          billingType: 'Retainer',
          retainerPeriod: 'Monthly',
          retainerAmount: 250000 as any, // $2,500
          retainerRollover: true,
          customRates: null,
          firm: { defaultRates: { partnerRate: 25000 } },
        } as any);

        // Previous period had 10 hours rolled over
        jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue({
          id: 'usage-1',
          caseId: 'case-123',
          firmId: 'firm-1',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-01-31'),
          hoursUsed: 0 as any,
          hoursIncluded: 10 as any,
          rolledOver: 5 as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _sum: { hours: null },
        } as any);

        const usage = await retainerService.calculateCurrentUsage('case-123', 'firm-1');

        expect(usage).not.toBeNull();
        expect(usage!.hoursUsed).toBe(0);
        // 10 included + 15 rolled over (10+5 from prev) = 25 remaining
        expect(usage!.remaining).toBe(25);
      });
    });

    describe('Retainer with 150% overutilization', () => {
      it('should calculate >100% utilization when hours exceed allocation', async () => {
        jest.mocked(prisma.case.findFirst).mockResolvedValue({
          id: 'case-123',
          billingType: 'Retainer',
          retainerPeriod: 'Monthly',
          retainerAmount: 500000 as any, // $5,000 = 20 hours at $250/hr
          retainerRollover: false,
          customRates: null,
          firm: { defaultRates: { partnerRate: 25000 } },
        } as any);

        jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue(null);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _sum: { hours: 30 as any }, // 30 hours used, 150% of 20 included
        } as any);

        const usage = await retainerService.calculateCurrentUsage('case-123', 'firm-1');

        expect(usage).not.toBeNull();
        expect(usage!.hoursUsed).toBe(30);
        expect(usage!.hoursIncluded).toBe(20);
        expect(usage!.utilizationPercent).toBe(150); // 30/20 * 100 = 150%
        expect(usage!.remaining).toBe(0); // Clamped to 0, not negative
      });

      it('should handle extreme overutilization (300%)', async () => {
        jest.mocked(prisma.case.findFirst).mockResolvedValue({
          id: 'case-123',
          billingType: 'Retainer',
          retainerPeriod: 'Monthly',
          retainerAmount: 250000 as any, // $2,500 = 10 hours at $250/hr
          retainerRollover: false,
          customRates: null,
          firm: { defaultRates: { partnerRate: 25000 } },
        } as any);

        jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue(null);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _sum: { hours: 30 as any }, // 30 hours used, 300% of 10 included
        } as any);

        const usage = await retainerService.calculateCurrentUsage('case-123', 'firm-1');

        expect(usage).not.toBeNull();
        expect(usage!.utilizationPercent).toBe(300);
        expect(usage!.remaining).toBe(0); // Clamped to 0
      });

      it('should not rollover negative hours from overutilized period', async () => {
        // Previous period was overutilized
        jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue({
          id: 'usage-1',
          caseId: 'case-123',
          firmId: 'firm-1',
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-01-31'),
          hoursUsed: 30 as any, // Used 30 hours
          hoursIncluded: 20 as any, // Only had 20 included
          rolledOver: 0 as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const rollover = await retainerService.calculateRollover(
          'case-123',
          new Date('2024-02-01'),
          true // Rollover enabled
        );

        expect(rollover).toBe(0); // Should not be negative
      });
    });

    describe('Period boundary transitions (Dec 31 → Jan 1)', () => {
      it('should correctly identify year boundary for monthly period', () => {
        // December 31, 2024
        const decDate = new Date('2024-12-31');
        const decPeriod = retainerService.getRetainerPeriodDates('Monthly', decDate);

        expect(decPeriod.start.getMonth()).toBe(11); // December
        expect(decPeriod.start.getDate()).toBe(1);
        expect(decPeriod.end.getMonth()).toBe(11);
        expect(decPeriod.end.getDate()).toBe(31);
        expect(decPeriod.start.getFullYear()).toBe(2024);
        expect(decPeriod.end.getFullYear()).toBe(2024);

        // January 1, 2025
        const janDate = new Date('2025-01-01');
        const janPeriod = retainerService.getRetainerPeriodDates('Monthly', janDate);

        expect(janPeriod.start.getMonth()).toBe(0); // January
        expect(janPeriod.start.getDate()).toBe(1);
        expect(janPeriod.end.getMonth()).toBe(0);
        expect(janPeriod.end.getDate()).toBe(31);
        expect(janPeriod.start.getFullYear()).toBe(2025);
        expect(janPeriod.end.getFullYear()).toBe(2025);
      });

      it('should correctly handle Q4 to Q1 transition', () => {
        // December 31, 2024 - Q4
        const q4Date = new Date('2024-12-31');
        const q4Period = retainerService.getRetainerPeriodDates('Quarterly', q4Date);

        expect(q4Period.start.getMonth()).toBe(9); // October
        expect(q4Period.end.getMonth()).toBe(11); // December
        expect(q4Period.start.getFullYear()).toBe(2024);

        // January 1, 2025 - Q1
        const q1Date = new Date('2025-01-01');
        const q1Period = retainerService.getRetainerPeriodDates('Quarterly', q1Date);

        expect(q1Period.start.getMonth()).toBe(0); // January
        expect(q1Period.end.getMonth()).toBe(2); // March
        expect(q1Period.start.getFullYear()).toBe(2025);
        expect(q1Period.end.getFullYear()).toBe(2025);
      });

      it('should correctly handle annual year-end transition', () => {
        // December 31, 2024
        const dec2024 = new Date('2024-12-31T23:59:59');
        const period2024 = retainerService.getRetainerPeriodDates('Annually', dec2024);

        expect(period2024.start.getMonth()).toBe(0); // Jan 1
        expect(period2024.end.getMonth()).toBe(11); // Dec 31
        expect(period2024.start.getFullYear()).toBe(2024);
        expect(period2024.end.getFullYear()).toBe(2024);

        // January 1, 2025
        const jan2025 = new Date('2025-01-01T00:00:00');
        const period2025 = retainerService.getRetainerPeriodDates('Annually', jan2025);

        expect(period2025.start.getMonth()).toBe(0);
        expect(period2025.end.getMonth()).toBe(11);
        expect(period2025.start.getFullYear()).toBe(2025);
        expect(period2025.end.getFullYear()).toBe(2025);
      });
    });

    describe('Leap year handling for annual retainers', () => {
      it('should correctly handle leap year (2024) annual period', () => {
        // 2024 is a leap year (Feb has 29 days)
        const leapYearDate = new Date('2024-02-29');
        const period = retainerService.getRetainerPeriodDates('Annually', leapYearDate);

        expect(period.start.getFullYear()).toBe(2024);
        expect(period.start.getMonth()).toBe(0);
        expect(period.start.getDate()).toBe(1);
        expect(period.end.getMonth()).toBe(11);
        expect(period.end.getDate()).toBe(31);
      });

      it('should correctly handle leap year February for monthly', () => {
        const leapFeb = new Date('2024-02-15');
        const period = retainerService.getRetainerPeriodDates('Monthly', leapFeb);

        expect(period.end.getMonth()).toBe(1); // February
        expect(period.end.getDate()).toBe(29); // Leap year = 29 days
      });

      it('should correctly handle non-leap year February for monthly', () => {
        const nonLeapFeb = new Date('2025-02-15'); // 2025 is not a leap year
        const period = retainerService.getRetainerPeriodDates('Monthly', nonLeapFeb);

        expect(period.end.getMonth()).toBe(1); // February
        expect(period.end.getDate()).toBe(28); // Non-leap year = 28 days
      });

      it('should correctly handle Q1 in leap year (includes Feb 29)', () => {
        const q1LeapYear = new Date('2024-02-29');
        const period = retainerService.getRetainerPeriodDates('Quarterly', q1LeapYear);

        expect(period.start.getMonth()).toBe(0); // January
        expect(period.start.getDate()).toBe(1);
        expect(period.end.getMonth()).toBe(2); // March
        expect(period.end.getDate()).toBe(31);
      });

      it('should handle century leap year (2000)', () => {
        // 2000 is a leap year (divisible by 400)
        const centuryLeap = new Date('2000-02-15');
        const period = retainerService.getRetainerPeriodDates('Monthly', centuryLeap);

        expect(period.end.getDate()).toBe(29);
      });

      it('should handle non-century leap year exception (2100)', () => {
        // 2100 is NOT a leap year (divisible by 100 but not 400)
        const centuryNonLeap = new Date('2100-02-15');
        const period = retainerService.getRetainerPeriodDates('Monthly', centuryNonLeap);

        expect(period.end.getDate()).toBe(28);
      });
    });

    describe('Edge cases with decimal hours', () => {
      it('should handle fractional hours used', async () => {
        jest.mocked(prisma.case.findFirst).mockResolvedValue({
          id: 'case-123',
          billingType: 'Retainer',
          retainerPeriod: 'Monthly',
          retainerAmount: 500000 as any,
          retainerRollover: false,
          customRates: null,
          firm: { defaultRates: { partnerRate: 25000 } },
        } as any);

        jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue(null);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _sum: { hours: 10.75 as any }, // 10 hours 45 minutes
        } as any);

        const usage = await retainerService.calculateCurrentUsage('case-123', 'firm-1');

        expect(usage).not.toBeNull();
        expect(usage!.hoursUsed).toBe(10.75);
        expect(usage!.remaining).toBeCloseTo(9.25, 2);
        expect(usage!.utilizationPercent).toBeCloseTo(53.75, 2);
      });

      it('should handle very small hour fractions', async () => {
        jest.mocked(prisma.case.findFirst).mockResolvedValue({
          id: 'case-123',
          billingType: 'Retainer',
          retainerPeriod: 'Monthly',
          retainerAmount: 500000 as any,
          retainerRollover: false,
          customRates: null,
          firm: { defaultRates: { partnerRate: 25000 } },
        } as any);

        jest.mocked(prisma.retainerPeriodUsage.findFirst).mockResolvedValue(null);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _sum: { hours: 0.1 as any }, // 6 minutes
        } as any);

        const usage = await retainerService.calculateCurrentUsage('case-123', 'firm-1');

        expect(usage).not.toBeNull();
        expect(usage!.hoursUsed).toBe(0.1);
        expect(usage!.utilizationPercent).toBeCloseTo(0.5, 2); // 0.1/20 * 100 = 0.5%
      });
    });
  });
});
