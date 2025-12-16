/**
 * Estimate Comparison Service Unit Tests
 * Story 4.3: Time Estimation & Manual Time Logging - Task 21
 *
 * Tests for estimate vs actual analysis, accuracy calculation, and recommendations
 */

import { PrismaClient } from '@legal-platform/database';
import { getEstimateVsActualReport, getTaskTypeAccuracy } from './estimate-comparison.service';
import type { TimeEntryDateRange } from '@legal-platform/types';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  PrismaClient: jest.fn(),
}));

describe('EstimateComparisonService', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      task: {
        findMany: jest.fn(),
      },
      timeEntry: {
        groupBy: jest.fn(),
      },
    } as any;

    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEstimateVsActualReport', () => {
    const dateRange: TimeEntryDateRange = {
      start: new Date('2025-12-01'),
      end: new Date('2025-12-31'),
    };

    it('should calculate overall accuracy across all task types', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          type: 'Research',
          estimatedHours: 5.0,
          status: 'Completed',
          timeEntries: [{ hours: 6.0 }],
        },
        {
          id: 'task-2',
          type: 'Research',
          estimatedHours: 10.0,
          status: 'Completed',
          timeEntries: [{ hours: 8.0 }],
        },
        {
          id: 'task-3',
          type: 'DocumentCreation',
          estimatedHours: 3.0,
          status: 'Completed',
          timeEntries: [{ hours: 3.0 }],
        },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockTasks as any);

      const result = await getEstimateVsActualReport('user-123', dateRange);

      // Overall: (14 actual / 18 estimated) * 100 = 77.78%
      expect(result.overallAccuracy).toBeCloseTo(77.78, 1);
      expect(result.byTaskType).toHaveLength(2);
    });

    it('should group by task type and calculate accuracy', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          type: 'Research',
          estimatedHours: 5.0,
          status: 'Completed',
          timeEntries: [{ hours: 5.5 }],
        },
        {
          id: 'task-2',
          type: 'Research',
          estimatedHours: 10.0,
          status: 'Completed',
          timeEntries: [{ hours: 9.5 }],
        },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockTasks as any);

      const result = await getEstimateVsActualReport('user-123', dateRange);

      const researchAccuracy = result.byTaskType.find(
        (t: { taskType: string }) => t.taskType === 'Research'
      );

      expect(researchAccuracy).toMatchObject({
        taskType: 'Research',
        taskCount: 2,
        avgEstimatedHours: 7.5, // (5 + 10) / 2
        avgActualHours: 7.5, // (5.5 + 9.5) / 2
        accuracy: 100, // Perfect estimate
        variance: 0,
        variancePercent: 0,
      });
    });

    it('should calculate variance and variance percent correctly', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          type: 'Meeting',
          estimatedHours: 2.0,
          status: 'Completed',
          timeEntries: [{ hours: 3.0 }], // 1 hour over
        },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockTasks as any);

      const result = await getEstimateVsActualReport('user-123', dateRange);

      const meetingAccuracy = result.byTaskType.find(
        (t: { taskType: string }) => t.taskType === 'Meeting'
      );

      expect(meetingAccuracy).toMatchObject({
        variance: 1.0, // 3 - 2
        variancePercent: 50, // (1 / 2) * 100
      });
    });

    it('should only include completed tasks with estimates and time entries', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          type: 'Research',
          estimatedHours: 5.0,
          status: 'Completed',
          timeEntries: [{ hours: 5.0 }],
        },
        {
          id: 'task-2',
          type: 'Research',
          estimatedHours: null, // No estimate
          status: 'Completed',
          timeEntries: [{ hours: 3.0 }],
        },
        {
          id: 'task-3',
          type: 'Research',
          estimatedHours: 5.0,
          status: 'InProgress', // Not completed
          timeEntries: [{ hours: 2.0 }],
        },
        {
          id: 'task-4',
          type: 'Research',
          estimatedHours: 5.0,
          status: 'Completed',
          timeEntries: [], // No time logged
        },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockTasks as any);

      const result = await getEstimateVsActualReport('user-123', dateRange);

      // Only task-1 should be included
      expect(result.byTaskType[0].taskCount).toBe(1);
    });

    it('should calculate improvement trend based on period comparison', async () => {
      const currentPeriodTasks = [
        {
          id: 'task-1',
          type: 'Research',
          estimatedHours: 10.0,
          status: 'Completed',
          timeEntries: [{ hours: 10.5 }],
          completedAt: new Date('2025-12-15'),
        },
      ];

      const previousPeriodTasks = [
        {
          id: 'task-old',
          type: 'Research',
          estimatedHours: 10.0,
          status: 'Completed',
          timeEntries: [{ hours: 12.0 }],
          completedAt: new Date('2025-11-15'),
        },
      ];

      // First call for current period
      mockPrisma.task.findMany.mockResolvedValueOnce(currentPeriodTasks as any);
      // Second call for previous period
      mockPrisma.task.findMany.mockResolvedValueOnce(previousPeriodTasks as any);

      const result = await getEstimateVsActualReport('user-123', dateRange);

      // Improvement: 95% (current) vs 83% (previous) = UP
      expect(result.improvementTrend).toBe('up');
    });

    it('should return empty report when no completed tasks', async () => {
      mockPrisma.task.findMany.mockResolvedValue([] as any);

      const result = await getEstimateVsActualReport('user-123', dateRange);

      expect(result.overallAccuracy).toBe(100);
      expect(result.byTaskType).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
    });

    it('should generate AI recommendations for poor accuracy', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          type: 'Research',
          estimatedHours: 5.0,
          status: 'Completed',
          timeEntries: [{ hours: 10.0 }], // 100% over estimate
        },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockTasks as any);

      const result = await getEstimateVsActualReport('user-123', dateRange);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations).toEqual(
        expect.arrayContaining([expect.stringMatching(/Research tasks/i)])
      );
    });
  });

  describe('getTaskTypeAccuracy', () => {
    it('should calculate accuracy for a specific task type', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          type: 'Research',
          estimatedHours: 5.0,
          status: 'Completed',
          timeEntries: [{ hours: 4.5 }],
        },
        {
          id: 'task-2',
          type: 'Research',
          estimatedHours: 10.0,
          status: 'Completed',
          timeEntries: [{ hours: 11.0 }],
        },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockTasks as any);

      const result = await getTaskTypeAccuracy('user-123', 'Research');

      expect(result).toMatchObject({
        taskType: 'Research',
        taskCount: 2,
        avgEstimatedHours: 7.5,
        avgActualHours: 7.75,
      });
    });

    it('should filter by task type correctly', async () => {
      mockPrisma.task.findMany.mockResolvedValue([] as any);

      await getTaskTypeAccuracy('user-123', 'Meeting');

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          type: 'Meeting',
        }),
      });
    });
  });
});
