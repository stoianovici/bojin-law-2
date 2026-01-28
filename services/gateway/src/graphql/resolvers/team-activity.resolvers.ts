/**
 * Team Activity Resolvers
 * OPS-272: Team Activity View Mode - Query for tasks with time entries
 *
 * Provides partner oversight of team work for activity review and timesheet generation.
 * Shows all tasks with time logged in the period (both completed and in-progress).
 */

import { GraphQLError } from 'graphql';
import {
  prisma,
  Task,
  User,
  DocumentStatus,
  TaskStatus,
  TaskTypeEnum,
} from '@legal-platform/database';
import { startOfWeek, endOfWeek, subDays, addDays } from 'date-fns';

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

type AttentionType =
  | 'STUCK_TASK'
  | 'OVERDUE_TASK'
  | 'DRAFT_PENDING_REVIEW'
  | 'COURT_DATE_APPROACHING'
  | 'HEAVY_TASK_APPROACHING'
  | 'OVERBOOKING';
type AttentionSeverity = 'WARNING' | 'CRITICAL';

interface AttentionFlag {
  type: AttentionType;
  message: string;
  severity: AttentionSeverity;
  relatedId?: string;
}

interface TaskStats {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
}

interface TimeProgress {
  completedHours: number;
  inProgressHours: number;
  notStartedHours: number;
  totalHours: number;
}

interface OverviewTask {
  id: string;
  title: string;
  status: TaskStatus;
  estimatedHours: number | null;
  assignee: User | null;
  isStuck: boolean;
  stuckMessage: string | null;
}

interface DocStats {
  total: number;
  drafts: number;
  final: number;
  pendingReview: number;
}

// ============================
// Attention Flag Detection
// ============================

