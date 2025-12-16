/**
 * Financial KPIs Service Unit Tests
 * Story 2.11.3: Financial KPIs Backend Service - Task 9
 *
 * Tests for all KPI calculations including revenue, utilization,
 * realization, profitability, and caching behavior.
 * Target coverage: 80%
 */

// Mock Prisma
jest.mock('@legal-platform/database', () => ({
  prisma: {
    case: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    timeEntry: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}));

// Mock financial data scope utilities
jest.mock('../graphql/resolvers/utils/financialDataScope', () => ({
  getFinancialDataFilter: jest.fn(),
  getFinancialDataScope: jest.fn(),
}));

import {
  FinancialKPIsService,
  clearKpiCache,
  createFinancialKPIsService,
} from './financial-kpis.service';
import { prisma } from '@legal-platform/database';
import {
  getFinancialDataFilter,
  getFinancialDataScope,
} from '../graphql/resolvers/utils/financialDataScope';
import type { Context } from '../graphql/resolvers/case.resolvers';

// ============================================================================
// Test Fixtures
// ============================================================================

const mockPartnerContext: Context = {
  user: {
    id: 'user-partner-1',
    firmId: 'firm-1',
    role: 'Partner',
    email: 'partner@firm.com',
  },
  financialDataScope: 'own',
};

const mockBusinessOwnerContext: Context = {
  user: {
    id: 'user-bo-1',
    firmId: 'firm-1',
    role: 'BusinessOwner',
    email: 'bo@firm.com',
  },
  financialDataScope: 'firm',
};

const mockDateRange = {
  start: new Date('2024-01-01'),
  end: new Date('2024-01-31'),
};

const mockCases = [
  {
    id: 'case-1',
    title: 'Case 1 - Hourly',
    billingType: 'Hourly',
    fixedAmount: null,
    retainerAmount: null,
    status: 'Active',
    customRates: null,
    firm: { defaultRates: { partnerRate: 30000 } }, // $300/hr in cents
  },
  {
    id: 'case-2',
    title: 'Case 2 - Fixed',
    billingType: 'Fixed',
    fixedAmount: 1000000, // $10,000 in cents
    retainerAmount: null,
    status: 'Closed',
    customRates: null,
    firm: { defaultRates: { partnerRate: 30000 } },
  },
  {
    id: 'case-3',
    title: 'Case 3 - Retainer',
    billingType: 'Retainer',
    fixedAmount: null,
    retainerAmount: 500000, // $5,000/month
    status: 'Active',
    customRates: { partnerRate: 25000 }, // $250/hr custom rate
    firm: { defaultRates: { partnerRate: 30000 } },
  },
];

const mockTimeEntries = [
  {
    id: 'entry-1',
    caseId: 'case-1',
    hours: 10,
    hourlyRate: 30000, // $300/hr
    billable: true,
    date: new Date('2024-01-15'),
    user: { role: 'Partner' },
  },
  {
    id: 'entry-2',
    caseId: 'case-1',
    hours: 5,
    hourlyRate: 20000, // $200/hr
    billable: true,
    date: new Date('2024-01-16'),
    user: { role: 'Associate' },
  },
  {
    id: 'entry-3',
    caseId: 'case-1',
    hours: 2,
    hourlyRate: 10000, // $100/hr
    billable: false, // Non-billable
    date: new Date('2024-01-17'),
    user: { role: 'Paralegal' },
  },
];

// ============================================================================
// Test Suite
// ============================================================================

describe('FinancialKPIsService', () => {
  let service: FinancialKPIsService;

  beforeEach(() => {
    jest.clearAllMocks();
    clearKpiCache(); // Clear cache between tests

    // Set default mock returns
    jest.mocked(getFinancialDataFilter).mockReturnValue({
      firmId: 'firm-1',
    });
    jest.mocked(getFinancialDataScope).mockReturnValue('own');

    service = new FinancialKPIsService(mockPartnerContext);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ============================================================================
  // createFinancialKPIsService Factory
  // ============================================================================

  describe('createFinancialKPIsService', () => {
    it('should create a new service instance', () => {
      const newService = createFinancialKPIsService(mockPartnerContext);
      expect(newService).toBeInstanceOf(FinancialKPIsService);
    });
  });

  // ============================================================================
  // calculateKPIs - Main Entry Point
  // ============================================================================

  describe('calculateKPIs', () => {
    beforeEach(() => {
      // Mock all required Prisma calls with minimal data
      jest.mocked(prisma.case.findMany).mockResolvedValue(mockCases as any);
      jest.mocked(prisma.case.count).mockResolvedValue(3);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue(mockTimeEntries as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: 20000 },
        _sum: { hours: 15 },
      } as any);
    });

    it('should return complete KPI result with all required fields', async () => {
      const result = await service.calculateKPIs(mockDateRange);

      // Check structure
      expect(result).toHaveProperty('totalRevenue');
      expect(result).toHaveProperty('revenueByBillingType');
      expect(result).toHaveProperty('revenueTrend');
      expect(result).toHaveProperty('totalBillableHours');
      expect(result).toHaveProperty('totalNonBillableHours');
      expect(result).toHaveProperty('utilizationRate');
      expect(result).toHaveProperty('utilizationByRole');
      expect(result).toHaveProperty('realizationRate');
      expect(result).toHaveProperty('billedHours');
      expect(result).toHaveProperty('workedHours');
      expect(result).toHaveProperty('effectiveHourlyRate');
      expect(result).toHaveProperty('profitabilityByCase');
      expect(result).toHaveProperty('retainerUtilizationAverage');
      expect(result).toHaveProperty('retainerCasesCount');
      expect(result).toHaveProperty('dataScope');
      expect(result).toHaveProperty('calculatedAt');
      expect(result).toHaveProperty('caseCount');
      expect(result).toHaveProperty('dateRange');
    });

    it('should use default date range (last 30 days) when not provided', async () => {
      const result = await service.calculateKPIs();

      expect(result.dateRange.start).toBeDefined();
      expect(result.dateRange.end).toBeDefined();

      // Default range should be approximately 30 days
      const diffDays = Math.floor(
        (result.dateRange.end.getTime() - result.dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(31);
    });

    it('should include metadata with correct data scope', async () => {
      const result = await service.calculateKPIs(mockDateRange);

      expect(result.dataScope).toBe('OWN');
      expect(result.caseCount).toBe(3);
      expect(result.calculatedAt).toBeInstanceOf(Date);
    });

    it('should return FIRM scope for BusinessOwner', async () => {
      jest.mocked(getFinancialDataScope).mockReturnValue('firm');
      const boService = new FinancialKPIsService(mockBusinessOwnerContext);

      const result = await boService.calculateKPIs(mockDateRange);

      expect(result.dataScope).toBe('FIRM');
    });
  });

  // ============================================================================
  // Caching (AC: 9)
  // ============================================================================

  describe('caching', () => {
    beforeEach(() => {
      jest.mocked(prisma.case.findMany).mockResolvedValue(mockCases as any);
      jest.mocked(prisma.case.count).mockResolvedValue(3);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue(mockTimeEntries as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: 20000 },
        _sum: { hours: 15 },
      } as any);
    });

    it('should cache results and return cached data on subsequent calls', async () => {
      const result1 = await service.calculateKPIs(mockDateRange);
      const result2 = await service.calculateKPIs(mockDateRange);

      // Second call should use cache - Prisma should only be called once per unique query
      expect(result1.totalRevenue).toBe(result2.totalRevenue);
      expect(result1.calculatedAt.getTime()).toBe(result2.calculatedAt.getTime());
    });

    it('should not use cache for different date ranges', async () => {
      const result1 = await service.calculateKPIs(mockDateRange);

      const differentDateRange = {
        start: new Date('2024-02-01'),
        end: new Date('2024-02-28'),
      };

      const result2 = await service.calculateKPIs(differentDateRange);

      // Different date ranges should have different calculatedAt
      expect(result1.dateRange.start.getTime()).not.toBe(result2.dateRange.start.getTime());
    });

    it('should clear cache with clearKpiCache()', async () => {
      await service.calculateKPIs(mockDateRange);

      // Clear cache
      clearKpiCache();

      // Update mock to return different data
      jest.mocked(prisma.case.count).mockResolvedValue(5);

      const result2 = await service.calculateKPIs(mockDateRange);

      expect(result2.caseCount).toBe(5);
    });
  });

  // ============================================================================
  // Revenue Metrics (AC: 4)
  // ============================================================================

  describe('revenue metrics', () => {
    it('should calculate hourly revenue from time entries', async () => {
      jest.mocked(prisma.case.findMany).mockResolvedValue([mockCases[0]] as any);
      jest.mocked(prisma.case.count).mockResolvedValue(1);
      jest
        .mocked(prisma.timeEntry.findMany)
        .mockResolvedValue([
          {
            hours: 10,
            hourlyRate: 30000,
            billable: true,
            caseId: 'case-1',
            date: new Date(),
            user: { role: 'Partner' },
          },
        ] as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: 30000 },
        _sum: { hours: 10 },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      // 10 hours × $300 = $3000 = 300000 cents
      expect(result.revenueByBillingType.hourly).toBe(300000);
    });

    it('should calculate fixed revenue from closed cases', async () => {
      jest.mocked(prisma.case.findMany).mockResolvedValue([mockCases[1]] as any);
      jest.mocked(prisma.case.count).mockResolvedValue(1);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: null },
        _sum: { hours: null },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      // Fixed case: $10,000 = 1000000 cents
      expect(result.revenueByBillingType.fixed).toBe(1000000);
    });

    it('should calculate retainer revenue', async () => {
      jest.mocked(prisma.case.findMany).mockResolvedValue([mockCases[2]] as any);
      jest.mocked(prisma.case.count).mockResolvedValue(1);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: null },
        _sum: { hours: null },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      // Retainer: $5,000 = 500000 cents
      expect(result.revenueByBillingType.retainer).toBe(500000);
    });

    it('should calculate total revenue as sum of all billing types', async () => {
      jest.mocked(prisma.case.findMany).mockResolvedValue(mockCases as any);
      jest.mocked(prisma.case.count).mockResolvedValue(3);
      jest
        .mocked(prisma.timeEntry.findMany)
        .mockResolvedValue([
          {
            hours: 10,
            hourlyRate: 30000,
            billable: true,
            caseId: 'case-1',
            date: new Date(),
            user: { role: 'Partner' },
          },
        ] as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: 30000 },
        _sum: { hours: 10 },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      const expectedTotal = 300000 + 1000000 + 500000; // hourly + fixed + retainer
      expect(result.totalRevenue).toBe(expectedTotal);
    });

    it('should return empty revenue trend when no time entries', async () => {
      jest.mocked(prisma.case.findMany).mockResolvedValue([]);
      jest.mocked(prisma.case.count).mockResolvedValue(0);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: null },
        _sum: { hours: null },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      expect(result.revenueTrend).toEqual([]);
    });
  });

  // ============================================================================
  // Utilization Metrics (AC: 5)
  // ============================================================================

  describe('utilization metrics', () => {
    it('should calculate billable and non-billable hours', async () => {
      jest.mocked(prisma.case.findMany).mockResolvedValue([mockCases[0]] as any);
      jest.mocked(prisma.case.count).mockResolvedValue(1);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue(mockTimeEntries as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: 20000 },
        _sum: { hours: 17 },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      // Billable: 10 + 5 = 15 hours
      // Non-billable: 2 hours
      expect(result.totalBillableHours).toBe(15);
      expect(result.totalNonBillableHours).toBe(2);
    });

    it('should calculate utilization rate as percentage', async () => {
      jest.mocked(prisma.case.findMany).mockResolvedValue([mockCases[0]] as any);
      jest.mocked(prisma.case.count).mockResolvedValue(1);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue(mockTimeEntries as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: 20000 },
        _sum: { hours: 17 },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      // Utilization: 15 / 17 × 100 = 88.24%
      expect(result.utilizationRate).toBeCloseTo(88.24, 1);
    });

    it('should group utilization by role', async () => {
      jest.mocked(prisma.case.findMany).mockResolvedValue([mockCases[0]] as any);
      jest.mocked(prisma.case.count).mockResolvedValue(1);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue(mockTimeEntries as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: 20000 },
        _sum: { hours: 17 },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      expect(result.utilizationByRole.length).toBe(3);

      // Find Partner role
      const partnerUtil = result.utilizationByRole.find((u) => u.role === 'Partner');
      expect(partnerUtil).toBeDefined();
      expect(partnerUtil!.billableHours).toBe(10);
      expect(partnerUtil!.utilizationRate).toBe(100); // All Partner hours are billable
    });

    it('should return 0 utilization when no time entries', async () => {
      jest.mocked(prisma.case.findMany).mockResolvedValue([mockCases[0]] as any);
      jest.mocked(prisma.case.count).mockResolvedValue(1);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: null },
        _sum: { hours: null },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      expect(result.utilizationRate).toBe(0);
      expect(result.utilizationByRole).toEqual([]);
    });
  });

  // ============================================================================
  // Realization Metrics (AC: 6)
  // ============================================================================

  describe('realization metrics', () => {
    it('should calculate realization rate', async () => {
      jest.mocked(prisma.case.findMany).mockResolvedValue([mockCases[0]] as any);
      jest.mocked(prisma.case.count).mockResolvedValue(1);
      jest
        .mocked(prisma.timeEntry.findMany)
        .mockResolvedValue([
          {
            hours: 10,
            hourlyRate: 30000,
            billable: true,
            caseId: 'case-1',
            date: new Date(),
            user: { role: 'Partner' },
          },
        ] as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: 30000 },
        _sum: { hours: 10 },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      // Assuming all billable hours are billed, realization = 100%
      expect(result.realizationRate).toBe(100);
    });

    it('should calculate billed and worked hours', async () => {
      jest.mocked(prisma.case.findMany).mockResolvedValue([mockCases[0]] as any);
      jest.mocked(prisma.case.count).mockResolvedValue(1);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([
        {
          hours: 10,
          hourlyRate: 30000,
          billable: true,
          caseId: 'case-1',
          date: new Date(),
          user: { role: 'Partner' },
        },
        {
          hours: 5,
          hourlyRate: 20000,
          billable: true,
          caseId: 'case-1',
          date: new Date(),
          user: { role: 'Associate' },
        },
      ] as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: 25000 },
        _sum: { hours: 15 },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      expect(result.billedHours).toBe(15);
      expect(result.workedHours).toBe(15);
    });

    it('should return 0 realization when no hours worked', async () => {
      jest.mocked(prisma.case.findMany).mockResolvedValue([mockCases[0]] as any);
      jest.mocked(prisma.case.count).mockResolvedValue(1);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: null },
        _sum: { hours: null },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      expect(result.realizationRate).toBe(0);
      expect(result.billedHours).toBe(0);
      expect(result.workedHours).toBe(0);
    });
  });

  // ============================================================================
  // Profitability Metrics (AC: 7)
  // ============================================================================

  describe('profitability metrics', () => {
    it('should calculate effective hourly rate', async () => {
      jest.mocked(prisma.case.findMany).mockResolvedValue([mockCases[0]] as any);
      jest.mocked(prisma.case.count).mockResolvedValue(1);
      jest
        .mocked(prisma.timeEntry.findMany)
        .mockResolvedValue([
          {
            hours: 10,
            hourlyRate: 30000,
            billable: true,
            caseId: 'case-1',
            date: new Date(),
            user: { role: 'Partner' },
          },
        ] as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: 30000 },
        _sum: { hours: 10 },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      // $3000 revenue / 10 hours = $300/hour = 30000 cents
      expect(result.effectiveHourlyRate).toBe(30000);
    });

    it('should calculate profitability by case', async () => {
      jest.mocked(prisma.case.findMany).mockResolvedValue([mockCases[0]] as any);
      jest.mocked(prisma.case.count).mockResolvedValue(1);
      jest
        .mocked(prisma.timeEntry.findMany)
        .mockResolvedValue([
          {
            hours: 10,
            hourlyRate: 30000,
            billable: true,
            caseId: 'case-1',
            date: new Date(),
            user: { role: 'Partner' },
          },
        ] as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: 30000 },
        _sum: { hours: 10 },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      expect(result.profitabilityByCase.length).toBe(1);
      expect(result.profitabilityByCase[0].caseId).toBe('case-1');
      expect(result.profitabilityByCase[0].revenue).toBe(300000);
    });

    it('should limit profitability list to top 10 cases', async () => {
      // Create 15 cases
      const manyCases = Array.from({ length: 15 }, (_, i) => ({
        id: `case-${i}`,
        title: `Case ${i}`,
        billingType: 'Hourly',
        fixedAmount: null,
        retainerAmount: null,
        status: 'Active',
        customRates: null,
        firm: { defaultRates: { partnerRate: 30000 } },
      }));

      jest.mocked(prisma.case.findMany).mockResolvedValue(manyCases as any);
      jest.mocked(prisma.case.count).mockResolvedValue(15);

      const manyEntries = Array.from({ length: 15 }, (_, i) => ({
        hours: 10 - i * 0.5, // Varying hours for different profitability
        hourlyRate: 30000,
        billable: true,
        caseId: `case-${i}`,
        date: new Date(),
        user: { role: 'Partner' },
      }));

      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue(manyEntries as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: 30000 },
        _sum: { hours: 100 },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      expect(result.profitabilityByCase.length).toBeLessThanOrEqual(10);
    });

    it('should return 0 effective hourly rate when no billable hours', async () => {
      jest.mocked(prisma.case.findMany).mockResolvedValue([mockCases[0]] as any);
      jest.mocked(prisma.case.count).mockResolvedValue(1);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: null },
        _sum: { hours: null },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      expect(result.effectiveHourlyRate).toBe(0);
    });
  });

  // ============================================================================
  // Retainer Metrics
  // ============================================================================

  describe('retainer metrics', () => {
    it('should count retainer cases', async () => {
      // Mock case.findMany to return mockCases for general queries and
      // only retainer case for retainer-specific queries
      (prisma.case.findMany as jest.Mock).mockImplementation(async (args: any) => {
        // Retainer-specific query
        if (args?.where?.billingType === 'Retainer') {
          return [mockCases[2]] as any; // Only the retainer case
        }
        // General query
        return mockCases as any;
      });
      jest.mocked(prisma.case.count).mockResolvedValue(3);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: null },
        _sum: { hours: null },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      expect(result.retainerCasesCount).toBe(1); // Only case-3 is retainer
    });

    it('should return null utilization average when no retainer cases', async () => {
      // Mock to return only hourly case for both general and retainer queries
      (prisma.case.findMany as jest.Mock).mockImplementation(async (args: any) => {
        // Retainer-specific query returns empty
        if (args?.where?.billingType === 'Retainer') {
          return [] as any;
        }
        // General query
        return [mockCases[0]] as any;
      });
      jest.mocked(prisma.case.count).mockResolvedValue(1);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: null },
        _sum: { hours: null },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      expect(result.retainerUtilizationAverage).toBeNull();
      expect(result.retainerCasesCount).toBe(0);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty dataset gracefully', async () => {
      jest.mocked(prisma.case.findMany).mockResolvedValue([]);
      jest.mocked(prisma.case.count).mockResolvedValue(0);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: null },
        _sum: { hours: null },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      expect(result.totalRevenue).toBe(0);
      expect(result.totalBillableHours).toBe(0);
      expect(result.utilizationRate).toBe(0);
      expect(result.caseCount).toBe(0);
    });

    it('should handle zero values correctly', async () => {
      jest.mocked(prisma.case.findMany).mockResolvedValue([
        {
          ...mockCases[0],
          fixedAmount: 0,
        },
      ] as any);
      jest.mocked(prisma.case.count).mockResolvedValue(1);
      jest
        .mocked(prisma.timeEntry.findMany)
        .mockResolvedValue([
          {
            hours: 0,
            hourlyRate: 30000,
            billable: true,
            caseId: 'case-1',
            date: new Date(),
            user: { role: 'Partner' },
          },
        ] as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: 30000 },
        _sum: { hours: 0 },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      expect(result.totalRevenue).toBe(0);
      expect(result.utilizationRate).toBe(0);
    });

    it('should exclude archived cases from calculations', async () => {
      const archivedCase = { ...mockCases[0], status: 'Archived' };
      jest.mocked(prisma.case.findMany).mockResolvedValue([archivedCase] as any);
      jest.mocked(prisma.case.count).mockResolvedValue(0); // Archived cases excluded
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _avg: { hourlyRate: null },
        _sum: { hours: null },
      } as any);

      const result = await service.calculateKPIs(mockDateRange);

      expect(result.caseCount).toBe(0);
    });
  });

  // ============================================================================
  // Story 2.11.5 - Additional Edge Cases (Task 3)
  // ============================================================================

  describe('Edge Cases - Story 2.11.5', () => {
    describe('Zero revenue period', () => {
      it('should handle period with no revenue (only non-billable)', async () => {
        jest.mocked(prisma.case.findMany).mockResolvedValue([mockCases[0]] as any);
        jest.mocked(prisma.case.count).mockResolvedValue(1);
        // Mock implementation that filters by billable correctly
        (prisma.timeEntry.findMany as jest.Mock).mockImplementation(async (args: any) => {
          // If querying for billable entries (for revenue), return empty
          if (args?.where?.billable === true) {
            return [];
          }
          // If querying for all entries (for utilization), return non-billable entries
          return [
            {
              hours: 10,
              hourlyRate: 30000,
              billable: false,
              caseId: 'case-1',
              date: new Date(),
              user: { role: 'Partner' },
            },
            {
              hours: 5,
              hourlyRate: 20000,
              billable: false,
              caseId: 'case-1',
              date: new Date(),
              user: { role: 'Associate' },
            },
          ];
        });
        jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _avg: { hourlyRate: 25000 },
          _sum: { hours: 15 },
        } as any);

        const result = await service.calculateKPIs(mockDateRange);

        expect(result.totalRevenue).toBe(0);
        expect(result.revenueByBillingType.hourly).toBe(0);
        expect(result.totalBillableHours).toBe(0);
        expect(result.totalNonBillableHours).toBe(15);
      });

      it('should handle firm with cases but no closed fixed-fee or time entries', async () => {
        // Hourly case with no time entries, Fixed case still open
        const openFixedCase = { ...mockCases[1], status: 'Active' };
        jest.mocked(prisma.case.findMany).mockResolvedValue([mockCases[0], openFixedCase] as any);
        jest.mocked(prisma.case.count).mockResolvedValue(2);
        jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _avg: { hourlyRate: null },
          _sum: { hours: null },
        } as any);

        const result = await service.calculateKPIs(mockDateRange);

        // Fixed case is open so no revenue counted
        expect(result.totalRevenue).toBe(0);
        expect(result.caseCount).toBe(2);
      });
    });

    describe('All non-billable hours (0% utilization)', () => {
      it('should return 0% utilization when all hours are non-billable', async () => {
        jest.mocked(prisma.case.findMany).mockResolvedValue([mockCases[0]] as any);
        jest.mocked(prisma.case.count).mockResolvedValue(1);
        jest
          .mocked(prisma.timeEntry.findMany)
          .mockResolvedValue([
            {
              hours: 20,
              hourlyRate: 30000,
              billable: false,
              caseId: 'case-1',
              date: new Date(),
              user: { role: 'Partner' },
            },
          ] as any);
        jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _avg: { hourlyRate: 30000 },
          _sum: { hours: 20 },
        } as any);

        const result = await service.calculateKPIs(mockDateRange);

        expect(result.utilizationRate).toBe(0);
        expect(result.totalBillableHours).toBe(0);
        expect(result.totalNonBillableHours).toBe(20);
      });

      it('should handle utilization by role when all hours are non-billable', async () => {
        jest.mocked(prisma.case.findMany).mockResolvedValue([mockCases[0]] as any);
        jest.mocked(prisma.case.count).mockResolvedValue(1);
        jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([
          {
            hours: 10,
            hourlyRate: 30000,
            billable: false,
            caseId: 'case-1',
            date: new Date(),
            user: { role: 'Partner' },
          },
          {
            hours: 5,
            hourlyRate: 20000,
            billable: false,
            caseId: 'case-1',
            date: new Date(),
            user: { role: 'Associate' },
          },
        ] as any);
        jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _avg: { hourlyRate: 25000 },
          _sum: { hours: 15 },
        } as any);

        const result = await service.calculateKPIs(mockDateRange);

        // Check that utilization by role shows 0% for all roles
        expect(result.utilizationByRole.length).toBeGreaterThan(0);
        result.utilizationByRole.forEach((roleUtil) => {
          expect(roleUtil.utilizationRate).toBe(0);
        });
      });
    });

    describe('Mixed billing types in same query', () => {
      it('should correctly aggregate all billing types', async () => {
        // All three cases with different billing types
        jest.mocked(prisma.case.findMany).mockResolvedValue(mockCases as any);
        jest.mocked(prisma.case.count).mockResolvedValue(3);
        jest
          .mocked(prisma.timeEntry.findMany)
          .mockResolvedValue([
            {
              hours: 10,
              hourlyRate: 30000,
              billable: true,
              caseId: 'case-1',
              date: new Date(),
              user: { role: 'Partner' },
            },
          ] as any);
        jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _avg: { hourlyRate: 30000 },
          _sum: { hours: 10 },
        } as any);

        const result = await service.calculateKPIs(mockDateRange);

        // Hourly: 10 hours × $300 = $3000 = 300000 cents
        expect(result.revenueByBillingType.hourly).toBe(300000);
        // Fixed: $10,000 = 1000000 cents (case is Closed)
        expect(result.revenueByBillingType.fixed).toBe(1000000);
        // Retainer: $5,000 = 500000 cents
        expect(result.revenueByBillingType.retainer).toBe(500000);
        // Total: 300000 + 1000000 + 500000 = 1800000 cents
        expect(result.totalRevenue).toBe(1800000);
      });

      it('should handle case with no billing type set', async () => {
        const noBillingTypeCase = { ...mockCases[0], billingType: null };
        jest.mocked(prisma.case.findMany).mockResolvedValue([noBillingTypeCase] as any);
        jest.mocked(prisma.case.count).mockResolvedValue(1);
        jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _avg: { hourlyRate: null },
          _sum: { hours: null },
        } as any);

        // Should not throw
        const result = await service.calculateKPIs(mockDateRange);
        expect(result).toBeDefined();
        expect(result.totalRevenue).toBe(0);
      });
    });

    describe('Date range spanning multiple years', () => {
      it('should handle date range spanning year boundary', async () => {
        const multiYearRange = {
          start: new Date('2023-11-01'),
          end: new Date('2024-02-28'),
        };

        jest.mocked(prisma.case.findMany).mockResolvedValue(mockCases as any);
        jest.mocked(prisma.case.count).mockResolvedValue(3);
        jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([
          {
            hours: 10,
            hourlyRate: 30000,
            billable: true,
            caseId: 'case-1',
            date: new Date('2023-12-15'),
            user: { role: 'Partner' },
          },
          {
            hours: 8,
            hourlyRate: 30000,
            billable: true,
            caseId: 'case-1',
            date: new Date('2024-01-15'),
            user: { role: 'Partner' },
          },
        ] as any);
        jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _avg: { hourlyRate: 30000 },
          _sum: { hours: 18 },
        } as any);

        const result = await service.calculateKPIs(multiYearRange);

        expect(result.dateRange.start.getFullYear()).toBe(2023);
        expect(result.dateRange.end.getFullYear()).toBe(2024);
        expect(result.totalBillableHours).toBe(18);
      });

      it('should handle full year date range', async () => {
        const fullYearRange = {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        };

        jest.mocked(prisma.case.findMany).mockResolvedValue(mockCases as any);
        jest.mocked(prisma.case.count).mockResolvedValue(3);
        jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _avg: { hourlyRate: null },
          _sum: { hours: null },
        } as any);

        const result = await service.calculateKPIs(fullYearRange);

        // Verify range is preserved
        const rangeInDays = Math.floor(
          (result.dateRange.end.getTime() - result.dateRange.start.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        expect(rangeInDays).toBe(365); // 2024 is leap year
      });

      it('should handle multi-year date range (2+ years)', async () => {
        const twoYearRange = {
          start: new Date('2023-01-01'),
          end: new Date('2024-12-31'),
        };

        jest.mocked(prisma.case.findMany).mockResolvedValue(mockCases as any);
        jest.mocked(prisma.case.count).mockResolvedValue(3);
        jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _avg: { hourlyRate: null },
          _sum: { hours: null },
        } as any);

        const result = await service.calculateKPIs(twoYearRange);

        expect(result.dateRange.start.getFullYear()).toBe(2023);
        expect(result.dateRange.end.getFullYear()).toBe(2024);
      });
    });

    describe('Cache behavior tests', () => {
      it('should return cached result for same date range (cache hit)', async () => {
        clearKpiCache();

        jest.mocked(prisma.case.findMany).mockResolvedValue(mockCases as any);
        jest.mocked(prisma.case.count).mockResolvedValue(3);
        jest.mocked(prisma.timeEntry.findMany).mockResolvedValue(mockTimeEntries as any);
        jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _avg: { hourlyRate: 20000 },
          _sum: { hours: 17 },
        } as any);

        const result1 = await service.calculateKPIs(mockDateRange);

        // Change mock return value
        jest.mocked(prisma.case.count).mockResolvedValue(999);

        const result2 = await service.calculateKPIs(mockDateRange);

        // Should return cached result, not new mock value
        expect(result1.calculatedAt.getTime()).toBe(result2.calculatedAt.getTime());
        expect(result2.caseCount).toBe(3); // Cached value, not 999
      });

      it('should not use cache for different date range (cache miss)', async () => {
        clearKpiCache();

        jest.mocked(prisma.case.findMany).mockResolvedValue(mockCases as any);
        jest.mocked(prisma.case.count).mockResolvedValue(3);
        jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _avg: { hourlyRate: null },
          _sum: { hours: null },
        } as any);

        const range1 = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };
        const range2 = { start: new Date('2024-02-01'), end: new Date('2024-02-28') };

        const result1 = await service.calculateKPIs(range1);

        // Different date range
        const result2 = await service.calculateKPIs(range2);

        // Should be different calculations (different date ranges)
        expect(result1.dateRange.start.getTime()).not.toBe(result2.dateRange.start.getTime());
      });

      it('should invalidate cache when clearKpiCache is called', async () => {
        clearKpiCache();

        jest.mocked(prisma.case.findMany).mockResolvedValue(mockCases as any);
        jest.mocked(prisma.case.count).mockResolvedValue(3);
        jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _avg: { hourlyRate: null },
          _sum: { hours: null },
        } as any);

        await service.calculateKPIs(mockDateRange);

        // Clear cache
        clearKpiCache();

        // Update mock
        jest.mocked(prisma.case.count).mockResolvedValue(10);

        const result2 = await service.calculateKPIs(mockDateRange);

        // Should have new value after cache clear
        expect(result2.caseCount).toBe(10);
      });

      it('should use different cache keys for different users/scopes', async () => {
        clearKpiCache();

        jest.mocked(prisma.case.findMany).mockResolvedValue(mockCases as any);
        jest.mocked(prisma.case.count).mockResolvedValue(3);
        jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _avg: { hourlyRate: null },
          _sum: { hours: null },
        } as any);

        // Partner service
        jest.mocked(getFinancialDataScope).mockReturnValue('own');
        const partnerService = new FinancialKPIsService(mockPartnerContext);
        const partnerResult = await partnerService.calculateKPIs(mockDateRange);

        // BusinessOwner service
        jest.mocked(getFinancialDataScope).mockReturnValue('firm');
        const boService = new FinancialKPIsService(mockBusinessOwnerContext);
        const boResult = await boService.calculateKPIs(mockDateRange);

        // Different scopes
        expect(partnerResult.dataScope).toBe('OWN');
        expect(boResult.dataScope).toBe('FIRM');
      });
    });

    describe('Large dataset handling', () => {
      it('should handle large number of cases (100+ cases)', async () => {
        const manyCases = Array.from({ length: 100 }, (_, i) => ({
          id: `case-${i}`,
          title: `Case ${i}`,
          billingType: 'Hourly',
          fixedAmount: null,
          retainerAmount: null,
          status: 'Active',
          customRates: null,
          firm: { defaultRates: { partnerRate: 30000 } },
        }));

        jest.mocked(prisma.case.findMany).mockResolvedValue(manyCases as any);
        jest.mocked(prisma.case.count).mockResolvedValue(100);
        jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _avg: { hourlyRate: null },
          _sum: { hours: null },
        } as any);

        const result = await service.calculateKPIs(mockDateRange);

        expect(result.caseCount).toBe(100);
        expect(result).toBeDefined();
      });

      it('should handle large number of time entries', async () => {
        const manyEntries = Array.from({ length: 1000 }, (_, i) => ({
          hours: 1,
          hourlyRate: 30000,
          billable: i % 2 === 0, // Half billable
          caseId: `case-${i % 10}`,
          date: new Date(),
          user: { role: 'Partner' },
        }));

        jest.mocked(prisma.case.findMany).mockResolvedValue([mockCases[0]] as any);
        jest.mocked(prisma.case.count).mockResolvedValue(1);
        jest.mocked(prisma.timeEntry.findMany).mockResolvedValue(manyEntries as any);
        jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
        jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
          _avg: { hourlyRate: 30000 },
          _sum: { hours: 1000 },
        } as any);

        const result = await service.calculateKPIs(mockDateRange);

        expect(result.totalBillableHours).toBe(500); // Half are billable
        expect(result.totalNonBillableHours).toBe(500);
      });
    });
  });
});
