/**
 * Task Template Resolvers
 * Story 4.4: Task Dependencies and Automation
 *
 * GraphQL resolvers for task template management
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import { TaskTemplateService } from '../../services/task-template.service';
import { TemplateApplicationService } from '../../services/template-application.service';
import {
  CaseType,
  TaskTypeEnum,
  OffsetType,
  DependencyType,
} from '@prisma/client';

interface Context {
  user: {
    id: string;
    role: string;
    firmId: string;
  };
}

interface CreateTaskTemplateInput {
  name: string;
  description?: string;
  caseType?: CaseType;
  isDefault?: boolean;
}

interface CreateTemplateStepInput {
  taskType: TaskTypeEnum;
  title: string;
  description?: string;
  estimatedHours?: number;
  typeMetadata?: Record<string, unknown>;
  offsetDays: number;
  offsetFrom: OffsetType;
  isParallel?: boolean;
  isCriticalPath?: boolean;
}

interface ApplyTemplateInput {
  templateId: string;
  caseId: string;
  startDate: Date;
  assignees?: Record<string, string>;
}

// Initialize services
const templateService = new TaskTemplateService();
const applicationService = new TemplateApplicationService();

export const taskTemplateResolvers = {
  Query: {
    /**
     * Get a single task template by ID
     */
    taskTemplate: async (_: any, args: { id: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const template = await templateService.getTemplateById(args.id, user.firmId);

      if (!template) {
        throw new GraphQLError('Task template not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return template;
    },

    /**
     * Get all task templates for the firm
     */
    taskTemplates: async (
      _: any,
      args: { caseType?: CaseType; activeOnly?: boolean },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await templateService.getTemplates(user.firmId, {
        caseType: args.caseType,
        isActive: args.activeOnly ? true : undefined,
      });
    },

    /**
     * Get default template for a case type
     */
    defaultTemplate: async (
      _: any,
      args: { caseType?: CaseType },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const templates = await templateService.getTemplates(user.firmId, {
        caseType: args.caseType,
        isDefault: true,
        isActive: true,
      });

      return templates[0] || null;
    },
  },

  Mutation: {
    /**
     * Create a new task template
     */
    createTaskTemplate: async (
      _: any,
      args: { input: CreateTaskTemplateInput },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await templateService.createTemplate(args.input, user.id);
    },

    /**
     * Update an existing task template
     */
    updateTaskTemplate: async (
      _: any,
      args: { id: string; input: CreateTaskTemplateInput },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await templateService.updateTemplate(args.id, args.input, user.id);
    },

    /**
     * Delete a task template
     */
    deleteTaskTemplate: async (
      _: any,
      args: { id: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      await templateService.deleteTemplate(args.id, user.id);
      return true;
    },

    /**
     * Duplicate a task template
     */
    duplicateTaskTemplate: async (
      _: any,
      args: { id: string; newName: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await templateService.duplicateTemplate(args.id, args.newName, user.id);
    },

    /**
     * Add a step to a template
     */
    addTemplateStep: async (
      _: any,
      args: { templateId: string; input: CreateTemplateStepInput },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await templateService.addStep(args.templateId, args.input);
    },

    /**
     * Update a template step
     */
    updateTemplateStep: async (
      _: any,
      args: { stepId: string; input: CreateTemplateStepInput },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await templateService.updateStep(args.stepId, args.input);
    },

    /**
     * Remove a step from a template
     */
    removeTemplateStep: async (
      _: any,
      args: { stepId: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      await templateService.removeStep(args.stepId);
      return true;
    },

    /**
     * Reorder template steps
     */
    reorderTemplateSteps: async (
      _: any,
      args: { templateId: string; stepIds: string[] },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Update step orders based on array position
      for (let i = 0; i < args.stepIds.length; i++) {
        await prisma.taskTemplateStep.update({
          where: { id: args.stepIds[i] },
          data: { stepOrder: i + 1 },
        });
      }

      // Return updated steps
      return await prisma.taskTemplateStep.findMany({
        where: { templateId: args.templateId },
        orderBy: { stepOrder: 'asc' },
      });
    },

    /**
     * Add a dependency between template steps
     */
    addStepDependency: async (
      _: any,
      args: {
        sourceStepId: string;
        targetStepId: string;
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

      return await templateService.addStepDependency(
        args.sourceStepId,
        args.targetStepId,
        args.type,
        args.lagDays
      );
    },

    /**
     * Remove a step dependency
     */
    removeStepDependency: async (
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

      await templateService.removeStepDependency(args.dependencyId);
      return true;
    },

    /**
     * Apply a template to a case
     */
    applyTemplate: async (
      _: any,
      args: { input: ApplyTemplateInput },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await applicationService.applyTemplate(args.input, user.id);
    },
  },

  TaskTemplate: {
    /**
     * Resolve createdBy user
     */
    createdBy: async (parent: any) => {
      return await prisma.user.findUnique({
        where: { id: parent.createdBy },
      });
    },

    /**
     * Resolve usage count
     */
    usageCount: async (parent: any) => {
      return await prisma.taskTemplateUsage.count({
        where: { templateId: parent.id },
      });
    },

    /**
     * Resolve steps
     */
    steps: async (parent: any) => {
      return await prisma.taskTemplateStep.findMany({
        where: { templateId: parent.id },
        orderBy: { stepOrder: 'asc' },
      });
    },
  },

  TaskTemplateStep: {
    /**
     * Resolve dependencies (where this step is the target)
     */
    dependencies: async (parent: any) => {
      return await prisma.templateStepDependency.findMany({
        where: { targetStepId: parent.id },
      });
    },

    /**
     * Resolve dependents (where this step is the source)
     */
    dependents: async (parent: any) => {
      return await prisma.templateStepDependency.findMany({
        where: { sourceStepId: parent.id },
      });
    },
  },
};
