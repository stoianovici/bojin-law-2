/**
 * Task History Service Unit Tests
 * Story 4.6: Task Collaboration and Updates - Task 34
 *
 * Tests for recording and retrieving task history entries
 */

import { TaskHistoryAction } from '@prisma/client';
import { taskHistoryService } from './task-history.service';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  prisma: {
    taskHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const { prisma } = jest.requireMock('@legal-platform/database');

describe('TaskHistoryService', () => {
  const mockActor = {
    id: 'user-123',
    email: 'user@test.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'Lawyer',
    status: 'Active',
    firmId: 'firm-123',
    azureAdId: 'azure-123',
    preferences: {},
    createdAt: new Date(),
    lastActive: new Date(),
  };

  const mockHistoryEntry = {
    id: 'history-123',
    taskId: 'task-123',
    actorId: 'user-123',
    action: TaskHistoryAction.Created,
    field: null,
    oldValue: null,
    newValue: null,
    metadata: null,
    createdAt: new Date(),
    actor: mockActor,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Record History Tests
  // ============================================================================

  describe('recordHistory', () => {
    it('should create a history entry successfully', async () => {
      prisma.taskHistory.create.mockResolvedValue(mockHistoryEntry);

      const result = await taskHistoryService.recordHistory(
        'task-123',
        'user-123',
        'Created'
      );

      expect(result.id).toBe('history-123');
      expect(result.taskId).toBe('task-123');
      expect(result.action).toBe(TaskHistoryAction.Created);
      expect(prisma.taskHistory.create).toHaveBeenCalledWith({
        data: {
          taskId: 'task-123',
          actorId: 'user-123',
          action: TaskHistoryAction.Created,
          field: undefined,
          oldValue: undefined,
          newValue: undefined,
          metadata: undefined,
        },
        include: { actor: true },
      });
    });

    it('should include field change details', async () => {
      const historyWithDetails = {
        ...mockHistoryEntry,
        action: TaskHistoryAction.StatusChanged,
        field: 'status',
        oldValue: 'Pending',
        newValue: 'InProgress',
      };
      prisma.taskHistory.create.mockResolvedValue(historyWithDetails);

      const result = await taskHistoryService.recordHistory(
        'task-123',
        'user-123',
        'StatusChanged',
        {
          field: 'status',
          oldValue: 'Pending',
          newValue: 'InProgress',
        }
      );

      expect(result.field).toBe('status');
      expect(result.oldValue).toBe('Pending');
      expect(result.newValue).toBe('InProgress');
    });

    it('should include metadata when provided', async () => {
      const historyWithMetadata = {
        ...mockHistoryEntry,
        metadata: { key: 'value' },
      };
      prisma.taskHistory.create.mockResolvedValue(historyWithMetadata);

      const result = await taskHistoryService.recordHistory(
        'task-123',
        'user-123',
        'Created',
        { metadata: { key: 'value' } }
      );

      expect(result.metadata).toEqual({ key: 'value' });
    });
  });

  // ============================================================================
  // Get History Tests
  // ============================================================================

  describe('getHistory', () => {
    it('should retrieve task history ordered by date descending', async () => {
      prisma.taskHistory.findMany.mockResolvedValue([mockHistoryEntry]);

      const result = await taskHistoryService.getHistory('task-123');

      expect(result).toHaveLength(1);
      expect(prisma.taskHistory.findMany).toHaveBeenCalledWith({
        where: { taskId: 'task-123' },
        include: { actor: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('should filter by action types', async () => {
      prisma.taskHistory.findMany.mockResolvedValue([mockHistoryEntry]);

      await taskHistoryService.getHistory('task-123', {
        actions: ['StatusChanged', 'AssigneeChanged'],
      });

      expect(prisma.taskHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            taskId: 'task-123',
            action: {
              in: [TaskHistoryAction.StatusChanged, TaskHistoryAction.AssigneeChanged],
            },
          },
        })
      );
    });

    it('should filter by date range', async () => {
      const since = new Date('2024-01-01');
      const until = new Date('2024-12-31');
      prisma.taskHistory.findMany.mockResolvedValue([]);

      await taskHistoryService.getHistory('task-123', { since, until });

      expect(prisma.taskHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            taskId: 'task-123',
            createdAt: { gte: since, lte: until },
          },
        })
      );
    });

    it('should respect limit option', async () => {
      prisma.taskHistory.findMany.mockResolvedValue([]);

      await taskHistoryService.getHistory('task-123', { limit: 10 });

      expect(prisma.taskHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });
  });

  // ============================================================================
  // Get Recent History Tests
  // ============================================================================

  describe('getRecentHistory', () => {
    it('should call getHistory with specified limit', async () => {
      prisma.taskHistory.findMany.mockResolvedValue([mockHistoryEntry]);

      const result = await taskHistoryService.getRecentHistory('task-123', 5);

      expect(result).toHaveLength(1);
      expect(prisma.taskHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });

    it('should default to 10 items', async () => {
      prisma.taskHistory.findMany.mockResolvedValue([]);

      await taskHistoryService.getRecentHistory('task-123');

      expect(prisma.taskHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });
  });

  // ============================================================================
  // Convenience Methods Tests
  // ============================================================================

  describe('convenience methods', () => {
    describe('recordTaskCreated', () => {
      it('should record task creation with metadata', async () => {
        prisma.taskHistory.create.mockResolvedValue({
          ...mockHistoryEntry,
          action: TaskHistoryAction.Created,
          metadata: { title: 'Test Task', type: 'General' },
        });

        await taskHistoryService.recordTaskCreated(
          'task-123',
          'user-123',
          'Test Task',
          'General'
        );

        expect(prisma.taskHistory.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: TaskHistoryAction.Created,
              metadata: { title: 'Test Task', type: 'General' },
            }),
          })
        );
      });
    });

    describe('recordStatusChange', () => {
      it('should record status change with before/after values', async () => {
        prisma.taskHistory.create.mockResolvedValue({
          ...mockHistoryEntry,
          action: TaskHistoryAction.StatusChanged,
          field: 'status',
          oldValue: 'Pending',
          newValue: 'InProgress',
        });

        await taskHistoryService.recordStatusChange(
          'task-123',
          'user-123',
          'Pending',
          'InProgress'
        );

        expect(prisma.taskHistory.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: TaskHistoryAction.StatusChanged,
              field: 'status',
              oldValue: 'Pending',
              newValue: 'InProgress',
            }),
          })
        );
      });
    });

    describe('recordAssigneeChange', () => {
      it('should record assignee change with names in metadata', async () => {
        prisma.taskHistory.create.mockResolvedValue({
          ...mockHistoryEntry,
          action: TaskHistoryAction.AssigneeChanged,
        });

        await taskHistoryService.recordAssigneeChange(
          'task-123',
          'user-123',
          'old-user',
          'new-user',
          'Old User',
          'New User'
        );

        expect(prisma.taskHistory.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: TaskHistoryAction.AssigneeChanged,
              field: 'assignedTo',
              oldValue: 'old-user',
              newValue: 'new-user',
              metadata: { oldAssigneeName: 'Old User', newAssigneeName: 'New User' },
            }),
          })
        );
      });

      it('should handle null old assignee', async () => {
        prisma.taskHistory.create.mockResolvedValue({
          ...mockHistoryEntry,
          action: TaskHistoryAction.AssigneeChanged,
        });

        await taskHistoryService.recordAssigneeChange(
          'task-123',
          'user-123',
          null,
          'new-user'
        );

        expect(prisma.taskHistory.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              oldValue: undefined,
            }),
          })
        );
      });
    });

    describe('recordPriorityChange', () => {
      it('should record priority change', async () => {
        prisma.taskHistory.create.mockResolvedValue({
          ...mockHistoryEntry,
          action: TaskHistoryAction.PriorityChanged,
        });

        await taskHistoryService.recordPriorityChange(
          'task-123',
          'user-123',
          'Low',
          'High'
        );

        expect(prisma.taskHistory.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: TaskHistoryAction.PriorityChanged,
              field: 'priority',
              oldValue: 'Low',
              newValue: 'High',
            }),
          })
        );
      });
    });

    describe('recordDueDateChange', () => {
      it('should record due date change', async () => {
        const oldDate = new Date('2024-01-01');
        const newDate = new Date('2024-02-01');
        prisma.taskHistory.create.mockResolvedValue({
          ...mockHistoryEntry,
          action: TaskHistoryAction.DueDateChanged,
        });

        await taskHistoryService.recordDueDateChange('task-123', 'user-123', oldDate, newDate);

        expect(prisma.taskHistory.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: TaskHistoryAction.DueDateChanged,
              field: 'dueDate',
              oldValue: oldDate.toISOString(),
              newValue: newDate.toISOString(),
            }),
          })
        );
      });

      it('should handle null old due date', async () => {
        const newDate = new Date('2024-02-01');
        prisma.taskHistory.create.mockResolvedValue({
          ...mockHistoryEntry,
          action: TaskHistoryAction.DueDateChanged,
        });

        await taskHistoryService.recordDueDateChange('task-123', 'user-123', null, newDate);

        expect(prisma.taskHistory.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              oldValue: undefined,
            }),
          })
        );
      });
    });

    describe('recordSubtaskCreated', () => {
      it('should record subtask creation in parent history', async () => {
        prisma.taskHistory.create.mockResolvedValue({
          ...mockHistoryEntry,
          action: TaskHistoryAction.SubtaskCreated,
        });

        await taskHistoryService.recordSubtaskCreated(
          'parent-task',
          'user-123',
          'subtask-123',
          'Subtask Title'
        );

        expect(prisma.taskHistory.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              taskId: 'parent-task',
              action: TaskHistoryAction.SubtaskCreated,
              metadata: { subtaskId: 'subtask-123', subtaskTitle: 'Subtask Title' },
            }),
          })
        );
      });
    });

    describe('recordSubtaskCompleted', () => {
      it('should record subtask completion in parent history', async () => {
        prisma.taskHistory.create.mockResolvedValue({
          ...mockHistoryEntry,
          action: TaskHistoryAction.SubtaskCompleted,
        });

        await taskHistoryService.recordSubtaskCompleted(
          'parent-task',
          'user-123',
          'subtask-123',
          'Subtask Title'
        );

        expect(prisma.taskHistory.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              taskId: 'parent-task',
              action: TaskHistoryAction.SubtaskCompleted,
              metadata: { subtaskId: 'subtask-123', subtaskTitle: 'Subtask Title' },
            }),
          })
        );
      });
    });

    describe('recordDependencyAdded', () => {
      it('should record dependency addition', async () => {
        prisma.taskHistory.create.mockResolvedValue({
          ...mockHistoryEntry,
          action: TaskHistoryAction.DependencyAdded,
        });

        await taskHistoryService.recordDependencyAdded(
          'task-123',
          'user-123',
          'predecessor-123',
          'Predecessor Task'
        );

        expect(prisma.taskHistory.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: TaskHistoryAction.DependencyAdded,
              metadata: { predecessorTaskId: 'predecessor-123', predecessorTitle: 'Predecessor Task' },
            }),
          })
        );
      });
    });

    describe('recordDependencyRemoved', () => {
      it('should record dependency removal', async () => {
        prisma.taskHistory.create.mockResolvedValue({
          ...mockHistoryEntry,
          action: TaskHistoryAction.DependencyRemoved,
        });

        await taskHistoryService.recordDependencyRemoved(
          'task-123',
          'user-123',
          'predecessor-123',
          'Predecessor Task'
        );

        expect(prisma.taskHistory.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: TaskHistoryAction.DependencyRemoved,
              metadata: { predecessorTaskId: 'predecessor-123', predecessorTitle: 'Predecessor Task' },
            }),
          })
        );
      });
    });

    describe('recordDelegated', () => {
      it('should record task delegation', async () => {
        prisma.taskHistory.create.mockResolvedValue({
          ...mockHistoryEntry,
          action: TaskHistoryAction.Delegated,
        });

        await taskHistoryService.recordDelegated(
          'task-123',
          'user-123',
          'delegate-123',
          'Delegate Name'
        );

        expect(prisma.taskHistory.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: TaskHistoryAction.Delegated,
              metadata: { delegateId: 'delegate-123', delegateName: 'Delegate Name' },
            }),
          })
        );
      });
    });
  });
});
