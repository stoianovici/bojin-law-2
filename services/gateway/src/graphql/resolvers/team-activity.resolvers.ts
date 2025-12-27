/**
 * Team Activity Resolvers
 * OPS-272: Team Activity View Mode - Query for completed tasks with time entries
 *
 * Provides partner oversight of team work for activity review and timesheet generation.
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';

interface Context {
  user?: {
    id: string;
    role: string;
    firmId: string;
  };
}

interface TeamActivityFilters {
  caseId?: string;
  userIds?: string[];
  periodStart: string;
  periodEnd: string;
}

export const teamActivityResolvers = {
  Query: {
    /**
     * Get team activity for the specified time period.
     * Returns completed tasks with hours logged from time entries.
     */
    teamActivity: async (_: unknown, args: { filters: TeamActivityFilters }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Only Partners and BusinessOwners can view team activity
      if (!['Partner', 'BusinessOwner'].includes(user.role)) {
        throw new GraphQLError('Access denied. Partner or BusinessOwner role required.', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const { filters } = args;
      const periodStart = new Date(filters.periodStart);
      const periodEnd = new Date(filters.periodEnd);

      // Build where clause for completed tasks
      const where: Record<string, unknown> = {
        firmId: user.firmId,
        status: 'Completed',
        completedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      };

      // Optional case filter
      if (filters.caseId) {
        where.caseId = filters.caseId;
      }

      // Optional user filter
      if (filters.userIds && filters.userIds.length > 0) {
        where.assignedTo = { in: filters.userIds };
      }

      // Query completed tasks with time entries
      const tasks = await prisma.task.findMany({
        where,
        include: {
          assignee: true,
          case: true,
          timeEntries: {
            where: {
              date: {
                gte: periodStart,
                lte: periodEnd,
              },
            },
          },
        },
        orderBy: {
          completedAt: 'desc',
        },
      });

      // Build activity entries from tasks
      const entries = tasks.map((task) => {
        // Sum hours from time entries for this task (Decimal -> number conversion)
        const hoursLogged = task.timeEntries.reduce(
          (sum, entry) => sum + parseFloat(entry.hours.toString()),
          0
        );

        return {
          id: task.id,
          task,
          user: task.assignee,
          hoursLogged,
          completedAt: task.completedAt,
        };
      });

      // Calculate totals
      const totalTasks = entries.length;
      const totalHours = entries.reduce((sum, entry) => sum + entry.hoursLogged, 0);

      return {
        entries,
        totalTasks,
        totalHours,
      };
    },
  },

  // Field resolvers for ActivityEntry
  ActivityEntry: {
    task: async (parent: { task: unknown }) => {
      // Task is already included in parent
      return parent.task;
    },
    user: async (parent: { user: unknown }) => {
      // User is already included in parent
      return parent.user;
    },
  },
};
