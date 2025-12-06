/**
 * Subtask Service Unit Tests
 * Story 4.6: Task Collaboration and Updates - Task 37
 *
 * Tests for subtask creation, completion, and progress tracking
 */

import { subtaskService } from './subtask.service';

// Mock dependencies
jest.mock('@legal-platform/database', () => ({
  prisma: {
    task: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  },
  NotificationType: {
    SubtaskCreated: 'SubtaskCreated',
    TaskAssigned: 'TaskAssigned',
  },
}));

jest.mock('./task-history.service', () => ({
  taskHistoryService: {
    recordSubtaskCreated: jest.fn(),
    recordTaskCreated: jest.fn(),
    recordStatusChange: jest.fn(),
    recordSubtaskCompleted: jest.fn(),
  },
}));

jest.mock('./case-activity.service', () => ({
  caseActivityService: {
    recordTaskCreated: jest.fn(),
    recordTaskCompleted: jest.fn(),
  },
}));

const { prisma } = jest.requireMock('@legal-platform/database');
const { taskHistoryService } = jest.requireMock('./task-history.service');
const { caseActivityService } = jest.requireMock('./case-activity.service');

describe('SubtaskService', () => {
  const mockParentTask = {
    id: 'parent-123',
    caseId: 'case-123',
    firmId: 'firm-123',
    type: 'Deadline',
    title: 'Parent Task',
    description: 'Parent task description',
    assignedTo: 'user-456',
    dueDate: new Date('2024-06-15'),
    status: 'InProgress',
    priority: 'High',
    case: { id: 'case-123', title: 'Test Case' },
    assignee: { id: 'user-456', firstName: 'John', lastName: 'Doe' },
  };

  const mockCreator = {
    id: 'user-789',
    firstName: 'Jane',
    lastName: 'Smith',
  };

  const mockSubtask = {
    id: 'subtask-123',
    caseId: 'case-123',
    firmId: 'firm-123',
    type: 'Deadline',
    title: 'Subtask Title',
    description: 'Subtask description',
    assignedTo: 'user-456',
    dueDate: new Date('2024-06-10'),
    status: 'Pending',
    priority: 'High',
    parentTaskId: 'parent-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {},
    case: { id: 'case-123', title: 'Test Case' },
    assignee: { id: 'user-456', firstName: 'John', lastName: 'Doe' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Create Subtask Tests
  // ============================================================================

  describe('createSubtask', () => {
    const createInput = {
      parentTaskId: 'parent-123',
      title: 'Subtask Title',
      description: 'Subtask description',
    };

    it('should create a subtask successfully', async () => {
      prisma.task.findFirst.mockResolvedValue(mockParentTask);
      prisma.task.create.mockResolvedValue(mockSubtask);
      prisma.user.findUnique.mockResolvedValue(mockCreator);
      prisma.notification.create.mockResolvedValue({});

      const result = await subtaskService.createSubtask(createInput, 'user-789', 'firm-123');

      expect(result.subtask.id).toBe('subtask-123');
      expect(result.subtask.parentTaskId).toBe('parent-123');
      expect(result.parentTask.id).toBe('parent-123');
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            caseId: 'case-123',
            firmId: 'firm-123',
            type: 'Deadline',
            parentTaskId: 'parent-123',
            status: 'Pending',
          }),
        })
      );
    });

    it('should inherit properties from parent task', async () => {
      prisma.task.findFirst.mockResolvedValue(mockParentTask);
      prisma.task.create.mockResolvedValue(mockSubtask);
      prisma.user.findUnique.mockResolvedValue(mockCreator);

      await subtaskService.createSubtask(createInput, 'user-789', 'firm-123');

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: mockParentTask.type,
            priority: mockParentTask.priority,
            assignedTo: mockParentTask.assignedTo,
            dueDate: mockParentTask.dueDate,
          }),
        })
      );
    });

    it('should use custom values when provided', async () => {
      prisma.task.findFirst.mockResolvedValue(mockParentTask);
      prisma.task.create.mockResolvedValue({
        ...mockSubtask,
        assignedTo: 'custom-user',
        priority: 'Low',
        dueDate: new Date('2024-05-01'),
      });
      prisma.user.findUnique.mockResolvedValue(mockCreator);

      const customInput = {
        ...createInput,
        assignedTo: 'custom-user',
        priority: 'Low' as const,
        dueDate: '2024-05-01',
      };

      await subtaskService.createSubtask(customInput, 'user-789', 'firm-123');

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignedTo: 'custom-user',
            priority: 'Low',
            dueDate: new Date('2024-05-01'),
          }),
        })
      );
    });

    it('should throw error if parent task not found', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        subtaskService.createSubtask(createInput, 'user-789', 'firm-123')
      ).rejects.toThrow('Parent task not found or access denied');
    });

    it('should record history for both parent and subtask', async () => {
      prisma.task.findFirst.mockResolvedValue(mockParentTask);
      prisma.task.create.mockResolvedValue(mockSubtask);
      prisma.user.findUnique.mockResolvedValue(mockCreator);

      await subtaskService.createSubtask(createInput, 'user-789', 'firm-123');

      expect(taskHistoryService.recordSubtaskCreated).toHaveBeenCalledWith(
        'parent-123',
        'user-789',
        'subtask-123',
        'Subtask Title'
      );
      expect(taskHistoryService.recordTaskCreated).toHaveBeenCalledWith(
        'subtask-123',
        'user-789',
        'Subtask Title',
        'Deadline'
      );
    });

    it('should post to case activity feed', async () => {
      prisma.task.findFirst.mockResolvedValue(mockParentTask);
      prisma.task.create.mockResolvedValue(mockSubtask);
      prisma.user.findUnique.mockResolvedValue(mockCreator);

      await subtaskService.createSubtask(createInput, 'user-789', 'firm-123');

      expect(caseActivityService.recordTaskCreated).toHaveBeenCalledWith(
        'case-123',
        'user-789',
        'subtask-123',
        'Subtask Title',
        'Subtask of Parent Task'
      );
    });

    it('should notify parent task assignee when creator is different', async () => {
      prisma.task.findFirst.mockResolvedValue(mockParentTask);
      prisma.task.create.mockResolvedValue(mockSubtask);
      prisma.user.findUnique.mockResolvedValue(mockCreator);
      prisma.notification.create.mockResolvedValue({});

      await subtaskService.createSubtask(createInput, 'user-789', 'firm-123');

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-456',
            type: 'SubtaskCreated',
          }),
        })
      );
    });

    it('should notify subtask assignee when different from creator and parent assignee', async () => {
      const subtaskWithDifferentAssignee = {
        ...mockSubtask,
        assignedTo: 'assignee-123',
      };
      prisma.task.findFirst.mockResolvedValue(mockParentTask);
      prisma.task.create.mockResolvedValue(subtaskWithDifferentAssignee);
      prisma.user.findUnique.mockResolvedValue(mockCreator);
      prisma.notification.create.mockResolvedValue({});

      await subtaskService.createSubtask(
        { ...createInput, assignedTo: 'assignee-123' },
        'user-789',
        'firm-123'
      );

      // Should have 2 notifications: one for parent assignee, one for subtask assignee
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // Get Subtasks Tests
  // ============================================================================

  describe('getSubtasks', () => {
    it('should retrieve all subtasks for a parent task', async () => {
      prisma.task.findFirst.mockResolvedValue(mockParentTask);
      prisma.task.findMany.mockResolvedValue([mockSubtask]);

      const result = await subtaskService.getSubtasks('parent-123', 'firm-123');

      expect(result).toHaveLength(1);
      expect(result[0].parentTaskId).toBe('parent-123');
      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: { parentTaskId: 'parent-123' },
        include: { assignee: true, case: true },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should throw error if parent task not found', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        subtaskService.getSubtasks('parent-123', 'firm-123')
      ).rejects.toThrow('Parent task not found or access denied');
    });
  });

  // ============================================================================
  // Complete Subtask Tests
  // ============================================================================

  describe('completeSubtask', () => {
    const subtaskWithParent = {
      ...mockSubtask,
      parent: {
        ...mockParentTask,
        case: { id: 'case-123', title: 'Test Case' },
      },
    };

    it('should complete a subtask successfully', async () => {
      prisma.task.findFirst.mockResolvedValue(subtaskWithParent);
      prisma.task.update.mockResolvedValue({
        ...mockSubtask,
        status: 'Completed',
        completedAt: new Date(),
      });

      const result = await subtaskService.completeSubtask('subtask-123', 'user-789', 'firm-123');

      expect(result.status).toBe('Completed');
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'subtask-123' },
        data: {
          status: 'Completed',
          completedAt: expect.any(Date),
        },
        include: { assignee: true, case: true },
      });
    });

    it('should throw error if subtask not found', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        subtaskService.completeSubtask('nonexistent', 'user-789', 'firm-123')
      ).rejects.toThrow('Subtask not found or access denied');
    });

    it('should throw error if task is not a subtask', async () => {
      prisma.task.findFirst.mockResolvedValue({
        ...mockSubtask,
        parent: null,
      });

      await expect(
        subtaskService.completeSubtask('task-123', 'user-789', 'firm-123')
      ).rejects.toThrow('Task is not a subtask');
    });

    it('should record history in both subtask and parent', async () => {
      prisma.task.findFirst.mockResolvedValue(subtaskWithParent);
      prisma.task.update.mockResolvedValue({
        ...mockSubtask,
        status: 'Completed',
      });

      await subtaskService.completeSubtask('subtask-123', 'user-789', 'firm-123');

      expect(taskHistoryService.recordStatusChange).toHaveBeenCalledWith(
        'subtask-123',
        'user-789',
        'Pending',
        'Completed'
      );
      expect(taskHistoryService.recordSubtaskCompleted).toHaveBeenCalledWith(
        'parent-123',
        'user-789',
        'subtask-123',
        'Subtask Title'
      );
    });

    it('should post to case activity feed', async () => {
      prisma.task.findFirst.mockResolvedValue(subtaskWithParent);
      prisma.task.update.mockResolvedValue({
        ...mockSubtask,
        status: 'Completed',
      });

      await subtaskService.completeSubtask('subtask-123', 'user-789', 'firm-123');

      expect(caseActivityService.recordTaskCompleted).toHaveBeenCalledWith(
        'case-123',
        'user-789',
        'subtask-123',
        'Subtask Title'
      );
    });
  });

  // ============================================================================
  // Get Subtask Progress Tests
  // ============================================================================

  describe('getSubtaskProgress', () => {
    it('should calculate progress correctly', async () => {
      prisma.task.findMany.mockResolvedValue([
        { status: 'Completed' },
        { status: 'Completed' },
        { status: 'Pending' },
        { status: 'InProgress' },
      ]);

      const result = await subtaskService.getSubtaskProgress('parent-123');

      expect(result.total).toBe(4);
      expect(result.completed).toBe(2);
      expect(result.percentage).toBe(50);
    });

    it('should return zero percentage when no subtasks', async () => {
      prisma.task.findMany.mockResolvedValue([]);

      const result = await subtaskService.getSubtaskProgress('parent-123');

      expect(result.total).toBe(0);
      expect(result.completed).toBe(0);
      expect(result.percentage).toBe(0);
    });

    it('should return 100% when all completed', async () => {
      prisma.task.findMany.mockResolvedValue([
        { status: 'Completed' },
        { status: 'Completed' },
      ]);

      const result = await subtaskService.getSubtaskProgress('parent-123');

      expect(result.percentage).toBe(100);
    });
  });

  // ============================================================================
  // Are All Subtasks Complete Tests
  // ============================================================================

  describe('areAllSubtasksComplete', () => {
    it('should return true when all subtasks are completed', async () => {
      prisma.task.findMany.mockResolvedValue([
        { status: 'Completed' },
        { status: 'Completed' },
      ]);

      const result = await subtaskService.areAllSubtasksComplete('parent-123');

      expect(result).toBe(true);
    });

    it('should return false when some subtasks are incomplete', async () => {
      prisma.task.findMany.mockResolvedValue([
        { status: 'Completed' },
        { status: 'Pending' },
      ]);

      const result = await subtaskService.areAllSubtasksComplete('parent-123');

      expect(result).toBe(false);
    });

    it('should return false when no subtasks exist', async () => {
      prisma.task.findMany.mockResolvedValue([]);

      const result = await subtaskService.areAllSubtasksComplete('parent-123');

      expect(result).toBe(false);
    });
  });
});
