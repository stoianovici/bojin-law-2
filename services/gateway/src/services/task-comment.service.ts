// @ts-nocheck
/**
 * Task Comment Service
 * Story 4.6: Task Collaboration and Updates (AC: 1)
 *
 * Handles CRUD operations for task comments with @mention support and threaded replies
 */

import { prisma } from '@legal-platform/database';
import { NotificationType } from '@prisma/client';
import { taskHistoryService } from './task-history.service';
import { caseActivityService } from './case-activity.service';

// Local types for task comment service
interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  parentId?: string;
  mentions: string[];
  createdAt: Date;
  updatedAt: Date;
  editedAt?: Date;
  author?: any;
  replies?: TaskComment[];
}

interface CreateTaskCommentInput {
  taskId: string;
  content: string;
  parentId?: string;
}

interface UpdateTaskCommentInput {
  content: string;
}

export class TaskCommentService {
  /**
   * Create a new comment on a task
   * @param input - Comment input data
   * @param userId - ID of the user creating the comment
   * @param firmId - Firm ID for validation and mention parsing
   */
  async createComment(
    input: CreateTaskCommentInput,
    userId: string,
    firmId: string
  ): Promise<TaskComment> {
    // Verify task exists and belongs to the firm
    const task = await prisma.task.findFirst({
      where: {
        id: input.taskId,
        firmId,
      },
      include: {
        case: true,
        assignee: true,
      },
    });

    if (!task) {
      throw new Error('Task not found or access denied');
    }

    // If parentId is provided, verify the parent comment exists
    if (input.parentId) {
      const parentComment = await prisma.taskComment.findFirst({
        where: {
          id: input.parentId,
          taskId: input.taskId,
        },
      });

      if (!parentComment) {
        throw new Error('Parent comment not found');
      }
    }

    // Parse @mentions from content
    const mentions = await this.parseMentions(input.content, firmId);

    // Create the comment
    const comment = await prisma.taskComment.create({
      data: {
        taskId: input.taskId,
        authorId: userId,
        content: input.content,
        parentId: input.parentId,
        mentions,
      },
      include: {
        author: true,
        replies: {
          include: {
            author: true,
          },
        },
      },
    });

    // Get author name for notifications
    const author = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const authorName = author ? `${author.firstName} ${author.lastName}` : 'Unknown';

    // Record in task history
    await taskHistoryService.recordHistory(input.taskId, userId, 'CommentAdded', {
      metadata: {
        commentId: comment.id,
        hasReplies: !!input.parentId,
        mentionCount: mentions.length,
      },
    });

    // Post to case activity feed
    await caseActivityService.recordActivity(
      task.caseId,
      userId,
      'TaskCommented',
      'Task',
      task.id,
      `Comment added to task: ${task.title}`,
      input.content.substring(0, 200),
      { commentId: comment.id, taskId: task.id }
    );

    // Send notification to task assignee (if not the comment author)
    if (task.assignedTo !== userId) {
      await this.notifyTaskCommentAdded(task.assignedTo, {
        taskId: task.id,
        taskTitle: task.title,
        caseId: task.caseId,
        caseTitle: task.case.title,
        commentId: comment.id,
        commentContent: input.content.substring(0, 200),
        authorId: userId,
        authorName,
      });
    }

    // Send notifications to mentioned users
    for (const mentionedUserId of mentions) {
      if (mentionedUserId !== userId) {
        await this.notifyTaskCommentMentioned(mentionedUserId, {
          taskId: task.id,
          taskTitle: task.title,
          caseId: task.caseId,
          caseTitle: task.case.title,
          commentId: comment.id,
          commentContent: input.content.substring(0, 200),
          authorId: userId,
          authorName,
        });
      }
    }

    // If this is a reply, notify the original comment author
    if (input.parentId) {
      const parentComment = await prisma.taskComment.findUnique({
        where: { id: input.parentId },
        select: { authorId: true },
      });

      if (parentComment && parentComment.authorId !== userId) {
        await this.notifyTaskCommentReplied(parentComment.authorId, {
          taskId: task.id,
          taskTitle: task.title,
          caseId: task.caseId,
          caseTitle: task.case.title,
          commentId: comment.id,
          commentContent: input.content.substring(0, 200),
          authorId: userId,
          authorName,
        });
      }
    }

    return this.mapToTaskComment(comment);
  }

  /**
   * Update an existing comment
   * @param commentId - ID of the comment to update
   * @param input - Updated content
   * @param userId - ID of the user updating (must be author)
   */
  async updateComment(
    commentId: string,
    input: UpdateTaskCommentInput,
    userId: string
  ): Promise<TaskComment> {
    // Verify comment exists and user is the author
    const existingComment = await prisma.taskComment.findFirst({
      where: {
        id: commentId,
        authorId: userId,
      },
      include: {
        task: true,
      },
    });

    if (!existingComment) {
      throw new Error('Comment not found or you are not authorized to edit it');
    }

    // Get firmId from task
    const firmId = existingComment.task.firmId;

    // Re-parse mentions from new content
    const mentions = await this.parseMentions(input.content, firmId);

    // Update the comment
    const updated = await prisma.taskComment.update({
      where: { id: commentId },
      data: {
        content: input.content,
        mentions,
        editedAt: new Date(),
      },
      include: {
        author: true,
        replies: {
          include: {
            author: true,
          },
        },
      },
    });

    // Record in task history
    await taskHistoryService.recordHistory(existingComment.taskId, userId, 'CommentEdited', {
      metadata: {
        commentId,
        previousContent: existingComment.content.substring(0, 100),
      },
    });

    return this.mapToTaskComment(updated);
  }

