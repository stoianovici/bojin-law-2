/**
 * Financial KPIs Resolvers Unit Tests
 * Story 2.11.3: Financial KPIs Backend Service - Task 10
 *
 * Tests for financialKPIs query resolver including:
 * - Partner gets KPIs for managed cases only
 * - BusinessOwner gets KPIs for all firm cases
 * - Date range filtering
 * - @requiresFinancialAccess directive enforcement
 */

import { GraphQLError } from 'graphql';
import { financialKPIsResolvers } from '../../src/graphql/resolvers/financial-kpis.resolvers';
import * as financialKPIsService from '../../src/services/financial-kpis.service';
import type { Context } from '../../src/graphql/resolvers/case.resolvers';

// Mock the financial KPIs service
jest.mock('../../src/services/financial-kpis.service', () => ({
  createFinancialKPIsService: jest.fn(),
  clearKpiCache: jest.fn(),
}));

describe('Financial KPIs Resolvers - Story 2.11.3', () => {
  let mockContext: Context;
  let mockService: any;

  const mockKPIsResult = {
    totalRevenue: 1500000,
    revenueByBillingType: {
      hourly: 1000000,
      fixed: 300000,
      retainer: 200000,
    },
    revenueTrend: [
      { date: new Date('2024-01-15'), revenue: 500000, caseCount: 5 },
      { date: new Date('2024-01-22'), revenue: 600000, caseCount: 6 },
    ],
    totalBillableHours: 50,
    totalNonBillableHours: 5,
    utilizationRate: 90.91,
    utilizationByRole: [
      { role: 'Partner', billableHours: 20, totalHours: 22, utilizationRate: 90.91 },
      { role: 'Associate', billableHours: 30, totalHours: 33, utilizationRate: 90.91 },
    ],
    realizationRate: 100,
    billedHours: 50,
    workedHours: 50,
    effectiveHourlyRate: 30000,
    profitabilityByCase: [
      {
        caseId: 'case-1',
        caseName: 'Test Case 1',
        billingType: 'Hourly',
        revenue: 500000,
        cost: 250000,
        margin: 250000,
        marginPercent: 50,
      },
    ],
    retainerUtilizationAverage: 75,
    retainerCasesCount: 2,
    dataScope: 'OWN',
    calculatedAt: new Date('2024-01-31T12:00:00Z'),
    caseCount: 10,
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Partner context
    mockContext = {
      user: {
        id: 'user-partner-1',
        firmId: 'firm-1',
        role: 'Partner',
        email: 'partner@firm.com',
      },
      financialDataScope: 'own',
    };

    // Mock service
    mockService = {
      calculateKPIs: jest.fn().mockResolvedValue(mockKPIsResult),
    };

    (financialKPIsService.createFinancialKPIsService as jest.Mock).mockReturnValue(
      mockService
    );
  });

  // ============================================================================
  // Query: financialKPIs
  // ============================================================================

  describe('Query: financialKPIs', () => {
    it('should return KPIs for Partner with managed cases scope', async () => {
      const result = await financialKPIsResolvers.Query.financialKPIs(
        {},
        {},
        mockContext
      );

      expect(result).toEqual(mockKPIsResult);
      expect(financialKPIsService.createFinancialKPIsService).toHaveBeenCalledWith(
        mockContext
      );
      expect(mockService.calculateKPIs).toHaveBeenCalledWith(undefined);
    });

    it('should return KPIs for BusinessOwner with firm-wide scope', async () => {
      mockContext.user!.role = 'BusinessOwner';
      mockContext.financialDataScope = 'firm';

      const firmWideKPIs = {
        ...mockKPIsResult,
        dataScope: 'FIRM',
        caseCount: 50,
        totalRevenue: 5000000,
      };
      mockService.calculateKPIs.mockResolvedValue(firmWideKPIs);

      const result = await financialKPIsResolvers.Query.financialKPIs(
        {},
        {},
        mockContext
      );

      expect(result.dataScope).toBe('FIRM');
      expect(result.caseCount).toBe(50);
      expect(result.totalRevenue).toBe(5000000);
    });

    it('should accept and use provided date range', async () => {
      const dateRangeInput = {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-31T23:59:59Z',
      };

      await financialKPIsResolvers.Query.financialKPIs(
        {},
        { dateRange: dateRangeInput },
        mockContext
      );

      expect(mockService.calculateKPIs).toHaveBeenCalledWith({
        start: expect.any(Date),
        end: expect.any(Date),
      });

      const calledDateRange = mockService.calculateKPIs.mock.calls[0][0];
      expect(calledDateRange.start.toISOString()).toBe('2024-01-01T00:00:00.000Z');
      expect(calledDateRange.end.toISOString()).toBe('2024-01-31T23:59:59.000Z');
    });

    it('should use default date range (last 30 days) when not provided', async () => {
      await financialKPIsResolvers.Query.financialKPIs({}, {}, mockContext);

      expect(mockService.calculateKPIs).toHaveBeenCalledWith(undefined);
    });

    it('should throw UNAUTHENTICATED error if no user in context', async () => {
      mockContext.user = undefined;

      await expect(
        financialKPIsResolvers.Query.financialKPIs({}, {}, mockContext)
      ).rejects.toThrow(GraphQLError);

      await expect(
        financialKPIsResolvers.Query.financialKPIs({}, {}, mockContext)
      ).rejects.toThrow('Authentication required');
    });

    it('should throw BAD_USER_INPUT error for invalid date format', async () => {
      const invalidDateRange = {
        start: 'not-a-date',
        end: '2024-01-31',
      };

      await expect(
        financialKPIsResolvers.Query.financialKPIs(
          {},
          { dateRange: invalidDateRange },
          mockContext
        )
      ).rejects.toThrow('Invalid date format');
    });

    it('should throw BAD_USER_INPUT error if start date is after end date', async () => {
      const invalidDateRange = {
        start: '2024-02-01',
        end: '2024-01-01',
      };

      await expect(
        financialKPIsResolvers.Query.financialKPIs(
          {},
          { dateRange: invalidDateRange },
          mockContext
        )
      ).rejects.toThrow('dateRange.start must be before dateRange.end');
    });

    it('should throw BAD_USER_INPUT error if date range exceeds 1 year', async () => {
      const invalidDateRange = {
        start: '2023-01-01',
        end: '2024-06-01', // More than 1 year
      };

      await expect(
        financialKPIsResolvers.Query.financialKPIs(
          {},
          { dateRange: invalidDateRange },
          mockContext
        )
      ).rejects.toThrow('Date range cannot exceed 1 year');
    });

    it('should accept Date objects for dateRange', async () => {
      const dateRangeInput = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      await financialKPIsResolvers.Query.financialKPIs(
        {},
        { dateRange: dateRangeInput },
        mockContext
      );

      expect(mockService.calculateKPIs).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Data Scope Tests (AC: 8)
  // ============================================================================

  describe('Data Scope - AC: 8', () => {
    it('Partner should only see KPIs for managed cases (OWN scope)', async () => {
      mockContext.user!.role = 'Partner';
      mockContext.financialDataScope = 'own';

      const result = await financialKPIsResolvers.Query.financialKPIs(
        {},
        {},
        mockContext
      );

      expect(result.dataScope).toBe('OWN');
      expect(financialKPIsService.createFinancialKPIsService).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ role: 'Partner' }),
          financialDataScope: 'own',
        })
      );
    });

    it('BusinessOwner should see KPIs for all firm cases (FIRM scope)', async () => {
      mockContext.user!.role = 'BusinessOwner';
      mockContext.financialDataScope = 'firm';

      const firmKPIs = { ...mockKPIsResult, dataScope: 'FIRM' };
      mockService.calculateKPIs.mockResolvedValue(firmKPIs);

      const result = await financialKPIsResolvers.Query.financialKPIs(
        {},
        {},
        mockContext
      );

      expect(result.dataScope).toBe('FIRM');
      expect(financialKPIsService.createFinancialKPIsService).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ role: 'BusinessOwner' }),
          financialDataScope: 'firm',
        })
      );
    });
  });

  // ============================================================================
  // @requiresFinancialAccess Directive Tests (AC: 10)
  // ============================================================================

  describe('@requiresFinancialAccess Directive', () => {
    // Note: The directive enforcement happens at the schema level, not in the resolver.
    // These tests verify the resolver doesn't bypass the directive by adding its own checks.

    it('resolver should not throw for Partner (directive allows)', async () => {
      mockContext.user!.role = 'Partner';

      const result = await financialKPIsResolvers.Query.financialKPIs(
        {},
        {},
        mockContext
      );

      expect(result).toBeDefined();
    });

    it('resolver should not throw for BusinessOwner (directive allows)', async () => {
      mockContext.user!.role = 'BusinessOwner';

      const result = await financialKPIsResolvers.Query.financialKPIs(
        {},
        {},
        mockContext
      );

      expect(result).toBeDefined();
    });

    // Note: Associate and Paralegal would be blocked by the @requiresFinancialAccess directive
    // at the schema level before the resolver is even called. The directive tests are in
    // the integration test suite.
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should propagate service errors', async () => {
      const serviceError = new Error('Database connection failed');
      mockService.calculateKPIs.mockRejectedValue(serviceError);

      await expect(
        financialKPIsResolvers.Query.financialKPIs({}, {}, mockContext)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle GraphQL errors from service', async () => {
      const graphqlError = new GraphQLError('Financial access denied', {
        extensions: { code: 'FORBIDDEN' },
      });
      mockService.calculateKPIs.mockRejectedValue(graphqlError);

      await expect(
        financialKPIsResolvers.Query.financialKPIs({}, {}, mockContext)
      ).rejects.toThrow(GraphQLError);
    });
  });

  // ============================================================================
  // Integration with Service
  // ============================================================================

  describe('Service Integration', () => {
    it('should create service with correct context', async () => {
      await financialKPIsResolvers.Query.financialKPIs({}, {}, mockContext);

      expect(financialKPIsService.createFinancialKPIsService).toHaveBeenCalledTimes(1);
      expect(financialKPIsService.createFinancialKPIsService).toHaveBeenCalledWith(
        mockContext
      );
    });

    it('should pass parsed date range to service', async () => {
      const dateRange = {
        start: '2024-03-01',
        end: '2024-03-31',
      };

      await financialKPIsResolvers.Query.financialKPIs(
        {},
        { dateRange },
        mockContext
      );

      const calledArg = mockService.calculateKPIs.mock.calls[0][0];
      expect(calledArg.start).toBeInstanceOf(Date);
      expect(calledArg.end).toBeInstanceOf(Date);
    });
  });

  // ============================================================================
  // Response Structure
  // ============================================================================

  describe('Response Structure', () => {
    it('should return all required KPI fields', async () => {
      const result = await financialKPIsResolvers.Query.financialKPIs(
        {},
        {},
        mockContext
      );

      // Revenue metrics
      expect(result).toHaveProperty('totalRevenue');
      expect(result).toHaveProperty('revenueByBillingType');
      expect(result).toHaveProperty('revenueTrend');

      // Utilization metrics
      expect(result).toHaveProperty('totalBillableHours');
      expect(result).toHaveProperty('totalNonBillableHours');
      expect(result).toHaveProperty('utilizationRate');
      expect(result).toHaveProperty('utilizationByRole');

      // Realization metrics
      expect(result).toHaveProperty('realizationRate');
      expect(result).toHaveProperty('billedHours');
      expect(result).toHaveProperty('workedHours');

      // Profitability metrics
      expect(result).toHaveProperty('effectiveHourlyRate');
      expect(result).toHaveProperty('profitabilityByCase');

      // Retainer metrics
      expect(result).toHaveProperty('retainerUtilizationAverage');
      expect(result).toHaveProperty('retainerCasesCount');

      // Metadata
      expect(result).toHaveProperty('dataScope');
      expect(result).toHaveProperty('calculatedAt');
      expect(result).toHaveProperty('caseCount');
      expect(result).toHaveProperty('dateRange');
    });

    it('should include correct nested structure for revenueByBillingType', async () => {
      const result = await financialKPIsResolvers.Query.financialKPIs(
        {},
        {},
        mockContext
      );

      expect(result.revenueByBillingType).toHaveProperty('hourly');
      expect(result.revenueByBillingType).toHaveProperty('fixed');
      expect(result.revenueByBillingType).toHaveProperty('retainer');
    });

    it('should include correct nested structure for utilizationByRole', async () => {
      const result = await financialKPIsResolvers.Query.financialKPIs(
        {},
        {},
        mockContext
      );

      expect(Array.isArray(result.utilizationByRole)).toBe(true);
      if (result.utilizationByRole.length > 0) {
        expect(result.utilizationByRole[0]).toHaveProperty('role');
        expect(result.utilizationByRole[0]).toHaveProperty('billableHours');
        expect(result.utilizationByRole[0]).toHaveProperty('totalHours');
        expect(result.utilizationByRole[0]).toHaveProperty('utilizationRate');
      }
    });

    it('should include correct nested structure for profitabilityByCase', async () => {
      const result = await financialKPIsResolvers.Query.financialKPIs(
        {},
        {},
        mockContext
      );

      expect(Array.isArray(result.profitabilityByCase)).toBe(true);
      if (result.profitabilityByCase.length > 0) {
        expect(result.profitabilityByCase[0]).toHaveProperty('caseId');
        expect(result.profitabilityByCase[0]).toHaveProperty('caseName');
        expect(result.profitabilityByCase[0]).toHaveProperty('billingType');
        expect(result.profitabilityByCase[0]).toHaveProperty('revenue');
        expect(result.profitabilityByCase[0]).toHaveProperty('cost');
        expect(result.profitabilityByCase[0]).toHaveProperty('margin');
        expect(result.profitabilityByCase[0]).toHaveProperty('marginPercent');
      }
    });
  });
});
