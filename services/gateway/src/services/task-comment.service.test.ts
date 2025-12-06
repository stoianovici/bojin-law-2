/**
 * Task Comment Service Unit Tests
 * Story 4.6: Task Collaboration and Updates - Task 33
 *
 * Tests for CRUD operations, @mention parsing, threaded replies, and notifications
 */

import { PrismaClient, NotificationType } from '@legal-platform/database';
import { taskCommentService, TaskCommentService } from './task-comment.service';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  prisma: {
    task: {
      findFirst: jest.fn(),
    },
    taskComment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  },
  NotificationType: {
    TaskComment: 'TaskComment',
    Mention: 'Mention',
  },
}));

// Mock related services
jest.mock('./task-history.service', () => ({
  taskHistoryService: {
    recordHistory: jest.fn(),
  },
}));

jest.mock('./case-activity.service', () => ({
  caseActivityService: {
    recordActivity: jest.fn(),
  },
}));

const { prisma } = jest.requireMock('@legal-platform/database');

describe('TaskCommentService', () => {
  const mockTask = {
    id: 'task-123',
    firmId: 'firm-123',
    caseId: 'case-123',
    title: 'Test Task',
    assignedTo: 'user-456',
    case: { id: 'case-123', title: 'Test Case' },
    assignee: { id: 'user-456', firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
  };

  const mockUser = {
    id: 'user-789',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@test.com',
    firmId: 'firm-123',
  };

  const mockComment = {
    id: 'comment-123',
    taskId: 'task-123',
    authorId: 'user-789',
    content: 'Test comment',
    parentId: null,
    mentions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    editedAt: null,
    author: mockUser,
    replies: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Create Comment Tests
  // ============================================================================

  describe('createComment', () => {
    it('should create a new comment successfully', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.taskComment.create.mockResolvedValue(mockComment);
      prisma.notification.create.mockResolvedValue({});

      const result = await taskCommentService.createComment(
        { taskId: 'task-123', content: 'Test comment' },
        'user-789',
        'firm-123'
      );

      expect(result).toEqual(mockComment);
      expect(prisma.task.findFirst).toHaveBeenCalledWith({
        where: { id: 'task-123', firmId: 'firm-123' },
        include: { case: true, assignee: true },
      });
      expect(prisma.taskComment.create).toHaveBeenCalled();
    });

    it('should throw error if task not found', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        taskCommentService.createComment(
          { taskId: 'task-123', content: 'Test comment' },
          'user-789',
          'firm-123'
        )
      ).rejects.toThrow('Task not found or access denied');
    });

    it('should throw error if parent comment not found', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.taskComment.findFirst.mockResolvedValue(null);

      await expect(
        taskCommentService.createComment(
          { taskId: 'task-123', content: 'Reply', parentId: 'nonexistent' },
          'user-789',
          'firm-123'
        )
      ).rejects.toThrow('Parent comment not found');
    });

    it('should parse @mentions from content', async () => {
      const mentionedUser = {
        id: 'mentioned-user',
        firstName: 'mentioned',
        lastName: 'user',
      };

      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.user.findMany.mockResolvedValue([mentionedUser]);
      prisma.taskComment.create.mockResolvedValue({
        ...mockComment,
        content: 'Hello @mentioned.user',
        mentions: ['mentioned-user'],
      });
      prisma.notification.create.mockResolvedValue({});

      const result = await taskCommentService.createComment(
        { taskId: 'task-123', content: 'Hello @mentioned.user' },
        'user-789',
        'firm-123'
      );

      expect(prisma.user.findMany).toHaveBeenCalled();
    });

    it('should create notification for task assignee', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.taskComment.create.mockResolvedValue(mockComment);
      prisma.notification.create.mockResolvedValue({});

      await taskCommentService.createComment(
        { taskId: 'task-123', content: 'Test comment' },
        'user-789',
        'firm-123'
      );

      // Should notify assignee (user-456) since commenter is different (user-789)
      expect(prisma.notification.create).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Get Comments Tests
  // ============================================================================

  describe('getComments', () => {
    it('should retrieve all comments for a task', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.taskComment.findMany.mockResolvedValue([mockComment]);

      const result = await taskCommentService.getComments('task-123', 'firm-123');

      expect(result).toEqual([mockComment]);
      expect(prisma.taskComment.findMany).toHaveBeenCalledWith({
        where: { taskId: 'task-123', parentId: null },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should throw error if task not found', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        taskCommentService.getComments('task-123', 'firm-123')
      ).rejects.toThrow('Task not found or access denied');
    });
  });

  // ============================================================================
  // Update Comment Tests
  // ============================================================================

  describe('updateComment', () => {
    it('should update comment content', async () => {
      const existingComment = { ...mockComment, authorId: 'user-789' };
      prisma.taskComment.findFirst.mockResolvedValue(existingComment);
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.taskComment.update.mockResolvedValue({
        ...existingComment,
        content: 'Updated content',
        editedAt: new Date(),
      });

      const result = await taskCommentService.updateComment(
        'comment-123',
        { content: 'Updated content' },
        'user-789',
        'firm-123'
      );

      expect(result.content).toBe('Updated content');
      expect(result.editedAt).toBeDefined();
    });

    it('should throw error if comment not found', async () => {
      prisma.taskComment.findFirst.mockResolvedValue(null);

      await expect(
        taskCommentService.updateComment(
          'nonexistent',
          { content: 'Updated' },
          'user-789',
          'firm-123'
        )
      ).rejects.toThrow('Comment not found');
    });

    it('should throw error if user is not the author', async () => {
      prisma.taskComment.findFirst.mockResolvedValue({ ...mockComment, authorId: 'other-user' });
      prisma.task.findFirst.mockResolvedValue(mockTask);

      await expect(
        taskCommentService.updateComment(
          'comment-123',
          { content: 'Updated' },
          'user-789',
          'firm-123'
        )
      ).rejects.toThrow('Not authorized to edit this comment');
    });
  });

  // ============================================================================
  // Delete Comment Tests
  // ============================================================================

  describe('deleteComment', () => {
    it('should delete comment successfully', async () => {
      const existingComment = { ...mockComment, authorId: 'user-789' };
      prisma.taskComment.findFirst
        .mockResolvedValueOnce(existingComment) // First call for the comment
        .mockResolvedValueOnce(existingComment); // Second call for task lookup
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.taskComment.delete.mockResolvedValue(existingComment);

      await taskCommentService.deleteComment('comment-123', 'user-789', 'firm-123');

      expect(prisma.taskComment.delete).toHaveBeenCalledWith({
        where: { id: 'comment-123' },
      });
    });

    it('should throw error if user is not the author', async () => {
      prisma.taskComment.findFirst.mockResolvedValue({ ...mockComment, authorId: 'other-user' });
      prisma.task.findFirst.mockResolvedValue(mockTask);

      await expect(
        taskCommentService.deleteComment('comment-123', 'user-789', 'firm-123')
      ).rejects.toThrow('Not authorized to delete this comment');
    });
  });

  // ============================================================================
  // Threaded Replies Tests
  // ============================================================================

  describe('threaded replies', () => {
    it('should create a reply to an existing comment', async () => {
      const parentComment = { ...mockComment, id: 'parent-123' };
      const replyComment = {
        ...mockComment,
        id: 'reply-123',
        parentId: 'parent-123',
        content: 'This is a reply',
      };

      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.taskComment.findFirst.mockResolvedValue(parentComment);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.taskComment.create.mockResolvedValue(replyComment);
      prisma.notification.create.mockResolvedValue({});

      const result = await taskCommentService.createComment(
        { taskId: 'task-123', content: 'This is a reply', parentId: 'parent-123' },
        'user-789',
        'firm-123'
      );

      expect(result.parentId).toBe('parent-123');
    });
  });
});
