/**
 * Token Usage Monitor Tests
 * Story 3.8: Document System Testing and Performance - Task 16
 *
 * Tests:
 * - Usage tracking accuracy
 * - Threshold detection
 * - Alert triggering
 * - Aggregation calculations
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TokenUsageMonitor, TokenUsageRecord } from './token-usage-monitor';

// Mock Prisma client
const mockPrisma = {
  aITokenUsage: {
    create: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    count: jest.fn(),
  },
};

// Mock Redis client
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  incr: jest.fn(),
  incrBy: jest.fn(),
  expire: jest.fn(),
  keys: jest.fn(),
};

describe('TokenUsageMonitor', () => {
  let monitor: TokenUsageMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    monitor = new TokenUsageMonitor(mockPrisma as any, mockRedis as any);

    // Default mock implementations
    mockPrisma.aITokenUsage.create.mockResolvedValue({ id: 'usage-001' });
    mockRedis.incrBy.mockResolvedValue(1000);
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(undefined);
    mockRedis.get.mockResolvedValue('0');
  });

  describe('recordUsage', () => {
    it('should store usage in PostgreSQL', async () => {
      const usage: TokenUsageRecord = {
        userId: 'user-001',
        firmId: 'firm-001',
        caseId: 'case-001',
        operationType: 'document_generation',
        modelUsed: 'claude-sonnet',
        inputTokens: 500,
        outputTokens: 1500,
        totalTokens: 2000,
        costCents: 450,
        latencyMs: 3500,
        cached: false,
        timestamp: new Date(),
      };

      await monitor.recordUsage(usage);

      expect(mockPrisma.aITokenUsage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-001',
          firmId: 'firm-001',
          totalTokens: 2000,
          costCents: 450,
        }),
      });
    });

    it('should update Redis counters', async () => {
      const usage: TokenUsageRecord = {
        userId: 'user-001',
        firmId: 'firm-001',
        caseId: null,
        operationType: 'clause_suggestion',
        modelUsed: 'claude-haiku',
        inputTokens: 200,
        outputTokens: 300,
        totalTokens: 500,
        costCents: 15,
        latencyMs: 800,
        cached: false,
        timestamp: new Date(),
      };

      await monitor.recordUsage(usage);

      // Should increment hourly, daily, monthly counters
      expect(mockRedis.incrBy).toHaveBeenCalled();
      expect(mockRedis.incr).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('should handle null userId', async () => {
      const usage: TokenUsageRecord = {
        userId: null,
        firmId: 'firm-001',
        caseId: null,
        operationType: 'semantic_diff',
        modelUsed: 'claude-sonnet',
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        costCents: 300,
        latencyMs: 5000,
        cached: false,
        timestamp: new Date(),
      };

      await monitor.recordUsage(usage);

      expect(mockPrisma.aITokenUsage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: null,
        }),
      });
    });

    it('should record cached requests', async () => {
      const usage: TokenUsageRecord = {
        userId: 'user-001',
        firmId: 'firm-001',
        caseId: 'case-001',
        operationType: 'document_generation',
        modelUsed: 'claude-sonnet',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costCents: 0,
        latencyMs: 50,
        cached: true,
        timestamp: new Date(),
      };

      await monitor.recordUsage(usage);

      expect(mockPrisma.aITokenUsage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cached: true,
          totalTokens: 0,
        }),
      });
    });
  });

  describe('getRealTimeUsage', () => {
    it('should return hourly, daily, and monthly usage', async () => {
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes(':hour:') && key.includes(':tokens')) return Promise.resolve('5000');
        if (key.includes(':hour:') && key.includes(':ops')) return Promise.resolve('10');
        if (key.includes(':hour:') && key.includes(':cost')) return Promise.resolve('150');
        if (key.includes(':day:') && key.includes(':tokens')) return Promise.resolve('50000');
        if (key.includes(':day:') && key.includes(':ops')) return Promise.resolve('100');
        if (key.includes(':day:') && key.includes(':cost')) return Promise.resolve('1500');
        if (key.includes(':month:') && key.includes(':tokens')) return Promise.resolve('500000');
        if (key.includes(':month:') && key.includes(':ops')) return Promise.resolve('1000');
        if (key.includes(':month:') && key.includes(':cost')) return Promise.resolve('15000');
        return Promise.resolve(null);
      });

      const usage = await monitor.getRealTimeUsage('firm-001');

      expect(usage.hourly.totalTokens).toBe(5000);
      expect(usage.hourly.operationCount).toBe(10);
      expect(usage.daily.totalTokens).toBe(50000);
      expect(usage.monthly.totalTokens).toBe(500000);
    });

    it('should return zeros when no data exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      const usage = await monitor.getRealTimeUsage('firm-new');

      expect(usage.hourly.totalTokens).toBe(0);
      expect(usage.daily.totalTokens).toBe(0);
      expect(usage.monthly.totalTokens).toBe(0);
    });
  });

  describe('getAggregatedUsage', () => {
    it('should return daily aggregated usage', async () => {
      mockPrisma.aITokenUsage.aggregate.mockResolvedValue({
        _sum: {
          totalTokens: 25000,
          inputTokens: 10000,
          outputTokens: 15000,
          costCents: 750,
          latencyMs: 150000,
        },
        _count: 50,
        _avg: {
          latencyMs: 3000,
        },
      });
      mockPrisma.aITokenUsage.count.mockResolvedValue(10);

      const usage = await monitor.getAggregatedUsage('firm-001', 'daily');

      expect(usage.totalTokens).toBe(25000);
      expect(usage.operationCount).toBe(50);
      expect(usage.cacheHitRate).toBe(0.2); // 10/50
    });

    it('should calculate correct cache hit rate', async () => {
      mockPrisma.aITokenUsage.aggregate.mockResolvedValue({
        _sum: { totalTokens: 10000, inputTokens: 4000, outputTokens: 6000, costCents: 300, latencyMs: 50000 },
        _count: 100,
        _avg: { latencyMs: 500 },
      });
      mockPrisma.aITokenUsage.count.mockResolvedValue(60); // 60% cache hit

      const usage = await monitor.getAggregatedUsage('firm-001', 'weekly');

      expect(usage.cacheHitRate).toBe(0.6);
    });

    it('should handle zero operations', async () => {
      mockPrisma.aITokenUsage.aggregate.mockResolvedValue({
        _sum: { totalTokens: null, inputTokens: null, outputTokens: null, costCents: null, latencyMs: null },
        _count: 0,
        _avg: { latencyMs: null },
      });
      mockPrisma.aITokenUsage.count.mockResolvedValue(0);

      const usage = await monitor.getAggregatedUsage('firm-001', 'daily');

      expect(usage.totalTokens).toBe(0);
      expect(usage.operationCount).toBe(0);
      expect(usage.cacheHitRate).toBe(0);
    });
  });

  describe('getUsageByModel', () => {
    it('should group usage by model', async () => {
      mockPrisma.aITokenUsage.groupBy.mockResolvedValue([
        { modelUsed: 'claude-haiku', _sum: { totalTokens: 50000, costCents: 250 }, _count: 200 },
        { modelUsed: 'claude-sonnet', _sum: { totalTokens: 30000, costCents: 900 }, _count: 50 },
        { modelUsed: 'claude-opus', _sum: { totalTokens: 5000, costCents: 750 }, _count: 5 },
      ]);

      const usage = await monitor.getUsageByModel('firm-001', new Date(), new Date());

      expect(usage).toHaveLength(3);
      expect(usage.find(u => u.model === 'claude-haiku')?.tokens).toBe(50000);
      expect(usage.find(u => u.model === 'claude-sonnet')?.operationCount).toBe(50);
    });
  });

  describe('getUsageByOperation', () => {
    it('should group usage by operation type', async () => {
      mockPrisma.aITokenUsage.groupBy.mockResolvedValue([
        { operationType: 'document_generation', _sum: { totalTokens: 40000, costCents: 1200 }, _count: 100 },
        { operationType: 'semantic_diff', _sum: { totalTokens: 20000, costCents: 600 }, _count: 50 },
        { operationType: 'clause_suggestion', _sum: { totalTokens: 10000, costCents: 150 }, _count: 200 },
      ]);

      const usage = await monitor.getUsageByOperation('firm-001', new Date(), new Date());

      expect(usage).toHaveLength(3);
      expect(usage.find(u => u.operationType === 'document_generation')?.tokens).toBe(40000);
    });
  });

  describe('checkBudget', () => {
    it('should detect budget warning at 50%', async () => {
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes(':day:') && key.includes(':cost')) return Promise.resolve('5000'); // 50% of 10000
        if (key.includes(':month:') && key.includes(':cost')) return Promise.resolve('50000');
        return Promise.resolve('0');
      });

      const budget = await monitor.checkBudget('firm-001');

      expect(budget.dailyPercentage).toBe(50);
      expect(budget.alerts).toHaveLength(0); // No alerts at exactly 50%
    });

    it('should detect budget exceeded at 100%', async () => {
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes(':day:') && key.includes(':cost')) return Promise.resolve('10000'); // 100%
        if (key.includes(':month:') && key.includes(':cost')) return Promise.resolve('100000');
        return Promise.resolve('0');
      });

      const budget = await monitor.checkBudget('firm-001');

      expect(budget.dailyPercentage).toBe(100);
      expect(budget.alerts).toContain('Daily budget exceeded');
    });

    it('should detect monthly budget warning', async () => {
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes(':day:') && key.includes(':cost')) return Promise.resolve('1000');
        if (key.includes(':month:') && key.includes(':cost')) return Promise.resolve('190000'); // 95%
        return Promise.resolve('0');
      });

      const budget = await monitor.checkBudget('firm-001');

      expect(budget.monthlyPercentage).toBe(95);
      expect(budget.alerts).toContain('Monthly budget at 90%');
    });
  });

  describe('getUserHourlyUsage', () => {
    it('should return user hourly token count', async () => {
      mockRedis.get.mockResolvedValue('2500');

      const usage = await monitor.getUserHourlyUsage('user-001');

      expect(usage).toBe(2500);
    });

    it('should return 0 for new users', async () => {
      mockRedis.get.mockResolvedValue(null);

      const usage = await monitor.getUserHourlyUsage('user-new');

      expect(usage).toBe(0);
    });
  });
});
