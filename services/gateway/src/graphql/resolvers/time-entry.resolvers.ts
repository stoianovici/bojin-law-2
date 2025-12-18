/**
 * Time Entry Resolvers
 * Story 4.3: Time Estimation & Manual Time Logging
 *
 * GraphQL resolvers for time tracking, time estimation, and time analysis
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import { TimeEntryService } from '../../services/time-entry.service';
import { TimeSummaryService } from '../../services/time-summary.service';
import { EstimateComparisonService } from '../../services/estimate-comparison.service';
import { TaskTypeEnum } from '@prisma/client';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3002';
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY || 'dev-api-key';
const SERVICE_SECRET = process.env.SERVICE_SECRET || 'dev-service-secret';

interface Context {
  user: {
    id: string;
    role: string;
    firmId: string;
  };
}

// Initialize services
const timeEntryService = new TimeEntryService();
const timeSummaryService = new TimeSummaryService();
const estimateComparisonService = new EstimateComparisonService();

// Helper: Build filter where clause for time entry queries
function buildFilterWhere(filters?: any) {
  if (!filters) return {};

  const where: any = {};

  if (filters.caseId) {
    where.caseId = filters.caseId;
  }

  if (filters.taskId !== undefined) {
    where.taskId = filters.taskId;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.date = {};
    if (filters.dateFrom) {
      where.date.gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      where.date.lte = new Date(filters.dateTo);
    }
  }

  if (filters.billable !== undefined) {
    where.billable = filters.billable;
  }

  return where;
}

export const timeEntryResolvers = {
  Query: {
    /**
     * Get a single time entry by ID
     */
    timeEntry: async (_: any, args: { id: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const entry = await timeEntryService.getTimeEntryById(args.id, user.firmId);

      if (!entry) {
        throw new GraphQLError('Time entry not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Authorization: Users can only view their own entries, Partners can view all firm entries
      if (entry.userId !== user.id && user.role !== 'Partner' && user.role !== 'BusinessOwner') {
        throw new GraphQLError('Not authorized to view this time entry', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return entry;
    },

    /**
     * Query time entries with filters
     */
    timeEntries: async (
      _: any,
      args: { filters?: any; limit?: number; offset?: number },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Partners and BusinessOwners can view all firm entries
      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
        throw new GraphQLError('Not authorized to view all time entries', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return await prisma.timeEntry.findMany({
        where: {
          firmId: user.firmId,
          ...buildFilterWhere(args.filters),
        },
        take: args.limit || 100,
        skip: args.offset || 0,
        orderBy: {
          date: 'desc',
        },
      });
    },

    /**
     * Get all time entries for a specific task
     */
    timeEntriesByTask: async (_: any, args: { taskId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await timeEntryService.getTimeEntriesByTask(args.taskId);
    },

    /**
     * Get current user's time entries with optional filters
     */
    myTimeEntries: async (_: any, args: { filters?: any }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Build date range from filters (optional)
      const dateRange =
        args.filters?.dateFrom || args.filters?.dateTo
          ? {
              start: args.filters.dateFrom ? new Date(args.filters.dateFrom) : undefined,
              end: args.filters.dateTo ? new Date(args.filters.dateTo) : undefined,
            }
          : undefined;

      return await timeEntryService.getTimeEntriesByUser(user.id, dateRange);
    },

    /**
     * Get weekly summary for current user
     */
    weeklySummary: async (_: any, args: { weekStart: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await timeSummaryService.getWeeklySummary(user.id, new Date(args.weekStart));
    },

    /**
     * Get multi-week trend data for current user
     */
    weeklyTrend: async (_: any, args: { weekCount: number }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (args.weekCount < 1 || args.weekCount > 52) {
        throw new GraphQLError('Week count must be between 1 and 52', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      return await timeSummaryService.getWeeklyTrend(user.id, args.weekCount);
    },

    /**
     * Get estimate vs actual report for improvement tracking
     */
    estimateVsActualReport: async (
      _: any,
      args: { periodStart: string; periodEnd: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const period = {
        start: new Date(args.periodStart),
        end: new Date(args.periodEnd),
      };

      return await estimateComparisonService.getEstimateVsActualReport(user.id, period);
    },

    /**
     * Get accuracy data for a specific task type
     */
    taskTypeAccuracy: async (_: any, args: { taskType: TaskTypeEnum }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await estimateComparisonService.getTaskTypeAccuracy(user.id, args.taskType);
    },
  },

  Mutation: {
    /**
     * Create a new time entry (manual time logging)
     */
    createTimeEntry: async (_: any, args: { input: any }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Convert date string to Date object
      const input = {
        ...args.input,
        date: new Date(args.input.date),
      };

      return await timeEntryService.createTimeEntry(input, user.id);
    },

    /**
     * Update an existing time entry
     */
    updateTimeEntry: async (_: any, args: { id: string; input: any }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Convert date string to Date object if provided
      const input = {
        ...args.input,
        date: args.input.date ? new Date(args.input.date) : undefined,
      };

      return await timeEntryService.updateTimeEntry(args.id, input, user.id);
    },

    /**
     * Delete a time entry
     */
    deleteTimeEntry: async (_: any, args: { id: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      await timeEntryService.deleteTimeEntry(args.id, user.id);
      return true;
    },

    /**
     * Quick log time against a task (pre-filled case and task)
     */
    logTimeAgainstTask: async (
      _: any,
      args: { taskId: string; hours: number; description: string; billable?: boolean },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get task to determine caseId
      const task = await prisma.task.findUnique({
        where: { id: args.taskId },
        select: { caseId: true, firmId: true },
      });

      if (!task) {
        throw new GraphQLError('Task not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Verify firm access
      if (task.firmId !== user.firmId) {
        throw new GraphQLError('Not authorized to log time to this task', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Create time entry
      const input = {
        caseId: task.caseId,
        taskId: args.taskId,
        date: new Date().toISOString(), // Today (ISO string)
        hours: args.hours,
        description: args.description,
        billable: args.billable ?? true, // Default to billable
      };

      return await timeEntryService.createTimeEntry(input, user.id);
    },

    /**
     * Get AI-powered time estimation for task planning
     */
    estimateTaskTime: async (_: any, args: { input: any }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Call AI service for time estimation
      const endpoint = '/api/ai/estimate-time';
      const requestBody = {
        ...args.input,
        firmId: user.firmId,
      };

      try {
        const response = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${AI_SERVICE_API_KEY}`,
            'x-service-secret': SERVICE_SECRET,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as { error?: string };
          throw new GraphQLError(errorData.error || 'AI service error', {
            extensions: { code: 'AI_SERVICE_ERROR' },
          });
        }

        const data = (await response.json()) as {
          estimatedHours: number;
          confidence: number;
          reasoning: string;
          basedOnSimilarTasks: number;
          range: { min: number; max: number };
        };

        // Transform response to match GraphQL schema
        return {
          estimatedHours: data.estimatedHours,
          confidence: data.confidence,
          reasoning: data.reasoning,
          basedOnSimilarTasks: data.basedOnSimilarTasks,
          rangeMin: data.range.min,
          rangeMax: data.range.max,
        };
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError('Failed to get time estimation from AI service', {
          extensions: { code: 'AI_SERVICE_ERROR' },
        });
      }
    },
  },

  // Field resolvers for TimeEntry type
  TimeEntry: {
    case: async (parent: any) => {
      return await prisma.case.findUnique({
        where: { id: parent.caseId },
      });
    },
    task: async (parent: any) => {
      if (!parent.taskId) return null;
      return await prisma.task.findUnique({
        where: { id: parent.taskId },
      });
    },
    user: async (parent: any) => {
      return await prisma.user.findUnique({
        where: { id: parent.userId },
      });
    },
    // Computed field: amount = hours * hourlyRate
    amount: (parent: any) => {
      return parseFloat(parent.hours) * parseFloat(parent.hourlyRate);
    },
  },

  // Field resolvers for WeeklySummary (computed fields are handled by service)
  WeeklySummary: {},

  // Field resolvers for DailySummary (computed fields are handled by service)
  DailySummary: {},
};

// Helper function for buildFilterWhere
export { buildFilterWhere };
