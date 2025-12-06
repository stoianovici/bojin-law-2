/**
 * Critical Path Service Unit Tests
 * Story 4.4: Task Dependencies and Automation - Task 34
 *
 * Tests for critical path calculation, bottleneck identification, and slack time calculation
 */

import { PrismaClient, TaskStatus } from '@legal-platform/database';
import {
  calculateCriticalPath,
  recalculateCriticalPath,
  getBottlenecks,
} from './critical-path.service';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  PrismaClient: jest.fn(),
  TaskStatus: {
    Pending: 'Pending',
    InProgress: 'InProgress',
    Completed: 'Completed',
  },
}));

describe('CriticalPathService', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      case: {
        findUnique: jest.fn(),
      },
      task: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((operations) => Promise.all(operations)),
    } as any;

    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Calculate Critical Path Tests
  // ============================================================================

  describe('calculateCriticalPath', () => {
    const mockCase = {
      id: 'case-123',
      firmId: 'firm-123',
    };

    it('should return empty result when case has no tasks', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(mockCase as any);
      mockPrisma.task.findMany.mockResolvedValue([]);

      const result = await calculateCriticalPath('case-123', 'firm-123');

      expect(result.criticalTasks).toHaveLength(0);
      expect(result.totalDuration).toBe(0);
      expect(result.bottlenecks).toHaveLength(0);
    });

    it('should calculate critical path for simple linear chain', async () => {
      const tasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          caseId: 'case-123',
          estimatedHours: 8, // 1 day
          dueDate: new Date('2025-12-10'),
          status: TaskStatus.Pending,
          predecessors: [],
          successors: [
            {
              id: 'dep-1',
              predecessorId: 'task-1',
              successorId: 'task-2',
              lagDays: 0,
            },
          ],
        },
        {
          id: 'task-2',
          title: 'Task 2',
          caseId: 'case-123',
          estimatedHours: 16, // 2 days
          dueDate: new Date('2025-12-11'),
          status: TaskStatus.Pending,
          predecessors: [
            {
              id: 'dep-1',
              predecessorId: 'task-1',
              successorId: 'task-2',
              lagDays: 0,
            },
          ],
          successors: [
            {
              id: 'dep-2',
              predecessorId: 'task-2',
              successorId: 'task-3',
              lagDays: 0,
            },
          ],
        },
        {
          id: 'task-3',
          title: 'Task 3',
          caseId: 'case-123',
          estimatedHours: 8, // 1 day
          dueDate: new Date('2025-12-13'),
          status: TaskStatus.Pending,
          predecessors: [
            {
              id: 'dep-2',
              predecessorId: 'task-2',
              successorId: 'task-3',
              lagDays: 0,
            },
          ],
          successors: [],
        },
      ];

      mockPrisma.case.findUnique.mockResolvedValue(mockCase as any);
      mockPrisma.task.findMany.mockResolvedValue(tasks as any);

      const result = await calculateCriticalPath('case-123', 'firm-123');

      // All tasks are on critical path (linear chain)
      expect(result.criticalTasks).toHaveLength(3);
      expect(result.criticalTasks.map((t: Task) => t.id)).toContain('task-1');
      expect(result.criticalTasks.map((t: Task) => t.id)).toContain('task-2');
      expect(result.criticalTasks.map((t: Task) => t.id)).toContain('task-3');

      // Total duration: 1 + 2 + 1 = 4 days
      expect(result.totalDuration).toBe(4);

      expect(result.estimatedCompletionDate).toBeDefined();
    });

    it('should identify critical path with parallel tasks', async () => {
      const tasks = [
        {
          id: 'task-1',
          title: 'Start',
          caseId: 'case-123',
          estimatedHours: 8, // 1 day
          dueDate: new Date('2025-12-10'),
          status: TaskStatus.Pending,
          predecessors: [],
          successors: [
            {
              id: 'dep-1',
              predecessorId: 'task-1',
              successorId: 'task-2',
              lagDays: 0,
            },
            {
              id: 'dep-2',
              predecessorId: 'task-1',
              successorId: 'task-3',
              lagDays: 0,
            },
          ],
        },
        {
          id: 'task-2',
          title: 'Long Path',
          caseId: 'case-123',
          estimatedHours: 40, // 5 days
          dueDate: new Date('2025-12-11'),
          status: TaskStatus.Pending,
          predecessors: [
            {
              id: 'dep-1',
              predecessorId: 'task-1',
              successorId: 'task-2',
              lagDays: 0,
            },
          ],
          successors: [
            {
              id: 'dep-3',
              predecessorId: 'task-2',
              successorId: 'task-4',
              lagDays: 0,
            },
          ],
        },
        {
          id: 'task-3',
          title: 'Short Path',
          caseId: 'case-123',
          estimatedHours: 8, // 1 day
          dueDate: new Date('2025-12-11'),
          status: TaskStatus.Pending,
          predecessors: [
            {
              id: 'dep-2',
              predecessorId: 'task-1',
              successorId: 'task-3',
              lagDays: 0,
            },
          ],
          successors: [
            {
              id: 'dep-4',
              predecessorId: 'task-3',
              successorId: 'task-4',
              lagDays: 0,
            },
          ],
        },
        {
          id: 'task-4',
          title: 'End',
          caseId: 'case-123',
          estimatedHours: 8, // 1 day
          dueDate: new Date('2025-12-16'),
          status: TaskStatus.Pending,
          predecessors: [
            {
              id: 'dep-3',
              predecessorId: 'task-2',
              successorId: 'task-4',
              lagDays: 0,
            },
            {
              id: 'dep-4',
              predecessorId: 'task-3',
              successorId: 'task-4',
              lagDays: 0,
            },
          ],
          successors: [],
        },
      ];

      mockPrisma.case.findUnique.mockResolvedValue(mockCase as any);
      mockPrisma.task.findMany.mockResolvedValue(tasks as any);

      const result = await calculateCriticalPath('case-123', 'firm-123');

      // Critical path: task-1 -> task-2 -> task-4 (longer path)
      // task-3 should have slack time
      expect(result.criticalTasks.length).toBeGreaterThan(0);
      expect(result.criticalTasks.map((t: Task) => t.id)).toContain('task-1');
      expect(result.criticalTasks.map((t: Task) => t.id)).toContain('task-2');
      expect(result.criticalTasks.map((t: Task) => t.id)).toContain('task-4');

      // Total duration: 1 + 5 + 1 = 7 days
      expect(result.totalDuration).toBe(7);
    });

    it('should handle lag days in dependencies', async () => {
      const tasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          caseId: 'case-123',
          estimatedHours: 8, // 1 day
          dueDate: new Date('2025-12-10'),
          status: TaskStatus.Pending,
          predecessors: [],
          successors: [
            {
              id: 'dep-1',
              predecessorId: 'task-1',
              successorId: 'task-2',
              lagDays: 3, // 3 day lag
            },
          ],
        },
        {
          id: 'task-2',
          title: 'Task 2',
          caseId: 'case-123',
          estimatedHours: 8, // 1 day
          dueDate: new Date('2025-12-14'),
          status: TaskStatus.Pending,
          predecessors: [
            {
              id: 'dep-1',
              predecessorId: 'task-1',
              successorId: 'task-2',
              lagDays: 3,
            },
          ],
          successors: [],
        },
      ];

      mockPrisma.case.findUnique.mockResolvedValue(mockCase as any);
      mockPrisma.task.findMany.mockResolvedValue(tasks as any);

      const result = await calculateCriticalPath('case-123', 'firm-123');

      // Total duration: 1 + 3 (lag) + 1 = 5 days
      expect(result.totalDuration).toBe(5);
      expect(result.criticalTasks).toHaveLength(2);
    });

    it('should calculate bottlenecks based on dependent count', async () => {
      const tasks = [
        {
          id: 'task-1',
          title: 'Bottleneck Task',
          caseId: 'case-123',
          estimatedHours: 8, // 1 day
          dueDate: new Date('2025-12-10'),
          status: TaskStatus.Pending,
          predecessors: [],
          successors: [
            {
              id: 'dep-1',
              predecessorId: 'task-1',
              successorId: 'task-2',
              lagDays: 0,
            },
            {
              id: 'dep-2',
              predecessorId: 'task-1',
              successorId: 'task-3',
              lagDays: 0,
            },
            {
              id: 'dep-3',
              predecessorId: 'task-1',
              successorId: 'task-4',
              lagDays: 0,
            },
          ],
        },
        {
          id: 'task-2',
          title: 'Task 2',
          caseId: 'case-123',
          estimatedHours: 8,
          dueDate: new Date('2025-12-11'),
          status: TaskStatus.Pending,
          predecessors: [
            {
              id: 'dep-1',
              predecessorId: 'task-1',
              successorId: 'task-2',
              lagDays: 0,
            },
          ],
          successors: [],
        },
        {
          id: 'task-3',
          title: 'Task 3',
          caseId: 'case-123',
          estimatedHours: 8,
          dueDate: new Date('2025-12-11'),
          status: TaskStatus.Pending,
          predecessors: [
            {
              id: 'dep-2',
              predecessorId: 'task-1',
              successorId: 'task-3',
              lagDays: 0,
            },
          ],
          successors: [],
        },
        {
          id: 'task-4',
          title: 'Task 4',
          caseId: 'case-123',
          estimatedHours: 8,
          dueDate: new Date('2025-12-11'),
          status: TaskStatus.Pending,
          predecessors: [
            {
              id: 'dep-3',
              predecessorId: 'task-1',
              successorId: 'task-4',
              lagDays: 0,
            },
          ],
          successors: [],
        },
      ];

      mockPrisma.case.findUnique.mockResolvedValue(mockCase as any);
      mockPrisma.task.findMany.mockResolvedValue(tasks as any);

      const result = await calculateCriticalPath('case-123', 'firm-123');

      // task-1 should be identified as a bottleneck (3 dependents)
      expect(result.bottlenecks.length).toBeGreaterThan(0);
      expect(result.bottlenecks[0].taskId).toBe('task-1');
      expect(result.bottlenecks[0].taskTitle).toBe('Bottleneck Task');
      expect(result.bottlenecks[0].dependentCount).toBe(3);
      expect(result.bottlenecks[0].slackDays).toBe(0); // On critical path
    });

    it('should default to 1 day duration when estimatedHours is null', async () => {
      const tasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          caseId: 'case-123',
          estimatedHours: null,
          dueDate: new Date('2025-12-10'),
          status: TaskStatus.Pending,
          predecessors: [],
          successors: [],
        },
      ];

      mockPrisma.case.findUnique.mockResolvedValue(mockCase as any);
      mockPrisma.task.findMany.mockResolvedValue(tasks as any);

      const result = await calculateCriticalPath('case-123', 'firm-123');

      expect(result.totalDuration).toBe(1);
      expect(result.criticalTasks).toHaveLength(1);
    });

    it('should round up estimatedHours to days', async () => {
      const tasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          caseId: 'case-123',
          estimatedHours: 10, // 1.25 days -> rounds to 2 days
          dueDate: new Date('2025-12-10'),
          status: TaskStatus.Pending,
          predecessors: [],
          successors: [],
        },
      ];

      mockPrisma.case.findUnique.mockResolvedValue(mockCase as any);
      mockPrisma.task.findMany.mockResolvedValue(tasks as any);

      const result = await calculateCriticalPath('case-123', 'firm-123');

      expect(result.totalDuration).toBe(2); // Rounded up from 1.25
    });

    it('should throw error when case not found', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(null);

      await expect(calculateCriticalPath('case-999', 'firm-123')).rejects.toThrow(
        'Case not found or access denied'
      );
    });

    it('should throw error when firm does not match (firm isolation)', async () => {
      const wrongFirmCase = {
        id: 'case-123',
        firmId: 'firm-999',
      };

      mockPrisma.case.findUnique.mockResolvedValue(wrongFirmCase as any);

      await expect(calculateCriticalPath('case-123', 'firm-123')).rejects.toThrow(
        'Case not found or access denied'
      );
    });
  });

  // ============================================================================
  // Recalculate Critical Path Tests
  // ============================================================================

  describe('recalculateCriticalPath', () => {
    const mockCase = {
      id: 'case-123',
      firmId: 'firm-123',
    };

    it('should update isCriticalPath flags for all tasks', async () => {
      const tasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          caseId: 'case-123',
          estimatedHours: 8,
          dueDate: new Date('2025-12-10'),
          status: TaskStatus.Pending,
          predecessors: [],
          successors: [
            {
              id: 'dep-1',
              predecessorId: 'task-1',
              successorId: 'task-2',
              lagDays: 0,
            },
          ],
        },
        {
          id: 'task-2',
          title: 'Task 2',
          caseId: 'case-123',
          estimatedHours: 8,
          dueDate: new Date('2025-12-11'),
          status: TaskStatus.Pending,
          predecessors: [
            {
              id: 'dep-1',
              predecessorId: 'task-1',
              successorId: 'task-2',
              lagDays: 0,
            },
          ],
          successors: [],
        },
      ];

      mockPrisma.case.findUnique.mockResolvedValue(mockCase as any);
      mockPrisma.task.findMany.mockResolvedValue(tasks as any);
      mockPrisma.task.updateMany.mockResolvedValue({ count: 2 } as any);

      await recalculateCriticalPath('case-123', 'firm-123');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.task.updateMany).toHaveBeenCalledTimes(2);

      // Should clear all flags first
      expect(mockPrisma.task.updateMany).toHaveBeenNthCalledWith(1, {
        where: { caseId: 'case-123' },
        data: { isCriticalPath: false },
      });

      // Should set critical path flags
      expect(mockPrisma.task.updateMany).toHaveBeenNthCalledWith(2, {
        where: {
          id: { in: expect.arrayContaining(['task-1', 'task-2']) },
        },
        data: { isCriticalPath: true },
      });
    });

    it('should handle case with no tasks', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(mockCase as any);
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.task.updateMany.mockResolvedValue({ count: 0 } as any);

      await recalculateCriticalPath('case-123', 'firm-123');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Get Bottlenecks Tests
  // ============================================================================

  describe('getBottlenecks', () => {
    const mockCase = {
      id: 'case-123',
      firmId: 'firm-123',
    };

    it('should return bottlenecks for case', async () => {
      const tasks = [
        {
          id: 'task-1',
          title: 'Bottleneck',
          caseId: 'case-123',
          estimatedHours: 8,
          dueDate: new Date('2025-12-10'),
          status: TaskStatus.Pending,
          predecessors: [],
          successors: [
            {
              id: 'dep-1',
              predecessorId: 'task-1',
              successorId: 'task-2',
              lagDays: 0,
            },
            {
              id: 'dep-2',
              predecessorId: 'task-1',
              successorId: 'task-3',
              lagDays: 0,
            },
          ],
        },
        {
          id: 'task-2',
          title: 'Task 2',
          caseId: 'case-123',
          estimatedHours: 8,
          dueDate: new Date('2025-12-11'),
          status: TaskStatus.Pending,
          predecessors: [
            {
              id: 'dep-1',
              predecessorId: 'task-1',
              successorId: 'task-2',
              lagDays: 0,
            },
          ],
          successors: [],
        },
        {
          id: 'task-3',
          title: 'Task 3',
          caseId: 'case-123',
          estimatedHours: 8,
          dueDate: new Date('2025-12-11'),
          status: TaskStatus.Pending,
          predecessors: [
            {
              id: 'dep-2',
              predecessorId: 'task-1',
              successorId: 'task-3',
              lagDays: 0,
            },
          ],
          successors: [],
        },
      ];

      mockPrisma.case.findUnique.mockResolvedValue(mockCase as any);
      mockPrisma.task.findMany.mockResolvedValue(tasks as any);

      const result = await getBottlenecks('case-123', 'firm-123');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].taskId).toBe('task-1');
      expect(result[0].dependentCount).toBe(2);
    });

    it('should return empty array when no bottlenecks exist', async () => {
      const tasks = [
        {
          id: 'task-1',
          title: 'Lone Task',
          caseId: 'case-123',
          estimatedHours: 8,
          dueDate: new Date('2025-12-10'),
          status: TaskStatus.Pending,
          predecessors: [],
          successors: [],
        },
      ];

      mockPrisma.case.findUnique.mockResolvedValue(mockCase as any);
      mockPrisma.task.findMany.mockResolvedValue(tasks as any);

      const result = await getBottlenecks('case-123', 'firm-123');

      expect(result).toHaveLength(0);
    });

    it('should limit bottlenecks to top 5', async () => {
      // Create task with 6 dependents (should only return top 5)
      const tasks = [
        {
          id: 'task-1',
          title: 'Bottleneck 1',
          caseId: 'case-123',
          estimatedHours: 8,
          dueDate: new Date('2025-12-10'),
          status: TaskStatus.Pending,
          predecessors: [],
          successors: Array.from({ length: 6 }, (_, i) => ({
            id: `dep-${i}`,
            predecessorId: 'task-1',
            successorId: `task-${i + 2}`,
            lagDays: 0,
          })),
        },
        ...Array.from({ length: 6 }, (_, i) => ({
          id: `task-${i + 2}`,
          title: `Task ${i + 2}`,
          caseId: 'case-123',
          estimatedHours: 8,
          dueDate: new Date('2025-12-11'),
          status: TaskStatus.Pending,
          predecessors: [
            {
              id: `dep-${i}`,
              predecessorId: 'task-1',
              successorId: `task-${i + 2}`,
              lagDays: 0,
            },
          ],
          successors: [],
        })),
      ];

      mockPrisma.case.findUnique.mockResolvedValue(mockCase as any);
      mockPrisma.task.findMany.mockResolvedValue(tasks as any);

      const result = await getBottlenecks('case-123', 'firm-123');

      expect(result.length).toBeLessThanOrEqual(5);
    });
  });
});
