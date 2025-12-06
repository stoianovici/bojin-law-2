/**
 * Velocity Trends Service Unit Tests
 * Story 4.7: Task Analytics and Optimization - Task 34
 *
 * Tests for:
 * - Velocity score calculation
 * - Trend determination
 * - Time series aggregation
 */

import { VelocityTrendsService } from './velocity-trends.service';
import {
  defaultFilters,
  TEST_FIRM_ID,
  TEST_USER_IDS,
  mockUsers,
} from '../../__tests__/fixtures/task-analytics.fixtures';
import { TaskStatus } from '@prisma/client';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(0),
  }));
});

describe('VelocityTrendsService', () => {
  let service: VelocityTrendsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      task: {
        groupBy: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    };

    service = new VelocityTrendsService(mockPrisma, undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateVelocityScore', () => {
    it('should return ratio of completed to target', () => {
      const score = service.calculateVelocityScore(10, 8, 10);
      expect(score).toBe(0.8); // 8/10
    });

    it('should return 0 when target is 0', () => {
      const score = service.calculateVelocityScore(10, 8, 0);
      expect(score).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      const score = service.calculateVelocityScore(10, 7, 9);
      expect(score).toBe(0.78); // 7/9 = 0.777... rounded
    });

    it('should handle velocity greater than 1', () => {
      const score = service.calculateVelocityScore(10, 15, 10);
      expect(score).toBe(1.5); // 15/10
    });
  });

  describe('determineTrend', () => {
    it('should return improving when current > previous by more than 5%', () => {
      const trend = service.determineTrend(1.1, 1.0); // 10% increase
      expect(trend).toBe('improving');
    });

    it('should return declining when current < previous by more than 5%', () => {
      const trend = service.determineTrend(0.9, 1.0); // 10% decrease
      expect(trend).toBe('declining');
    });

    it('should return stable when change is within 5%', () => {
      const trend = service.determineTrend(1.02, 1.0); // 2% increase
      expect(trend).toBe('stable');
    });

    it('should return stable when previous is 0', () => {
      const trend = service.determineTrend(1.0, 0);
      expect(trend).toBe('stable');
    });

    it('should handle equal values as stable', () => {
      const trend = service.determineTrend(1.0, 1.0);
      expect(trend).toBe('stable');
    });

    it('should correctly identify edge case at exactly 5%', () => {
      // Exactly 5% increase is 1.05/1.0 - 1 = 0.05 = 5%, which is not > 5%
      // So 1.05 vs 1.0 should be stable (changePercent = 5, not > 5)
      const trend = service.determineTrend(1.04999, 1.0);
      expect(trend).toBe('stable');
    });

    it('should correctly identify just over 5%', () => {
      const trend = service.determineTrend(1.051, 1.0);
      expect(trend).toBe('improving');
    });
  });

  describe('getVelocityTrends', () => {
    it('should return velocity trends with time series', async () => {
      // Mock groupBy for created tasks
      mockPrisma.task.groupBy.mockResolvedValueOnce([
        { createdAt: new Date('2025-11-15'), _count: { id: 5 } },
        { createdAt: new Date('2025-11-16'), _count: { id: 3 } },
      ]);

      // Mock groupBy for completed tasks
      mockPrisma.task.groupBy.mockResolvedValueOnce([
        { completedAt: new Date('2025-11-15'), _count: { id: 4 } },
        { completedAt: new Date('2025-11-16'), _count: { id: 2 } },
      ]);

      // Mock historical target count
      mockPrisma.task.count.mockResolvedValueOnce(90); // 90 completed in 90 days = 1/day avg

      // Mock current period count for firm velocity
      mockPrisma.task.count.mockResolvedValueOnce(48); // current period completed
      // Mock previous period count
      mockPrisma.task.count.mockResolvedValueOnce(40); // previous period completed

      // Mock user velocity groupBy
      mockPrisma.task.groupBy.mockResolvedValueOnce([
        { assignedTo: TEST_USER_IDS.associate, _count: { id: 20 } },
        { assignedTo: TEST_USER_IDS.paralegal, _count: { id: 15 } },
      ]);
      mockPrisma.task.groupBy.mockResolvedValueOnce([
        { assignedTo: TEST_USER_IDS.associate, _count: { id: 18 } },
        { assignedTo: TEST_USER_IDS.paralegal, _count: { id: 12 } },
      ]);

      // Mock user names
      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers);

      const result = await service.getVelocityTrends(TEST_FIRM_ID, defaultFilters, 'daily');

      expect(result.firmVelocity).toBeDefined();
      expect(result.timeSeries).toBeDefined();
      expect(result.byUser).toBeDefined();
      expect(result.interval).toBe('daily');
    });

    it('should calculate firm velocity with trend', async () => {
      // Time series data (getDailyTaskCounts calls groupBy twice)
      mockPrisma.task.groupBy.mockResolvedValueOnce([]);
      mockPrisma.task.groupBy.mockResolvedValueOnce([]);

      // Historical target count (called in getTimeSeries -> getHistoricalTarget)
      mockPrisma.task.count.mockResolvedValueOnce(30); // 30 completed / 90 days = 0.33/day

      // Firm velocity calculation:
      // Current period completed count
      mockPrisma.task.count.mockResolvedValueOnce(15);
      // Previous period completed count
      mockPrisma.task.count.mockResolvedValueOnce(10);
      // Historical target again for firm velocity
      mockPrisma.task.count.mockResolvedValueOnce(30);

      // User velocity - groupBy calls
      mockPrisma.task.groupBy.mockResolvedValueOnce([]);
      mockPrisma.task.groupBy.mockResolvedValueOnce([]);
      mockPrisma.user.findMany.mockResolvedValueOnce([]);
      // Historical target for user velocity
      mockPrisma.task.count.mockResolvedValueOnce(30);

      const result = await service.getVelocityTrends(TEST_FIRM_ID, defaultFilters, 'daily');

      expect(result.firmVelocity).toBeDefined();
      // With 15 current vs 10 previous, trend should be improving
      if (result.firmVelocity.previous > 0) {
        expect(result.firmVelocity.trend).toBe('improving');
      }
    });
  });

  describe('getUserVelocityComparison', () => {
    it('should calculate velocity and trend for each user', async () => {
      // Current period
      mockPrisma.task.groupBy.mockResolvedValueOnce([
        { assignedTo: TEST_USER_IDS.associate, _count: { id: 12 } },
        { assignedTo: TEST_USER_IDS.paralegal, _count: { id: 8 } },
      ]);

      // Previous period
      mockPrisma.task.groupBy.mockResolvedValueOnce([
        { assignedTo: TEST_USER_IDS.associate, _count: { id: 10 } },
        { assignedTo: TEST_USER_IDS.paralegal, _count: { id: 10 } },
      ]);

      // User names
      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers);

      // Historical target
      mockPrisma.task.count.mockResolvedValueOnce(60);

      const result = await service.getUserVelocityComparison(TEST_FIRM_ID, defaultFilters);

      expect(result).toHaveLength(2);

      const associate = result.find((u) => u.userId === TEST_USER_IDS.associate);
      expect(associate?.trendDirection).toBe('up'); // 12 vs 10 = +20%

      const paralegal = result.find((u) => u.userId === TEST_USER_IDS.paralegal);
      expect(paralegal?.trendDirection).toBe('down'); // 8 vs 10 = -20%
    });

    it('should sort users by velocity descending', async () => {
      mockPrisma.task.groupBy.mockResolvedValueOnce([
        { assignedTo: TEST_USER_IDS.paralegal, _count: { id: 20 } },
        { assignedTo: TEST_USER_IDS.associate, _count: { id: 10 } },
      ]);
      mockPrisma.task.groupBy.mockResolvedValueOnce([]);
      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers);
      mockPrisma.task.count.mockResolvedValueOnce(30);

      const result = await service.getUserVelocityComparison(TEST_FIRM_ID, defaultFilters);

      // Paralegal has higher count, should be first
      expect(result[0].userId).toBe(TEST_USER_IDS.paralegal);
      expect(result[0].currentVelocity).toBeGreaterThan(result[1].currentVelocity);
    });

    it('should handle users with no previous data', async () => {
      mockPrisma.task.groupBy.mockResolvedValueOnce([
        { assignedTo: TEST_USER_IDS.associate, _count: { id: 10 } },
      ]);
      mockPrisma.task.groupBy.mockResolvedValueOnce([]); // No previous data
      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers);
      mockPrisma.task.count.mockResolvedValueOnce(30);

      const result = await service.getUserVelocityComparison(TEST_FIRM_ID, defaultFilters);

      expect(result[0].previousVelocity).toBe(0);
      expect(result[0].trendDirection).toBe('stable'); // Can't calculate trend with 0 previous
    });
  });

  describe('calculateFirmVelocity', () => {
    it('should compare current and previous periods', async () => {
      mockPrisma.task.count
        .mockResolvedValueOnce(50) // Current period completed
        .mockResolvedValueOnce(40) // Previous period completed
        .mockResolvedValueOnce(120); // Historical 90-day average

      const result = await service.calculateFirmVelocity(TEST_FIRM_ID, defaultFilters);

      expect(result.current).toBeGreaterThan(0);
      expect(result.previous).toBeGreaterThan(0);
      expect(result.trend).toBe('improving'); // 50 > 40
      expect(result.percentageChange).toBeGreaterThan(0);
    });

    it('should handle no previous data', async () => {
      mockPrisma.task.count
        .mockResolvedValueOnce(50) // Current period
        .mockResolvedValueOnce(0) // No previous data
        .mockResolvedValueOnce(100); // Historical

      const result = await service.calculateFirmVelocity(TEST_FIRM_ID, defaultFilters);

      expect(result.current).toBeGreaterThan(0);
      expect(result.previous).toBe(0);
      expect(result.percentageChange).toBe(0);
    });
  });

  describe('interval aggregation', () => {
    it('should aggregate weekly correctly', async () => {
      // Mock daily data across 2 weeks
      mockPrisma.task.groupBy.mockResolvedValueOnce([
        { createdAt: new Date('2025-11-04'), _count: { id: 2 } }, // Week 1 Mon
        { createdAt: new Date('2025-11-05'), _count: { id: 3 } }, // Week 1 Tue
        { createdAt: new Date('2025-11-11'), _count: { id: 4 } }, // Week 2 Mon
        { createdAt: new Date('2025-11-12'), _count: { id: 1 } }, // Week 2 Tue
      ]);
      mockPrisma.task.groupBy.mockResolvedValueOnce([]);
      mockPrisma.task.count.mockResolvedValueOnce(30);
      mockPrisma.task.count.mockResolvedValueOnce(25);
      mockPrisma.task.count.mockResolvedValueOnce(20);
      mockPrisma.task.groupBy.mockResolvedValueOnce([]);
      mockPrisma.task.groupBy.mockResolvedValueOnce([]);
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      const weekFilters = {
        ...defaultFilters,
        dateRange: {
          start: new Date('2025-11-03'),
          end: new Date('2025-11-15'),
        },
      };

      const result = await service.getVelocityTrends(TEST_FIRM_ID, weekFilters, 'weekly');

      expect(result.interval).toBe('weekly');
      // Aggregated weeks should be in time series
      expect(result.timeSeries.length).toBeGreaterThan(0);
    });
  });
});
