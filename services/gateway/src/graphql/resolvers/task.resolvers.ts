/**
 * Task Resolvers
 * Story 4.2: Task Type System Implementation
 *
 * GraphQL resolvers for task management with type-specific workflows
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import { TaskService } from '../../services/task.service';
import { CourtDateSubtaskService } from '../../services/court-date-subtask.service';
import { MeetingAttendeeService } from '../../services/meeting-attendee.service';
import { ResearchDocumentService } from '../../services/research-document.service';
import { DelegationService } from '../../services/delegation.service';
import { TaskDependencyService } from '../../services/task-dependency.service';
import {
  TaskTypeEnum,
  TaskStatus,
  TaskPriority,
  AttendeeResponse,
  TaskDocumentLinkType,
} from '@prisma/client';

interface Context {
  user: {
    id: string;
    role: string;
    firmId: string;
  };
}

// Initialize services
const taskService = new TaskService();
const courtDateService = new CourtDateSubtaskService();
const attendeeService = new MeetingAttendeeService();
const documentService = new ResearchDocumentService();
const delegationService = new DelegationService();
const dependencyService = new TaskDependencyService();

export const taskResolvers = {
  Query: {
    /**
     * Get a single task by ID
     */
    task: async (_: any, args: { id: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const task = await taskService.getTaskById(args.id, user.firmId);

      if (!task) {
        throw new GraphQLError('Task not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return task;
    },

    /**
     * Get tasks with optional filters
     */
    tasks: async (
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

      // Get all tasks for firm with filters
      return await prisma.task.findMany({
        where: {
          firmId: user.firmId,
          ...buildFilterWhere(args.filters),
        },
        take: args.limit || 100,
        skip: args.offset || 0,
        include: {
          assignee: true,
          creator: true,
          case: true,
          subtasks: true,
        },
        orderBy: {
          dueDate: 'asc',
        },
      });
    },

    /**
     * Get tasks for a specific case
     */
    tasksByCase: async (
      _: any,
      args: { caseId: string; filters?: any },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await taskService.getTasksByCase(
        args.caseId,
        user.firmId,
        args.filters
      );
    },

    /**
     * Get current user's tasks
     */
    myTasks: async (_: any, args: { filters?: any }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await taskService.getTasksByAssignee(
        user.id,
        user.firmId,
        args.filters
      );
    },

    /**
     * Get delegations created by current user
     */
    myDelegations: async (_: any, __: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await delegationService.getDelegationsForUser(user.id);
    },

    /**
     * Get delegation requests sent to current user
     */
    delegationsToMe: async (_: any, __: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await delegationService.getDelegationsToUser(user.id);
    },
  },

  Mutation: {
    /**
     * Create a new task
     * Auto-generates subtasks for CourtDate tasks
     */
    createTask: async (_: any, args: { input: any }, context: Context) => {
      const { user } = context;
      const { input } = args;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Create task
      const task = await taskService.createTask(input, user.id);

      // Auto-generate subtasks for CourtDate tasks
      if (task.type === TaskTypeEnum.CourtDate) {
        await courtDateService.generatePreparationSubtasks(task);
      }

      return task;
    },

    /**
     * Update an existing task
     */
    updateTask: async (
      _: any,
      args: { id: string; input: any },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await taskService.updateTask(args.id, args.input, user.id);
    },

    /**
     * Complete a task
     */
    completeTask: async (_: any, args: { id: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await taskService.completeTask(args.id, user.id);
    },

    /**
     * Cancel a task with optional reason
     */
    cancelTask: async (
      _: any,
      args: { id: string; reason?: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await taskService.cancelTask(args.id, user.id, args.reason);
    },

    /**
     * Delete a task
     */
    deleteTask: async (_: any, args: { id: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await taskService.deleteTask(args.id, user.id);
    },

    // Meeting Attendee Mutations

    /**
     * Add attendee to Meeting task
     */
    addTaskAttendee: async (
      _: any,
      args: { taskId: string; input: any },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await attendeeService.addAttendee(
        args.taskId,
        args.input,
        user.firmId
      );
    },

    /**
     * Remove attendee from Meeting task
     */
    removeTaskAttendee: async (
      _: any,
      args: { taskId: string; attendeeId: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      await attendeeService.removeAttendee(
        args.taskId,
        args.attendeeId,
        user.firmId
      );

      return true;
    },

    /**
     * Update attendee response status
     */
    updateAttendeeResponse: async (
      _: any,
      args: { attendeeId: string; response: AttendeeResponse },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await attendeeService.updateAttendeeResponse(
        args.attendeeId,
        args.response
      );
    },

    // Research Document Linking Mutations

    /**
     * Link document to Research task
     */
    linkDocumentToTask: async (
      _: any,
      args: { taskId: string; input: any },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await documentService.linkDocument(
        args.taskId,
        args.input.documentId,
        args.input.linkType as TaskDocumentLinkType,
        user.id,
        args.input.notes
      );
    },

    /**
     * Unlink document from Research task
     */
    unlinkDocumentFromTask: async (
      _: any,
      args: { taskId: string; documentId: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      await documentService.unlinkDocument(
        args.taskId,
        args.documentId,
        user.firmId
      );

      return true;
    },

    // Delegation Mutations

    /**
     * Create delegation for Business Trip task
     */
    createDelegation: async (
      _: any,
      args: { sourceTaskId: string; input: any },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await delegationService.createDelegation(
        args.sourceTaskId,
        args.input,
        user.id
      );
    },

    /**
     * Accept delegation request
     */
    acceptDelegation: async (
      _: any,
      args: { delegationId: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await delegationService.acceptDelegation(args.delegationId, user.id);
    },

    /**
     * Decline delegation request
     */
    declineDelegation: async (
      _: any,
      args: { delegationId: string; reason?: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await delegationService.declineDelegation(
        args.delegationId,
        user.id,
        args.reason
      );
    },
  },

  // Field resolvers for Task type
  Task: {
    case: async (parent: any) => {
      return await prisma.case.findUnique({
        where: { id: parent.caseId },
      });
    },
    assignee: async (parent: any) => {
      return await prisma.user.findUnique({
        where: { id: parent.assignedTo },
      });
    },
    creator: async (parent: any) => {
      return await prisma.user.findUnique({
        where: { id: parent.createdBy },
      });
    },
    parentTask: async (parent: any) => {
      if (!parent.parentTaskId) return null;
      return await prisma.task.findUnique({
        where: { id: parent.parentTaskId },
      });
    },
    subtasks: async (parent: any) => {
      return await prisma.task.findMany({
        where: { parentTaskId: parent.id },
        orderBy: { dueDate: 'asc' },
      });
    },
    attendees: async (parent: any) => {
      return await prisma.taskAttendee.findMany({
        where: { taskId: parent.id },
      });
    },
    linkedDocuments: async (parent: any) => {
      return await prisma.taskDocumentLink.findMany({
        where: { taskId: parent.id },
      });
    },
    delegations: async (parent: any) => {
      return await prisma.taskDelegation.findMany({
        where: { sourceTaskId: parent.id },
      });
    },
    // Story 4.4: Task Dependencies and Automation - Dependency field resolvers
    predecessors: async (parent: any) => {
      return await prisma.taskDependency.findMany({
        where: { successorId: parent.id },
      });
    },
    successors: async (parent: any) => {
      return await prisma.taskDependency.findMany({
        where: { predecessorId: parent.id },
      });
    },
    isCriticalPath: async (parent: any) => {
      // Return value from database field
      return parent.isCriticalPath || false;
    },
    isBlocked: async (parent: any) => {
      // A task is blocked if it has incomplete predecessors
      const predecessors = await prisma.taskDependency.findMany({
        where: { successorId: parent.id },
        include: { predecessor: true },
      });

      return predecessors.some((dep) => dep.predecessor.status !== 'Completed');
    },
    blockedReason: async (parent: any) => {
      // Return blocking reason if set, or compute from predecessors
      if (parent.blockedReason) {
        return parent.blockedReason;
      }

      const predecessors = await prisma.taskDependency.findMany({
        where: { successorId: parent.id },
        include: { predecessor: true },
      });

      const incompletePredecessors = predecessors.filter(
        (dep) => dep.predecessor.status !== 'Completed'
      );

      if (incompletePredecessors.length === 0) {
        return null;
      }

      const titles = incompletePredecessors
        .map((dep) => dep.predecessor.title)
        .join(', ');
      return `Blocked by incomplete task(s): ${titles}`;
    },
  },

  // Field resolvers for TaskAttendee
  TaskAttendee: {
    user: async (parent: any) => {
      if (!parent.userId) return null;
      return await prisma.user.findUnique({
        where: { id: parent.userId },
      });
    },
  },

  // Field resolvers for TaskDocumentLink
  TaskDocumentLink: {
    document: async (parent: any) => {
      return await prisma.document.findUnique({
        where: { id: parent.documentId },
      });
    },
    linkedBy: async (parent: any) => {
      return await prisma.user.findUnique({
        where: { id: parent.linkedBy },
      });
    },
  },

  // Field resolvers for TaskDelegation
  TaskDelegation: {
    sourceTask: async (parent: any) => {
      return await prisma.task.findUnique({
        where: { id: parent.sourceTaskId },
      });
    },
    delegatedTask: async (parent: any) => {
      if (!parent.delegatedTaskId) return null;
      return await prisma.task.findUnique({
        where: { id: parent.delegatedTaskId },
      });
    },
    delegate: async (parent: any) => {
      return await prisma.user.findUnique({
        where: { id: parent.delegatedTo },
      });
    },
    delegator: async (parent: any) => {
      return await prisma.user.findUnique({
        where: { id: parent.delegatedBy },
      });
    },
  },
};

/**
 * Build Prisma where clause from GraphQL filters
 */
function buildFilterWhere(filters?: any): Record<string, unknown> {
  if (!filters) return {};

  const where: Record<string, unknown> = {};

  if (filters.types && filters.types.length > 0) {
    where.type = { in: filters.types };
  }

  if (filters.statuses && filters.statuses.length > 0) {
    where.status = { in: filters.statuses };
  }

  if (filters.priorities && filters.priorities.length > 0) {
    where.priority = { in: filters.priorities };
  }

  if (filters.assignedTo && filters.assignedTo.length > 0) {
    where.assignedTo = { in: filters.assignedTo };
  }

  if (filters.caseId) {
    where.caseId = filters.caseId;
  }

  if (filters.dueDateFrom || filters.dueDateTo) {
    where.dueDate = {};
    if (filters.dueDateFrom) {
      (where.dueDate as Record<string, unknown>).gte = new Date(
        filters.dueDateFrom
      );
    }
    if (filters.dueDateTo) {
      (where.dueDate as Record<string, unknown>).lte = new Date(filters.dueDateTo);
    }
  }

  if (filters.searchQuery) {
    where.OR = [
      { title: { contains: filters.searchQuery, mode: 'insensitive' } },
      { description: { contains: filters.searchQuery, mode: 'insensitive' } },
    ];
  }

  return where;
}
