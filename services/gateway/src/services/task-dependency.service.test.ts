/**
 * Task Dependency Service Unit Tests
 * Story 4.4: Task Dependencies and Automation - Task 33
 *
 * Tests for task dependency management, circular dependency detection, and blocked task queries
 */

import { PrismaClient, TaskStatus } from '@legal-platform/database';
import {
  addDependency,
  removeDependency,
  getDependencies,
  validateNoCycle,
  getBlockedTasks,
  getUnblockedTasks,
  isTaskBlocked,
  getTasksUnblockedBy,
} from './task-dependency.service';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  PrismaClient: jest.fn(),
  TaskStatus: {
    Pending: 'Pending',
    InProgress: 'InProgress',
    Completed: 'Completed',
    OnHold: 'OnHold',
  },
}));

describe('TaskDependencyService', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      task: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      taskDependency: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      case: {
        findUnique: jest.fn(),
      },
    } as any;

    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Add Dependency Tests
  // ============================================================================

  describe('addDependency', () => {
    const mockPredecessor = {
      id: 'task-1',
      firmId: 'firm-123',
      caseId: 'case-123',
      title: 'File Motion',
      status: TaskStatus.InProgress,
      case: { id: 'case-123' },
    };

    const mockSuccessor = {
      id: 'task-2',
      firmId: 'firm-123',
      caseId: 'case-123',
      title: 'Hearing',
      status: TaskStatus.Pending,
      case: { id: 'case-123' },
    };

    it('should create dependency between tasks', async () => {
      mockPrisma.task.findUnique
        .mockResolvedValueOnce(mockPredecessor as any)
        .mockResolvedValueOnce(mockSuccessor as any);
      mockPrisma.taskDependency.findMany.mockResolvedValue([]);
      mockPrisma.taskDependency.create.mockResolvedValue({
        id: 'dep-123',
        predecessorId: 'task-1',
        successorId: 'task-2',
        dependencyType: 'FinishToStart',
        lagDays: 0,
        predecessor: mockPredecessor,
        successor: mockSuccessor,
      } as any);
      mockPrisma.task.update.mockResolvedValue(mockSuccessor as any);

      const result = await addDependency('task-1', 'task-2', 'FinishToStart', 0, 'firm-123');

      expect(mockPrisma.taskDependency.create).toHaveBeenCalledWith({
        data: {
          predecessorId: 'task-1',
          successorId: 'task-2',
          dependencyType: 'FinishToStart',
          lagDays: 0,
        },
        include: {
          predecessor: true,
          successor: true,
        },
      });
      expect(result.predecessorId).toBe('task-1');
      expect(result.successorId).toBe('task-2');
    });

    it('should update successor blocked status when predecessor is not completed', async () => {
      mockPrisma.task.findUnique
        .mockResolvedValueOnce(mockPredecessor as any)
        .mockResolvedValueOnce(mockSuccessor as any);
      mockPrisma.taskDependency.findMany.mockResolvedValue([]);
      mockPrisma.taskDependency.create.mockResolvedValue({
        id: 'dep-123',
        predecessorId: 'task-1',
        successorId: 'task-2',
        predecessor: mockPredecessor,
        successor: mockSuccessor,
      } as any);
      mockPrisma.task.update.mockResolvedValue(mockSuccessor as any);

      await addDependency('task-1', 'task-2', 'FinishToStart', 0, 'firm-123');

      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-2' },
        data: {
          blockedReason: 'Waiting for "File Motion" to be completed',
        },
      });
    });

    it('should not update blocked status when predecessor is completed', async () => {
      const completedPredecessor = {
        ...mockPredecessor,
        status: TaskStatus.Completed,
      };

      mockPrisma.task.findUnique
        .mockResolvedValueOnce(completedPredecessor as any)
        .mockResolvedValueOnce(mockSuccessor as any);
      mockPrisma.taskDependency.findMany.mockResolvedValue([]);
      mockPrisma.taskDependency.create.mockResolvedValue({
        id: 'dep-123',
        predecessor: completedPredecessor,
        successor: mockSuccessor,
      } as any);

      await addDependency('task-1', 'task-2', 'FinishToStart', 0, 'firm-123');

      expect(mockPrisma.task.update).not.toHaveBeenCalled();
    });

    it('should throw error when task not found', async () => {
      mockPrisma.task.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockSuccessor as any);

      await expect(
        addDependency('task-999', 'task-2', 'FinishToStart', 0, 'firm-123')
      ).rejects.toThrow('One or both tasks not found');
    });

    it('should throw error when firm does not match (firm isolation)', async () => {
      const wrongFirmTask = { ...mockPredecessor, firmId: 'firm-999' };

      mockPrisma.task.findUnique
        .mockResolvedValueOnce(wrongFirmTask as any)
        .mockResolvedValueOnce(mockSuccessor as any);

      await expect(
        addDependency('task-1', 'task-2', 'FinishToStart', 0, 'firm-123')
      ).rejects.toThrow('Access denied');
    });

    it('should throw error when tasks belong to different cases', async () => {
      const differentCaseTask = {
        ...mockSuccessor,
        caseId: 'case-456',
        case: { id: 'case-456' },
      };

      mockPrisma.task.findUnique
        .mockResolvedValueOnce(mockPredecessor as any)
        .mockResolvedValueOnce(differentCaseTask as any);

      await expect(
        addDependency('task-1', 'task-2', 'FinishToStart', 0, 'firm-123')
      ).rejects.toThrow('Cannot create dependency between tasks in different cases');
    });

    it('should throw error when trying to create self-dependency', async () => {
      mockPrisma.task.findUnique
        .mockResolvedValueOnce(mockPredecessor as any)
        .mockResolvedValueOnce(mockPredecessor as any);

      await expect(
        addDependency('task-1', 'task-1', 'FinishToStart', 0, 'firm-123')
      ).rejects.toThrow('Cannot create dependency to self');
    });

    it('should throw error when adding dependency would create cycle', async () => {
      // Existing dependency: task-1 -> task-2
      mockPrisma.task.findUnique
        .mockResolvedValueOnce(mockSuccessor as any) // task-2 as predecessor
        .mockResolvedValueOnce(mockPredecessor as any); // task-1 as successor
      mockPrisma.taskDependency.findMany.mockResolvedValue([
        {
          id: 'dep-existing',
          predecessorId: 'task-1',
          successorId: 'task-2',
          dependencyType: 'FinishToStart',
        },
      ] as any);

      // Trying to add: task-2 -> task-1 (creates cycle)
      await expect(
        addDependency('task-2', 'task-1', 'FinishToStart', 0, 'firm-123')
      ).rejects.toThrow('Adding this dependency would create a circular dependency');
    });
  });

  // ============================================================================
  // Remove Dependency Tests
  // ============================================================================

  describe('removeDependency', () => {
    it('should remove dependency and clear blocked status when no other predecessors', async () => {
      const mockDependency = {
        id: 'dep-123',
        predecessorId: 'task-1',
        successorId: 'task-2',
        predecessor: {
          id: 'task-1',
          firmId: 'firm-123',
          title: 'File Motion',
        },
        successor: {
          id: 'task-2',
          title: 'Hearing',
        },
      };

      mockPrisma.taskDependency.findUnique.mockResolvedValue(mockDependency as any);
      mockPrisma.taskDependency.delete.mockResolvedValue(mockDependency as any);
      mockPrisma.taskDependency.findMany.mockResolvedValue([]);
      mockPrisma.task.update.mockResolvedValue({} as any);

      await removeDependency('dep-123', 'firm-123');

      expect(mockPrisma.taskDependency.delete).toHaveBeenCalledWith({
        where: { id: 'dep-123' },
      });
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-2' },
        data: {
          blockedReason: null,
        },
      });
    });

    it('should not clear blocked status when other incomplete predecessors remain', async () => {
      const mockDependency = {
        id: 'dep-123',
        predecessorId: 'task-1',
        successorId: 'task-2',
        predecessor: {
          id: 'task-1',
          firmId: 'firm-123',
        },
        successor: {
          id: 'task-2',
        },
      };

      const otherDependency = {
        id: 'dep-456',
        predecessorId: 'task-3',
        successorId: 'task-2',
        predecessor: {
          id: 'task-3',
          status: TaskStatus.InProgress,
        },
      };

      mockPrisma.taskDependency.findUnique.mockResolvedValue(mockDependency as any);
      mockPrisma.taskDependency.delete.mockResolvedValue(mockDependency as any);
      mockPrisma.taskDependency.findMany.mockResolvedValue([otherDependency] as any);

      await removeDependency('dep-123', 'firm-123');

      expect(mockPrisma.task.update).not.toHaveBeenCalled();
    });

    it('should throw error when dependency not found', async () => {
      mockPrisma.taskDependency.findUnique.mockResolvedValue(null);

      await expect(removeDependency('dep-999', 'firm-123')).rejects.toThrow(
        'Dependency not found'
      );
    });

    it('should throw error when firm does not match', async () => {
      const mockDependency = {
        id: 'dep-123',
        predecessor: {
          firmId: 'firm-999',
        },
        successor: {},
      };

      mockPrisma.taskDependency.findUnique.mockResolvedValue(mockDependency as any);

      await expect(removeDependency('dep-123', 'firm-123')).rejects.toThrow('Access denied');
    });
  });

  // ============================================================================
  // Get Dependencies Tests
  // ============================================================================

  describe('getDependencies', () => {
    it('should return predecessors and successors for task', async () => {
      const mockTask = {
        id: 'task-2',
        firmId: 'firm-123',
      };

      const mockPredecessors = [
        {
          id: 'dep-1',
          predecessorId: 'task-1',
          successorId: 'task-2',
          predecessor: {
            id: 'task-1',
            title: 'File Motion',
            assignee: { id: 'user-1', name: 'John' },
          },
        },
      ];

      const mockSuccessors = [
        {
          id: 'dep-2',
          predecessorId: 'task-2',
          successorId: 'task-3',
          successor: {
            id: 'task-3',
            title: 'Follow Up',
            assignee: { id: 'user-2', name: 'Jane' },
          },
        },
      ];

      mockPrisma.task.findUnique.mockResolvedValue(mockTask as any);
      mockPrisma.taskDependency.findMany
        .mockResolvedValueOnce(mockPredecessors as any)
        .mockResolvedValueOnce(mockSuccessors as any);

      const result = await getDependencies('task-2', 'firm-123');

      expect(result.predecessors).toHaveLength(1);
      expect(result.successors).toHaveLength(1);
      expect(result.predecessors[0].predecessor.title).toBe('File Motion');
      expect(result.successors[0].successor.title).toBe('Follow Up');
    });

    it('should throw error when task not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect(getDependencies('task-999', 'firm-123')).rejects.toThrow(
        'Task not found or access denied'
      );
    });

    it('should throw error when firm does not match', async () => {
      const mockTask = {
        id: 'task-2',
        firmId: 'firm-999',
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask as any);

      await expect(getDependencies('task-2', 'firm-123')).rejects.toThrow(
        'Task not found or access denied'
      );
    });
  });

  // ============================================================================
  // Cycle Detection Tests
  // ============================================================================

  describe('validateNoCycle', () => {
    it('should return true when no cycle exists', async () => {
      // Simple chain: task-1 -> task-2 -> task-3
      mockPrisma.taskDependency.findMany.mockResolvedValue([
        {
          id: 'dep-1',
          predecessorId: 'task-1',
          successorId: 'task-2',
        },
        {
          id: 'dep-2',
          predecessorId: 'task-2',
          successorId: 'task-3',
        },
      ] as any);

      // Adding: task-3 -> task-4 (no cycle)
      const result = await validateNoCycle('task-3', 'task-4');

      expect(result).toBe(true);
    });

    it('should return false when cycle would be created', async () => {
      // Existing: task-1 -> task-2 -> task-3
      mockPrisma.taskDependency.findMany.mockResolvedValue([
        {
          id: 'dep-1',
          predecessorId: 'task-1',
          successorId: 'task-2',
        },
        {
          id: 'dep-2',
          predecessorId: 'task-2',
          successorId: 'task-3',
        },
      ] as any);

      // Adding: task-3 -> task-1 (creates cycle)
      const result = await validateNoCycle('task-3', 'task-1');

      expect(result).toBe(false);
    });

    it('should return false when direct cycle would be created', async () => {
      // Existing: task-1 -> task-2
      mockPrisma.taskDependency.findMany.mockResolvedValue([
        {
          id: 'dep-1',
          predecessorId: 'task-1',
          successorId: 'task-2',
        },
      ] as any);

      // Adding: task-2 -> task-1 (creates direct cycle)
      const result = await validateNoCycle('task-2', 'task-1');

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Blocked Tasks Tests
  // ============================================================================

  describe('getBlockedTasks', () => {
    it('should return tasks with incomplete predecessors', async () => {
      const mockCase = {
        id: 'case-123',
        firmId: 'firm-123',
      };

      const mockTasks = [
        {
          id: 'task-2',
          title: 'Hearing',
          status: TaskStatus.Pending,
          predecessors: [
            {
              predecessor: {
                id: 'task-1',
                status: TaskStatus.InProgress,
              },
            },
          ],
          assignee: { id: 'user-1' },
        },
        {
          id: 'task-3',
          title: 'Follow Up',
          status: TaskStatus.Pending,
          predecessors: [],
          assignee: { id: 'user-1' },
        },
      ];

      mockPrisma.case.findUnique.mockResolvedValue(mockCase as any);
      mockPrisma.task.findMany.mockResolvedValue(mockTasks as any);

      const result = await getBlockedTasks('case-123', 'firm-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-2');
    });

    it('should throw error when case not found', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(null);

      await expect(getBlockedTasks('case-999', 'firm-123')).rejects.toThrow(
        'Case not found or access denied'
      );
    });
  });

  describe('getUnblockedTasks', () => {
    it('should return pending tasks with all predecessors completed', async () => {
      const mockCase = {
        id: 'case-123',
        firmId: 'firm-123',
      };

      const mockTasks = [
        {
          id: 'task-2',
          title: 'Ready Task',
          status: TaskStatus.Pending,
          predecessors: [
            {
              predecessor: {
                id: 'task-1',
                status: TaskStatus.Completed,
              },
            },
          ],
          assignee: { id: 'user-1' },
        },
        {
          id: 'task-3',
          title: 'Blocked Task',
          status: TaskStatus.Pending,
          predecessors: [
            {
              predecessor: {
                id: 'task-4',
                status: TaskStatus.InProgress,
              },
            },
          ],
          assignee: { id: 'user-1' },
        },
        {
          id: 'task-5',
          title: 'No Dependencies',
          status: TaskStatus.Pending,
          predecessors: [],
          assignee: { id: 'user-1' },
        },
      ];

      mockPrisma.case.findUnique.mockResolvedValue(mockCase as any);
      mockPrisma.task.findMany.mockResolvedValue(mockTasks as any);

      const result = await getUnblockedTasks('case-123', 'firm-123');

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toContain('task-2');
      expect(result.map((t) => t.id)).toContain('task-5');
    });
  });

  describe('isTaskBlocked', () => {
    it('should return true when task has incomplete predecessors', async () => {
      const mockTask = {
        id: 'task-2',
        firmId: 'firm-123',
        predecessors: [
          {
            predecessor: {
              status: TaskStatus.InProgress,
            },
          },
        ],
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask as any);

      const result = await isTaskBlocked('task-2', 'firm-123');

      expect(result).toBe(true);
    });

    it('should return false when all predecessors are completed', async () => {
      const mockTask = {
        id: 'task-2',
        firmId: 'firm-123',
        predecessors: [
          {
            predecessor: {
              status: TaskStatus.Completed,
            },
          },
        ],
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask as any);

      const result = await isTaskBlocked('task-2', 'firm-123');

      expect(result).toBe(false);
    });
  });

  describe('getTasksUnblockedBy', () => {
    it('should return tasks that would be unblocked by completing this task', async () => {
      const mockTask = {
        id: 'task-1',
        firmId: 'firm-123',
      };

      const mockDependencies = [
        {
          predecessorId: 'task-1',
          successor: {
            id: 'task-2',
            predecessors: [
              {
                predecessorId: 'task-1',
                predecessor: {
                  id: 'task-1',
                  status: TaskStatus.InProgress,
                },
              },
            ],
          },
        },
        {
          predecessorId: 'task-1',
          successor: {
            id: 'task-3',
            predecessors: [
              {
                predecessorId: 'task-1',
                predecessor: {
                  id: 'task-1',
                  status: TaskStatus.InProgress,
                },
              },
              {
                predecessorId: 'task-4',
                predecessor: {
                  id: 'task-4',
                  status: TaskStatus.InProgress,
                },
              },
            ],
          },
        },
      ];

      mockPrisma.task.findUnique.mockResolvedValue(mockTask as any);
      mockPrisma.taskDependency.findMany.mockResolvedValue(mockDependencies as any);

      const result = await getTasksUnblockedBy('task-1', 'firm-123');

      // Only task-2 should be unblocked (task-3 still blocked by task-4)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-2');
    });
  });
});
