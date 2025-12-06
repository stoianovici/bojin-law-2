/**
 * Task Completion Analytics Service
 * Story 4.7: Task Analytics and Optimization - Task 7
 *
 * Calculates average task completion time by type and user (AC: 1)
 *
 * Business Logic:
 * - Completion time = completedAt - createdAt
 * - Exclude cancelled tasks and tasks without completedAt
 * - Group by TaskTypeEnum and assignedTo
 * - Support date range filtering
 *
 * Performance Optimizations:
 * - Redis caching with 15-minute TTL
 * - Pre-aggregated snapshots for historical queries
 */

import { PrismaClient as PrismaClientType, TaskStatus, TaskTypeEnum, Prisma } from '@prisma/client';
import Redis from 'ioredis';
import type {
  AnalyticsFilters,
  CompletionTimeMetrics,
  CompletionByType,
  CompletionByUser,
  CompletionTimeAnalyticsResponse,
} from '@legal-platform/types';

// Cache TTL in seconds (15 minutes)
const CACHE_TTL = 900;

interface CompletedTaskData {
  id: string;
  type: TaskTypeEnum;
  assignedTo: string;
  createdAt: Date;
  completedAt: Date;
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

/**
 * Task Completion Analytics Service
 * Calculates completion time metrics for tasks
 */
export class TaskCompletionAnalyticsService {
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
      // Lazy load Redis in non-test environments
      try {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          this.redis = new Redis(redisUrl);
        }
      } catch {
        // Redis not available, skip caching
      }
    }
  }

  /**
   * Get completion time analytics for a firm
   * AC: 1 - Average task completion time by type and user
   */
  async getCompletionTimeAnalytics(
    firmId: string,
    filters: AnalyticsFilters
  ): Promise<CompletionTimeAnalyticsResponse> {
    // Check cache first
    const cacheKey = this.getCacheKey(firmId, filters);
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Get completed tasks within date range
    const tasks = await this.getCompletedTasks(firmId, filters);

    // Calculate firm-wide metrics
    const firmMetrics = this.calculateMetrics(tasks);

    // Calculate by type
    const byType = await this.getCompletionByType(firmId, filters, tasks);

    // Calculate by user
    const byUser = await this.getCompletionByUser(firmId, filters, tasks);

    const result: CompletionTimeAnalyticsResponse = {
      firmMetrics,
      byType,
      byUser,
      dateRange: {
        start: filters.dateRange.start,
        end: filters.dateRange.end,
      },
    };

    // Cache result
    await this.setCache(cacheKey, result);

    return result;
  }

  /**
   * Get completed tasks within filters
   */
  private async getCompletedTasks(
    firmId: string,
    filters: AnalyticsFilters
  ): Promise<CompletedTaskData[]> {
    const whereClause: Prisma.TaskWhereInput = {
      firmId,
      status: TaskStatus.Completed,
      completedAt: {
        not: null,
        gte: filters.dateRange.start,
        lte: filters.dateRange.end,
      },
    };

    // Apply optional filters
    if (filters.taskTypes && filters.taskTypes.length > 0) {
      whereClause.type = { in: filters.taskTypes as TaskTypeEnum[] };
    }
    if (filters.userIds && filters.userIds.length > 0) {
      whereClause.assignedTo = { in: filters.userIds };
    }
    if (filters.caseIds && filters.caseIds.length > 0) {
      whereClause.caseId = { in: filters.caseIds };
    }

    const tasks = await this.prisma.task.findMany({
      where: whereClause,
      select: {
        id: true,
        type: true,
        assignedTo: true,
        createdAt: true,
        completedAt: true,
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Filter out tasks without completedAt (TypeScript safety)
    return tasks.filter((t): t is CompletedTaskData => t.completedAt !== null);
  }

  /**
   * Calculate completion time metrics from a list of tasks
   */
  calculateMetrics(tasks: CompletedTaskData[]): CompletionTimeMetrics {
    if (tasks.length === 0) {
      return {
        avgCompletionTimeHours: 0,
        medianCompletionTimeHours: 0,
        minCompletionTimeHours: 0,
        maxCompletionTimeHours: 0,
        totalTasksAnalyzed: 0,
      };
    }

    // Calculate completion time in hours for each task
    const completionTimes = tasks.map((task) => {
      const completedAt = new Date(task.completedAt);
      const createdAt = new Date(task.createdAt);
      const diffMs = completedAt.getTime() - createdAt.getTime();
      return diffMs / (1000 * 60 * 60); // Convert to hours
    });

    // Sort for median calculation
    const sorted = [...completionTimes].sort((a, b) => a - b);

    const avg = completionTimes.reduce((sum, t) => sum + t, 0) / completionTimes.length;
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

    return {
      avgCompletionTimeHours: Math.round(avg * 100) / 100,
      medianCompletionTimeHours: Math.round(median * 100) / 100,
      minCompletionTimeHours: Math.round(Math.min(...completionTimes) * 100) / 100,
      maxCompletionTimeHours: Math.round(Math.max(...completionTimes) * 100) / 100,
      totalTasksAnalyzed: tasks.length,
    };
  }

  /**
   * Get completion metrics grouped by task type
   * AC: 1 - Completion time by type
   */
  async getCompletionByType(
    firmId: string,
    filters: AnalyticsFilters,
    tasks?: CompletedTaskData[]
  ): Promise<CompletionByType[]> {
    // Use provided tasks or fetch them
    const completedTasks = tasks ?? (await this.getCompletedTasks(firmId, filters));

    // Group tasks by type
    const byTypeMap = new Map<TaskTypeEnum, CompletedTaskData[]>();
    for (const task of completedTasks) {
      const existing = byTypeMap.get(task.type) || [];
      existing.push(task);
      byTypeMap.set(task.type, existing);
    }

    // Calculate previous period for comparison
    const periodLength = filters.dateRange.end.getTime() - filters.dateRange.start.getTime();
    const previousFilters: AnalyticsFilters = {
      ...filters,
      dateRange: {
        start: new Date(filters.dateRange.start.getTime() - periodLength),
        end: new Date(filters.dateRange.start.getTime() - 1),
      },
    };
    const previousTasks = await this.getCompletedTasks(firmId, previousFilters);
    const previousByType = new Map<TaskTypeEnum, CompletedTaskData[]>();
    for (const task of previousTasks) {
      const existing = previousByType.get(task.type) || [];
      existing.push(task);
      previousByType.set(task.type, existing);
    }

    // Build result
    const result: CompletionByType[] = [];
    for (const [taskType, typeTasks] of byTypeMap) {
      const metrics = this.calculateMetrics(typeTasks);
      const previousTypeTasks = previousByType.get(taskType) || [];
      const previousMetrics = this.calculateMetrics(previousTypeTasks);

      let comparedToPrevious: number | undefined;
      if (previousMetrics.avgCompletionTimeHours > 0) {
        comparedToPrevious =
          ((metrics.avgCompletionTimeHours - previousMetrics.avgCompletionTimeHours) /
            previousMetrics.avgCompletionTimeHours) *
          100;
        comparedToPrevious = Math.round(comparedToPrevious * 100) / 100;
      }

      result.push({
        taskType: taskType as unknown as import('@legal-platform/types').TaskType,
        metrics,
        comparedToPrevious,
      });
    }

    // Sort by task count descending
    return result.sort((a, b) => b.metrics.totalTasksAnalyzed - a.metrics.totalTasksAnalyzed);
  }

  /**
   * Get completion metrics grouped by user
   * AC: 1 - Completion time by user
   */
  async getCompletionByUser(
    firmId: string,
    filters: AnalyticsFilters,
    tasks?: CompletedTaskData[]
  ): Promise<CompletionByUser[]> {
    // Use provided tasks or fetch them
    const completedTasks = tasks ?? (await this.getCompletedTasks(firmId, filters));

    // Group tasks by user
    const byUserMap = new Map<string, { tasks: CompletedTaskData[]; userName: string }>();
    for (const task of completedTasks) {
      const existing = byUserMap.get(task.assignedTo);
      if (existing) {
        existing.tasks.push(task);
      } else {
        byUserMap.set(task.assignedTo, {
          tasks: [task],
          userName: `${task.assignee.firstName} ${task.assignee.lastName}`,
        });
      }
    }

    // Calculate team average for comparison
    const teamMetrics = this.calculateMetrics(completedTasks);

    // Build result
    const result: CompletionByUser[] = [];
    for (const [userId, { tasks: userTasks, userName }] of byUserMap) {
      const metrics = this.calculateMetrics(userTasks);

      let comparedToTeamAvg: number | undefined;
      if (teamMetrics.avgCompletionTimeHours > 0) {
        comparedToTeamAvg =
          ((metrics.avgCompletionTimeHours - teamMetrics.avgCompletionTimeHours) /
            teamMetrics.avgCompletionTimeHours) *
          100;
        comparedToTeamAvg = Math.round(comparedToTeamAvg * 100) / 100;
      }

      result.push({
        userId,
        userName,
        metrics,
        taskCount: userTasks.length,
        comparedToTeamAvg,
      });
    }

    // Sort by task count descending
    return result.sort((a, b) => b.taskCount - a.taskCount);
  }

  /**
   * Generate cache key for analytics query
   */
  private getCacheKey(firmId: string, filters: AnalyticsFilters): string {
    const params = [
      firmId,
      filters.dateRange.start.toISOString().split('T')[0],
      filters.dateRange.end.toISOString().split('T')[0],
      filters.taskTypes?.sort().join(',') || '',
      filters.userIds?.sort().join(',') || '',
      filters.caseIds?.sort().join(',') || '',
    ];
    return `analytics:completion:${params.join(':')}`;
  }

  /**
   * Get cached analytics result
   */
  private async getFromCache(key: string): Promise<CompletionTimeAnalyticsResponse | null> {
    if (!this.redis) return null;
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Restore Date objects
        parsed.dateRange.start = new Date(parsed.dateRange.start);
        parsed.dateRange.end = new Date(parsed.dateRange.end);
        return parsed;
      }
    } catch {
      // Cache error, continue without cache
    }
    return null;
  }

  /**
   * Set cached analytics result
   */
  private async setCache(key: string, data: CompletionTimeAnalyticsResponse): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(key, CACHE_TTL, JSON.stringify(data));
    } catch {
      // Cache error, continue without cache
    }
  }

  /**
   * Invalidate cache for a firm (called after task updates)
   */
  async invalidateCache(firmId: string): Promise<void> {
    if (!this.redis) return;
    try {
      const pattern = `analytics:completion:${firmId}:*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {
      // Cache error, continue without cache
    }
  }
}

// Export singleton instance
let serviceInstance: TaskCompletionAnalyticsService | null = null;

export function getTaskCompletionAnalyticsService(): TaskCompletionAnalyticsService {
  if (!serviceInstance) {
    serviceInstance = new TaskCompletionAnalyticsService();
  }
  return serviceInstance;
}

export default TaskCompletionAnalyticsService;
