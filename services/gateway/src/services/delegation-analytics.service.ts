/**
 * Delegation Analytics Service
 * Story 4.7: Task Analytics and Optimization - Task 11
 *
 * Analyzes delegation patterns to reveal training opportunities (AC: 5)
 *
 * Business Logic:
 * - Track delegations received/given per user
 * - Calculate success rate (completed on time)
 * - Identify strength areas (high success by task type)
 * - Identify struggle areas (low success by task type)
 * - Generate AI-powered training suggestions
 */

import {
  PrismaClient as PrismaClientType,
  TaskStatus,
  DelegationStatus,
  TaskTypeEnum,
} from '@prisma/client';
import Redis from 'ioredis';
import type {
  AnalyticsFilters,
  DelegationAnalyticsResponse,
  DelegationPatternUser,
  DelegationFlow,
  TrainingSuggestion,
  UserTrainingOpportunities,
  TrainingPriority,
  TaskType,
} from '@legal-platform/types';

// Cache TTL in seconds (15 minutes)
const CACHE_TTL = 900;
// Success threshold for strength/struggle classification
const SUCCESS_THRESHOLD = 0.75; // 75%
const STRUGGLE_THRESHOLD = 0.5; // 50%

interface DelegationData {
  id: string;
  delegatedTo: string;
  delegatedBy: string;
  status: DelegationStatus;
  sourceTask: {
    type: TaskTypeEnum;
    status: TaskStatus;
    dueDate: Date;
    completedAt: Date | null;
  };
  delegate: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  delegator: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

/**
 * Delegation Analytics Service
 * Analyzes delegation patterns for training opportunities
 */
export class DelegationAnalyticsService {
  private prisma: PrismaClientType;
  private redis: Redis | null = null;

  constructor(prismaClient?: PrismaClientType, redisClient?: Redis) {
    if (prismaClient) {
      this.prisma = prismaClient;
    } else {
      const { prisma } = require('@legal-platform/database');
      this.prisma = prisma;
    }

    if (redisClient) {
      this.redis = redisClient;
    } else {
      try {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          this.redis = new Redis(redisUrl);
        }
      } catch {
        // Redis not available
      }
    }
  }

  /**
   * Get delegation analytics for a firm
   * AC: 5 - Delegation patterns reveal training opportunities
   */
  async getDelegationAnalytics(
    firmId: string,
    filters: AnalyticsFilters
  ): Promise<DelegationAnalyticsResponse> {
    // Check cache
    const cacheKey = this.getCacheKey(firmId, filters);
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Get delegation data
    const delegations = await this.getDelegations(firmId, filters);

    // Analyze by user
    const byUser = await this.analyzeByUser(delegations);

    // Get top delegation flows
    const topDelegationFlows = this.calculateDelegationFlows(delegations);

    // Calculate firm-wide success rate
    const completedDelegations = delegations.filter((d) => d.status === DelegationStatus.Accepted);
    const onTimeDelegations = completedDelegations.filter((d) => {
      if (!d.sourceTask.completedAt) return false;
      return new Date(d.sourceTask.completedAt) <= new Date(d.sourceTask.dueDate);
    });
    const firmWideSuccessRate =
      completedDelegations.length > 0 ? onTimeDelegations.length / completedDelegations.length : 0;

    // Identify training opportunities
    const trainingOpportunities = this.identifyTrainingOpportunities(byUser);

    const result: DelegationAnalyticsResponse = {
      byUser,
      topDelegationFlows: topDelegationFlows.slice(0, 10),
      firmWideSuccessRate: Math.round(firmWideSuccessRate * 100) / 100,
      trainingOpportunities,
    };

    // Cache result
    await this.setCache(cacheKey, result);

    return result;
  }

