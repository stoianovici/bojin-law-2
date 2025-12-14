// @ts-nocheck
/**
 * Task Dependency Resolvers
 * Story 4.4: Task Dependencies and Automation
 *
 * GraphQL resolvers for task dependency management, critical path, and cascade operations
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import { TaskDependencyService } from '../../services/task-dependency.service';
import { DeadlineCascadeService } from '../../services/deadline-cascade.service';
import { CriticalPathService } from '../../services/critical-path.service';
import { ParallelTaskService } from '../../services/parallel-task.service';
import { DependencyType } from '@prisma/client';

interface Context {
  user: {
    id: string;
    role: string;
    firmId: string;
  };
}

// Initialize services
const dependencyService = new TaskDependencyService();
const cascadeService = new DeadlineCascadeService();
const criticalPathService = new CriticalPathService();
const parallelTaskService = new ParallelTaskService();

export const taskDependencyResolvers = {
  Query: {
    /**
     * Get all dependencies for a task
     */
    taskDependencies: async (_: any, args: { taskId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { predecessors, successors } = await dependencyService.getDependencies(args.taskId);
      return [...predecessors, ...successors];
    },

    /**
     * Get all blocked tasks for a case
     */
    blockedTasks: async (_: any, args: { caseId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await dependencyService.getBlockedTasks(args.caseId);
    },

    /**
     * Calculate critical path for a case
     */
    criticalPath: async (_: any, args: { caseId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await criticalPathService.calculateCriticalPath(args.caseId);
    },

    /**
     * Identify parallel tasks for a case
     */
    parallelTasks: async (_: any, args: { caseId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await parallelTaskService.identifyParallelTasks(args.caseId);
    },
  },

  Mutation: {
    /**
     * Add a dependency between tasks
     */
    addTaskDependency: async (
      _: any,
      args: {
        predecessorId: string;
        successorId: string;
        type: DependencyType;
        lagDays?: number;
      },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Validate no circular dependency
      const isValid = await dependencyService.validateNoCycle(
        args.predecessorId,
        args.successorId
      );

      if (!isValid) {
        throw new GraphQLError('Cannot add dependency: would create circular dependency', {
          extensions: { code: 'VALIDATION_ERROR' },
        });
      }

      return await dependencyService.addDependency(
        args.predecessorId,
        args.successorId,
        args.type,
        args.lagDays
      );
    },

    /**
     * Remove a task dependency
     */
    removeTaskDependency: async (
      _: any,
      args: { dependencyId: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      await dependencyService.removeDependency(args.dependencyId);
      return true;
    },

    /**
     * Preview deadline cascade impact
     */
    previewDeadlineCascade: async (
      _: any,
      args: { taskId: string; newDueDate: Date },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await cascadeService.analyzeDeadlineChange(args.taskId, new Date(args.newDueDate));
    },

    /**
     * Apply deadline cascade
     */
    applyDeadlineCascade: async (
      _: any,
      args: { taskId: string; newDueDate: Date; confirmConflicts: boolean },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await cascadeService.applyDeadlineCascade(
        args.taskId,
        new Date(args.newDueDate),
        args.confirmConflicts
      );
    },

    /**
     * Recalculate critical path for a case
     */
    recalculateCriticalPath: async (
      _: any,
      args: { caseId: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      await criticalPathService.recalculateCriticalPath(args.caseId);
      return await criticalPathService.calculateCriticalPath(args.caseId);
    },
  },

  TaskDependency: {
    /**
     * Resolve predecessor task
     */
    predecessor: async (parent: any) => {
      return await prisma.task.findUnique({
        where: { id: parent.predecessorId },
      });
    },

    /**
     * Resolve successor task
     */
    successor: async (parent: any) => {
      return await prisma.task.findUnique({
        where: { id: parent.successorId },
      });
    },
  },

  ParallelTaskGroup: {
    /**
     * Resolve tasks in the group
     */
    tasks: async (parent: any) => {
      const taskIds = parent.tasks.map((t: any) => t.id);
      return await prisma.task.findMany({
        where: { id: { in: taskIds } },
      });
    },
  },

  AssigneeSuggestion: {
    /**
     * Resolve user for suggestion
     */
    user: async (parent: any) => {
      return await prisma.user.findUnique({
        where: { id: parent.userId },
      });
    },
  },
};
