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

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:4003';
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
     * Get summary of all unbilled time entries grouped by client.
     * Used for billing overview to see total unbilled work.
     * Supports both case-based entries and direct-client entries (no case).
     */
    unbilledSummaryByClient: async (_: any, _args: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get all time entries - both via case.client and direct client
      // Filter out already invoiced entries and non-billable entries
      const entries = await prisma.timeEntry.findMany({
        where: {
          firmId: user.firmId,
          // Only include billable entries
          billable: true,
          // Exclude time entries that are already on a non-cancelled invoice
          invoiceLineItems: {
            none: {
              invoice: {
                status: { not: 'Cancelled' },
              },
            },
          },
          // Include entries via case.client OR direct client (no case)
          OR: [
            { caseId: { not: null } }, // Case-based entries (case has client)
            { caseId: null, clientId: { not: null } }, // Direct-client entries
          ],
        },
        include: {
          case: {
            select: {
              id: true,
              caseNumber: true,
              title: true,
              client: {
                select: {
                  id: true,
                  name: true,
                  clientType: true,
                },
              },
            },
          },
          client: {
            select: {
              id: true,
              name: true,
              clientType: true,
            },
          },
        },
        orderBy: { date: 'asc' },
      });

      // Group by client
      const clientMap = new Map<
        string,
        {
          clientId: string;
          clientName: string;
          clientType: string | null;
          totalHours: number;
          totalAmount: number;
          entryCount: number;
          oldestEntryDate: string | null;
          caseMap: Map<
            string,
            {
              caseId: string;
              caseNumber: string;
              caseTitle: string;
              totalHours: number;
              totalAmount: number;
              entryCount: number;
            }
          >;
        }
      >();

      // Special key for "no case" entries
      const NO_CASE_KEY = '__no_case__';

      for (const entry of entries) {
        // Get client from case or direct client relation
        const client = entry.case?.client || entry.client;
        if (!client) continue; // Skip entries without client (shouldn't happen with our query)

        const hours = parseFloat(entry.hours.toString());
        const amount = hours * parseFloat(entry.hourlyRate.toString());
        const entryDate = entry.date.toISOString().split('T')[0];

        if (!clientMap.has(client.id)) {
          clientMap.set(client.id, {
            clientId: client.id,
            clientName: client.name,
            clientType: client.clientType,
            totalHours: 0,
            totalAmount: 0,
            entryCount: 0,
            oldestEntryDate: null,
            caseMap: new Map(),
          });
        }

        const clientSummary = clientMap.get(client.id)!;
        clientSummary.totalHours += hours;
        clientSummary.totalAmount += amount;
        clientSummary.entryCount += 1;

        // Track oldest entry date
        if (!clientSummary.oldestEntryDate || entryDate < clientSummary.oldestEntryDate) {
          clientSummary.oldestEntryDate = entryDate;
        }

        // Group by case within client (or "no case" for direct-client entries)
        const caseKey = entry.case?.id || NO_CASE_KEY;
        const caseNumber = entry.case?.caseNumber || '';
        const caseTitle = entry.case?.title || 'Fără dosar';

        if (!clientSummary.caseMap.has(caseKey)) {
          clientSummary.caseMap.set(caseKey, {
            caseId: caseKey === NO_CASE_KEY ? '' : caseKey,
            caseNumber: caseNumber,
            caseTitle: caseTitle,
            totalHours: 0,
            totalAmount: 0,
            entryCount: 0,
          });
        }

        const caseSummary = clientSummary.caseMap.get(caseKey)!;
        caseSummary.totalHours += hours;
        caseSummary.totalAmount += amount;
        caseSummary.entryCount += 1;
      }

      // Convert to array and sort by total amount descending
      return Array.from(clientMap.values())
        .map((client) => ({
          ...client,
          cases: Array.from(client.caseMap.values()).sort((a, b) => b.totalAmount - a.totalAmount),
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount);
    },

    /**
     * Get billable time entries for a client, optionally filtered by case.
     * Used for invoice creation to show unbilled work.
     * Supports both case-based entries and direct-client entries (no case).
     */
    billableTimeEntries: async (
      _: any,
      args: { clientId: string; caseId?: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Build where clause - support both case.clientId and direct clientId
      // Only include billable entries (non-billable are permanently excluded from invoicing)
      const whereClause: any = {
        firmId: user.firmId,
        billable: true,
      };

      // Filter by specific case if provided
      if (args.caseId) {
        whereClause.caseId = args.caseId;
      } else {
        // Include entries via case.client OR direct client (no case)
        whereClause.OR = [
          { case: { clientId: args.clientId } }, // Case-based entries
          { caseId: null, clientId: args.clientId }, // Direct-client entries
        ];
      }

      const entries = await prisma.timeEntry.findMany({
        where: whereClause,
        orderBy: { date: 'desc' },
        include: {
          case: {
            select: {
              id: true,
              caseNumber: true,
              title: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
            },
          },
          invoiceLineItems: {
            where: {
              invoice: {
                status: { not: 'Cancelled' },
              },
            },
            select: { id: true },
            take: 1,
          },
        },
      });

      // Map to BillableTimeEntry shape
      return entries.map((entry) => ({
        id: entry.id,
        description: entry.description,
        hours: parseFloat(entry.hours.toString()),
        rateEur: parseFloat(entry.hourlyRate.toString()),
        date: entry.date.toISOString().split('T')[0], // YYYY-MM-DD format
        invoiced: entry.invoiceLineItems && entry.invoiceLineItems.length > 0,
        case: entry.case,
        user: entry.user,
        task: entry.task,
      }));
    },

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

    /**
     * OPS-273: Get timesheet entries for a case within a date range
     * Returns time entries with case context for timesheet mode UI
     */
    timesheetEntries: async (
      _: any,
      args: {
        caseId: string;
        startDate: string;
        endDate: string;
        teamMemberIds?: string[];
      },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // All authenticated users can view timesheets

      // Fetch the case first to verify access and get billing info
      const caseData = await prisma.case.findFirst({
        where: {
          id: args.caseId,
          firmId: user.firmId,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!caseData) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Build where clause for time entries
      const whereClause: any = {
        caseId: args.caseId,
        firmId: user.firmId,
        date: {
          gte: new Date(args.startDate),
          lte: new Date(args.endDate),
        },
      };

      // Filter by team members if specified
      if (args.teamMemberIds && args.teamMemberIds.length > 0) {
        whereClause.userId = {
          in: args.teamMemberIds,
        };
      }

      // Fetch time entries
      const entries = await prisma.timeEntry.findMany({
        where: whereClause,
        orderBy: {
          date: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      // Calculate totals
      let totalHours = 0;
      let totalBillableHours = 0;
      let totalCost = 0;
      let totalBillableCost = 0;

      const mappedEntries = entries.map((entry) => {
        const hours = parseFloat(entry.hours.toString());
        const hourlyRate = parseFloat(entry.hourlyRate.toString());
        const amount = hours * hourlyRate;

        totalHours += hours;
        totalCost += amount;

        if (entry.billable) {
          totalBillableHours += hours;
          totalBillableCost += amount;
        }

        return {
          id: entry.id,
          date: entry.date,
          description: entry.description,
          narrative: entry.narrative,
          hours,
          hourlyRate,
          amount,
          billable: entry.billable,
          user: entry.user,
          task: entry.task,
        };
      });

      // Extract partner hourly rate from customRates if available
      // customRates: { partnerRate?: number, associateRate?: number, paralegalRate?: number }
      let defaultHourlyRate: number | null = null;
      if (caseData.customRates && typeof caseData.customRates === 'object') {
        const rates = caseData.customRates as { partnerRate?: number; associateRate?: number };
        // Use partner rate as the default display rate
        defaultHourlyRate = rates.partnerRate ?? rates.associateRate ?? null;
      }

      return {
        entries: mappedEntries,
        case: {
          id: caseData.id,
          title: caseData.title,
          caseNumber: caseData.caseNumber,
          billingType: caseData.billingType,
          hourlyRate: defaultHourlyRate,
          client: caseData.client,
        },
        totalHours,
        totalBillableHours,
        totalCost,
        totalBillableCost,
      };
    },

    /**
     * Flexible timesheet query supporting all entry types:
     * - Case entries (caseId not null)
     * - Client-only entries (clientId not null, caseId null)
     * - Internal entries (both caseId and clientId null)
     */
    myTimesheetEntries: async (
      _: any,
      args: {
        startDate: string;
        endDate: string;
        entryType?: 'CASE' | 'CLIENT' | 'INTERNAL' | 'ALL';
        caseId?: string;
        clientId?: string;
        teamMemberIds?: string[];
      },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // All authenticated users can view timesheets

      // Build where clause
      const where: any = {
        firmId: user.firmId,
        date: {
          gte: new Date(args.startDate),
          lte: new Date(args.endDate),
        },
      };

      // Filter by entry type
      const entryType = args.entryType || 'ALL';
      switch (entryType) {
        case 'CASE':
          where.caseId = { not: null };
          if (args.caseId) where.caseId = args.caseId;
          break;
        case 'CLIENT':
          where.caseId = null;
          where.clientId = { not: null };
          if (args.clientId) where.clientId = args.clientId;
          break;
        case 'INTERNAL':
          where.caseId = null;
          where.clientId = null;
          break;
        // 'ALL' - no additional type filters
      }

      // Filter by team members if specified
      if (args.teamMemberIds && args.teamMemberIds.length > 0) {
        where.userId = { in: args.teamMemberIds };
      }

      // Fetch time entries
      const entries = await prisma.timeEntry.findMany({
        where,
        orderBy: { date: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
            },
          },
          case: {
            select: {
              id: true,
              caseNumber: true,
              title: true,
              client: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Calculate totals
      let totalHours = 0;
      let totalBillableHours = 0;
      let totalCost = 0;
      let totalBillableCost = 0;

      const mappedEntries = entries.map((entry) => {
        const hours = parseFloat(entry.hours.toString());
        const hourlyRate = parseFloat(entry.hourlyRate.toString());
        const amount = hours * hourlyRate;

        totalHours += hours;
        totalCost += amount;

        if (entry.billable) {
          totalBillableHours += hours;
          totalBillableCost += amount;
        }

        // Determine the client - either from case or direct
        const client = entry.case?.client || entry.client;

        return {
          id: entry.id,
          date: entry.date,
          description: entry.description,
          narrative: entry.narrative,
          hours,
          hourlyRate,
          amount,
          billable: entry.billable,
          user: entry.user,
          task: entry.task,
          case: entry.case,
          client: client,
        };
      });

      return {
        entries: mappedEntries,
        totalHours,
        totalBillableHours,
        totalCost,
        totalBillableCost,
      };
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
     * Quick log time against a task (pre-filled case/client and task)
     * Supports: case tasks, client-only tasks, and internal tasks
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

      // Get task to determine caseId and clientId
      const task = await prisma.task.findUnique({
        where: { id: args.taskId },
        select: { caseId: true, clientId: true, firmId: true },
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

      // Determine if this is billable based on whether it has a case/client
      // Internal tasks (no case, no client) are not billable by default
      const hasCaseOrClient = task.caseId || task.clientId;
      const defaultBillable = hasCaseOrClient ? true : false;

      // Create time entry
      const input = {
        caseId: task.caseId || undefined,
        clientId: task.clientId || undefined,
        taskId: args.taskId,
        date: new Date().toISOString(), // Today (ISO string)
        hours: args.hours,
        description: args.description,
        billable: args.billable ?? defaultBillable,
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

    /**
     * Mark multiple time entries as non-billable.
     * Used when user excludes entries from invoice - they won't appear in future billing.
     * Returns the count of entries updated.
     */
    markTimeEntriesNonBillable: async (_: any, args: { ids: string[] }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (!args.ids || args.ids.length === 0) {
        return 0;
      }

      // Update time entries belonging to user's firm
      const result = await prisma.timeEntry.updateMany({
        where: {
          id: { in: args.ids },
          firmId: user.firmId,
        },
        data: {
          billable: false,
        },
      });

      return result.count;
    },
  },

  // Field resolvers for TimeEntry type
  TimeEntry: {
    case: async (parent: any) => {
      if (!parent.caseId) return null;
      return await prisma.case.findUnique({
        where: { id: parent.caseId },
      });
    },
    client: async (parent: any) => {
      if (!parent.clientId) return null;
      return await prisma.client.findUnique({
        where: { id: parent.clientId },
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

  // Enum resolver: maps internal lowercase values to GraphQL uppercase enum values
  TrendIndicator: {
    UP: 'up',
    STABLE: 'stable',
    DOWN: 'down',
  },
};

// Helper function for buildFilterWhere
export { buildFilterWhere };