  /**
   * Delete a comment
   * @param commentId - ID of the comment to delete
   * @param userId - ID of the user deleting (must be author)
   */
  async deleteComment(commentId: string, userId: string): Promise<void> {
    // Verify comment exists and user is the author
    const comment = await prisma.taskComment.findFirst({
      where: {
        id: commentId,
        authorId: userId,
      },
    });

    if (!comment) {
      throw new Error('Comment not found or you are not authorized to delete it');
    }

    // Delete the comment (cascades to replies via Prisma)
    await prisma.taskComment.delete({
      where: { id: commentId },
    });

    // Record in task history
    await taskHistoryService.recordHistory(comment.taskId, userId, 'CommentDeleted', {
      metadata: {
        commentId,
        hadReplies: !!comment.parentId,
      },
    });
  }

  /**
   * Get all comments for a task
   * @param taskId - ID of the task
   * @param firmId - Firm ID for access control
   */
  async getComments(taskId: string, firmId: string): Promise<TaskComment[]> {
    // Verify task belongs to firm
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        firmId,
      },
    });

    if (!task) {
      throw new Error('Task not found or access denied');
    }

    // Get top-level comments with replies
    const comments = await prisma.taskComment.findMany({
      where: {
        taskId,
        parentId: null, // Only top-level comments
      },
      include: {
        author: true,
        replies: {
          include: {
            author: true,
            replies: {
              include: {
                author: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return comments.map((c) => this.mapToTaskComment(c));
  }

  /**
   * Get a single comment by ID
   * @param commentId - ID of the comment
   */
  async getComment(commentId: string): Promise<TaskComment | null> {
    const comment = await prisma.taskComment.findUnique({
      where: { id: commentId },
      include: {
        author: true,
        replies: {
          include: {
            author: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!comment) {
      return null;
    }

    return this.mapToTaskComment(comment);
  }

  /**
   * Parse @mentions from comment content and return user IDs
   * Uses existing pattern from notification.service.ts
   */
  private async parseMentions(content: string, firmId: string): Promise<string[]> {
    // Match @username pattern
    const mentionPattern = /@([\w-]+)/g;
    const matches = content.match(mentionPattern);

    if (!matches) {
      return [];
    }

    // Extract usernames without the @ symbol
    const usernames = matches.map((m) => m.substring(1));

    // Find users by email prefix in the same firm
    const users = await prisma.user.findMany({
      where: {
        firmId,
        status: 'Active',
        OR: usernames.map((username) => ({
          email: {
            startsWith: username,
          },
        })),
      },
      select: { id: true },
    });

    return users.map((u) => u.id);
  }

  /**
   * Notify task assignee that a comment was added
   */
  private async notifyTaskCommentAdded(
    userId: string,
    context: {
      taskId: string;
      taskTitle: string;
      caseId: string;
      caseTitle: string;
      commentId: string;
      commentContent: string;
      authorId: string;
      authorName: string;
    }
  ): Promise<void> {
    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.TaskCommentAdded,
        title: 'New Comment on Task',
        message: `${context.authorName} commented on "${context.taskTitle}": ${context.commentContent}`,
        link: `/tasks/${context.taskId}#comment-${context.commentId}`,
        caseId: context.caseId,
        taskId: context.taskId,
      },
    });
  }

  /**
   * Notify user that they were @mentioned in a comment
   */
  private async notifyTaskCommentMentioned(
    userId: string,
    context: {
      taskId: string;
      taskTitle: string;
      caseId: string;
      caseTitle: string;
      commentId: string;
      commentContent: string;
      authorId: string;
      authorName: string;
    }
  ): Promise<void> {
    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.TaskCommentMentioned,
        title: 'You Were Mentioned',
        message: `${context.authorName} mentioned you in a comment on "${context.taskTitle}"`,
        link: `/tasks/${context.taskId}#comment-${context.commentId}`,
        caseId: context.caseId,
        taskId: context.taskId,
      },
    });
  }

  /**
   * Notify user that someone replied to their comment
   */
  private async notifyTaskCommentReplied(
    userId: string,
    context: {
      taskId: string;
      taskTitle: string;
      caseId: string;
      caseTitle: string;
      commentId: string;
      commentContent: string;
      authorId: string;
      authorName: string;
    }
  ): Promise<void> {
    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.TaskCommentReplied,
        title: 'Reply to Your Comment',
        message: `${context.authorName} replied to your comment on "${context.taskTitle}"`,
        link: `/tasks/${context.taskId}#comment-${context.commentId}`,
        caseId: context.caseId,
        taskId: context.taskId,
      },
    });
  }

  /**
   * Map Prisma result to TaskComment type
   */
  private mapToTaskComment(comment: any): TaskComment {
    return {
      id: comment.id,
      taskId: comment.taskId,
      authorId: comment.authorId,
      content: comment.content,
      parentId: comment.parentId || undefined,
      mentions: comment.mentions || [],
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      editedAt: comment.editedAt || undefined,
      author: comment.author
        ? {
            id: comment.author.id,
            email: comment.author.email,
            firstName: comment.author.firstName,
            lastName: comment.author.lastName,
            role: comment.author.role,
            status: comment.author.status,
            firmId: comment.author.firmId,
            azureAdId: comment.author.azureAdId,
            preferences: comment.author.preferences || {},
            createdAt: comment.author.createdAt,
            lastActive: comment.author.lastActive,
          }
        : undefined,
      replies: comment.replies
        ? comment.replies.map((r: any) => this.mapToTaskComment(r))
        : undefined,
    };
  }
}

// Export singleton instance
export const taskCommentService = new TaskCommentService();
