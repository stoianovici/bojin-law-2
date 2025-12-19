/**
 * Proactive AI Suggestions GraphQL Resolvers
 * Story 5.4: Proactive AI Suggestions System
 *
 * Implements all queries and mutations for proactive AI suggestions,
 * morning briefings, deadline warnings, and document completeness.
 */

import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';
import logger from '../../utils/logger';

// Context type
interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
    email: string;
  };
}

// Helper function to check authorization
function requireAuth(context: Context) {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.user;
}

// Placeholder services - these would be imported from ai-service in production
// For now, we'll implement basic functionality directly

export const proactiveSuggestionsResolvers = {
  Query: {
    /**
     * Get morning briefing for a specific date
     */
    morningBriefing: async (_parent: unknown, args: { date?: string }, context: Context) => {
      const user = requireAuth(context);

      const targetDate = args.date ? new Date(args.date) : new Date();
      targetDate.setHours(0, 0, 0, 0);

      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const briefing = await prisma.morningBriefing.findFirst({
        where: {
          userId: user.id,
          firmId: user.firmId,
          briefingDate: {
            gte: targetDate,
            lt: nextDay,
          },
        },
        orderBy: { generatedAt: 'desc' },
      });

      if (!briefing) {
        return null;
      }

      return {
        id: briefing.id,
        briefingDate: briefing.briefingDate,
        prioritizedTasks: briefing.prioritizedTasks,
        keyDeadlines: briefing.keyDeadlines,
        riskAlerts: briefing.riskAlerts,
        suggestions: briefing.suggestions,
        summary: briefing.summary,
        isViewed: briefing.isViewed,
        viewedAt: briefing.viewedAt,
        tokensUsed: briefing.tokensUsed,
        createdAt: briefing.generatedAt,
      };
    },

    /**
     * Get contextual suggestions based on current context
     */
    contextualSuggestions: async (
      _parent: unknown,
      args: {
        context: {
          currentScreen?: string;
          currentCaseId?: string;
          currentDocumentId?: string;
          recentActions?: Array<{
            type: string;
            timestamp?: Date;
            context?: Record<string, unknown>;
          }>;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      try {
        // Get suggestions from database that match the context
        const suggestions = await prisma.aISuggestion.findMany({
          where: {
            userId: user.id,
            firmId: user.firmId,
            status: 'Pending',
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            ...(args.context.currentCaseId ? { caseId: args.context.currentCaseId } : {}),
          },
          orderBy: [{ priority: 'desc' }, { confidence: 'desc' }, { createdAt: 'desc' }],
          take: 10,
          include: {
            case: {
              select: {
                id: true,
                title: true,
                caseNumber: true,
              },
            },
          },
        });

        return suggestions.map((s) => ({
          id: s.id,
          type: s.type,
          category: s.category,
          title: s.title,
          description: s.description,
          suggestedAction: s.suggestedAction,
          actionPayload: s.actionPayload,
          confidence: s.confidence,
          priority: s.priority,
          status: s.status,
          case: s.case,
          expiresAt: s.expiresAt,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        }));
      } catch (error) {
        // Graceful degradation: return empty array if table doesn't exist yet
        // This allows the feature to degrade gracefully during development
        console.warn('contextualSuggestions query failed (table may not exist):', error);
        return [];
      }
    },

    /**
     * Get all pending suggestions
     */
    pendingSuggestions: async (
      _parent: unknown,
      args: { limit?: number; offset?: number },
      context: Context
    ) => {
      const user = requireAuth(context);
      const limit = args.limit || 20;
      const offset = args.offset || 0;

      const suggestions = await prisma.aISuggestion.findMany({
        where: {
          userId: user.id,
          firmId: user.firmId,
          status: 'Pending',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        include: {
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true,
            },
          },
        },
      });

      return suggestions;
    },

    /**
     * Get upcoming deadline warnings
     */
    deadlineWarnings: async (
      _parent: unknown,
      args: {
        input?: {
          caseId?: string;
          lookaheadDays?: number;
          includeDependencies?: boolean;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);
      const lookaheadDays = args.input?.lookaheadDays || 14;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + lookaheadDays);

      const tasks = await prisma.task.findMany({
        where: {
          assignedTo: user.id,
          firmId: user.firmId,
          status: { in: ['Pending', 'InProgress'] },
          dueDate: {
            gte: today,
            lte: futureDate,
          },
          ...(args.input?.caseId ? { caseId: args.input.caseId } : {}),
        },
        orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
        include: {
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true,
            },
          },
        },
      });

      return tasks.map((task) => {
        const dueDate = task.dueDate ? new Date(task.dueDate) : new Date();
        const daysUntilDue = Math.ceil(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        let severity: 'Info' | 'Warning' | 'Critical' = 'Info';
        if (daysUntilDue < 3) severity = 'Critical';
        else if (daysUntilDue < 7) severity = 'Warning';

        return {
          id: task.id,
          taskId: task.id,
          title: task.title,
          dueDate: task.dueDate,
          daysUntilDue,
          severity,
          caseId: task.caseId,
          case: task.case,
          suggestedActions: [
            {
              action: 'start_task',
              description: 'Start working on this task',
              actionType: 'Navigate',
              payload: { taskId: task.id },
            },
          ],
          blockedBy: [],
        };
      });
    },

    /**
     * Get overdue deadlines
     */
    overdueDeadlines: async (_parent: unknown, _args: unknown, context: Context) => {
      const user = requireAuth(context);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tasks = await prisma.task.findMany({
        where: {
          assignedTo: user.id,
          firmId: user.firmId,
          status: { in: ['Pending', 'InProgress'] },
          dueDate: { lt: today },
        },
        orderBy: { dueDate: 'asc' },
        include: {
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true,
            },
          },
        },
      });

      return tasks.map((task) => {
        const dueDate = task.dueDate ? new Date(task.dueDate) : new Date();
        const daysUntilDue = Math.ceil(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          id: task.id,
          taskId: task.id,
          title: task.title,
          dueDate: task.dueDate,
          daysUntilDue,
          severity: 'Critical' as const,
          caseId: task.caseId,
          case: task.case,
          suggestedActions: [
            {
              action: 'complete',
              description: 'Complete this overdue task',
              actionType: 'Navigate',
              payload: { taskId: task.id },
            },
            {
              action: 'reschedule',
              description: 'Reschedule the deadline',
              actionType: 'CreateTask',
              payload: { taskId: task.id, action: 'reschedule' },
            },
          ],
          blockedBy: [],
        };
      });
    },

    /**
     * Check document completeness
     */
    documentCompleteness: async (
      _parent: unknown,
      args: {
        input: {
          documentId: string;
          documentContent: string;
          documentType: string;
          documentTitle?: string;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Basic completeness check - in production this would call the AI service
      const { documentId, documentContent, documentType, documentTitle } = args.input;

      const contentLower = documentContent.toLowerCase();
      const missingItems: Array<{
        item: string;
        severity: 'Required' | 'Recommended' | 'Optional';
        section?: string;
        suggestion: string;
      }> = [];

      // Simple rule-based checks
      if (!contentLower.includes('semnătur') && !contentLower.includes('signature')) {
        missingItems.push({
          item: 'Signature',
          severity: 'Required',
          suggestion: 'Add signature blocks for all parties',
        });
      }

      if (!contentLower.includes('data') && !contentLower.includes('date')) {
        missingItems.push({
          item: 'Date',
          severity: 'Required',
          suggestion: 'Include the document date',
        });
      }

      const completenessScore =
        missingItems.length === 0 ? 1.0 : Math.max(0, 1 - missingItems.length * 0.2);

      // Store the check
      try {
        await prisma.documentCompletenessCheck.create({
          data: {
            firmId: user.firmId,
            documentId,
            documentType,
            completeness: completenessScore,
            missingItems: JSON.parse(JSON.stringify(missingItems)),
            checkType: 'api_check',
          },
        });
      } catch (error) {
        logger.error('Failed to store completeness check', {
          documentId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return {
        documentId,
        documentType,
        completenessScore,
        missingItems,
        suggestions:
          missingItems.length > 0
            ? ['Review and add missing required elements']
            : ['Document appears complete'],
      };
    },

    /**
     * Get user action patterns
     */
    userPatterns: async (_parent: unknown, args: { limit?: number }, context: Context) => {
      const user = requireAuth(context);

      const patterns = await prisma.userActionPattern.findMany({
        where: {
          userId: user.id,
          firmId: user.firmId,
          isActive: true,
        },
        orderBy: { confidence: 'desc' },
        take: args.limit || 10,
      });

      return patterns;
    },

    /**
     * Get suggestion analytics
     */
    suggestionAnalytics: async (
      _parent: unknown,
      args: { dateRange?: { start: string; end: string } },
      context: Context
    ) => {
      const user = requireAuth(context);

      const startDate = args.dateRange?.start
        ? new Date(args.dateRange.start)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = args.dateRange?.end ? new Date(args.dateRange.end) : new Date();

      const suggestions = await prisma.aISuggestion.findMany({
        where: {
          userId: user.id,
          firmId: user.firmId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      const feedback = await prisma.suggestionFeedback.findMany({
        where: {
          userId: user.id,
          firmId: user.firmId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      const acceptedCount = suggestions.filter((s) => s.status === 'Accepted').length;
      const dismissedCount = suggestions.filter((s) => s.status === 'Dismissed').length;

      // Aggregate by type
      const byType: Record<string, { count: number; accepted: number }> = {};
      const byCategory: Record<string, { count: number; accepted: number }> = {};

      for (const s of suggestions) {
        if (!byType[s.type]) byType[s.type] = { count: 0, accepted: 0 };
        byType[s.type].count++;
        if (s.status === 'Accepted') byType[s.type].accepted++;

        if (!byCategory[s.category]) byCategory[s.category] = { count: 0, accepted: 0 };
        byCategory[s.category].count++;
        if (s.status === 'Accepted') byCategory[s.category].accepted++;
      }

      const avgResponseTime =
        feedback.length > 0
          ? feedback.reduce((sum, f) => sum + (f.responseTimeMs || 0), 0) / feedback.length
          : 0;

      return {
        totalSuggestions: suggestions.length,
        acceptedCount,
        dismissedCount,
        acceptanceRate: suggestions.length > 0 ? acceptedCount / suggestions.length : 0,
        averageResponseTimeMs: avgResponseTime,
        byType: Object.entries(byType).map(([type, stats]) => ({
          type,
          count: stats.count,
          acceptanceRate: stats.count > 0 ? stats.accepted / stats.count : 0,
        })),
        byCategory: Object.entries(byCategory).map(([category, stats]) => ({
          category,
          count: stats.count,
          acceptanceRate: stats.count > 0 ? stats.accepted / stats.count : 0,
        })),
      };
    },

    /**
     * Get pattern-based suggestions
     */
    patternBasedSuggestions: async (
      _parent: unknown,
      args: { limit?: number },
      context: Context
    ) => {
      const user = requireAuth(context);

      const suggestions = await prisma.aISuggestion.findMany({
        where: {
          userId: user.id,
          firmId: user.firmId,
          type: 'PatternMatch',
          status: 'Pending',
        },
        orderBy: { confidence: 'desc' },
        take: args.limit || 5,
      });

      return suggestions;
    },

    /**
     * Get deadline statistics
     */
    deadlineStats: async (_parent: unknown, _args: unknown, context: Context) => {
      const user = requireAuth(context);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [overdue, critical, warning, info] = await Promise.all([
        prisma.task.count({
          where: {
            assignedTo: user.id,
            firmId: user.firmId,
            status: { in: ['Pending', 'InProgress'] },
            dueDate: { lt: today },
          },
        }),
        prisma.task.count({
          where: {
            assignedTo: user.id,
            firmId: user.firmId,
            status: { in: ['Pending', 'InProgress'] },
            dueDate: {
              gte: today,
              lt: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        prisma.task.count({
          where: {
            assignedTo: user.id,
            firmId: user.firmId,
            status: { in: ['Pending', 'InProgress'] },
            dueDate: {
              gte: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
              lt: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        prisma.task.count({
          where: {
            assignedTo: user.id,
            firmId: user.firmId,
            status: { in: ['Pending', 'InProgress'] },
            dueDate: {
              gte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
              lt: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

      return {
        total: overdue + critical + warning + info,
        critical,
        warning,
        info,
        overdue,
      };
    },
  },

  Mutation: {
    /**
     * Accept a suggestion
     */
    acceptSuggestion: async (
      _parent: unknown,
      args: { suggestionId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      const suggestion = await prisma.aISuggestion.update({
        where: {
          id: args.suggestionId,
          userId: user.id,
          firmId: user.firmId,
        },
        data: {
          status: 'Accepted',
          acceptedAt: new Date(),
        },
        include: {
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true,
            },
          },
        },
      });

      logger.info('Suggestion accepted', {
        suggestionId: args.suggestionId,
        userId: user.id,
        type: suggestion.type,
      });

      return suggestion;
    },

    /**
     * Dismiss a suggestion
     */
    dismissSuggestion: async (
      _parent: unknown,
      args: { suggestionId: string; reason?: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      const suggestion = await prisma.aISuggestion.update({
        where: {
          id: args.suggestionId,
          userId: user.id,
          firmId: user.firmId,
        },
        data: {
          status: 'Dismissed',
          dismissedAt: new Date(),
          dismissReason: args.reason,
        },
        include: {
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true,
            },
          },
        },
      });

      logger.info('Suggestion dismissed', {
        suggestionId: args.suggestionId,
        userId: user.id,
        reason: args.reason,
      });

      return suggestion;
    },

    /**
     * Record suggestion feedback
     */
    recordSuggestionFeedback: async (
      _parent: unknown,
      args: {
        input: {
          suggestionId: string;
          action: string;
          modifiedAction?: Record<string, unknown>;
          feedbackReason?: string;
          responseTimeMs?: number;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);
      const { suggestionId, action, modifiedAction, feedbackReason, responseTimeMs } = args.input;

      // Create feedback record
      await prisma.suggestionFeedback.create({
        data: {
          suggestionId,
          userId: user.id,
          firmId: user.firmId,
          action,
          modifiedAction: modifiedAction ? JSON.parse(JSON.stringify(modifiedAction)) : undefined,
          feedbackReason,
          responseTimeMs,
        },
      });

      // Update suggestion status
      const statusMap: Record<string, string> = {
        accepted: 'Accepted',
        dismissed: 'Dismissed',
        modified: 'Accepted',
        ignored: 'Expired',
      };

      const newStatus = statusMap[action] || 'Pending';

      await prisma.aISuggestion.update({
        where: { id: suggestionId },
        data: {
          status: newStatus as 'Accepted' | 'Dismissed' | 'Pending' | 'Expired' | 'AutoApplied',
          ...(action === 'accepted' || action === 'modified' ? { acceptedAt: new Date() } : {}),
          ...(action === 'dismissed' ? { dismissedAt: new Date() } : {}),
        },
      });

      logger.info('Suggestion feedback recorded', {
        suggestionId,
        userId: user.id,
        action,
      });

      return {
        success: true,
        suggestionId,
        newStatus,
      };
    },

    /**
     * Mark briefing as viewed
     */
    markBriefingViewed: async (
      _parent: unknown,
      args: { briefingId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      const briefing = await prisma.morningBriefing.update({
        where: {
          id: args.briefingId,
          userId: user.id,
          firmId: user.firmId,
        },
        data: {
          isViewed: true,
          viewedAt: new Date(),
        },
      });

      return briefing;
    },

    /**
     * Refresh suggestions (invalidate cache and regenerate)
     */
    refreshSuggestions: async (
      _parent: unknown,
      args: {
        context: {
          currentScreen?: string;
          currentCaseId?: string;
          currentDocumentId?: string;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Mark expired suggestions
      await prisma.aISuggestion.updateMany({
        where: {
          userId: user.id,
          firmId: user.firmId,
          status: 'Pending',
          expiresAt: { lte: new Date() },
        },
        data: {
          status: 'Expired',
        },
      });

      // Get fresh suggestions
      const suggestions = await prisma.aISuggestion.findMany({
        where: {
          userId: user.id,
          firmId: user.firmId,
          status: 'Pending',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          ...(args.context.currentCaseId ? { caseId: args.context.currentCaseId } : {}),
        },
        orderBy: [{ priority: 'desc' }, { confidence: 'desc' }],
        take: 10,
        include: {
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true,
            },
          },
        },
      });

      return suggestions;
    },

    /**
     * Generate a new morning briefing
     */
    generateMorningBriefing: async (_parent: unknown, _args: unknown, context: Context) => {
      const user = requireAuth(context);

      // Create a basic briefing (in production, this would call the AI service)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const briefing = await prisma.morningBriefing.create({
        data: {
          userId: user.id,
          firmId: user.firmId,
          briefingDate: today,
          summary: 'Your morning briefing is ready.',
          prioritizedTasks: [],
          keyDeadlines: [],
          riskAlerts: [],
          suggestions: [],
          tokensUsed: 0,
        },
      });

      return briefing;
    },

    /**
     * Mark completeness issue as resolved
     */
    markCompletenessResolved: async (
      _parent: unknown,
      args: { checkId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      await prisma.documentCompletenessCheck.update({
        where: {
          id: args.checkId,
          firmId: user.firmId,
        },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          resolvedBy: user.id,
        },
      });

      return true;
    },

    /**
     * Record user action for pattern learning
     */
    recordUserAction: async (
      _parent: unknown,
      args: { type: string; context?: Record<string, unknown> },
      context: Context
    ) => {
      const user = requireAuth(context);

      // In production, this would be handled by the pattern recognition service
      logger.info('User action recorded', {
        userId: user.id,
        actionType: args.type,
        context: args.context,
      });

      return true;
    },
  },

  // Field resolvers
  MorningBriefing: {
    prioritizedTasks: (parent: { prioritizedTasks: unknown }) => {
      return (parent.prioritizedTasks as unknown[]) || [];
    },
    keyDeadlines: (parent: { keyDeadlines: unknown }) => {
      return (parent.keyDeadlines as unknown[]) || [];
    },
    riskAlerts: (parent: { riskAlerts: unknown }) => {
      return (parent.riskAlerts as unknown[]) || [];
    },
    suggestions: (parent: { suggestions: unknown }) => {
      return (parent.suggestions as unknown[]) || [];
    },
  },

  PrioritizedTask: {
    task: async (parent: { taskId: string }) => {
      return prisma.task.findUnique({
        where: { id: parent.taskId },
      });
    },
  },

  DeadlineInfo: {
    case: async (parent: { caseId?: string }) => {
      if (!parent.caseId) return null;
      return prisma.case.findUnique({
        where: { id: parent.caseId },
        select: {
          id: true,
          title: true,
          caseNumber: true,
        },
      });
    },
  },
};
