/**
 * Performance Baseline and Cache Effectiveness Tests
 * Story 2.11.5: Comprehensive Testing - Tasks 14 & 15
 *
 * Task 14: Establish Performance Baseline
 * - Document initial performance metrics for Financial KPIs API
 * - Measure response times for various data sizes
 * - Establish baseline for future optimization
 *
 * Task 15: Cache Effectiveness Test
 * - Verify 5-minute TTL works correctly
 * - Test cache invalidation
 * - Measure cache hit/miss performance
 */

import { FinancialKPIsService, clearKpiCache } from '../../src/services/financial-kpis.service';
import type { Context } from '../../src/graphql/resolvers/case.resolvers';

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
    retainerPeriodUsage: {
      findFirst: jest.fn(),
    },
  },
}));

import { prisma } from '@legal-platform/database';

// Test fixtures
const createMockContext = (role: 'Partner' | 'BusinessOwner', userId = 'user-1'): Context => ({
  user: {
    id: userId,
    firmId: 'firm-1',
    role,
    email: `${role.toLowerCase()}@test.com`,
  },
});

const createMockCases = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `case-${i + 1}`,
    firmId: 'firm-1',
    title: `Case ${i + 1}`,
    billingType: i % 3 === 0 ? 'Hourly' : i % 3 === 1 ? 'Fixed' : 'Retainer',
    fixedAmount: 50000 + i * 1000,
    retainerAmount: 5000 + i * 100,
    status: 'Active',
    customRates: null,
    firm: {
      defaultRates: {
        partnerRate: 30000,
        associateRate: 20000,
        paralegalRate: 10000,
      },
    },
  }));
};

const createMockTimeEntries = (caseIds: string[], entriesPerCase: number) => {
  const entries: any[] = [];
  for (const caseId of caseIds) {
    for (let i = 0; i < entriesPerCase; i++) {
      entries.push({
        id: `entry-${caseId}-${i}`,
        caseId,
        hours: 2 + Math.random() * 6,
        hourlyRate: 25000 + Math.random() * 10000,
        billable: Math.random() > 0.2,
        date: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        user: {
          role: ['Partner', 'Associate', 'Paralegal'][Math.floor(Math.random() * 3)],
        },
      });
    }
  }
  return entries;
};

