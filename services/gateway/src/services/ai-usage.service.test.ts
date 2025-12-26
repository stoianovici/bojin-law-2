/**
 * AI Usage Service Tests
 * OPS-235: AI Usage Aggregation Service
 */

// Mock dependencies
jest.mock('@legal-platform/database', () => ({
  prisma: {
    aIUsageLog: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
  redis: {
    get: jest.fn(),
    setex: jest.fn(),
    keys: jest.fn(),
    del: jest.fn(),
  },
}));

import { AIUsageService } from './ai-usage.service';
import { prisma, redis } from '@legal-platform/database';
import { Prisma } from '@prisma/client';

describe('AIUsageService', () => {
  let service: AIUsageService;
  const testFirmId = 'firm-123';
  const testDateRange = {
    start: new Date('2024-12-01'),
    end: new Date('2024-12-31'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AIUsageService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getUsageOverview', () => {
    it('should return cached value if exists', async () => {
      const cachedData = {
        totalCost: 45.5,
        totalTokens: 150000,
        totalCalls: 500,
        successRate: 100,
        averageDailyCost: 1.5,
        projectedMonthEnd: 55.0,
      };
      (redis.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedData));

      const result = await service.getUsageOverview(testFirmId, testDateRange);

      expect(result).toEqual(cachedData);
      expect(prisma.aIUsageLog.aggregate).not.toHaveBeenCalled();
    });

    it('should query DB and cache result if not cached', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce(null);
      (prisma.aIUsageLog.aggregate as jest.Mock).mockResolvedValueOnce({
        _sum: {
          inputTokens: 80000,
          outputTokens: 70000,
          costEur: new Prisma.Decimal(45.5),
        },
        _count: 500,
      });

      const result = await service.getUsageOverview(testFirmId, testDateRange);

      expect(result.totalCost).toBe(45.5);
      expect(result.totalTokens).toBe(150000);
      expect(result.totalCalls).toBe(500);
      expect(result.successRate).toBe(100);
      expect(redis.setex).toHaveBeenCalled();
    });

    it('should handle empty results gracefully', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce(null);
      (prisma.aIUsageLog.aggregate as jest.Mock).mockResolvedValueOnce({
        _sum: {
          inputTokens: null,
          outputTokens: null,
          costEur: null,
        },
        _count: 0,
      });

      const result = await service.getUsageOverview(testFirmId, testDateRange);

      expect(result.totalCost).toBe(0);
      expect(result.totalTokens).toBe(0);
      expect(result.totalCalls).toBe(0);
    });

    it('should use current month range if no range provided', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce(null);
      (prisma.aIUsageLog.aggregate as jest.Mock).mockResolvedValueOnce({
        _sum: {
          inputTokens: 1000,
          outputTokens: 500,
          costEur: new Prisma.Decimal(0.5),
        },
        _count: 10,
      });

      await service.getUsageOverview(testFirmId);

      expect(prisma.aIUsageLog.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            firmId: testFirmId,
          }),
        })
      );
    });
  });

  describe('getDailyCosts', () => {
    it('should return cached value if exists', async () => {
      const cachedData = [
        { date: '2024-12-01', cost: 1.5, tokens: 5000, calls: 20 },
        { date: '2024-12-02', cost: 2.0, tokens: 6000, calls: 25 },
      ];
      (redis.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedData));

      const result = await service.getDailyCosts(testFirmId, testDateRange);

      expect(result).toEqual(cachedData);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('should query DB with raw SQL for date grouping', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce(null);
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
        {
          date: new Date('2024-12-01'),
          cost: new Prisma.Decimal(1.5),
          tokens: BigInt(5000),
          calls: BigInt(20),
        },
        {
          date: new Date('2024-12-02'),
          cost: new Prisma.Decimal(2.0),
          tokens: BigInt(6000),
          calls: BigInt(25),
        },
      ]);

      const result = await service.getDailyCosts(testFirmId, testDateRange);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-12-01');
      expect(result[0].cost).toBe(1.5);
      expect(result[0].tokens).toBe(5000);
      expect(result[0].calls).toBe(20);
      expect(redis.setex).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce(null);
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.getDailyCosts(testFirmId, testDateRange);

      expect(result).toEqual([]);
    });
  });

  describe('getCostsByFeature', () => {
    it('should return cached value if exists', async () => {
      const cachedData = [
        {
          feature: 'assistant_chat',
          featureName: 'Asistent AI',
          cost: 25.0,
          tokens: 80000,
          calls: 300,
          percentOfTotal: 55.5,
        },
      ];
      (redis.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedData));

      const result = await service.getCostsByFeature(testFirmId, testDateRange);

      expect(result).toEqual(cachedData);
      expect(prisma.aIUsageLog.groupBy).not.toHaveBeenCalled();
    });

    it('should group by feature and calculate percentages', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce(null);
      (prisma.aIUsageLog.groupBy as jest.Mock).mockResolvedValueOnce([
        {
          feature: 'assistant_chat',
          _sum: {
            inputTokens: 50000,
            outputTokens: 30000,
            costEur: new Prisma.Decimal(25.0),
          },
          _count: 300,
        },
        {
          feature: 'search_index',
          _sum: {
            inputTokens: 10000,
            outputTokens: 10000,
            costEur: new Prisma.Decimal(20.0),
          },
          _count: 200,
        },
      ]);

      const result = await service.getCostsByFeature(testFirmId, testDateRange);

      expect(result).toHaveLength(2);
      expect(result[0].feature).toBe('assistant_chat');
      expect(result[0].featureName).toBe('Asistent AI');
      expect(result[0].cost).toBe(25.0);
      expect(result[0].tokens).toBe(80000);
      expect(result[0].percentOfTotal).toBeCloseTo(55.56, 1);
      expect(result[1].feature).toBe('search_index');
      expect(result[1].featureName).toBe('Indexare Căutare');
      expect(result[1].percentOfTotal).toBeCloseTo(44.44, 1);
    });

    it('should handle unknown features with fallback name', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce(null);
      (prisma.aIUsageLog.groupBy as jest.Mock).mockResolvedValueOnce([
        {
          feature: 'unknown_feature',
          _sum: {
            inputTokens: 1000,
            outputTokens: 500,
            costEur: new Prisma.Decimal(1.0),
          },
          _count: 10,
        },
      ]);

      const result = await service.getCostsByFeature(testFirmId, testDateRange);

      expect(result[0].feature).toBe('unknown_feature');
      expect(result[0].featureName).toBe('unknown_feature'); // Falls back to code
    });
  });

  describe('getCostsByUser', () => {
    it('should return cached value if exists', async () => {
      const cachedData = [
        { userId: 'user-1', userName: 'John Doe', cost: 30.0, tokens: 90000, calls: 350 },
      ];
      (redis.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedData));

      const result = await service.getCostsByUser(testFirmId, testDateRange);

      expect(result).toEqual(cachedData);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('should join with users table for names', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce(null);
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
        {
          user_id: 'user-1',
          first_name: 'John',
          last_name: 'Doe',
          cost: new Prisma.Decimal(30.0),
          tokens: BigInt(90000),
          calls: BigInt(350),
        },
        {
          user_id: null,
          first_name: null,
          last_name: null,
          cost: new Prisma.Decimal(15.0),
          tokens: BigInt(60000),
          calls: BigInt(150),
        },
      ]);

      const result = await service.getCostsByUser(testFirmId, testDateRange);

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('user-1');
      expect(result[0].userName).toBe('John Doe');
      expect(result[0].cost).toBe(30.0);
      expect(result[1].userId).toBe('batch');
      expect(result[1].userName).toBe('Procesare Batch');
    });
  });

  describe('getCurrentMonthSpend', () => {
    it('should return current month total cost', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce(null);
      (prisma.aIUsageLog.aggregate as jest.Mock).mockResolvedValueOnce({
        _sum: {
          inputTokens: 100000,
          outputTokens: 50000,
          costEur: new Prisma.Decimal(42.5),
        },
        _count: 600,
      });

      const result = await service.getCurrentMonthSpend(testFirmId);

      expect(result).toBe(42.5);
    });
  });

  describe('getProjectedMonthEnd', () => {
    it('should return projected month-end cost', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce(null);
      (prisma.aIUsageLog.aggregate as jest.Mock).mockResolvedValueOnce({
        _sum: {
          inputTokens: 100000,
          outputTokens: 50000,
          costEur: new Prisma.Decimal(30.0),
        },
        _count: 600,
      });

      const result = await service.getProjectedMonthEnd(testFirmId);

      // Should be >= current spend (projection adds remaining days * average)
      expect(result).toBeGreaterThanOrEqual(30.0);
    });
  });

  describe('invalidateCache', () => {
    it('should delete all cached keys for firm', async () => {
      (redis.keys as jest.Mock).mockResolvedValueOnce([
        'ai-usage:overview:firm-123:2024-12-01:2024-12-31',
        'ai-usage:daily:firm-123:2024-12-01:2024-12-31',
        'ai-usage:feature:firm-123:2024-12-01:2024-12-31',
      ]);
      (redis.del as jest.Mock).mockResolvedValueOnce(3);

      await service.invalidateCache(testFirmId);

      expect(redis.keys).toHaveBeenCalledWith('ai-usage:*:firm-123:*');
      expect(redis.del).toHaveBeenCalledWith(
        'ai-usage:overview:firm-123:2024-12-01:2024-12-31',
        'ai-usage:daily:firm-123:2024-12-01:2024-12-31',
        'ai-usage:feature:firm-123:2024-12-01:2024-12-31'
      );
    });

    it('should handle empty cache gracefully', async () => {
      (redis.keys as jest.Mock).mockResolvedValueOnce([]);

      await service.invalidateCache(testFirmId);

      expect(redis.del).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      (redis.keys as jest.Mock).mockRejectedValueOnce(new Error('Redis error'));

      // Should not throw
      await expect(service.invalidateCache(testFirmId)).resolves.toBeUndefined();
    });
  });

  describe('cache key building', () => {
    it('should build consistent cache keys', async () => {
      // First call - no cache
      (redis.get as jest.Mock).mockResolvedValueOnce(null);
      (prisma.aIUsageLog.aggregate as jest.Mock).mockResolvedValueOnce({
        _sum: { inputTokens: 0, outputTokens: 0, costEur: new Prisma.Decimal(0) },
        _count: 0,
      });

      await service.getUsageOverview(testFirmId, testDateRange);

      expect(redis.get).toHaveBeenCalledWith('ai-usage:overview:firm-123:2024-12-01:2024-12-31');
      expect(redis.setex).toHaveBeenCalledWith(
        'ai-usage:overview:firm-123:2024-12-01:2024-12-31',
        300, // 5 minutes TTL
        expect.any(String)
      );
    });
  });
});
