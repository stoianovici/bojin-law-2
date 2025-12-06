/**
 * Deadline Cascade Service Unit Tests
 * Story 4.4: Task Dependencies and Automation - Task 33
 *
 * Tests for deadline cascade calculation, conflict detection, and cascade application
 */

import { PrismaClient } from '@legal-platform/database';
import { analyzeDeadlineChange, applyDeadlineCascade } from './deadline-cascade.service';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  PrismaClient: jest.fn(),
}));

describe('DeadlineCascadeService', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      task: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      taskDependency: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    } as any;

    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Analyze Deadline Change Tests
  // ============================================================================

  describe('analyzeDeadlineChange', () => {
    const mockTask = {
      id: 'task-1',
      firmId: 'firm-123',
      caseId: 'case-123',
      title: 'File Motion',
      dueDate: new Date('2025-12-10'),
      successors: [],
    };

    it('should calculate affected tasks for FinishToStart dependencies', async () => {
      const successor = {
        id: 'task-2',
        title: 'Hearing',
        dueDate: new Date('2025-12-15'),
        assignedTo: 'user-1',
        status: 'Pending',
        assignee: { id: 'user-1', name: 'John' },
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask as any);
      mockPrisma.taskDependency.findMany
        .mockResolvedValueOnce([
          {
            id: 'dep-1',
            predecessorId: 'task-1',
            successorId: 'task-2',
            dependencyType: 'FinishToStart',
            lagDays: 2,
            successor,
          },
        ] as any)
        .mockResolvedValueOnce([]); // No further successors

      const newDueDate = new Date('2025-12-12');
      const result = await analyzeDeadlineChange('task-1', newDueDate, 'firm-123');

      expect(result.affectedTasks).toHaveLength(1);
      expect(result.affectedTasks[0].taskId).toBe('task-2');
      expect(result.affectedTasks[0].taskTitle).toBe('Hearing');
      // New date should be 2025-12-12 + 2 lag days = 2025-12-14
      expect(result.affectedTasks[0].daysDelta).toBe(-1); // Moving 1 day earlier
    });

    it('should detect PastDeadline conflict', async () => {
      const pastDate = new Date('2020-01-01');
      const successor = {
        id: 'task-2',
        title: 'Hearing',
        dueDate: new Date('2025-12-15'),
        assignedTo: 'user-1',
        status: 'Pending',
        assignee: { id: 'user-1', name: 'John' },
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask as any);
      mockPrisma.taskDependency.findMany
        .mockResolvedValueOnce([
          {
            id: 'dep-1',
            predecessorId: 'task-1',
            successorId: 'task-2',
            dependencyType: 'FinishToStart',
            lagDays: 0,
            successor,
          },
        ] as any)
        .mockResolvedValueOnce([]);

      const result = await analyzeDeadlineChange('task-1', pastDate, 'firm-123');

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].conflictType).toBe('PastDeadline');
      expect(result.conflicts[0].severity).toBe('Error');
      expect(result.suggestedResolution).toContain('critical conflict');
    });

    it('should detect OverlapConflict when assignee has multiple tasks same day', async () => {
      const successor = {
        id: 'task-2',
        title: 'Hearing',
        dueDate: new Date('2025-12-15'),
        assignedTo: 'user-1',
        status: 'Pending',
        assignee: { id: 'user-1', name: 'John' },
      };

      const overlappingTask = {
        id: 'task-3',
        title: 'Other Task',
        dueDate: new Date('2025-12-12'),
        assignedTo: 'user-1',
        status: 'Pending',
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask as any);
      mockPrisma.taskDependency.findMany
        .mockResolvedValueOnce([
          {
            id: 'dep-1',
            predecessorId: 'task-1',
            successorId: 'task-2',
            dependencyType: 'FinishToStart',
            lagDays: 0,
            successor,
          },
        ] as any)
        .mockResolvedValueOnce([]);
      mockPrisma.task.findMany.mockResolvedValue([overlappingTask] as any);

      const newDueDate = new Date('2025-12-12');
      const result = await analyzeDeadlineChange('task-1', newDueDate, 'firm-123');

      expect(result.conflicts.some((c: DeadlineConflict) => c.conflictType === 'OverlapConflict')).toBe(true);
      const overlapConflict = result.conflicts.find((c: DeadlineConflict) => c.conflictType === 'OverlapConflict');
      expect(overlapConflict?.severity).toBe('Warning');
      expect(overlapConflict?.message).toContain('other task');
    });

    it('should handle FinishToFinish dependency type', async () => {
      const successor = {
        id: 'task-2',
        title: 'Parallel Task',
        dueDate: new Date('2025-12-15'),
        assignedTo: 'user-1',
        status: 'Pending',
        assignee: { id: 'user-1', name: 'John' },
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask as any);
      mockPrisma.taskDependency.findMany
        .mockResolvedValueOnce([
          {
            id: 'dep-1',
            predecessorId: 'task-1',
            successorId: 'task-2',
            dependencyType: 'FinishToFinish',
            lagDays: 0,
            successor,
          },
        ] as any)
        .mockResolvedValueOnce([]);

      const newDueDate = new Date('2025-12-20');
      const result = await analyzeDeadlineChange('task-1', newDueDate, 'firm-123');

      expect(result.affectedTasks).toHaveLength(1);
      // FinishToFinish: successor should finish on same date as predecessor
      expect(result.affectedTasks[0].newDueDate.getTime()).toBe(newDueDate.getTime());
    });

    it('should skip StartToStart and StartToFinish dependency types', async () => {
      const successor1 = {
        id: 'task-2',
        title: 'Start Together',
        dueDate: new Date('2025-12-15'),
        assignedTo: 'user-1',
        status: 'Pending',
        assignee: { id: 'user-1', name: 'John' },
      };

      const successor2 = {
        id: 'task-3',
        title: 'Start to Finish',
        dueDate: new Date('2025-12-16'),
        assignedTo: 'user-2',
        status: 'Pending',
        assignee: { id: 'user-2', name: 'Jane' },
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask as any);
      mockPrisma.taskDependency.findMany.mockResolvedValueOnce([
        {
          id: 'dep-1',
          predecessorId: 'task-1',
          successorId: 'task-2',
          dependencyType: 'StartToStart',
          lagDays: 0,
          successor: successor1,
        },
        {
          id: 'dep-2',
          predecessorId: 'task-1',
          successorId: 'task-3',
          dependencyType: 'StartToFinish',
          lagDays: 0,
          successor: successor2,
        },
      ] as any);

      const newDueDate = new Date('2025-12-20');
      const result = await analyzeDeadlineChange('task-1', newDueDate, 'firm-123');

      // Should not affect tasks with StartToStart or StartToFinish
      expect(result.affectedTasks).toHaveLength(0);
    });

    it('should recursively cascade through multiple levels', async () => {
      const successor1 = {
        id: 'task-2',
        title: 'Level 1',
        dueDate: new Date('2025-12-15'),
        assignedTo: 'user-1',
        status: 'Pending',
        assignee: { id: 'user-1', name: 'John' },
      };

      const successor2 = {
        id: 'task-3',
        title: 'Level 2',
        dueDate: new Date('2025-12-18'),
        assignedTo: 'user-2',
        status: 'Pending',
        assignee: { id: 'user-2', name: 'Jane' },
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask as any);
      mockPrisma.taskDependency.findMany
        .mockResolvedValueOnce([
          {
            id: 'dep-1',
            predecessorId: 'task-1',
            successorId: 'task-2',
            dependencyType: 'FinishToStart',
            lagDays: 1,
            successor: successor1,
          },
        ] as any)
        .mockResolvedValueOnce([
          {
            id: 'dep-2',
            predecessorId: 'task-2',
            successorId: 'task-3',
            dependencyType: 'FinishToStart',
            lagDays: 1,
            successor: successor2,
          },
        ] as any)
        .mockResolvedValueOnce([]);

      const newDueDate = new Date('2025-12-12');
      const result = await analyzeDeadlineChange('task-1', newDueDate, 'firm-123');

      expect(result.affectedTasks).toHaveLength(2);
      expect(result.affectedTasks.map((t: AffectedTask) => t.taskId)).toContain('task-2');
      expect(result.affectedTasks.map((t: AffectedTask) => t.taskId)).toContain('task-3');
    });

    it('should provide warning resolution when only warnings exist', async () => {
      const successor = {
        id: 'task-2',
        title: 'Hearing',
        dueDate: new Date('2025-12-15'),
        assignedTo: 'user-1',
        status: 'Pending',
        assignee: { id: 'user-1', name: 'John' },
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask as any);
      mockPrisma.taskDependency.findMany
        .mockResolvedValueOnce([
          {
            id: 'dep-1',
            predecessorId: 'task-1',
            successorId: 'task-2',
            dependencyType: 'FinishToStart',
            lagDays: 0,
            successor,
          },
        ] as any)
        .mockResolvedValueOnce([]);
      mockPrisma.task.findMany.mockResolvedValue([
        { id: 'task-3', title: 'Overlap' },
      ] as any);

      const newDueDate = new Date('2025-12-12');
      const result = await analyzeDeadlineChange('task-1', newDueDate, 'firm-123');

      expect(result.conflicts.every((c: DeadlineConflict) => c.severity === 'Warning')).toBe(true);
      expect(result.suggestedResolution).toContain('warning');
      expect(result.suggestedResolution).not.toContain('critical');
    });

    it('should throw error when task not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect(
        analyzeDeadlineChange('task-999', new Date(), 'firm-123')
      ).rejects.toThrow('Task not found or access denied');
    });

    it('should throw error when firm does not match', async () => {
      const wrongFirmTask = {
        ...mockTask,
        firmId: 'firm-999',
      };

      mockPrisma.task.findUnique.mockResolvedValue(wrongFirmTask as any);

      await expect(
        analyzeDeadlineChange('task-1', new Date(), 'firm-123')
      ).rejects.toThrow('Task not found or access denied');
    });
  });

  // ============================================================================
  // Apply Deadline Cascade Tests
  // ============================================================================

  describe('applyDeadlineCascade', () => {
    const mockTask = {
      id: 'task-1',
      firmId: 'firm-123',
      caseId: 'case-123',
      title: 'File Motion',
      dueDate: new Date('2025-12-10'),
      successors: [],
    };

    it('should apply cascade when no conflicts exist', async () => {
      const successor = {
        id: 'task-2',
        title: 'Hearing',
        dueDate: new Date('2025-12-15'),
        assignedTo: 'user-1',
        status: 'Pending',
        assignee: { id: 'user-1', name: 'John' },
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask as any);
      mockPrisma.taskDependency.findMany
        .mockResolvedValueOnce([
          {
            id: 'dep-1',
            predecessorId: 'task-1',
            successorId: 'task-2',
            dependencyType: 'FinishToStart',
            lagDays: 2,
            successor,
          },
        ] as any)
        .mockResolvedValueOnce([]);
      mockPrisma.task.findMany.mockResolvedValue([]);

      const updatedOriginal = { ...mockTask, dueDate: new Date('2025-12-12') };
      const updatedSuccessor = { ...successor, dueDate: new Date('2025-12-14') };

      mockPrisma.task.update
        .mockResolvedValueOnce(updatedOriginal as any)
        .mockResolvedValueOnce(updatedSuccessor as any);

      const newDueDate = new Date('2025-12-12');
      const result = await applyDeadlineCascade('task-1', newDueDate, false, 'firm-123');

      expect(result).toHaveLength(2);
      expect(mockPrisma.task.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.task.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'task-1' },
        data: { dueDate: newDueDate },
      });
    });

    it('should throw error when critical conflicts exist and not confirmed', async () => {
      const pastDate = new Date('2020-01-01');
      const successor = {
        id: 'task-2',
        title: 'Hearing',
        dueDate: new Date('2025-12-15'),
        assignedTo: 'user-1',
        status: 'Pending',
        assignee: { id: 'user-1', name: 'John' },
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask as any);
      mockPrisma.taskDependency.findMany
        .mockResolvedValueOnce([
          {
            id: 'dep-1',
            predecessorId: 'task-1',
            successorId: 'task-2',
            dependencyType: 'FinishToStart',
            lagDays: 0,
            successor,
          },
        ] as any)
        .mockResolvedValueOnce([]);

      await expect(
        applyDeadlineCascade('task-1', pastDate, false, 'firm-123')
      ).rejects.toThrow('Critical conflicts detected');
    });

    it('should apply cascade when critical conflicts exist but confirmed', async () => {
      const pastDate = new Date('2020-01-01');
      const successor = {
        id: 'task-2',
        title: 'Hearing',
        dueDate: new Date('2025-12-15'),
        assignedTo: 'user-1',
        status: 'Pending',
        assignee: { id: 'user-1', name: 'John' },
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask as any);
      mockPrisma.taskDependency.findMany
        .mockResolvedValueOnce([
          {
            id: 'dep-1',
            predecessorId: 'task-1',
            successorId: 'task-2',
            dependencyType: 'FinishToStart',
            lagDays: 0,
            successor,
          },
        ] as any)
        .mockResolvedValueOnce([]);
      mockPrisma.task.findMany.mockResolvedValue([]);

      const updatedOriginal = { ...mockTask, dueDate: pastDate };
      const updatedSuccessor = { ...successor, dueDate: pastDate };

      mockPrisma.task.update
        .mockResolvedValueOnce(updatedOriginal as any)
        .mockResolvedValueOnce(updatedSuccessor as any);

      const result = await applyDeadlineCascade('task-1', pastDate, true, 'firm-123');

      expect(result).toHaveLength(2);
      expect(mockPrisma.task.update).toHaveBeenCalled();
    });

    it('should apply cascade with warnings without confirmation required', async () => {
      const successor = {
        id: 'task-2',
        title: 'Hearing',
        dueDate: new Date('2025-12-15'),
        assignedTo: 'user-1',
        status: 'Pending',
        assignee: { id: 'user-1', name: 'John' },
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask as any);
      mockPrisma.taskDependency.findMany
        .mockResolvedValueOnce([
          {
            id: 'dep-1',
            predecessorId: 'task-1',
            successorId: 'task-2',
            dependencyType: 'FinishToStart',
            lagDays: 0,
            successor,
          },
        ] as any)
        .mockResolvedValueOnce([]);
      mockPrisma.task.findMany.mockResolvedValue([
        { id: 'task-3', title: 'Overlap' },
      ] as any);

      const updatedOriginal = { ...mockTask, dueDate: new Date('2025-12-12') };
      const updatedSuccessor = { ...successor, dueDate: new Date('2025-12-12') };

      mockPrisma.task.update
        .mockResolvedValueOnce(updatedOriginal as any)
        .mockResolvedValueOnce(updatedSuccessor as any);

      const newDueDate = new Date('2025-12-12');
      const result = await applyDeadlineCascade('task-1', newDueDate, false, 'firm-123');

      // Should succeed with warnings (no confirmation required)
      expect(result).toHaveLength(2);
    });

    it('should update all affected tasks in transaction', async () => {
      const successor1 = {
        id: 'task-2',
        title: 'Level 1',
        dueDate: new Date('2025-12-15'),
        assignedTo: 'user-1',
        status: 'Pending',
        assignee: { id: 'user-1', name: 'John' },
      };

      const successor2 = {
        id: 'task-3',
        title: 'Level 2',
        dueDate: new Date('2025-12-18'),
        assignedTo: 'user-2',
        status: 'Pending',
        assignee: { id: 'user-2', name: 'Jane' },
      };

      mockPrisma.task.findUnique.mockResolvedValue(mockTask as any);
      mockPrisma.taskDependency.findMany
        .mockResolvedValueOnce([
          {
            id: 'dep-1',
            predecessorId: 'task-1',
            successorId: 'task-2',
            dependencyType: 'FinishToStart',
            lagDays: 1,
            successor: successor1,
          },
        ] as any)
        .mockResolvedValueOnce([
          {
            id: 'dep-2',
            predecessorId: 'task-2',
            successorId: 'task-3',
            dependencyType: 'FinishToStart',
            lagDays: 1,
            successor: successor2,
          },
        ] as any)
        .mockResolvedValueOnce([]);
      mockPrisma.task.findMany.mockResolvedValue([]);

      mockPrisma.task.update
        .mockResolvedValueOnce({ ...mockTask } as any)
        .mockResolvedValueOnce({ ...successor1 } as any)
        .mockResolvedValueOnce({ ...successor2 } as any);

      const newDueDate = new Date('2025-12-12');
      const result = await applyDeadlineCascade('task-1', newDueDate, false, 'firm-123');

      expect(result).toHaveLength(3); // Original + 2 successors
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.task.update).toHaveBeenCalledTimes(3);
    });
  });
});
