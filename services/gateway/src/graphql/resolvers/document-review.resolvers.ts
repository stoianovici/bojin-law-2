/**
 * Document Review GraphQL Resolvers
 * Story 3.6: Document Review and Approval Workflow
 *
 * Implements resolvers for document review workflow including
 * submission, comments, AI concerns, and approval/rejection
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import { ReviewStatus, ReviewAction } from '@prisma/client';
import { notificationService } from '../../services/notification.service';
import logger from '../../utils/logger';
import { requireAuth, requirePartner as requirePartnerBase, type Context } from '../utils/auth';

// AI Service base URL
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3002';
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY || 'dev-api-key';

// Helper function to require Partner role
function requirePartnerRole(user: Context['user']) {
  if (!user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }

  if (user.role !== 'Partner') {
    throw new GraphQLError('Partner role required for this operation', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  return user;
}

// Helper to check document access
async function canAccessDocument(documentId: string, user: Context['user']): Promise<boolean> {
  if (!user) return false;

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { firmId: true },
  });

  if (!document || document.firmId !== user.firmId) return false;

  return true;
}

// Helper to check review access
async function canAccessReview(reviewId: string, user: Context['user']): Promise<boolean> {
  if (!user) return false;

  const review = await prisma.documentReview.findUnique({
    where: { id: reviewId },
    select: { firmId: true },
  });

  if (!review || review.firmId !== user.firmId) return false;

  return true;
}

// Call AI service for document analysis
async function callAIService(endpoint: string, data: object): Promise<any> {
  try {
    const response = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_SERVICE_API_KEY}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI Service error: ${error}`);
    }

    return response.json();
  } catch (error) {
    logger.error('AI Service call failed', { endpoint, error });
    throw new GraphQLError('AI service unavailable', {
      extensions: { code: 'SERVICE_UNAVAILABLE' },
    });
  }
}

// Helper to record review history
async function recordHistory(
  reviewId: string,
  action: ReviewAction,
  actorId: string,
  previousStatus?: ReviewStatus,
  newStatus?: ReviewStatus,
  feedback?: string,
  metadata?: object
) {
  await prisma.reviewHistory.create({
    data: {
      reviewId,
      action,
      actorId,
      previousStatus,
      newStatus,
      feedback,
      metadata,
    },
  });
}

export const documentReviewResolvers = {
  Query: {
    // Get review by ID
    documentReview: async (_: unknown, { id }: { id: string }, context: Context) => {
      const user = requireAuth(context);

      if (!(await canAccessReview(id, user))) {
        throw new GraphQLError('Review not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return prisma.documentReview.findUnique({
        where: { id },
        include: {
          document: true,
          documentVersion: true,
          submitter: true,
          reviewer: true,
          comments: {
            include: {
              author: true,
              resolver: true,
              replies: {
                include: { author: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
          aiConcerns: {
            orderBy: { severity: 'asc' },
          },
          history: {
            include: { actor: true },
            orderBy: { timestamp: 'desc' },
          },
        },
      });
    },

    // Get pending reviews
    pendingDocumentReviews: async (
      _: unknown,
      { priority, limit = 20, offset = 0 }: { priority?: string; limit?: number; offset?: number },
      context: Context
    ) => {
      const user = requireAuth(context);

      const where: any = {
        firmId: user.firmId,
        status: { in: ['PENDING', 'IN_REVIEW'] },
      };

      // Partners see all pending reviews, Associates see only assigned
      if (user.role !== 'Partner') {
        where.assignedTo = user.id;
      }

      if (priority) {
        where.priority = priority;
      }

      return prisma.documentReview.findMany({
        where,
        include: {
          document: true,
          documentVersion: true,
          submitter: true,
          reviewer: true,
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
        take: limit,
        skip: offset,
      });
    },

    // Get reviews submitted by current user
    mySubmittedReviews: async (
      _: unknown,
      { status, limit = 20, offset = 0 }: { status?: string; limit?: number; offset?: number },
      context: Context
    ) => {
      const user = requireAuth(context);

      const where: any = {
        submittedBy: user.id,
      };

      if (status) {
        where.status = status;
      }

      return prisma.documentReview.findMany({
        where,
        include: {
          document: true,
          documentVersion: true,
          reviewer: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });
    },

    // Get review history for a document
    documentReviewHistory: async (
      _: unknown,
      { documentId }: { documentId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessDocument(documentId, user))) {
        throw new GraphQLError('Document not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return prisma.documentReview.findMany({
        where: { documentId },
        include: {
          document: true,
          documentVersion: true,
          submitter: true,
          reviewer: true,
          history: {
            include: { actor: true },
            orderBy: { timestamp: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    },

    // Get similar documents for batch review
    similarDocumentsForBatch: async (
      _: unknown,
      { documentIds, threshold = 0.8 }: { documentIds: string[]; threshold?: number },
      context: Context
    ) => {
      const user = requireAuth(context);
      requirePartnerRole(user);

      // Get reviews for the specified documents
      const reviews = await prisma.documentReview.findMany({
        where: {
          documentId: { in: documentIds },
          firmId: user.firmId,
          status: { in: ['PENDING', 'IN_REVIEW'] },
        },
        include: {
          document: true,
        },
      });

      // Group by document type for batch processing
      const grouped = new Map<string, typeof reviews>();
      for (const review of reviews) {
        const key = review.document.fileType || 'unknown';
        const existing = grouped.get(key) || [];
        existing.push(review);
        grouped.set(key, existing);
      }

      return Array.from(grouped.values());
    },

    // Get review statistics
    reviewStatistics: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context);

      const [pending, inReview, approved, rejected, byPriority, avgReviewTime] = await Promise.all([
        prisma.documentReview.count({
          where: { firmId: user.firmId, status: 'PENDING' },
        }),
        prisma.documentReview.count({
          where: { firmId: user.firmId, status: 'IN_REVIEW' },
        }),
        prisma.documentReview.count({
          where: { firmId: user.firmId, status: 'APPROVED' },
        }),
        prisma.documentReview.count({
          where: { firmId: user.firmId, status: 'REJECTED' },
        }),
        prisma.documentReview.groupBy({
          by: ['priority'],
          where: { firmId: user.firmId },
          _count: true,
        }),
        prisma.documentReview.aggregate({
          where: {
            firmId: user.firmId,
            reviewedAt: { not: null },
          },
          _avg: {
            revisionNumber: true, // Proxy for review cycles
          },
        }),
      ]);

      const priorityStats = {
        low: 0,
        normal: 0,
        high: 0,
        urgent: 0,
      };

      for (const p of byPriority) {
        const key = p.priority.toLowerCase() as keyof typeof priorityStats;
        priorityStats[key] = p._count;
      }

      return {
        totalPending: pending,
        totalInReview: inReview,
        totalApproved: approved,
        totalRejected: rejected,
        averageReviewTimeHours: 24, // Would need actual time calculation
        reviewsByPriority: priorityStats,
      };
    },
  },

  Mutation: {
    // Submit document for review
    submitDocumentForReview: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          documentId: string;
          versionId: string;
          assignedTo?: string;
          priority?: string;
          dueDate?: string;
          message?: string;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessDocument(input.documentId, user))) {
        throw new GraphQLError('Document not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Check if there's already an active review
      const existingReview = await prisma.documentReview.findFirst({
        where: {
          documentId: input.documentId,
          status: { in: ['PENDING', 'IN_REVIEW'] },
        },
      });

      if (existingReview) {
        throw new GraphQLError('Document already has an active review', {
          extensions: { code: 'CONFLICT' },
        });
      }

      // Get revision count
      const previousReviews = await prisma.documentReview.count({
        where: { documentId: input.documentId },
      });

      // Create review
      const review = await prisma.documentReview.create({
        data: {
          documentId: input.documentId,
          documentVersionId: input.versionId,
          firmId: user.firmId,
          submittedBy: user.id,
          assignedTo: input.assignedTo || null,
          priority: (input.priority as any) || 'NORMAL',
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          revisionNumber: previousReviews,
        },
        include: {
          document: true,
          documentVersion: true,
          submitter: true,
          reviewer: true,
        },
      });

      // Record history
      await recordHistory(
        review.id,
        ReviewAction.SUBMITTED,
        user.id,
        undefined,
        ReviewStatus.PENDING,
        input.message
      );

      // Get document title for notification
      const documentTitle = review.document.fileName;

      // Send notification
      await notificationService.notifyDocumentReviewRequested(
        input.assignedTo || null,
        user.firmId,
        {
          reviewId: review.id,
          documentId: input.documentId,
          documentTitle,
          actorName: `${user.firstName} ${user.lastName}`,
          revisionNumber: previousReviews,
        }
      );

      logger.info('Document submitted for review', {
        reviewId: review.id,
        documentId: input.documentId,
        submittedBy: user.id,
      });

      return review;
    },

    // Assign reviewer
    assignReviewer: async (
      _: unknown,
      { reviewId, reviewerId }: { reviewId: string; reviewerId: string },
      context: Context
    ) => {
      const user = requireAuth(context);
      requirePartnerRole(user);

      if (!(await canAccessReview(reviewId, user))) {
        throw new GraphQLError('Review not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const review = await prisma.documentReview.update({
        where: { id: reviewId },
        data: {
          assignedTo: reviewerId,
          status: 'IN_REVIEW',
        },
        include: {
          document: true,
          submitter: true,
        },
      });

      // Record history
      await recordHistory(
        reviewId,
        ReviewAction.ASSIGNED,
        user.id,
        ReviewStatus.PENDING,
        ReviewStatus.IN_REVIEW
      );

      // Notify assigned reviewer
      await notificationService.notifyDocumentReviewRequested(reviewerId, user.firmId, {
        reviewId,
        documentId: review.documentId,
        documentTitle: review.document.fileName,
        actorName: `${user.firstName} ${user.lastName}`,
      });

      return review;
    },

    // Add inline comment
    addReviewComment: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          reviewId: string;
          content: string;
          anchorText?: string;
          anchorStart?: number;
          anchorEnd?: number;
          sectionPath?: string;
          suggestionText?: string;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessReview(input.reviewId, user))) {
        throw new GraphQLError('Review not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const comment = await prisma.reviewComment.create({
        data: {
          reviewId: input.reviewId,
          authorId: user.id,
          content: input.content,
          anchorText: input.anchorText,
          anchorStart: input.anchorStart,
          anchorEnd: input.anchorEnd,
          sectionPath: input.sectionPath,
          suggestionText: input.suggestionText,
        },
        include: {
          author: true,
        },
      });

      // Record history
      await recordHistory(input.reviewId, ReviewAction.COMMENT_ADDED, user.id);

      // Get review for notification context
      const review = await prisma.documentReview.findUnique({
        where: { id: input.reviewId },
        include: { document: true, submitter: true },
      });

      if (review && review.submittedBy !== user.id) {
        // Notify document submitter
        await notificationService.notifyCommentAdded(review.submittedBy, {
          reviewId: input.reviewId,
          commentId: comment.id,
          documentTitle: review.document.fileName,
          authorName: `${user.firstName} ${user.lastName}`,
          commentPreview: input.content.substring(0, 100),
        });
      }

      // Check for @mentions
      const mentionedUserIds = await notificationService.parseMentions(input.content, user.firmId);

      for (const mentionedId of mentionedUserIds) {
        if (mentionedId !== user.id) {
          await notificationService.notifyMentioned(mentionedId, {
            reviewId: input.reviewId,
            commentId: comment.id,
            documentTitle: review?.document.fileName || '',
            mentionedBy: `${user.firstName} ${user.lastName}`,
            commentContent: input.content,
          });
        }
      }

      return comment;
    },

    // Reply to comment
    replyToComment: async (
      _: unknown,
      { commentId, content }: { commentId: string; content: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      const comment = await prisma.reviewComment.findUnique({
        where: { id: commentId },
        include: { review: true },
      });

      if (!comment || !(await canAccessReview(comment.reviewId, user))) {
        throw new GraphQLError('Comment not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const reply = await prisma.reviewCommentReply.create({
        data: {
          commentId,
          authorId: user.id,
          content,
        },
        include: {
          author: true,
        },
      });

      return reply;
    },

    // Resolve comment
    resolveComment: async (_: unknown, { commentId }: { commentId: string }, context: Context) => {
      const user = requireAuth(context);

      const comment = await prisma.reviewComment.findUnique({
        where: { id: commentId },
        include: { review: true },
      });

      if (!comment || !(await canAccessReview(comment.reviewId, user))) {
        throw new GraphQLError('Comment not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const updated = await prisma.reviewComment.update({
        where: { id: commentId },
        data: {
          resolved: true,
          resolvedBy: user.id,
          resolvedAt: new Date(),
        },
        include: {
          author: true,
          resolver: true,
          replies: { include: { author: true } },
        },
      });

      // Record history
      await recordHistory(comment.reviewId, ReviewAction.COMMENT_RESOLVED, user.id);

      return updated;
    },

    // Make review decision
    makeReviewDecision: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          reviewId: string;
          decision: string;
          feedback: string;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Only Partners or assigned reviewers can make decisions
      const review = await prisma.documentReview.findUnique({
        where: { id: input.reviewId },
        include: { document: true, submitter: true },
      });

      if (!review || review.firmId !== user.firmId) {
        throw new GraphQLError('Review not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (user.role !== 'Partner' && review.assignedTo !== user.id) {
        throw new GraphQLError('Only Partners or assigned reviewers can make decisions', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const previousStatus = review.status;
      const newStatus = input.decision as ReviewStatus;

      const updated = await prisma.documentReview.update({
        where: { id: input.reviewId },
        data: {
          status: newStatus,
          reviewedAt: new Date(),
          feedback: input.feedback,
          assignedTo: review.assignedTo || user.id,
        },
        include: {
          document: true,
          documentVersion: true,
          submitter: true,
          reviewer: true,
          comments: { include: { author: true, replies: { include: { author: true } } } },
          aiConcerns: true,
          history: { include: { actor: true } },
        },
      });

      // Record history
      const action =
        newStatus === 'APPROVED'
          ? ReviewAction.APPROVED
          : newStatus === 'REJECTED'
            ? ReviewAction.REJECTED
            : ReviewAction.REVISION_REQUESTED;

      await recordHistory(
        input.reviewId,
        action,
        user.id,
        previousStatus,
        newStatus,
        input.feedback
      );

      // Send notification to submitter
      const notificationContext = {
        reviewId: input.reviewId,
        documentId: review.documentId,
        documentTitle: review.document.fileName,
        actorName: `${user.firstName} ${user.lastName}`,
        feedback: input.feedback,
      };

      if (newStatus === 'APPROVED') {
        await notificationService.notifyDocumentApproved(review.submittedBy, notificationContext);
      } else if (newStatus === 'REJECTED') {
        await notificationService.notifyDocumentRejected(review.submittedBy, notificationContext);
      } else if (newStatus === 'REVISION_REQUESTED') {
        await notificationService.notifyDocumentRevisionRequested(
          review.submittedBy,
          notificationContext
        );
      }

      logger.info('Review decision made', {
        reviewId: input.reviewId,
        decision: newStatus,
        reviewer: user.id,
      });

      return updated;
    },

    // Resubmit after revision
    resubmitForReview: async (
      _: unknown,
      { reviewId, message }: { reviewId: string; message?: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      const review = await prisma.documentReview.findUnique({
        where: { id: reviewId },
        include: { document: true },
      });

      if (!review || review.firmId !== user.firmId) {
        throw new GraphQLError('Review not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (review.submittedBy !== user.id) {
        throw new GraphQLError('Only the original submitter can resubmit', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      if (review.status !== 'REVISION_REQUESTED' && review.status !== 'REJECTED') {
        throw new GraphQLError('Review must be in revision requested or rejected status', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      const previousStatus = review.status;
      const updated = await prisma.documentReview.update({
        where: { id: reviewId },
        data: {
          status: 'PENDING',
          revisionNumber: review.revisionNumber + 1,
          reviewedAt: null,
          feedback: null,
        },
        include: {
          document: true,
          documentVersion: true,
          submitter: true,
          reviewer: true,
        },
      });

      // Record history
      await recordHistory(
        reviewId,
        ReviewAction.RESUBMITTED,
        user.id,
        previousStatus,
        ReviewStatus.PENDING,
        message
      );

      // Notify reviewer
      if (review.assignedTo) {
        await notificationService.notifyDocumentReviewRequested(review.assignedTo, user.firmId, {
          reviewId,
          documentId: review.documentId,
          documentTitle: review.document.fileName,
          actorName: `${user.firstName} ${user.lastName}`,
          revisionNumber: updated.revisionNumber,
        });
      }

      return updated;
    },

    // Dismiss AI concern
    dismissAIConcern: async (
      _: unknown,
      { concernId }: { concernId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      const concern = await prisma.aIReviewConcern.findUnique({
        where: { id: concernId },
        include: { review: true },
      });

      if (!concern || concern.review.firmId !== user.firmId) {
        throw new GraphQLError('Concern not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const updated = await prisma.aIReviewConcern.update({
        where: { id: concernId },
        data: {
          dismissed: true,
          dismissedBy: user.id,
          dismissedAt: new Date(),
        },
      });

      return updated;
    },

    // Batch review decision
    batchReviewDecision: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          reviewIds: string[];
          decision: string;
          commonFeedback: string;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);
      requirePartnerRole(user);

      // Verify all reviews belong to the firm
      const reviews = await prisma.documentReview.findMany({
        where: {
          id: { in: input.reviewIds },
          firmId: user.firmId,
        },
      });

      if (reviews.length !== input.reviewIds.length) {
        throw new GraphQLError('Some reviews not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Create batch review record
      const batchReview = await prisma.batchReview.create({
        data: {
          firmId: user.firmId,
          createdBy: user.id,
          reviewIds: input.reviewIds,
          status: 'IN_PROGRESS',
          totalCount: input.reviewIds.length,
          commonFeedback: input.commonFeedback,
        },
      });

      // Process each review
      let processedCount = 0;
      for (const reviewId of input.reviewIds) {
        try {
          await documentReviewResolvers.Mutation.makeReviewDecision(
            _,
            {
              input: {
                reviewId,
                decision: input.decision,
                feedback: input.commonFeedback,
              },
            },
            context
          );
          processedCount++;
        } catch (error) {
          logger.error('Batch review item failed', { reviewId, error });
        }
      }

      // Update batch status
      const completed = await prisma.batchReview.update({
        where: { id: batchReview.id },
        data: {
          status: 'COMPLETED',
          processedCount,
          completedAt: new Date(),
        },
      });

      // Get all reviews for response
      const processedReviews = await prisma.documentReview.findMany({
        where: { id: { in: input.reviewIds } },
        include: {
          document: true,
          documentVersion: true,
          submitter: true,
          reviewer: true,
        },
      });

      return {
        id: completed.id,
        reviews: processedReviews,
        status: completed.status,
        processedCount: completed.processedCount,
        totalCount: completed.totalCount,
        commonFeedback: completed.commonFeedback,
        createdAt: completed.createdAt,
      };
    },

    // Generate AI concerns for review
    generateAIConcerns: async (
      _: unknown,
      { reviewId }: { reviewId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      const review = await prisma.documentReview.findUnique({
        where: { id: reviewId },
        include: {
          document: true,
          documentVersion: true,
        },
      });

      if (!review || review.firmId !== user.firmId) {
        throw new GraphQLError('Review not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Call AI service for document analysis
      const result = await callAIService('/api/document-review/analyze', {
        documentId: review.documentId,
        versionId: review.documentVersionId,
        documentType: review.document.fileType,
        firmId: user.firmId,
        language: 'ro',
      });

      // Clear existing AI concerns
      await prisma.aIReviewConcern.deleteMany({
        where: { reviewId },
      });

      // Store new concerns
      if (result.concerns && result.concerns.length > 0) {
        await prisma.aIReviewConcern.createMany({
          data: result.concerns.map((concern: any) => ({
            reviewId,
            concernType: concern.concernType,
            severity: concern.severity,
            description: concern.description,
            anchorText: concern.anchorText,
            anchorStart: concern.anchorStart,
            anchorEnd: concern.anchorEnd,
            sectionPath: concern.sectionPath,
            suggestedFix: concern.suggestedFix,
            aiConfidence: concern.confidence,
          })),
        });
      }

      // Return stored concerns
      return prisma.aIReviewConcern.findMany({
        where: { reviewId },
        orderBy: { severity: 'asc' },
      });
    },
  },

  // Type resolvers
  DocumentReview: {
    document: (parent: any) => prisma.document.findUnique({ where: { id: parent.documentId } }),
    documentVersion: (parent: any) =>
      prisma.documentVersion.findUnique({ where: { id: parent.documentVersionId } }),
    submittedBy: (parent: any) => prisma.user.findUnique({ where: { id: parent.submittedBy } }),
    assignedTo: (parent: any) =>
      parent.assignedTo ? prisma.user.findUnique({ where: { id: parent.assignedTo } }) : null,
  },

  ReviewComment: {
    author: (parent: any) => prisma.user.findUnique({ where: { id: parent.authorId } }),
    resolvedBy: (parent: any) =>
      parent.resolvedBy ? prisma.user.findUnique({ where: { id: parent.resolvedBy } }) : null,
  },

  ReviewCommentReply: {
    author: (parent: any) => prisma.user.findUnique({ where: { id: parent.authorId } }),
  },

  ReviewHistoryEntry: {
    actor: (parent: any) => prisma.user.findUnique({ where: { id: parent.actorId } }),
  },
};

export default documentReviewResolvers;
