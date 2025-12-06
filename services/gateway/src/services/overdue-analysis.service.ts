/**
 * Overdue Analysis Service
 * Story 4.7: Task Analytics and Optimization - Task 8
 *
 * Identifies bottleneck patterns in overdue tasks (AC: 2)
 *
 * Business Logic:
 * - Task is overdue if dueDate < now AND status not in [Completed, Cancelled]
 * - Bottleneck patterns: user overload, task type delays, dependency chains
 * - Impact estimation based on dependency depth and case priority
 *
 * Performance Optimizations:
 * - Redis caching with 15-minute TTL
 * - Indexed queries on dueDate and status
 */

import { PrismaClient as PrismaClientType, TaskStatus, TaskTypeEnum, TaskPriority, Prisma } from '@prisma/client';
import Redis from 'ioredis';
import type {
  AnalyticsFilters,
  OverdueAnalyticsResponse,
  OverdueTask,
  OverdueByTypeItem,
  OverdueByUserItem,
  BottleneckPattern,
  BottleneckPatternType,
  ImpactLevel,
  TaskType,
} from '@legal-platform/types';

// Cache TTL in seconds (15 minutes)
const CACHE_TTL = 900;

interface OverdueTaskData {
  id: string;
  title: string;
  type: TaskTypeEnum;
  assignedTo: string;
  caseId: string;
  dueDate: Date;
  priority: TaskPriority;
  isCriticalPath: boolean;
  predecessors: { predecessorId: string }[];
  assignee: { id: string; firstName: string; lastName: string };
  case: { id: string; title: string };
}

/**
 * Overdue Analysis Service
 * Identifies bottleneck patterns and critical overdue tasks
 */
export class OverdueAnalysisService {
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
   * Get overdue analytics for a firm
   * AC: 2 - Overdue task analysis identifies bottleneck patterns
   */
  async getOverdueAnalytics(
    firmId: string,
    filters: AnalyticsFilters
  ): Promise<OverdueAnalyticsResponse> {
    // Check cache
    const cacheKey = this.getCacheKey(firmId, filters);
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Get overdue tasks
    const overdueTasks = await this.getOverdueTasks(firmId, filters);

    // Calculate by type
    const overdueByType = this.groupByType(overdueTasks);

    // Calculate by user
    const overdueByUser = this.groupByUser(overdueTasks);

    // Identify bottleneck patterns
    const bottleneckPatterns = await this.identifyBottlenecks(firmId, overdueTasks);

    // Get critical tasks (top 10 by impact)
    const criticalTasks = await this.getCriticalOverdueTasks(firmId, 10);

    const result: OverdueAnalyticsResponse = {
      totalOverdue: overdueTasks.length,
      overdueByType,
      overdueByUser,
      bottleneckPatterns,
      criticalTasks,
    };

    // Cache result
    await this.setCache(cacheKey, result);

    return result;
  }