function detectAttentionFlags(
  tasks: Array<Task & { assignee: User }>,
  docs: Array<{ id: string; status: DocumentStatus; createdAt: Date }>,
  allTasksByUser: Map<string, Array<Task>>
): AttentionFlag[] {
  const flags: AttentionFlag[] = [];
  const now = new Date();
  const twoDaysAgo = subDays(now, 2);
  const threeDaysFromNow = addDays(now, 3);
  const sevenDaysFromNow = addDays(now, 7);

  // Check tasks for attention flags
  for (const task of tasks) {
    // STUCK_TASK: status unchanged 2+ days, not completed
    if (task.status !== TaskStatus.Completed && task.status !== TaskStatus.Cancelled) {
      if (task.updatedAt < twoDaysAgo) {
        flags.push({
          type: 'STUCK_TASK',
          message: `"${task.title}" nu a avut actualizări de 2+ zile`,
          severity: 'WARNING',
          relatedId: task.id,
        });
      }
    }

    // OVERDUE_TASK: deadline passed, not completed
    if (task.status !== TaskStatus.Completed && task.status !== TaskStatus.Cancelled) {
      if (task.dueDate && new Date(task.dueDate) < now) {
        const daysOverdue = Math.floor(
          (now.getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        flags.push({
          type: 'OVERDUE_TASK',
          message: `"${task.title}" este întârziat cu ${daysOverdue} zile`,
          severity: daysOverdue > 3 ? 'CRITICAL' : 'WARNING',
          relatedId: task.id,
        });
      }
    }

    // HEAVY_TASK_APPROACHING: task 2h+ estimate due in 3 days
    if (task.status !== TaskStatus.Completed && task.status !== TaskStatus.Cancelled) {
      if (task.estimatedHours && parseFloat(task.estimatedHours.toString()) >= 2) {
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          if (dueDate > now && dueDate <= threeDaysFromNow) {
            flags.push({
              type: 'HEAVY_TASK_APPROACHING',
              message: `"${task.title}" (${task.estimatedHours}h) are termen în curând`,
              severity: 'WARNING',
              relatedId: task.id,
            });
          }
        }
      }
    }

    // OVERBOOKING: user has 8h+ tasks due same day
    if (
      task.status !== TaskStatus.Completed &&
      task.status !== TaskStatus.Cancelled &&
      task.dueDate
    ) {
      const userTasks = allTasksByUser.get(task.assignedTo) || [];
      const sameDayTasks = userTasks.filter(
        (t) =>
          t.dueDate &&
          t.status !== TaskStatus.Completed &&
          t.status !== TaskStatus.Cancelled &&
          new Date(t.dueDate).toDateString() === new Date(task.dueDate!).toDateString()
      );
      const totalHours = sameDayTasks.reduce(
        (sum, t) => sum + (t.estimatedHours ? parseFloat(t.estimatedHours.toString()) : 1),
        0
      );
      const userName = `${task.assignee.firstName} ${task.assignee.lastName}`;
      if (
        totalHours >= 8 &&
        !flags.some((f) => f.type === 'OVERBOOKING' && f.message.includes(userName))
      ) {
        flags.push({
          type: 'OVERBOOKING',
          message: `${userName} are ${totalHours}h sarcinile în ${new Date(task.dueDate).toLocaleDateString('ro-RO')}`,
          severity: 'WARNING',
          relatedId: task.assignedTo,
        });
      }
    }
  }

  // DRAFT_PENDING_REVIEW: doc status=DRAFT, created 2+ days ago
  for (const doc of docs) {
    if (doc.status === DocumentStatus.DRAFT && doc.createdAt < twoDaysAgo) {
      flags.push({
        type: 'DRAFT_PENDING_REVIEW',
        message: 'Document ciornă în așteptare de 2+ zile',
        severity: 'WARNING',
        relatedId: doc.id,
      });
    }
  }

  // COURT_DATE_APPROACHING: court/hearing task in next 7 days
  const courtTasks = tasks.filter(
    (t) =>
      (t.type === TaskTypeEnum.CourtDate || t.type === TaskTypeEnum.Hearing) &&
      t.status !== TaskStatus.Completed &&
      t.status !== TaskStatus.Cancelled &&
      t.dueDate
  );
  for (const courtTask of courtTasks) {
    const dueDate = new Date(courtTask.dueDate!);
    if (dueDate > now && dueDate <= sevenDaysFromNow) {
      const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      flags.push({
        type: 'COURT_DATE_APPROACHING',
        message: `Termen de judecată în ${daysUntil} zile`,
        severity: daysUntil <= 3 ? 'CRITICAL' : 'WARNING',
        relatedId: courtTask.id,
      });
    }
  }

  return flags;
}

export const teamActivityResolvers = {
  Query: {
    /**
     * Get team activity for the specified time period.
     * Returns all tasks with hours logged from time entries (completed and in-progress).
     */
    teamActivity: async (_: unknown, args: { filters: TeamActivityFilters }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // All authenticated users can view team activity

      const { filters } = args;
      const periodStart = new Date(filters.periodStart);
      const periodEnd = new Date(filters.periodEnd);

      // Build where clause - tasks with time entries in the period
      const where: Record<string, unknown> = {
        firmId: user.firmId,
        // Only include tasks that have time entries in the period
        timeEntries: {
          some: {
            date: {
              gte: periodStart,
              lte: periodEnd,
            },
          },
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

      // Query tasks with time entries in the period
      const tasks = await prisma.task.findMany({
        where,
        include: {
          assignee: true,
          case: true,
          client: true,
          timeEntries: {
            where: {
              date: {
                gte: periodStart,
                lte: periodEnd,
              },
            },
            orderBy: {
              date: 'desc',
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      // Build activity entries from tasks
      const entries = tasks.map((task) => {
        // Sum hours from time entries for this task (Decimal -> number conversion)
        const hoursLogged = task.timeEntries.reduce(
          (sum, entry) => sum + parseFloat(entry.hours.toString()),
          0
        );

        // Use most recent time entry date or task update date for sorting
        const mostRecentEntry = task.timeEntries[0];
        const activityDate = mostRecentEntry?.date || task.updatedAt;

        return {
          id: task.id,
          task,
          user: task.assignee,
          hoursLogged,
          completedAt: activityDate, // Using activityDate for grouping purposes
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

    /**
     * Get case progress overview for partners.
     * Shows active cases with task/doc stats and attention indicators.
     * Returns current snapshot (no period filter).
     */
    caseProgress: async (_: unknown, _args: unknown, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const now = new Date();
      const twoDaysAgo = subDays(now, 2);
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      // Find active cases: have IN_PROGRESS tasks OR tasks completed this week
      const activeCases = await prisma.case.findMany({
        where: {
          firmId: user.firmId,
          status: 'Active',
          OR: [
            // Has in-progress tasks
            {
              tasks: {
                some: {
                  status: TaskStatus.InProgress,
                },
              },
            },
            // Has tasks completed this week
            {
              tasks: {
                some: {
                  status: TaskStatus.Completed,
                  completedAt: {
                    gte: weekStart,
                    lte: weekEnd,
                  },
                },
              },
            },
          ],
        },
        include: {
          client: true,
          tasks: {
            include: {
              assignee: true,
            },
            orderBy: [
              { status: 'asc' }, // Completed first, then InProgress, etc.
              { updatedAt: 'desc' },
            ],
          },
          documents: {
            include: {
              document: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      // Build a map of all tasks by user for overbooking detection
      const allTasksByUser = new Map<string, Array<Task>>();
      for (const caseData of activeCases) {
        for (const task of caseData.tasks) {
          const userTasks = allTasksByUser.get(task.assignedTo) || [];
          userTasks.push(task);
          allTasksByUser.set(task.assignedTo, userTasks);
        }
      }

      // Summary statistics
      let totalTasksInProgress = 0;
      let totalCompletedThisWeek = 0;
      let totalDocsInDraft = 0;

      // Build case progress items
      const caseProgressItems = activeCases.map((caseData) => {
        const tasks = caseData.tasks;
        const docs = caseData.documents.map((cd) => cd.document);

        // Count tasks by status
        const completedTasks = tasks.filter((t) => t.status === TaskStatus.Completed);
        const inProgressTasks = tasks.filter((t) => t.status === TaskStatus.InProgress);
        const notStartedTasks = tasks.filter(
          (t) =>
            t.status !== TaskStatus.Completed &&
            t.status !== TaskStatus.InProgress &&
            t.status !== TaskStatus.Cancelled
        );

        // Task stats
        const taskStats: TaskStats = {
          total: tasks.length,
          completed: completedTasks.length,
          inProgress: inProgressTasks.length,
          notStarted: notStartedTasks.length,
          overdue: tasks.filter(
            (t) =>
              t.status !== TaskStatus.Completed &&
              t.status !== TaskStatus.Cancelled &&
              t.dueDate &&
              new Date(t.dueDate) < now
          ).length,
        };

        // Time progress (based on estimated hours)
        const getHours = (taskList: typeof tasks) =>
          taskList.reduce(
            (sum, t) => sum + (t.estimatedHours ? parseFloat(t.estimatedHours.toString()) : 1),
            0
          );

        const timeProgress: TimeProgress = {
          completedHours: getHours(completedTasks),
          inProgressHours: getHours(inProgressTasks),
          notStartedHours: getHours(notStartedTasks),
          totalHours: getHours(tasks.filter((t) => t.status !== TaskStatus.Cancelled)),
        };

        // Build overview tasks (limit to relevant ones: in-progress + recently completed)
        const overviewTasks: OverviewTask[] = [];

        // Add in-progress tasks first (with stuck detection)
        for (const task of inProgressTasks) {
          const isStuck = task.updatedAt < twoDaysAgo;
          overviewTasks.push({
            id: task.id,
            title: task.title,
            status: task.status,
            estimatedHours: task.estimatedHours ? parseFloat(task.estimatedHours.toString()) : null,
            assignee: task.assignee,
            isStuck,
            stuckMessage: isStuck
              ? `${Math.floor((now.getTime() - task.updatedAt.getTime()) / (1000 * 60 * 60 * 24))}+ zile fără update`
              : null,
          });
        }

        // Add completed tasks from this week
        const recentlyCompleted = completedTasks.filter(
          (t) => t.completedAt && t.completedAt >= weekStart && t.completedAt <= weekEnd
        );
        for (const task of recentlyCompleted.slice(0, 5)) {
          // Limit to 5 recent
          overviewTasks.push({
            id: task.id,
            title: task.title,
            status: task.status,
            estimatedHours: task.estimatedHours ? parseFloat(task.estimatedHours.toString()) : null,
            assignee: task.assignee,
            isStuck: false,
            stuckMessage: null,
          });
        }

        // Add not-started tasks (limit to 3)
        for (const task of notStartedTasks.slice(0, 3)) {
          overviewTasks.push({
            id: task.id,
            title: task.title,
            status: task.status,
            estimatedHours: task.estimatedHours ? parseFloat(task.estimatedHours.toString()) : null,
            assignee: task.assignee,
            isStuck: false,
            stuckMessage: null,
          });
        }

        // Doc stats
        const docStats: DocStats = {
          total: docs.length,
          drafts: docs.filter((d) => d.status === DocumentStatus.DRAFT).length,
          final: docs.filter((d) => d.status === DocumentStatus.FINAL).length,
          pendingReview: docs.filter((d) => d.status === DocumentStatus.READY_FOR_REVIEW).length,
        };

        // Unique assigned users
        const assignedUserMap = new Map<string, User>();
        for (const task of tasks) {
          if (task.assignee && !assignedUserMap.has(task.assignee.id)) {
            assignedUserMap.set(task.assignee.id, task.assignee);
          }
        }
        const assignedUsers = Array.from(assignedUserMap.values());

        // Last activity timestamp
        const taskDates = tasks.map((t) => t.updatedAt);
        const docDates = docs.map((d) => d.updatedAt);
        const allDates = [...taskDates, ...docDates].filter(Boolean);
        const lastActivity =
          allDates.length > 0 ? new Date(Math.max(...allDates.map((d) => d.getTime()))) : null;

        // Attention flags
        const attentionFlags = detectAttentionFlags(
          tasks as Array<Task & { assignee: User }>,
          docs.map((d) => ({ id: d.id, status: d.status, createdAt: d.createdAt })),
          allTasksByUser
        );

        // Update summary totals
        totalTasksInProgress += taskStats.inProgress;
        totalCompletedThisWeek += recentlyCompleted.length;
        totalDocsInDraft += docStats.drafts;

        return {
          case: caseData,
          taskStats,
          timeProgress,
          docStats,
          assignedUsers,
          lastActivity,
          attentionFlags,
          tasks: overviewTasks,
        };
      });

      // Sort by attention flags (most issues first), then by last activity
      caseProgressItems.sort((a, b) => {
        const aHasCritical = a.attentionFlags.some((f) => f.severity === 'CRITICAL');
        const bHasCritical = b.attentionFlags.some((f) => f.severity === 'CRITICAL');
        if (aHasCritical && !bHasCritical) return -1;
        if (!aHasCritical && bHasCritical) return 1;

        const aFlagCount = a.attentionFlags.length;
        const bFlagCount = b.attentionFlags.length;
        if (aFlagCount !== bFlagCount) return bFlagCount - aFlagCount;

        // Then by last activity (most recent first)
        const aTime = a.lastActivity?.getTime() || 0;
        const bTime = b.lastActivity?.getTime() || 0;
        return bTime - aTime;
      });

      return {
        cases: caseProgressItems,
        summary: {
          activeCases: activeCases.length,
          tasksInProgress: totalTasksInProgress,
          completedThisWeek: totalCompletedThisWeek,
          docsInDraft: totalDocsInDraft,
        },
      };
    },

    /**
     * Get client-level progress (tasks/docs not assigned to any case).
     * Used when selecting a client in the team activity sidebar.
     */
    clientProgress: async (_: unknown, args: { clientId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { clientId } = args;
      const now = new Date();
      const twoDaysAgo = subDays(now, 2);
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      // Get the client
      const client = await prisma.client.findFirst({
        where: {
          id: clientId,
          firmId: user.firmId,
        },
      });

      if (!client) {
        return null;
      }

      // Get tasks assigned to this client but NOT to any case
      const tasks = await prisma.task.findMany({
        where: {
          firmId: user.firmId,
          clientId: clientId,
          caseId: null, // Only client-level tasks
          status: {
            notIn: [TaskStatus.Cancelled],
          },
        },
        include: {
          assignee: true,
        },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      });

      // Get documents in client inbox (not assigned to any case)
      const clientDocuments = await prisma.document.findMany({
        where: {
          firmId: user.firmId,
          clientId: clientId,
          caseLinks: {
            none: {}, // Not linked to any case
          },
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Build map for overbooking detection
      const allTasksByUser = new Map<string, Array<Task>>();
      for (const task of tasks) {
        if (task.assignedTo) {
          const userTasks = allTasksByUser.get(task.assignedTo) || [];
          userTasks.push(task);
          allTasksByUser.set(task.assignedTo, userTasks);
        }
      }

      // Count tasks by status
      const completedTasks = tasks.filter((t) => t.status === TaskStatus.Completed);
      const inProgressTasks = tasks.filter((t) => t.status === TaskStatus.InProgress);
      const notStartedTasks = tasks.filter(
        (t) =>
          t.status !== TaskStatus.Completed &&
          t.status !== TaskStatus.InProgress &&
          t.status !== TaskStatus.Cancelled
      );

      // Task stats
      const taskStats: TaskStats = {
        total: tasks.length,
        completed: completedTasks.length,
        inProgress: inProgressTasks.length,
        notStarted: notStartedTasks.length,
        overdue: tasks.filter(
          (t) =>
            t.status !== TaskStatus.Completed &&
            t.status !== TaskStatus.Cancelled &&
            t.dueDate &&
            new Date(t.dueDate) < now
        ).length,
      };

      // Time progress (based on estimated hours)
      const getHours = (taskList: typeof tasks) =>
        taskList.reduce(
          (sum, t) => sum + (t.estimatedHours ? parseFloat(t.estimatedHours.toString()) : 1),
          0
        );

      const timeProgress: TimeProgress = {
        completedHours: getHours(completedTasks),
        inProgressHours: getHours(inProgressTasks),
        notStartedHours: getHours(notStartedTasks),
        totalHours: getHours(tasks),
      };

      // Build overview tasks
      const overviewTasks: OverviewTask[] = [];

      // Add in-progress tasks first
      for (const task of inProgressTasks) {
        const isStuck = task.updatedAt < twoDaysAgo;
        overviewTasks.push({
          id: task.id,
          title: task.title,
          status: task.status,
          estimatedHours: task.estimatedHours ? parseFloat(task.estimatedHours.toString()) : null,
          assignee: task.assignee,
          isStuck,
          stuckMessage: isStuck
            ? `${Math.floor((now.getTime() - task.updatedAt.getTime()) / (1000 * 60 * 60 * 24))}+ zile fără update`
            : null,
        });
      }

      // Add recently completed tasks
      const recentlyCompleted = completedTasks.filter(
        (t) => t.completedAt && t.completedAt >= weekStart && t.completedAt <= weekEnd
      );
      for (const task of recentlyCompleted.slice(0, 5)) {
        overviewTasks.push({
          id: task.id,
          title: task.title,
          status: task.status,
          estimatedHours: task.estimatedHours ? parseFloat(task.estimatedHours.toString()) : null,
          assignee: task.assignee,
          isStuck: false,
          stuckMessage: null,
        });
      }

      // Add not-started tasks
      for (const task of notStartedTasks.slice(0, 3)) {
        overviewTasks.push({
          id: task.id,
          title: task.title,
          status: task.status,
          estimatedHours: task.estimatedHours ? parseFloat(task.estimatedHours.toString()) : null,
          assignee: task.assignee,
          isStuck: false,
          stuckMessage: null,
        });
      }

      // Doc stats
      const docStats: DocStats = {
        total: clientDocuments.length,
        drafts: clientDocuments.filter((d) => d.status === DocumentStatus.DRAFT).length,
        final: clientDocuments.filter((d) => d.status === DocumentStatus.FINAL).length,
        pendingReview: clientDocuments.filter((d) => d.status === DocumentStatus.READY_FOR_REVIEW)
          .length,
      };

      // Unique assigned users
      const assignedUserMap = new Map<string, User>();
      for (const task of tasks) {
        if (task.assignee && !assignedUserMap.has(task.assignee.id)) {
          assignedUserMap.set(task.assignee.id, task.assignee);
        }
      }
      const assignedUsers = Array.from(assignedUserMap.values());

      // Last activity timestamp
      const taskDates = tasks.map((t) => t.updatedAt);
      const docDates = clientDocuments.map((d) => d.updatedAt);
      const allDates = [...taskDates, ...docDates].filter(Boolean);
      const lastActivity =
        allDates.length > 0 ? new Date(Math.max(...allDates.map((d) => d.getTime()))) : null;

      // Attention flags
      const attentionFlags = detectAttentionFlags(
        tasks as Array<Task & { assignee: User }>,
        clientDocuments.map((d) => ({ id: d.id, status: d.status, createdAt: d.createdAt })),
        allTasksByUser
      );

      return {
        client,
        taskStats,
        timeProgress,
        docStats,
        assignedUsers,
        lastActivity,
        attentionFlags,
        tasks: overviewTasks,
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

  // Field resolvers for CaseProgressItem
  CaseProgressItem: {
    case: (parent: { case: unknown }) => parent.case,
    taskStats: (parent: { taskStats: TaskStats }) => parent.taskStats,
    timeProgress: (parent: { timeProgress: TimeProgress }) => parent.timeProgress,
    docStats: (parent: { docStats: DocStats }) => parent.docStats,
    assignedUsers: (parent: { assignedUsers: User[] }) => parent.assignedUsers,
    lastActivity: (parent: { lastActivity: Date | null }) => parent.lastActivity,
    attentionFlags: (parent: { attentionFlags: AttentionFlag[] }) => parent.attentionFlags,
    tasks: (parent: { tasks: OverviewTask[] }) => parent.tasks,
  },

  // Field resolvers for OverviewTask
  OverviewTask: {
    id: (parent: OverviewTask) => parent.id,
    title: (parent: OverviewTask) => parent.title,
    status: (parent: OverviewTask) => parent.status,
    estimatedHours: (parent: OverviewTask) => parent.estimatedHours,
    assignee: (parent: OverviewTask) => parent.assignee,
    isStuck: (parent: OverviewTask) => parent.isStuck,
    stuckMessage: (parent: OverviewTask) => parent.stuckMessage,
  },

  // Field resolvers for ClientProgressItem
  ClientProgressItem: {
    client: (parent: { client: unknown }) => parent.client,
    taskStats: (parent: { taskStats: TaskStats }) => parent.taskStats,
    timeProgress: (parent: { timeProgress: TimeProgress }) => parent.timeProgress,
    docStats: (parent: { docStats: DocStats }) => parent.docStats,
    assignedUsers: (parent: { assignedUsers: User[] }) => parent.assignedUsers,
    lastActivity: (parent: { lastActivity: Date | null }) => parent.lastActivity,
    attentionFlags: (parent: { attentionFlags: AttentionFlag[] }) => parent.attentionFlags,
    tasks: (parent: { tasks: OverviewTask[] }) => parent.tasks,
  },
};