  /**
   * Get delegations for a firm
   */
  private async getDelegations(
    firmId: string,
    filters: AnalyticsFilters
  ): Promise<DelegationData[]> {
    return this.prisma.taskDelegation.findMany({
      where: {
        sourceTask: {
          firmId,
          createdAt: {
            gte: filters.dateRange.start,
            lte: filters.dateRange.end,
          },
        },
        ...(filters.userIds?.length && {
          OR: [{ delegatedTo: { in: filters.userIds } }, { delegatedBy: { in: filters.userIds } }],
        }),
      },
      select: {
        id: true,
        delegatedTo: true,
        delegatedBy: true,
        status: true,
        sourceTask: {
          select: {
            type: true,
            status: true,
            dueDate: true,
            completedAt: true,
          },
        },
        delegate: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        delegator: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * Analyze delegation patterns by user
   */
  private async analyzeByUser(delegations: DelegationData[]): Promise<DelegationPatternUser[]> {
    // Group by user (delegated to)
    const userMap = new Map<
      string,
      {
        user: DelegationData['delegate'];
        received: DelegationData[];
        given: DelegationData[];
        byType: Map<TaskTypeEnum, { total: number; successful: number }>;
      }
    >();

    // Process received delegations
    for (const delegation of delegations) {
      const userId = delegation.delegatedTo;
      const existing = userMap.get(userId);

      if (existing) {
        existing.received.push(delegation);
      } else {
        userMap.set(userId, {
          user: delegation.delegate,
          received: [delegation],
          given: [],
          byType: new Map(),
        });
      }

      // Track by type
      const entry = userMap.get(userId)!;
      const typeStats = entry.byType.get(delegation.sourceTask.type) || {
        total: 0,
        successful: 0,
      };
      typeStats.total++;

      // Check if successful (completed on time)
      if (
        delegation.status === DelegationStatus.Accepted &&
        delegation.sourceTask.completedAt &&
        new Date(delegation.sourceTask.completedAt) <= new Date(delegation.sourceTask.dueDate)
      ) {
        typeStats.successful++;
      }

      entry.byType.set(delegation.sourceTask.type, typeStats);
    }

    // Process given delegations
    for (const delegation of delegations) {
      const userId = delegation.delegatedBy;
      const existing = userMap.get(userId);

      if (existing) {
        existing.given.push(delegation);
      } else {
        // User only delegated, didn't receive
        userMap.set(userId, {
          user: {
            id: delegation.delegator.id,
            firstName: delegation.delegator.firstName,
            lastName: delegation.delegator.lastName,
            role: 'Unknown',
          },
          received: [],
          given: [delegation],
          byType: new Map(),
        });
      }
    }

    // Build result
    const result: DelegationPatternUser[] = [];

    for (const [userId, data] of userMap) {
      // Calculate overall success rate
      const completedReceived = data.received.filter((d) => d.status === DelegationStatus.Accepted);
      const onTimeReceived = completedReceived.filter((d) => {
        if (!d.sourceTask.completedAt) return false;
        return new Date(d.sourceTask.completedAt) <= new Date(d.sourceTask.dueDate);
      });
      const successRate =
        completedReceived.length > 0 ? onTimeReceived.length / completedReceived.length : 0;

      // Calculate average completion time
      const completionTimes = completedReceived
        .filter((d) => d.sourceTask.completedAt)
        .map((d) => {
          const created = new Date(d.sourceTask.dueDate);
          const completed = new Date(d.sourceTask.completedAt!);
          return (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        });
      const avgCompletionDays =
        completionTimes.length > 0
          ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
          : 0;

      // Identify strength and struggle areas
      const strengthAreas: TaskType[] = [];
      const struggleAreas: TaskType[] = [];

      for (const [taskType, stats] of data.byType) {
        if (stats.total < 2) continue; // Need minimum samples

        const typeSuccessRate = stats.successful / stats.total;
        if (typeSuccessRate >= SUCCESS_THRESHOLD) {
          strengthAreas.push(taskType as unknown as TaskType);
        } else if (typeSuccessRate < STRUGGLE_THRESHOLD) {
          struggleAreas.push(taskType as unknown as TaskType);
        }
      }

      // Generate training suggestions
      const suggestedTraining = this.generateTrainingSuggestions(
        struggleAreas as unknown as TaskTypeEnum[],
        data.byType
      );

      result.push({
        userId,
        userName: `${data.user.firstName} ${data.user.lastName}`,
        role: data.user.role,
        delegationsReceived: data.received.length,
        delegationsGiven: data.given.length,
        successRate: Math.round(successRate * 100) / 100,
        avgCompletionDays: Math.round(avgCompletionDays * 10) / 10,
        strengthAreas,
        struggleAreas,
        suggestedTraining,
      });
    }

    // Sort by delegations received (most active first)
    return result.sort((a, b) => b.delegationsReceived - a.delegationsReceived);
  }

  /**
   * Calculate delegation flows between users
   */
  private calculateDelegationFlows(delegations: DelegationData[]): DelegationFlow[] {
    const flowMap = new Map<
      string,
      {
        fromUserId: string;
        fromUserName: string;
        toUserId: string;
        toUserName: string;
        total: number;
        successful: number;
      }
    >();

    for (const delegation of delegations) {
      const flowKey = `${delegation.delegatedBy}->${delegation.delegatedTo}`;
      const existing = flowMap.get(flowKey);

      if (existing) {
        existing.total++;
        if (
          delegation.status === DelegationStatus.Accepted &&
          delegation.sourceTask.completedAt &&
          new Date(delegation.sourceTask.completedAt) <= new Date(delegation.sourceTask.dueDate)
        ) {
          existing.successful++;
        }
      } else {
        const isSuccessful =
          delegation.status === DelegationStatus.Accepted &&
          delegation.sourceTask.completedAt &&
          new Date(delegation.sourceTask.completedAt) <= new Date(delegation.sourceTask.dueDate);

        flowMap.set(flowKey, {
          fromUserId: delegation.delegatedBy,
          fromUserName: `${delegation.delegator.firstName} ${delegation.delegator.lastName}`,
          toUserId: delegation.delegatedTo,
          toUserName: `${delegation.delegate.firstName} ${delegation.delegate.lastName}`,
          total: 1,
          successful: isSuccessful ? 1 : 0,
        });
      }
    }

    return Array.from(flowMap.values())
      .map((flow) => ({
        fromUserId: flow.fromUserId,
        fromUserName: flow.fromUserName,
        toUserId: flow.toUserId,
        toUserName: flow.toUserName,
        count: flow.total,
        avgSuccessRate: flow.total > 0 ? Math.round((flow.successful / flow.total) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Generate training suggestions based on struggle areas
   */
  private generateTrainingSuggestions(
    struggleAreas: TaskTypeEnum[],
    byType: Map<TaskTypeEnum, { total: number; successful: number }>
  ): TrainingSuggestion[] {
    const suggestions: TrainingSuggestion[] = [];

    for (const taskType of struggleAreas) {
      const stats = byType.get(taskType);
      if (!stats) continue;

      const successRate = stats.successful / stats.total;
      let priority: TrainingPriority = 'low';
      if (successRate < 0.3) priority = 'high';
      else if (successRate < 0.5) priority = 'medium';

      const suggestion = this.getTrainingSuggestionForType(taskType, stats.total, priority);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // Sort by priority
    const priorityOrder: Record<TrainingPriority, number> = { high: 3, medium: 2, low: 1 };
    return suggestions.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
  }

  /**
   * Get specific training suggestion for a task type
   */
  private getTrainingSuggestionForType(
    taskType: TaskTypeEnum,
    taskCount: number,
    priority: TrainingPriority
  ): TrainingSuggestion | null {
    const suggestions: Record<TaskTypeEnum, { reason: string; action: string }> = {
      [TaskTypeEnum.Research]: {
        reason: `Low success rate on ${taskCount} research tasks`,
        action: 'Review legal research methodology and database usage training',
      },
      [TaskTypeEnum.DocumentCreation]: {
        reason: `Delays in ${taskCount} document creation tasks`,
        action: 'Training on document templates and drafting best practices',
      },
      [TaskTypeEnum.DocumentRetrieval]: {
        reason: `Challenges with ${taskCount} document retrieval tasks`,
        action: 'Review document management system and retrieval procedures',
      },
      [TaskTypeEnum.CourtDate]: {
        reason: `Issues with ${taskCount} court date preparations`,
        action: 'Court procedure and deadline management training',
      },
      [TaskTypeEnum.Meeting]: {
        reason: `Difficulties with ${taskCount} meeting coordination tasks`,
        action: 'Meeting preparation and client communication workshop',
      },
      [TaskTypeEnum.BusinessTrip]: {
        reason: `Challenges with ${taskCount} business trip tasks`,
        action: 'Travel logistics and time management training',
      },
      [TaskTypeEnum.Hearing]: {
        reason: `Issues with ${taskCount} hearing preparation tasks`,
        action: 'Court hearing procedures and preparation training',
      },
      [TaskTypeEnum.LegalDeadline]: {
        reason: `Challenges with ${taskCount} legal deadline tasks`,
        action: 'Deadline tracking and procedural timeline management',
      },
      [TaskTypeEnum.Reminder]: {
        reason: `Issues with ${taskCount} reminder tasks`,
        action: 'Task prioritization and follow-up management training',
      },
      [TaskTypeEnum.GeneralTask]: {
        reason: `Challenges with ${taskCount} general tasks`,
        action: 'General task management and workflow optimization',
      },
    };

    const suggestion = suggestions[taskType];
    if (!suggestion) return null;

    return {
      skillArea: taskType as unknown as TaskType,
      reason: suggestion.reason,
      priority,
      suggestedAction: suggestion.action,
    };
  }

  /**
   * Identify training opportunities across all users
   * AC: 5 - Training opportunities from delegation patterns
   */
  identifyTrainingOpportunities(
    userPatterns: DelegationPatternUser[]
  ): UserTrainingOpportunities[] {
    return userPatterns
      .filter((user) => user.suggestedTraining.length > 0)
      .map((user) => ({
        userId: user.userId,
        userName: user.userName,
        suggestions: user.suggestedTraining,
      }))
      .sort((a, b) => b.suggestions.length - a.suggestions.length);
  }

  /**
   * Analyze delegation patterns for a specific user
   */
  async analyzeDelegationPatterns(
    firmId: string,
    userId: string,
    filters: AnalyticsFilters
  ): Promise<DelegationPatternUser | null> {
    const analytics = await this.getDelegationAnalytics(firmId, {
      ...filters,
      userIds: [userId],
    });

    return analytics.byUser.find((u) => u.userId === userId) || null;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(firmId: string, filters: AnalyticsFilters): string {
    const params = [
      firmId,
      filters.dateRange.start.toISOString().split('T')[0],
      filters.dateRange.end.toISOString().split('T')[0],
      filters.userIds?.sort().join(',') || '',
    ];
    return `analytics:delegation:${params.join(':')}`;
  }

  /**
   * Get from cache
   */
  private async getFromCache(key: string): Promise<DelegationAnalyticsResponse | null> {
    if (!this.redis) return null;
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Cache error
    }
    return null;
  }

  /**
   * Set cache
   */
  private async setCache(key: string, data: DelegationAnalyticsResponse): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(key, CACHE_TTL, JSON.stringify(data));
    } catch {
      // Cache error
    }
  }

  /**
   * Invalidate cache
   */
  async invalidateCache(firmId: string): Promise<void> {
    if (!this.redis) return;
    try {
      const pattern = `analytics:delegation:${firmId}:*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {
      // Cache error
    }
  }
}

// Export singleton
let serviceInstance: DelegationAnalyticsService | null = null;

export function getDelegationAnalyticsService(): DelegationAnalyticsService {
  if (!serviceInstance) {
    serviceInstance = new DelegationAnalyticsService();
  }
  return serviceInstance;
}

export default DelegationAnalyticsService;