  /**
   * Get all overdue tasks for a firm
   */
  private async getOverdueTasks(
    firmId: string,
    filters: AnalyticsFilters
  ): Promise<OverdueTaskData[]> {
    const now = new Date();

    const whereClause: Prisma.TaskWhereInput = {
      firmId,
      dueDate: {
        lt: now,
        gte: filters.dateRange.start,
      },
      status: {
        notIn: [TaskStatus.Completed, TaskStatus.Cancelled],
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

    return this.prisma.task.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        type: true,
        assignedTo: true,
        caseId: true,
        dueDate: true,
        priority: true,
        isCriticalPath: true,
        predecessors: {
          select: { predecessorId: true },
        },
        assignee: {
          select: { id: true, firstName: true, lastName: true },
        },
        case: {
          select: { id: true, title: true },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: filters.limit || 500,
    }) as unknown as Promise<OverdueTaskData[]>;
  }

  /**
   * Group overdue tasks by type
   */
  private groupByType(tasks: OverdueTaskData[]): OverdueByTypeItem[] {
    const now = new Date();
    const byTypeMap = new Map<TaskTypeEnum, { count: number; totalDays: number }>();

    for (const task of tasks) {
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      const existing = byTypeMap.get(task.type);
      if (existing) {
        existing.count++;
        existing.totalDays += daysOverdue;
      } else {
        byTypeMap.set(task.type, { count: 1, totalDays: daysOverdue });
      }
    }

    return Array.from(byTypeMap.entries())
      .map(([taskType, { count, totalDays }]) => ({
        taskType: taskType as unknown as TaskType,
        count,
        avgDaysOverdue: Math.round((totalDays / count) * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Group overdue tasks by user
   */
  private groupByUser(tasks: OverdueTaskData[]): OverdueByUserItem[] {
    const byUserMap = new Map<string, { name: string; count: number }>();

    for (const task of tasks) {
      const existing = byUserMap.get(task.assignedTo);
      if (existing) {
        existing.count++;
      } else {
        byUserMap.set(task.assignedTo, {
          name: `${task.assignee.firstName} ${task.assignee.lastName}`,
          count: 1,
        });
      }
    }

    return Array.from(byUserMap.entries())
      .map(([userId, { name, count }]) => ({
        userId,
        userName: name,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Identify bottleneck patterns
   * AC: 2 - Bottleneck pattern identification
   */
  async identifyBottlenecks(
    firmId: string,
    overdueTasks?: OverdueTaskData[]
  ): Promise<BottleneckPattern[]> {
    const patterns: BottleneckPattern[] = [];
    const now = new Date();

    // Get tasks if not provided
    const tasks =
      overdueTasks ??
      (await this.getOverdueTasks(firmId, {
        firmId,
        dateRange: {
          start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
          end: now,
        },
      }));

    if (tasks.length === 0) return patterns;

    // Pattern 1: User Overload
    const byUser = this.groupByUser(tasks);
    const avgPerUser = tasks.length / byUser.length;
    const overloadedUsers = byUser.filter((u) => u.count > avgPerUser * 1.5);

    if (overloadedUsers.length > 0) {
      patterns.push({
        patternType: 'user_overload' as BottleneckPatternType,
        description: `${overloadedUsers.length} user(s) have significantly more overdue tasks than average`,
        affectedTasks: overloadedUsers.reduce((sum, u) => sum + u.count, 0),
        suggestedAction: 'Consider redistributing tasks or reviewing workload capacity',
        relatedUsers: overloadedUsers.map((u) => u.userId),
      });
    }

    // Pattern 2: Task Type Delays
    const byType = this.groupByType(tasks);
    const avgDaysOverdue = tasks.reduce((sum, t) => {
      const days = Math.floor(
        (now.getTime() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      return sum + days;
    }, 0) / tasks.length;

    const delayedTypes = byType.filter((t) => t.avgDaysOverdue > avgDaysOverdue * 1.5);

    if (delayedTypes.length > 0) {
      patterns.push({
        patternType: 'task_type_delay' as BottleneckPatternType,
        description: `${delayedTypes.length} task type(s) have longer average delays`,
        affectedTasks: delayedTypes.reduce((sum, t) => sum + t.count, 0),
        suggestedAction: 'Review processes for these task types or adjust time estimates',
        relatedTaskTypes: delayedTypes.map((t) => t.taskType),
      });
    }

    // Pattern 3: Dependency Chains
    const blockedTasks = tasks.filter((t) => t.predecessors.length > 0);
    if (blockedTasks.length > tasks.length * 0.3) {
      patterns.push({
        patternType: 'dependency_chain' as BottleneckPatternType,
        description: `${blockedTasks.length} overdue tasks are blocked by dependencies`,
        affectedTasks: blockedTasks.length,
        suggestedAction: 'Prioritize completing blocking tasks or review dependency structure',
      });
    }

    // Pattern 4: Case Complexity
    const caseTaskCounts = new Map<string, number>();
    for (const task of tasks) {
      const count = caseTaskCounts.get(task.caseId) || 0;
      caseTaskCounts.set(task.caseId, count + 1);
    }

    const complexCases = Array.from(caseTaskCounts.entries()).filter(
      ([, count]) => count > 5
    );

    if (complexCases.length > 0) {
      patterns.push({
        patternType: 'case_complexity' as BottleneckPatternType,
        description: `${complexCases.length} case(s) have multiple overdue tasks, indicating complexity issues`,
        affectedTasks: complexCases.reduce((sum, [, count]) => sum + count, 0),
        suggestedAction: 'Review case priorities and consider additional resources',
      });
    }

    return patterns;
  }

  /**
   * Get critical overdue tasks (most impactful)
   * AC: 2 - Critical tasks identification
   */
  async getCriticalOverdueTasks(firmId: string, limit: number): Promise<OverdueTask[]> {
    const now = new Date();

    const tasks = await this.prisma.task.findMany({
      where: {
        firmId,
        dueDate: { lt: now },
        status: { notIn: [TaskStatus.Completed, TaskStatus.Cancelled] },
      },
      select: {
        id: true,
        title: true,
        type: true,
        assignedTo: true,
        caseId: true,
        dueDate: true,
        priority: true,
        isCriticalPath: true,
        predecessors: {
          select: { predecessorId: true },
        },
        successors: {
          select: { successorId: true },
        },
        assignee: {
          select: { id: true, firstName: true, lastName: true },
        },
        case: {
          select: { id: true, title: true },
        },
      },
      orderBy: [{ isCriticalPath: 'desc' }, { dueDate: 'asc' }],
      take: limit * 2, // Get more to filter/rank
    });

    // Calculate impact and sort
    const tasksWithImpact = tasks.map((task) => {
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      const impact = this.calculateEstimatedImpact(
        task.isCriticalPath,
        task.successors.length,
        task.priority,
        daysOverdue
      );

      return {
        taskId: task.id,
        taskTitle: task.title,
        taskType: task.type as unknown as TaskType,
        assigneeId: task.assignedTo,
        assigneeName: `${task.assignee.firstName} ${task.assignee.lastName}`,
        caseId: task.caseId,
        caseTitle: task.case.title,
        dueDate: task.dueDate,
        daysOverdue,
        blockedBy: task.predecessors.map((p) => p.predecessorId),
        estimatedImpact: impact,
      };
    });

    // Sort by impact (critical first) and days overdue
    const impactOrder: Record<ImpactLevel, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return tasksWithImpact
      .sort((a, b) => {
        const impactDiff = impactOrder[b.estimatedImpact] - impactOrder[a.estimatedImpact];
        if (impactDiff !== 0) return impactDiff;
        return b.daysOverdue - a.daysOverdue;
      })
      .slice(0, limit);
  }

  /**
   * Calculate estimated impact of an overdue task
   */
  calculateEstimatedImpact(
    isCriticalPath: boolean,
    successorCount: number,
    taskPriority: TaskPriority,
    daysOverdue: number
  ): ImpactLevel {
    let score = 0;

    // Critical path is highest priority
    if (isCriticalPath) score += 40;

    // Tasks blocking others are important
    score += Math.min(successorCount * 10, 30);

    // Task priority matters
    if (taskPriority === 'High') score += 20;
    else if (taskPriority === 'Medium') score += 10;

    // Longer overdue = higher impact
    if (daysOverdue > 14) score += 20;
    else if (daysOverdue > 7) score += 10;
    else if (daysOverdue > 3) score += 5;

    // Map score to impact level
    if (score >= 60) return 'critical';
    if (score >= 40) return 'high';
    if (score >= 20) return 'medium';
    return 'low';
  }

  /**
   * Generate cache key
   */
  private getCacheKey(firmId: string, filters: AnalyticsFilters): string {
    const params = [
      firmId,
      filters.dateRange.start.toISOString().split('T')[0],
      filters.dateRange.end.toISOString().split('T')[0],
      filters.taskTypes?.sort().join(',') || '',
      filters.userIds?.sort().join(',') || '',
    ];
    return `analytics:overdue:${params.join(':')}`;
  }

  /**
   * Get from cache
   */
  private async getFromCache(key: string): Promise<OverdueAnalyticsResponse | null> {
    if (!this.redis) return null;
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Restore Date objects in criticalTasks
        if (parsed.criticalTasks) {
          parsed.criticalTasks = parsed.criticalTasks.map((t: OverdueTask) => ({
            ...t,
            dueDate: new Date(t.dueDate),
          }));
        }
        return parsed;
      }
    } catch {
      // Cache error
    }
    return null;
  }

  /**
   * Set cache
   */
  private async setCache(key: string, data: OverdueAnalyticsResponse): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(key, CACHE_TTL, JSON.stringify(data));
    } catch {
      // Cache error
    }
  }

  /**
   * Invalidate cache for a firm
   */
  async invalidateCache(firmId: string): Promise<void> {
    if (!this.redis) return;
    try {
      const pattern = `analytics:overdue:${firmId}:*`;
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
let serviceInstance: OverdueAnalysisService | null = null;

export function getOverdueAnalysisService(): OverdueAnalysisService {
  if (!serviceInstance) {
    serviceInstance = new OverdueAnalysisService();
  }
  return serviceInstance;
}

export default OverdueAnalysisService;
