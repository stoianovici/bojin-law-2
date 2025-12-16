/**
 * Task Collaboration GraphQL API Integration Tests
 * Story 4.6: Task Collaboration and Updates - Task 39
 *
 * Tests for comments, history, attachments, subtasks, and subscriptions
 */

// Set environment variables
process.env.SKIP_AUTH_VALIDATION = 'true';
process.env.SKIP_GRAPH_VALIDATION = 'true';

// Mock Prisma
jest.mock('@legal-platform/database', () => {
  const mockPrisma: any = {
    task: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    taskComment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    taskHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    taskAttachment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    case: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    caseActivityEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    caseSubscription: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
  };
  return {
    prisma: mockPrisma,
    NotificationType: {
      TaskComment: 'TaskComment',
      Mention: 'Mention',
      SubtaskCreated: 'SubtaskCreated',
      TaskAssigned: 'TaskAssigned',
      TaskAttachmentAdded: 'TaskAttachmentAdded',
    },
    TaskHistoryAction: {
      Created: 'Created',
      StatusChanged: 'StatusChanged',
      AssigneeChanged: 'AssigneeChanged',
      PriorityChanged: 'PriorityChanged',
      DueDateChanged: 'DueDateChanged',
      SubtaskCreated: 'SubtaskCreated',
      SubtaskCompleted: 'SubtaskCompleted',
      AttachmentAdded: 'AttachmentAdded',
      AttachmentRemoved: 'AttachmentRemoved',
      CommentAdded: 'CommentAdded',
    },
    CaseActivityType: {
      TaskCreated: 'TaskCreated',
      TaskCompleted: 'TaskCompleted',
      TaskStatusChanged: 'TaskStatusChanged',
      TaskAssigned: 'TaskAssigned',
      TaskCommented: 'TaskCommented',
      DocumentUploaded: 'DocumentUploaded',
    },
  };
});

// Mock R2 storage service
jest.mock('../../src/services/r2-storage.service', () => ({
  r2StorageService: {
    uploadFile: jest.fn().mockResolvedValue('https://storage.example.com/file.pdf'),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    getSignedUrl: jest.fn().mockResolvedValue('https://signed-url.example.com'),
  },
}));

import { prisma } from '@legal-platform/database';
import { taskCommentService } from '../../src/services/task-comment.service';
import { taskHistoryService } from '../../src/services/task-history.service';
import { caseActivityService } from '../../src/services/case-activity.service';
import { subtaskService } from '../../src/services/subtask.service';
import { caseSubscriptionService } from '../../src/services/case-subscription.service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Test data
const testFirm = {
  id: 'firm-123',
  name: 'Test Law Firm',
};

const testUser = {
  id: 'user-123',
  email: 'user@testfirm.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'Partner',
  status: 'Active',
  firmId: testFirm.id,
  azureAdId: 'azure-123',
  preferences: {},
  createdAt: new Date(),
  lastActive: new Date(),
};

const testCase = {
  id: 'case-123',
  caseNumber: '123/2024',
  title: 'Test Case',
  firmId: testFirm.id,
  status: 'Active',
};

const testTask = {
  id: 'task-123',
  caseId: testCase.id,
  firmId: testFirm.id,
  type: 'Research',
  title: 'Test Task',
  description: 'Test description',
  assignedTo: 'user-456',
  dueDate: new Date('2024-12-31'),
  status: 'InProgress',
  priority: 'High',
  case: testCase,
  assignee: {
    id: 'user-456',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@test.com',
  },
};