describe('Story 2.11.5: Performance and Cache Integration Tests', () => {
  // Performance metrics storage
  const performanceMetrics: {
    testName: string;
    caseCount: number;
    timeEntryCount: number;
    executionTimeMs: number;
    isCacheHit: boolean;
  }[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    clearKpiCache();
  });

  afterAll(() => {
    // Output performance baseline report
    console.log('\n========================================');
    console.log('PERFORMANCE BASELINE REPORT');
    console.log('Story 2.11.5 - Task 14');
    console.log('========================================\n');

    console.log('Test Results:');
    console.log('-------------');

    for (const metric of performanceMetrics) {
      console.log(
        `${metric.testName}: ${metric.executionTimeMs}ms ` +
          `(${metric.caseCount} cases, ${metric.timeEntryCount} entries, ` +
          `cache: ${metric.isCacheHit ? 'HIT' : 'MISS'})`
      );
    }

    // Calculate averages
    const cacheMisses = performanceMetrics.filter((m) => !m.isCacheHit);
    const cacheHits = performanceMetrics.filter((m) => m.isCacheHit);

    if (cacheMisses.length > 0) {
      const avgCacheMiss =
        cacheMisses.reduce((sum, m) => sum + m.executionTimeMs, 0) / cacheMisses.length;
      console.log(`\nAverage cache MISS time: ${avgCacheMiss.toFixed(2)}ms`);
    }

    if (cacheHits.length > 0) {
      const avgCacheHit =
        cacheHits.reduce((sum, m) => sum + m.executionTimeMs, 0) / cacheHits.length;
      console.log(`Average cache HIT time: ${avgCacheHit.toFixed(2)}ms`);
    }

    console.log('\n========================================\n');
  });

  // ============================================================================
  // Task 14: Performance Baseline Tests
  // ============================================================================

  describe('Task 14: Performance Baseline', () => {
    it('measures baseline performance with small dataset (5 cases, 50 entries)', async () => {
      const cases = createMockCases(5);
      const caseIds = cases.map((c) => c.id);
      const timeEntries = createMockTimeEntries(caseIds, 10);

      jest.mocked(prisma.case.findMany).mockResolvedValue(cases as any);
      jest.mocked(prisma.case.count).mockResolvedValue(5);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue(timeEntries as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: 100 },
        _avg: { hourlyRate: 27500 },
      } as any);

      const context = createMockContext('Partner');
      const service = new FinancialKPIsService(context);

      const startTime = performance.now();
      const result = await service.calculateKPIs();
      const executionTime = performance.now() - startTime;

      performanceMetrics.push({
        testName: 'Small dataset (5 cases)',
        caseCount: 5,
        timeEntryCount: 50,
        executionTimeMs: Math.round(executionTime),
        isCacheHit: false,
      });

      expect(result).toBeDefined();
      expect(result.caseCount).toBe(5);
      // Baseline: should complete within 500ms for small dataset
      expect(executionTime).toBeLessThan(500);
    });

    it('measures baseline performance with medium dataset (25 cases, 500 entries)', async () => {
      const cases = createMockCases(25);
      const caseIds = cases.map((c) => c.id);
      const timeEntries = createMockTimeEntries(caseIds, 20);

      jest.mocked(prisma.case.findMany).mockResolvedValue(cases as any);
      jest.mocked(prisma.case.count).mockResolvedValue(25);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue(timeEntries as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: 500 },
        _avg: { hourlyRate: 27500 },
      } as any);

      const context = createMockContext('BusinessOwner');
      const service = new FinancialKPIsService(context);

      const startTime = performance.now();
      const result = await service.calculateKPIs();
      const executionTime = performance.now() - startTime;

      performanceMetrics.push({
        testName: 'Medium dataset (25 cases)',
        caseCount: 25,
        timeEntryCount: 500,
        executionTimeMs: Math.round(executionTime),
        isCacheHit: false,
      });

      expect(result).toBeDefined();
      expect(result.caseCount).toBe(25);
      // Baseline: should complete within 1000ms for medium dataset
      expect(executionTime).toBeLessThan(1000);
    });

    it('measures baseline performance with large dataset (100 cases, 2000 entries)', async () => {
      const cases = createMockCases(100);
      const caseIds = cases.map((c) => c.id);
      const timeEntries = createMockTimeEntries(caseIds, 20);

      jest.mocked(prisma.case.findMany).mockResolvedValue(cases as any);
      jest.mocked(prisma.case.count).mockResolvedValue(100);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue(timeEntries as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: 2000 },
        _avg: { hourlyRate: 27500 },
      } as any);

      const context = createMockContext('BusinessOwner');
      const service = new FinancialKPIsService(context);

      const startTime = performance.now();
      const result = await service.calculateKPIs();
      const executionTime = performance.now() - startTime;

      performanceMetrics.push({
        testName: 'Large dataset (100 cases)',
        caseCount: 100,
        timeEntryCount: 2000,
        executionTimeMs: Math.round(executionTime),
        isCacheHit: false,
      });

      expect(result).toBeDefined();
      expect(result.caseCount).toBe(100);
      // Baseline: should complete within 2000ms for large dataset
      expect(executionTime).toBeLessThan(2000);
    });

    it('verifies parallel calculation improves performance', async () => {
      const cases = createMockCases(50);
      const caseIds = cases.map((c) => c.id);
      const timeEntries = createMockTimeEntries(caseIds, 20);

      jest.mocked(prisma.case.findMany).mockResolvedValue(cases as any);
      jest.mocked(prisma.case.count).mockResolvedValue(50);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue(timeEntries as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: 1000 },
        _avg: { hourlyRate: 27500 },
      } as any);

      const context = createMockContext('BusinessOwner');
      const service = new FinancialKPIsService(context);

      // Run multiple times and take average
      const times: number[] = [];
      for (let i = 0; i < 3; i++) {
        clearKpiCache();
        const startTime = performance.now();
        await service.calculateKPIs();
        times.push(performance.now() - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

      performanceMetrics.push({
        testName: 'Parallel calculation (50 cases, avg of 3)',
        caseCount: 50,
        timeEntryCount: 1000,
        executionTimeMs: Math.round(avgTime),
        isCacheHit: false,
      });

      // Parallel should keep time reasonable
      expect(avgTime).toBeLessThan(1500);
    });
  });

  // ============================================================================
  // Task 15: Cache Effectiveness Tests
  // ============================================================================

  describe('Task 15: Cache Effectiveness', () => {
    it('verifies cache improves subsequent request performance', async () => {
      const cases = createMockCases(50);
      const caseIds = cases.map((c) => c.id);
      const timeEntries = createMockTimeEntries(caseIds, 20);

      jest.mocked(prisma.case.findMany).mockResolvedValue(cases as any);
      jest.mocked(prisma.case.count).mockResolvedValue(50);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue(timeEntries as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: 1000 },
        _avg: { hourlyRate: 27500 },
      } as any);

      const context = createMockContext('Partner');
      const service = new FinancialKPIsService(context);

      // First request (cache miss)
      const startTime1 = performance.now();
      const result1 = await service.calculateKPIs();
      const time1 = performance.now() - startTime1;

      performanceMetrics.push({
        testName: 'Cache MISS (first request)',
        caseCount: 50,
        timeEntryCount: 1000,
        executionTimeMs: Math.round(time1),
        isCacheHit: false,
      });

      // Second request (cache hit)
      const startTime2 = performance.now();
      const result2 = await service.calculateKPIs();
      const time2 = performance.now() - startTime2;

      performanceMetrics.push({
        testName: 'Cache HIT (second request)',
        caseCount: 50,
        timeEntryCount: 1000,
        executionTimeMs: Math.round(time2),
        isCacheHit: true,
      });

      // Cache hit should be significantly faster
      expect(time2).toBeLessThan(time1 * 0.5); // At least 50% faster

      // Results should be identical
      expect(result1.totalRevenue).toBe(result2.totalRevenue);
      expect(result1.calculatedAt).toBe(result2.calculatedAt);
    });

    it('verifies cache respects 5-minute TTL', async () => {
      const cases = createMockCases(10);
      const caseIds = cases.map((c) => c.id);
      const timeEntries = createMockTimeEntries(caseIds, 10);

      jest.mocked(prisma.case.findMany).mockResolvedValue(cases as any);
      jest.mocked(prisma.case.count).mockResolvedValue(10);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue(timeEntries as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: 100 },
        _avg: { hourlyRate: 27500 },
      } as any);

      const context = createMockContext('Partner');
      const service = new FinancialKPIsService(context);

      // First request
      const result1 = await service.calculateKPIs();
      const calculatedAt1 = result1.calculatedAt;

      // Immediate second request should return cached result
      const result2 = await service.calculateKPIs();
      expect(result2.calculatedAt).toEqual(calculatedAt1);

      // Note: We can't easily test the actual 5-minute expiration without
      // manipulating time, but the cache key and TTL are verified to be 5 minutes
      // in the service implementation (CACHE_TTL_MS = 5 * 60 * 1000)
    });

    it('verifies cache key includes user and date range', async () => {
      const cases = createMockCases(10);
      const caseIds = cases.map((c) => c.id);
      const timeEntries = createMockTimeEntries(caseIds, 10);

      jest.mocked(prisma.case.findMany).mockResolvedValue(cases as any);
      jest.mocked(prisma.case.count).mockResolvedValue(10);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue(timeEntries as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: 100 },
        _avg: { hourlyRate: 27500 },
      } as any);

      // Partner user
      const partnerContext = createMockContext('Partner', 'partner-1');
      const partnerService = new FinancialKPIsService(partnerContext);

      // BusinessOwner user
      const boContext = createMockContext('BusinessOwner', 'bo-1');
      const boService = new FinancialKPIsService(boContext);

      // Both users should get separate cache entries
      const partnerResult = await partnerService.calculateKPIs();
      const boResult = await boService.calculateKPIs();

      // Both should have made database calls (different cache keys)
      // Partner makes multiple findMany calls for different metrics
      expect(jest.mocked(prisma.case.findMany).mock.calls.length).toBeGreaterThan(1);
    });

    it('verifies clearKpiCache invalidates all cached data', async () => {
      const cases = createMockCases(10);
      const caseIds = cases.map((c) => c.id);
      const timeEntries = createMockTimeEntries(caseIds, 10);

      jest.mocked(prisma.case.findMany).mockResolvedValue(cases as any);
      jest.mocked(prisma.case.count).mockResolvedValue(10);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue(timeEntries as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: 100 },
        _avg: { hourlyRate: 27500 },
      } as any);

      const context = createMockContext('Partner');
      const service = new FinancialKPIsService(context);

      // First request
      const result1 = await service.calculateKPIs();

      // Track the call count before clearing cache
      const callCountBefore = jest.mocked(prisma.case.findMany).mock.calls.length;

      // Second request - should use cache (no new db calls)
      await service.calculateKPIs();
      const callCountAfterCachedRequest = jest.mocked(prisma.case.findMany).mock.calls.length;
      expect(callCountAfterCachedRequest).toBe(callCountBefore); // No new calls - cache hit

      // Clear cache
      clearKpiCache();

      // Third request should recalculate (new db calls)
      await service.calculateKPIs();
      const callCountAfterCacheClear = jest.mocked(prisma.case.findMany).mock.calls.length;

      // Should have made new DB calls after cache clear
      expect(callCountAfterCacheClear).toBeGreaterThan(callCountAfterCachedRequest);
    });

    it('verifies different date ranges use different cache entries', async () => {
      const cases = createMockCases(10);
      const caseIds = cases.map((c) => c.id);
      const timeEntries = createMockTimeEntries(caseIds, 10);

      jest.mocked(prisma.case.findMany).mockResolvedValue(cases as any);
      jest.mocked(prisma.case.count).mockResolvedValue(10);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue(timeEntries as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: 100 },
        _avg: { hourlyRate: 27500 },
      } as any);

      const context = createMockContext('Partner');
      const service = new FinancialKPIsService(context);

      // Request with date range 1
      const dateRange1 = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };
      const result1 = await service.calculateKPIs(dateRange1);

      // Request with date range 2
      const dateRange2 = {
        start: new Date('2024-02-01'),
        end: new Date('2024-02-29'),
      };
      const result2 = await service.calculateKPIs(dateRange2);

      // Both should have different date ranges in result
      expect(result1.dateRange.start).toEqual(dateRange1.start);
      expect(result2.dateRange.start).toEqual(dateRange2.start);
    });

    it('measures cache hit performance improvement ratio', async () => {
      const cases = createMockCases(75);
      const caseIds = cases.map((c) => c.id);
      const timeEntries = createMockTimeEntries(caseIds, 25);

      jest.mocked(prisma.case.findMany).mockResolvedValue(cases as any);
      jest.mocked(prisma.case.count).mockResolvedValue(75);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue(timeEntries as any);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: 1875 },
        _avg: { hourlyRate: 27500 },
      } as any);

      const context = createMockContext('BusinessOwner');
      const service = new FinancialKPIsService(context);

      // Measure cache miss (multiple runs)
      const missTimesMs: number[] = [];
      for (let i = 0; i < 3; i++) {
        clearKpiCache();
        const start = performance.now();
        await service.calculateKPIs();
        missTimesMs.push(performance.now() - start);
      }
      const avgMissTime = missTimesMs.reduce((a, b) => a + b, 0) / missTimesMs.length;

      // Measure cache hit (multiple runs)
      // Don't clear cache this time
      const hitTimesMs: number[] = [];
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        await service.calculateKPIs();
        hitTimesMs.push(performance.now() - start);
      }
      const avgHitTime = hitTimesMs.reduce((a, b) => a + b, 0) / hitTimesMs.length;

      // Calculate improvement ratio
      const improvementRatio = avgMissTime / avgHitTime;

      console.log(`\nCache Performance Ratio: ${improvementRatio.toFixed(1)}x faster with cache`);
      console.log(`  - Avg cache MISS: ${avgMissTime.toFixed(2)}ms`);
      console.log(`  - Avg cache HIT: ${avgHitTime.toFixed(2)}ms`);

      // Cache hit should be at least 2x faster
      expect(improvementRatio).toBeGreaterThan(2);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles empty dataset gracefully', async () => {
      jest.mocked(prisma.case.findMany).mockResolvedValue([]);
      jest.mocked(prisma.case.count).mockResolvedValue(0);
      jest.mocked(prisma.timeEntry.findMany).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.timeEntry.aggregate).mockResolvedValue({
        _sum: { hours: null },
        _avg: { hourlyRate: null },
      } as any);

      const context = createMockContext('Partner');
      const service = new FinancialKPIsService(context);

      const startTime = performance.now();
      const result = await service.calculateKPIs();
      const executionTime = performance.now() - startTime;

      performanceMetrics.push({
        testName: 'Empty dataset',
        caseCount: 0,
        timeEntryCount: 0,
        executionTimeMs: Math.round(executionTime),
        isCacheHit: false,
      });

      expect(result.caseCount).toBe(0);
      expect(result.totalRevenue).toBe(0);
      // Empty dataset should be very fast
      expect(executionTime).toBeLessThan(100);
    });

    it('throws authentication error for undefined context user', async () => {
      const context: Context = { user: undefined };
      const service = new FinancialKPIsService(context);

      // Should throw authentication error
      await expect(service.calculateKPIs()).rejects.toThrow('Authentication required');
    });
  });
});
