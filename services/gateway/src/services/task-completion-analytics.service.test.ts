/**
 * Task Completion Analytics Service Unit Tests
 * Story 4.7: Task Analytics and Optimization - Task 32
 *
 * Tests for:
 * - Completion time calculation
 * - Grouping by type and user
 * - Date range filtering
 * - Comparison calculations
 */

import { TaskCompletionAnalyticsService } from './task-completion-analytics.service';
import {
  completedTasksFixtures,
  emptyCompletionFixture,
  singleTaskCompletionFixture,
  defaultFilters,
  TEST_FIRM_ID,
  TEST_USER_IDS,
} from '../../__tests__/fixtures/task-analytics.fixtures';
import { TaskStatus, TaskTypeEnum } from '@prisma/client';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(0),
  }));
});

describe('TaskCompletionAnalyticsService', () => {
  let service: TaskCompletionAnalyticsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      task: {
        findMany: jest.fn(),
      },
    };

    service = new TaskCompletionAnalyticsService(mockPrisma, undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateMetrics', () => {
    it('should calculate correct metrics for multiple tasks', () => {
      const tasks = [
        {
          id: 'task-1',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-12-01T00:00:00Z'),
          completedAt: new Date('2025-12-02T00:00:00Z'), // 24 hours
          assignee: { id: TEST_USER_IDS.associate, firstName: 'Jane', lastName: 'Associate' },
        },
        {
          id: 'task-2',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.paralegal,
          createdAt: new Date('2025-12-01T00:00:00Z'),
          completedAt: new Date('2025-12-03T00:00:00Z'), // 48 hours
          assignee: { id: TEST_USER_IDS.paralegal, firstName: 'Bob', lastName: 'Paralegal' },
        },
        {
          id: 'task-3',
          type: TaskTypeEnum.Meeting,
          assignedTo: TEST_USER_IDS.partner,
          createdAt: new Date('2025-12-01T00:00:00Z'),
          completedAt: new Date('2025-12-01T06:00:00Z'), // 6 hours
          assignee: { id: TEST_USER_IDS.partner, firstName: 'John', lastName: 'Partner' },
        },
      ];

      const metrics = service.calculateMetrics(tasks);

      expect(metrics.totalTasksAnalyzed).toBe(3);
      expect(metrics.avgCompletionTimeHours).toBe(26); // (24 + 48 + 6) / 3
      expect(metrics.medianCompletionTimeHours).toBe(24); // Middle value
      expect(metrics.minCompletionTimeHours).toBe(6);
      expect(metrics.maxCompletionTimeHours).toBe(48);
    });

    it('should return zeros for empty task list', () => {
      const metrics = service.calculateMetrics([]);

      expect(metrics).toEqual({
        avgCompletionTimeHours: 0,
        medianCompletionTimeHours: 0,
        minCompletionTimeHours: 0,
        maxCompletionTimeHours: 0,
        totalTasksAnalyzed: 0,
      });
    });

    it('should calculate correct median for even number of tasks', () => {
      const tasks = [
        {
          id: 'task-1',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-12-01T00:00:00Z'),
          completedAt: new Date('2025-12-01T12:00:00Z'), // 12 hours
          assignee: { id: TEST_USER_IDS.associate, firstName: 'Jane', lastName: 'Associate' },
        },
        {
          id: 'task-2',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.paralegal,
          createdAt: new Date('2025-12-01T00:00:00Z'),
          completedAt: new Date('2025-12-02T00:00:00Z'), // 24 hours
          assignee: { id: TEST_USER_IDS.paralegal, firstName: 'Bob', lastName: 'Paralegal' },
        },
      ];

      const metrics = service.calculateMetrics(tasks);

      expect(metrics.medianCompletionTimeHours).toBe(18); // (12 + 24) / 2
    });

    it('should handle single task correctly', () => {
      const tasks = [
        {
          id: 'task-1',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-12-01T00:00:00Z'),
          completedAt: new Date('2025-12-02T00:00:00Z'), // 24 hours
          assignee: { id: TEST_USER_IDS.associate, firstName: 'Jane', lastName: 'Associate' },
        },
      ];

      const metrics = service.calculateMetrics(tasks);

      expect(metrics.totalTasksAnalyzed).toBe(1);
      expect(metrics.avgCompletionTimeHours).toBe(24);
      expect(metrics.medianCompletionTimeHours).toBe(24);
      expect(metrics.minCompletionTimeHours).toBe(24);
      expect(metrics.maxCompletionTimeHours).toBe(24);
    });
  });

  describe('getCompletionTimeAnalytics', () => {
    it('should return analytics grouped by type and user', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-15T00:00:00Z'),
          completedAt: new Date('2025-11-16T00:00:00Z'),
          assignee: { id: TEST_USER_IDS.associate, firstName: 'Jane', lastName: 'Associate' },
        },
        {
          id: 'task-2',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-17T00:00:00Z'),
          completedAt: new Date('2025-11-18T00:00:00Z'),
          assignee: { id: TEST_USER_IDS.associate, firstName: 'Jane', lastName: 'Associate' },
        },
        {
          id: 'task-3',
          type: TaskTypeEnum.DocumentCreation,
          assignedTo: TEST_USER_IDS.paralegal,
          createdAt: new Date('2025-11-18T00:00:00Z'),
          completedAt: new Date('2025-11-20T00:00:00Z'),
          assignee: { id: TEST_USER_IDS.paralegal, firstName: 'Bob', lastName: 'Paralegal' },
        },
      ];

      // Current period
      mockPrisma.task.findMany.mockResolvedValueOnce(mockTasks);
      // Previous period for byType comparison
      mockPrisma.task.findMany.mockResolvedValueOnce([]);

      const result = await service.getCompletionTimeAnalytics(TEST_FIRM_ID, defaultFilters);

      expect(result.firmMetrics.totalTasksAnalyzed).toBe(3);
      expect(result.byType).toHaveLength(2); // Research, DocumentCreation
      expect(result.byUser).toHaveLength(2); // associate, paralegal

      // Check byType grouping
      const researchType = result.byType.find((t) => t.taskType === TaskTypeEnum.Research);
      expect(researchType?.metrics.totalTasksAnalyzed).toBe(2);

      // Check byUser grouping
      const associateUser = result.byUser.find((u) => u.userId === TEST_USER_IDS.associate);
      expect(associateUser?.taskCount).toBe(2);
      expect(associateUser?.userName).toBe('Jane Associate');
    });

    it('should apply date range filtering', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      await service.getCompletionTimeAnalytics(TEST_FIRM_ID, defaultFilters);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            firmId: TEST_FIRM_ID,
            status: TaskStatus.Completed,
            completedAt: expect.objectContaining({
              gte: defaultFilters.dateRange.start,
              lte: defaultFilters.dateRange.end,
            }),
          }),
        })
      );
    });

    it('should apply optional task type filter', async () => {
      const filteredFilters = {
        ...defaultFilters,
        taskTypes: [TaskTypeEnum.Research],
      };

      mockPrisma.task.findMany.mockResolvedValue([]);

      await service.getCompletionTimeAnalytics(TEST_FIRM_ID, filteredFilters);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: { in: [TaskTypeEnum.Research] },
          }),
        })
      );
    });

    it('should apply optional user filter', async () => {
      const filteredFilters = {
        ...defaultFilters,
        userIds: [TEST_USER_IDS.associate],
      };

      mockPrisma.task.findMany.mockResolvedValue([]);

      await service.getCompletionTimeAnalytics(TEST_FIRM_ID, filteredFilters);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedTo: { in: [TEST_USER_IDS.associate] },
          }),
        })
      );
    });

    it('should handle empty results', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      const result = await service.getCompletionTimeAnalytics(TEST_FIRM_ID, defaultFilters);

      expect(result.firmMetrics.totalTasksAnalyzed).toBe(0);
      expect(result.byType).toHaveLength(0);
      expect(result.byUser).toHaveLength(0);
    });
  });

  describe('getCompletionByType', () => {
    it('should calculate comparison to previous period', async () => {
      const currentTasks = [
        {
          id: 'task-1',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-15T00:00:00Z'),
          completedAt: new Date('2025-11-16T12:00:00Z'), // 36 hours
          assignee: { id: TEST_USER_IDS.associate, firstName: 'Jane', lastName: 'Associate' },
        },
      ];

      const previousTasks = [
        {
          id: 'task-prev-1',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-10-15T00:00:00Z'),
          completedAt: new Date('2025-10-16T00:00:00Z'), // 24 hours
          assignee: { id: TEST_USER_IDS.associate, firstName: 'Jane', lastName: 'Associate' },
        },
      ];

      // Current period tasks
      mockPrisma.task.findMany.mockResolvedValueOnce(currentTasks);
      // Previous period tasks
      mockPrisma.task.findMany.mockResolvedValueOnce(previousTasks);

      const result = await service.getCompletionByType(TEST_FIRM_ID, defaultFilters);

      expect(result).toHaveLength(1);
      expect(result[0].taskType).toBe(TaskTypeEnum.Research);
      // (36 - 24) / 24 * 100 = 50%
      expect(result[0].comparedToPrevious).toBe(50);
    });

    it('should not calculate comparison when no previous data', async () => {
      const currentTasks = [
        {
          id: 'task-1',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-15T00:00:00Z'),
          completedAt: new Date('2025-11-16T00:00:00Z'),
          assignee: { id: TEST_USER_IDS.associate, firstName: 'Jane', lastName: 'Associate' },
        },
      ];

      mockPrisma.task.findMany.mockResolvedValueOnce(currentTasks);
      mockPrisma.task.findMany.mockResolvedValueOnce([]);

      const result = await service.getCompletionByType(TEST_FIRM_ID, defaultFilters);

      expect(result[0].comparedToPrevious).toBeUndefined();
    });
  });

  describe('getCompletionByUser', () => {
    it('should calculate comparison to team average', async () => {
      const tasks = [
        {
          id: 'task-1',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-15T00:00:00Z'),
          completedAt: new Date('2025-11-16T00:00:00Z'), // 24 hours
          assignee: { id: TEST_USER_IDS.associate, firstName: 'Jane', lastName: 'Associate' },
        },
        {
          id: 'task-2',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.paralegal,
          createdAt: new Date('2025-11-15T00:00:00Z'),
          completedAt: new Date('2025-11-17T00:00:00Z'), // 48 hours
          assignee: { id: TEST_USER_IDS.paralegal, firstName: 'Bob', lastName: 'Paralegal' },
        },
      ];

      // Team average: (24 + 48) / 2 = 36 hours
      // Associate: 24 hours, (24 - 36) / 36 * 100 = -33.33%
      // Paralegal: 48 hours, (48 - 36) / 36 * 100 = +33.33%

      const result = await service.getCompletionByUser(TEST_FIRM_ID, defaultFilters, tasks);

      const associateResult = result.find((u) => u.userId === TEST_USER_IDS.associate);
      const paralegalResult = result.find((u) => u.userId === TEST_USER_IDS.paralegal);

      expect(associateResult?.comparedToTeamAvg).toBeCloseTo(-33.33, 0);
      expect(paralegalResult?.comparedToTeamAvg).toBeCloseTo(33.33, 0);
    });

    it('should sort by task count descending', async () => {
      const tasks = [
        {
          id: 'task-1',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-15T00:00:00Z'),
          completedAt: new Date('2025-11-16T00:00:00Z'),
          assignee: { id: TEST_USER_IDS.associate, firstName: 'Jane', lastName: 'Associate' },
        },
        {
          id: 'task-2',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.paralegal,
          createdAt: new Date('2025-11-15T00:00:00Z'),
          completedAt: new Date('2025-11-16T00:00:00Z'),
          assignee: { id: TEST_USER_IDS.paralegal, firstName: 'Bob', lastName: 'Paralegal' },
        },
        {
          id: 'task-3',
          type: TaskTypeEnum.Meeting,
          assignedTo: TEST_USER_IDS.paralegal,
          createdAt: new Date('2025-11-15T00:00:00Z'),
          completedAt: new Date('2025-11-16T00:00:00Z'),
          assignee: { id: TEST_USER_IDS.paralegal, firstName: 'Bob', lastName: 'Paralegal' },
        },
      ];

      const result = await service.getCompletionByUser(TEST_FIRM_ID, defaultFilters, tasks);

      // Paralegal has 2 tasks, Associate has 1
      expect(result[0].userId).toBe(TEST_USER_IDS.paralegal);
      expect(result[0].taskCount).toBe(2);
      expect(result[1].userId).toBe(TEST_USER_IDS.associate);
      expect(result[1].taskCount).toBe(1);
    });
  });

  describe('caching', () => {
    it('should invalidate cache for a firm', async () => {
      const mockRedis = {
        get: jest.fn().mockResolvedValue(null),
        setex: jest.fn().mockResolvedValue('OK'),
        keys: jest.fn().mockResolvedValue(['analytics:completion:firm-1:key1', 'analytics:completion:firm-1:key2']),
        del: jest.fn().mockResolvedValue(2),
      };

      const serviceWithRedis = new TaskCompletionAnalyticsService(mockPrisma, mockRedis as any);

      await serviceWithRedis.invalidateCache('firm-1');

      expect(mockRedis.keys).toHaveBeenCalledWith('analytics:completion:firm-1:*');
      expect(mockRedis.del).toHaveBeenCalledWith(
        'analytics:completion:firm-1:key1',
        'analytics:completion:firm-1:key2'
      );
    });
  });
});
