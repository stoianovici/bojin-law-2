/**
 * Workload Management Resolvers
 * Story 4.5: Team Workload Management
 *
 * GraphQL resolvers for team calendar, workload metrics, availability,
 * AI assignment suggestions, delegation handoffs, and capacity planning
 *
 * Performance Optimization (PERF-001):
 * - Field resolvers use DataLoader to batch user lookups and prevent N+1 queries
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import { createUserDataLoader, UserDataLoader } from '../dataloaders/user.dataloader';
import { WorkloadService } from '../../services/workload.service';
import { TeamCalendarService } from '../../services/team-calendar.service';
import { AvailabilityService } from '../../services/availability.service';
import { SkillAssignmentService } from '../../services/skill-assignment.service';
import { DelegationHandoffService } from '../../services/delegation-handoff.service';
import { CapacityPlanningService } from '../../services/capacity-planning.service';
import { OOOReassignmentService } from '../../services/ooo-reassignment.service';

interface Context {
  user: {
    id: string;
    role: string;
    firmId: string;
  };
  loaders?: {
    user: UserDataLoader;
  };
}

/**
 * Get or create user loader from context
 * Creates a new loader if not provided in context (backwards compatibility)
 */
function getUserLoader(context: Context): UserDataLoader {
  if (context.loaders?.user) {
    return context.loaders.user;
  }
  // Fallback: create a request-scoped loader
  // Note: For optimal performance, the loader should be created in the context factory
  return createUserDataLoader();
}

// Initialize services
const workloadService = new WorkloadService();
const teamCalendarService = new TeamCalendarService();
const availabilityService = new AvailabilityService();
const skillAssignmentService = new SkillAssignmentService();
const delegationHandoffService = new DelegationHandoffService();
const capacityPlanningService = new CapacityPlanningService();
const oooReassignmentService = new OOOReassignmentService();