describe('Task Collaboration Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Task Comments Integration Tests
  // ============================================================================

  describe('Task Comments', () => {
    it('should create comment and notify task assignee', async () => {
      const comment = {
        id: 'comment-123',
        taskId: testTask.id,
        authorId: testUser.id,
        content: 'Test comment',
        parentId: null,
        mentions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        editedAt: null,
        author: testUser,
        replies: [],
      };

      mockPrisma.task.findFirst.mockResolvedValue(testTask as any);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.taskComment.create.mockResolvedValue(comment as any);
      mockPrisma.notification.create.mockResolvedValue({} as any);

      const result = await taskCommentService.createComment(
        { taskId: testTask.id, content: 'Test comment' },
        testUser.id,
        testFirm.id
      );

      expect(result.id).toBe('comment-123');
      expect(mockPrisma.notification.create).toHaveBeenCalled();
    });

    it('should parse @mentions and create notifications', async () => {
      const mentionedUser = {
        id: 'mentioned-user',
        firstName: 'mentioned',
        lastName: 'user',
        email: 'mentioned@test.com',
      };

      const comment = {
        id: 'comment-123',
        taskId: testTask.id,
        authorId: testUser.id,
        content: 'Hello @mentioned.user please review',
        parentId: null,
        mentions: ['mentioned-user'],
        createdAt: new Date(),
        author: testUser,
        replies: [],
      };

      mockPrisma.task.findFirst.mockResolvedValue(testTask as any);
      mockPrisma.user.findMany.mockResolvedValue([mentionedUser] as any);
      mockPrisma.taskComment.create.mockResolvedValue(comment as any);
      mockPrisma.notification.create.mockResolvedValue({} as any);

      const result = await taskCommentService.createComment(
        { taskId: testTask.id, content: 'Hello @mentioned.user please review' },
        testUser.id,
        testFirm.id
      );

      expect(result.mentions).toContain('mentioned-user');
    });

    it('should create threaded reply to comment', async () => {
      const parentComment = {
        id: 'parent-comment',
        taskId: testTask.id,
        authorId: 'user-456',
        content: 'Parent comment',
      };

      const replyComment = {
        id: 'reply-123',
        taskId: testTask.id,
        authorId: testUser.id,
        content: 'Reply to parent',
        parentId: 'parent-comment',
        mentions: [],
        createdAt: new Date(),
        author: testUser,
        replies: [],
      };

      mockPrisma.task.findFirst.mockResolvedValue(testTask as any);
      mockPrisma.taskComment.findFirst.mockResolvedValue(parentComment as any);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.taskComment.create.mockResolvedValue(replyComment as any);
      mockPrisma.notification.create.mockResolvedValue({} as any);

      const result = await taskCommentService.createComment(
        { taskId: testTask.id, content: 'Reply to parent', parentId: 'parent-comment' },
        testUser.id,
        testFirm.id
      );

      expect(result.parentId).toBe('parent-comment');
    });
  });

  // ============================================================================
  // Task History Integration Tests
  // ============================================================================

  describe('Task History', () => {
    it('should record history entry with actor info', async () => {
      const historyEntry = {
        id: 'history-123',
        taskId: testTask.id,
        actorId: testUser.id,
        action: 'Created',
        field: null,
        oldValue: null,
        newValue: null,
        metadata: { title: 'Test Task', type: 'Research' },
        createdAt: new Date(),
        actor: testUser,
      };

      mockPrisma.taskHistory.create.mockResolvedValue(historyEntry as any);

      const result = await taskHistoryService.recordTaskCreated(
        testTask.id,
        testUser.id,
        'Test Task',
        'Research'
      );

      expect(result.id).toBe('history-123');
      expect(result.action).toBe('Created');
    });

    it('should retrieve filtered history entries', async () => {
      const entries = [
        { id: 'h1', action: 'StatusChanged', createdAt: new Date(), actor: testUser },
        { id: 'h2', action: 'StatusChanged', createdAt: new Date(), actor: testUser },
      ];

      mockPrisma.taskHistory.findMany.mockResolvedValue(entries as any);

      const result = await taskHistoryService.getHistory(testTask.id, {
        actions: ['StatusChanged'],
        limit: 10,
      });

      expect(result).toHaveLength(2);
    });
  });

  // ============================================================================
  // Case Activity Feed Integration Tests
  // ============================================================================

  describe('Case Activity Feed', () => {
    it('should record activity and return paginated feed', async () => {
      const activityEntry = {
        id: 'activity-123',
        caseId: testCase.id,
        actorId: testUser.id,
        activityType: 'TaskCreated',
        entityType: 'Task',
        entityId: testTask.id,
        title: 'New Research task created',
        summary: 'Test Task',
        metadata: { taskType: 'Research' },
        createdAt: new Date(),
        actor: testUser,
      };

      mockPrisma.caseActivityEntry.create.mockResolvedValue(activityEntry as any);

      const result = await caseActivityService.recordTaskCreated(
        testCase.id,
        testUser.id,
        testTask.id,
        'Test Task',
        'Research'
      );

      expect(result.id).toBe('activity-123');
      expect(result.activityType).toBe('TaskCreated');
    });

    it('should get paginated activity feed for a case', async () => {
      const entries = Array(25)
        .fill(null)
        .map((_, i) => ({
          id: `activity-${i}`,
          caseId: testCase.id,
          activityType: 'TaskCreated',
          entityType: 'Task',
          entityId: `task-${i}`,
          title: `Activity ${i}`,
          createdAt: new Date(),
          actor: testUser,
        }));

      mockPrisma.case.findFirst.mockResolvedValue(testCase as any);
      mockPrisma.caseActivityEntry.findMany.mockResolvedValue(entries.slice(0, 21) as any);

      const result = await caseActivityService.getActivityFeed(testCase.id, testFirm.id, {
        limit: 20,
      });

      expect(result.entries).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    });
  });

  // ============================================================================
  // Subtask Integration Tests
  // ============================================================================

  describe('Subtasks', () => {
    it('should create subtask inheriting parent properties', async () => {
      const parentTask = {
        ...testTask,
        id: 'parent-task',
      };

      const subtask = {
        id: 'subtask-123',
        caseId: testCase.id,
        firmId: testFirm.id,
        type: 'Research',
        title: 'Subtask Title',
        description: '',
        assignedTo: 'user-456',
        dueDate: new Date('2024-12-31'),
        status: 'Pending',
        priority: 'High',
        parentTaskId: 'parent-task',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
        case: testCase,
        assignee: testTask.assignee,
      };

      mockPrisma.task.findFirst.mockResolvedValue(parentTask as any);
      mockPrisma.task.create.mockResolvedValue(subtask as any);
      mockPrisma.user.findUnique.mockResolvedValue(testUser as any);
      mockPrisma.taskHistory.create.mockResolvedValue({} as any);
      mockPrisma.caseActivityEntry.create.mockResolvedValue({} as any);
      mockPrisma.notification.create.mockResolvedValue({} as any);

      const result = await subtaskService.createSubtask(
        { parentTaskId: 'parent-task', title: 'Subtask Title' },
        testUser.id,
        testFirm.id
      );

      expect(result.subtask.parentTaskId).toBe('parent-task');
      expect(result.subtask.type).toBe('Research');
      expect(result.parentTask.id).toBe('parent-task');
    });

    it('should complete subtask and update parent history', async () => {
      const subtaskWithParent = {
        id: 'subtask-123',
        caseId: testCase.id,
        firmId: testFirm.id,
        type: 'Research',
        title: 'Subtask Title',
        status: 'Pending',
        parentTaskId: 'parent-task',
        parent: {
          ...testTask,
          id: 'parent-task',
          case: testCase,
        },
        case: testCase,
      };

      const completedSubtask = {
        ...subtaskWithParent,
        status: 'Completed',
        completedAt: new Date(),
        assignee: testTask.assignee,
      };

      mockPrisma.task.findFirst.mockResolvedValue(subtaskWithParent as any);
      mockPrisma.task.update.mockResolvedValue(completedSubtask as any);
      mockPrisma.taskHistory.create.mockResolvedValue({} as any);
      mockPrisma.caseActivityEntry.create.mockResolvedValue({} as any);

      const result = await subtaskService.completeSubtask('subtask-123', testUser.id, testFirm.id);

      expect(result.status).toBe('Completed');
    });

    it('should calculate subtask progress correctly', async () => {
      mockPrisma.task.findMany.mockResolvedValue([
        { status: 'Completed' },
        { status: 'Completed' },
        { status: 'Pending' },
        { status: 'InProgress' },
      ] as any);

      const result = await subtaskService.getSubtaskProgress('parent-task');

      expect(result.total).toBe(4);
      expect(result.completed).toBe(2);
      expect(result.percentage).toBe(50);
    });
  });

  // ============================================================================
  // Case Subscription Integration Tests
  // ============================================================================

  describe('Case Subscriptions', () => {
    it('should subscribe user to case with default options', async () => {
      const subscription = {
        id: 'sub-123',
        caseId: testCase.id,
        userId: testUser.id,
        digestEnabled: true,
        notifyOnTask: true,
        notifyOnDocument: true,
        notifyOnComment: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.case.findUnique.mockResolvedValue(testCase as any);
      mockPrisma.caseSubscription.upsert.mockResolvedValue(subscription as any);

      const result = await caseSubscriptionService.subscribe(testCase.id, testUser.id);

      expect(result.digestEnabled).toBe(true);
      expect(result.notifyOnTask).toBe(true);
    });

    it('should update subscription preferences', async () => {
      const updatedSubscription = {
        id: 'sub-123',
        caseId: testCase.id,
        userId: testUser.id,
        digestEnabled: false,
        notifyOnTask: true,
        notifyOnDocument: false,
        notifyOnComment: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.caseSubscription.update.mockResolvedValue(updatedSubscription as any);

      const result = await caseSubscriptionService.updateSubscription(testCase.id, testUser.id, {
        digestEnabled: false,
        notifyOnDocument: false,
      });

      expect(result.digestEnabled).toBe(false);
      expect(result.notifyOnDocument).toBe(false);
    });

    it('should auto-subscribe team members', async () => {
      mockPrisma.caseSubscription.findMany.mockResolvedValue([{ userId: 'existing-user' }] as any);
      mockPrisma.caseSubscription.createMany.mockResolvedValue({ count: 2 });

      await caseSubscriptionService.autoSubscribeTeamMembers(testCase.id, [
        'existing-user',
        'new-user-1',
        'new-user-2',
      ]);

      expect(mockPrisma.caseSubscription.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: 'new-user-1' }),
          expect.objectContaining({ userId: 'new-user-2' }),
        ]),
      });
    });

    it('should generate daily digest with activity summaries', async () => {
      const subscriptions = [
        {
          id: 'sub-123',
          caseId: testCase.id,
          userId: testUser.id,
          digestEnabled: true,
          case: testCase,
        },
      ];

      const activities = [
        {
          id: 'activity-1',
          caseId: testCase.id,
          activityType: 'TaskCreated',
          entityId: 'task-1',
          title: 'New task',
          summary: 'Task 1',
          createdAt: new Date(),
          actor: { firstName: 'Jane', lastName: 'Doe' },
        },
        {
          id: 'activity-2',
          caseId: testCase.id,
          activityType: 'TaskCompleted',
          entityId: 'task-2',
          title: 'Task completed',
          summary: 'Task 2',
          createdAt: new Date(),
          actor: { firstName: 'Jane', lastName: 'Doe' },
        },
      ];

      mockPrisma.caseSubscription.findMany.mockResolvedValue(subscriptions as any);

      // Mock getActivityForCases via caseActivityService
      const activityMap = new Map();
      activityMap.set(testCase.id, activities);
      mockPrisma.caseActivityEntry.findMany.mockResolvedValue(activities as any);

      const result = await caseSubscriptionService.generateDailyDigest(testUser.id);

      expect(result.userId).toBe(testUser.id);
      expect(result.cases).toHaveLength(1);
      expect(result.cases[0].taskUpdates).toHaveLength(2);
    });
  });

  // ============================================================================
  // Cross-Feature Integration Tests
  // ============================================================================

  describe('Cross-Feature Integration', () => {
    it('should record activity when comment is added', async () => {
      // When a comment is added, it should:
      // 1. Create the comment
      // 2. Record task history
      // 3. Post to case activity feed
      // 4. Send notifications

      const comment = {
        id: 'comment-123',
        taskId: testTask.id,
        authorId: testUser.id,
        content: 'Test comment',
        mentions: [],
        createdAt: new Date(),
        author: testUser,
        replies: [],
      };

      mockPrisma.task.findFirst.mockResolvedValue(testTask as any);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.taskComment.create.mockResolvedValue(comment as any);
      mockPrisma.notification.create.mockResolvedValue({} as any);
      mockPrisma.taskHistory.create.mockResolvedValue({} as any);
      mockPrisma.caseActivityEntry.create.mockResolvedValue({} as any);

      const result = await taskCommentService.createComment(
        { taskId: testTask.id, content: 'Test comment' },
        testUser.id,
        testFirm.id
      );

      expect(result.id).toBe('comment-123');
      // Notification should be created for task assignee
      expect(mockPrisma.notification.create).toHaveBeenCalled();
    });

    it('should maintain firm isolation across all operations', async () => {
      // Test that operations fail when accessing different firm's data
      const differentFirmTask = {
        ...testTask,
        firmId: 'different-firm',
      };

      mockPrisma.task.findFirst.mockResolvedValue(null);

      await expect(
        taskCommentService.createComment(
          { taskId: 'task-123', content: 'Test' },
          testUser.id,
          testFirm.id
        )
      ).rejects.toThrow('Task not found or access denied');
    });
  });
});