export const workloadManagementResolvers = {
  Query: {
    // ============================================================================
    // Team Calendar (AC: 1)
    // ============================================================================

    teamCalendar: async (
      _: any,
      args: { dateRange: { start: string; end: string } },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await teamCalendarService.getTeamCalendar(user.firmId, {
        start: new Date(args.dateRange.start),
        end: new Date(args.dateRange.end),
      });
    },

    myCalendar: async (
      _: any,
      args: { dateRange: { start: string; end: string } },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await teamCalendarService.getMemberCalendar(user.id, {
        start: new Date(args.dateRange.start),
        end: new Date(args.dateRange.end),
      });
    },

    // ============================================================================
    // Workload Meter (AC: 2)
    // ============================================================================

    teamWorkload: async (
      _: any,
      args: { dateRange: { start: string; end: string } },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await workloadService.getTeamWorkloadSummary(user.firmId, {
        start: new Date(args.dateRange.start),
        end: new Date(args.dateRange.end),
      });
    },

    userWorkload: async (
      _: any,
      args: { userId: string; dateRange: { start: string; end: string } },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify user belongs to same firm
      const targetUser = await prisma.user.findUnique({
        where: { id: args.userId },
        select: { firmId: true },
      });

      if (!targetUser || targetUser.firmId !== user.firmId) {
        throw new GraphQLError('User not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return await workloadService.calculateUserWorkload(args.userId, {
        start: new Date(args.dateRange.start),
        end: new Date(args.dateRange.end),
      });
    },

    myWorkload: async (
      _: any,
      args: { dateRange: { start: string; end: string } },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await workloadService.calculateUserWorkload(user.id, {
        start: new Date(args.dateRange.start),
        end: new Date(args.dateRange.end),
      });
    },

    // ============================================================================
    // Assignment Suggestions (AC: 3)
    // ============================================================================

    suggestAssignees: async (_: any, args: { input: any }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await skillAssignmentService.suggestAssignees(
        {
          taskType: args.input.taskType,
          taskTitle: args.input.taskTitle,
          caseId: args.input.caseId,
          estimatedHours: args.input.estimatedHours,
          dueDate: new Date(args.input.dueDate),
          requiredSkills: args.input.requiredSkills,
          excludeUserIds: args.input.excludeUserIds,
        },
        user.firmId
      );
    },

    // ============================================================================
    // Availability
    // ============================================================================

    myAvailabilities: async (
      _: any,
      args: { dateRange?: { start: string; end: string } },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const dateRange = args.dateRange
        ? {
            start: new Date(args.dateRange.start),
            end: new Date(args.dateRange.end),
          }
        : undefined;

      return await availabilityService.getAvailabilities(user.id, dateRange);
    },

    teamAvailability: async (
      _: any,
      args: { dateRange: { start: string; end: string } },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await availabilityService.getTeamAvailability(user.firmId, {
        start: new Date(args.dateRange.start),
        end: new Date(args.dateRange.end),
      });
    },

    // ============================================================================
    // Skills
    // ============================================================================

    mySkills: async (_: any, __: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await skillAssignmentService.getUserSkills(user.id);
    },

    userSkills: async (_: any, args: { userId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify user belongs to same firm
      const targetUser = await prisma.user.findUnique({
        where: { id: args.userId },
        select: { firmId: true },
      });

      if (!targetUser || targetUser.firmId !== user.firmId) {
        throw new GraphQLError('User not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return await skillAssignmentService.getUserSkills(args.userId);
    },

    // ============================================================================
    // Delegation Handoff (AC: 4)
    // ============================================================================

    delegationHandoff: async (
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

      return await delegationHandoffService.getHandoff(args.delegationId);
    },

    // ============================================================================
    // Capacity Planning (AC: 6)
    // ============================================================================

    capacityForecast: async (
      _: any,
      args: { days?: number },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await capacityPlanningService.getForecast(
        user.firmId,
        args.days || 30
      );
    },

    resourceAllocationSuggestions: async (_: any, __: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await capacityPlanningService.suggestResourceAllocation(user.firmId);
    },

    // ============================================================================
    // User Settings
    // ============================================================================

    myWorkloadSettings: async (_: any, __: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await prisma.userWorkloadSettings.findUnique({
        where: { userId: user.id },
      });
    },
  },

  Mutation: {
    // ============================================================================
    // Availability (AC: 1, 5)
    // ============================================================================

    createAvailability: async (
      _: any,
      args: { input: any },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await availabilityService.createAvailability(
        args.input,
        user.id,
        user.firmId
      );
    },

    updateAvailability: async (
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

      return await availabilityService.updateAvailability(
        args.id,
        args.input,
        user.id,
        user.firmId
      );
    },

    deleteAvailability: async (
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

      await availabilityService.deleteAvailability(args.id, user.id, user.firmId);
      return true;
    },

    // ============================================================================
    // Skills (AC: 3)
    // ============================================================================

    updateMySkills: async (
      _: any,
      args: { skills: Array<{ skillType: string; proficiency: number }> },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      await skillAssignmentService.updateUserSkills(
        user.id,
        args.skills as any,
        user.firmId
      );

      return await skillAssignmentService.getUserSkills(user.id);
    },

    verifyUserSkill: async (
      _: any,
      args: { skillId: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Only Partners can verify skills
      if (user.role !== 'Partner') {
        throw new GraphQLError('Only Partners can verify skills', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return await skillAssignmentService.verifyUserSkill(args.skillId);
    },

    // ============================================================================
    // Delegation Handoff (AC: 4)
    // ============================================================================

    generateHandoff: async (_: any, args: { input: any }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await delegationHandoffService.generateHandoff(args.input);
    },

    saveHandoff: async (
      _: any,
      args: {
        delegationId: string;
        handoffNotes: string;
        contextSummary?: string;
        relatedTaskIds?: string[];
        relatedDocIds?: string[];
      },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await delegationHandoffService.saveHandoff(
        args.delegationId,
        args.handoffNotes,
        args.contextSummary,
        args.relatedTaskIds,
        args.relatedDocIds
      );
    },

    // ============================================================================
    // OOO Reassignment (AC: 5)
    // ============================================================================

    processOOOReassignments: async (
      _: any,
      args: { availabilityId: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await oooReassignmentService.processOOOReassignments(
        user.id,
        args.availabilityId
      );
    },

    // ============================================================================
    // Workload Settings
    // ============================================================================

    updateMyWorkloadSettings: async (
      _: any,
      args: { input: any },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await prisma.userWorkloadSettings.upsert({
        where: { userId: user.id },
        update: {
          dailyCapacityHours: args.input.dailyCapacityHours,
          weeklyCapacityHours: args.input.weeklyCapacityHours,
          workingDays: args.input.workingDays,
          maxConcurrentTasks: args.input.maxConcurrentTasks,
          overloadThreshold: args.input.overloadThreshold,
        },
        create: {
          userId: user.id,
          firmId: user.firmId,
          dailyCapacityHours: args.input.dailyCapacityHours || 8,
          weeklyCapacityHours: args.input.weeklyCapacityHours || 40,
          workingDays: args.input.workingDays || [1, 2, 3, 4, 5],
          maxConcurrentTasks: args.input.maxConcurrentTasks || 10,
          overloadThreshold: args.input.overloadThreshold || 1.2,
        },
      });
    },
  },

  // ============================================================================
  // Field Resolvers
  // Performance Optimization (PERF-001): Using DataLoader to batch user lookups
  // ============================================================================

  UserAvailability: {
    user: async (parent: any, _args: any, context: Context) => {
      const loader = getUserLoader(context);
      return await loader.load(parent.userId);
    },
    delegate: async (parent: any, _args: any, context: Context) => {
      if (!parent.delegateTo) return null;
      const loader = getUserLoader(context);
      return await loader.load(parent.delegateTo);
    },
  },

  UserWorkload: {
    user: async (parent: any, _args: any, context: Context) => {
      const loader = getUserLoader(context);
      return await loader.load(parent.userId);
    },
  },

  TeamCalendarEntry: {
    user: async (parent: any, _args: any, context: Context) => {
      const loader = getUserLoader(context);
      return await loader.load(parent.userId);
    },
  },

  TeamMemberCalendar: {
    user: async (parent: any, _args: any, context: Context) => {
      const loader = getUserLoader(context);
      return await loader.load(parent.userId);
    },
  },

  AssignmentSuggestion: {
    user: async (parent: any, _args: any, context: Context) => {
      const loader = getUserLoader(context);
      return await loader.load(parent.userId);
    },
  },

  CapacityBottleneck: {
    user: async (parent: any, _args: any, context: Context) => {
      const loader = getUserLoader(context);
      return await loader.load(parent.userId);
    },
  },
};
