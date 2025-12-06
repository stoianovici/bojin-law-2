/**
 * Workload Calculation Service
 * Story 4.5: Team Workload Management
 *
 * Calculates user and team workload based on task assignments
 * AC: 2 - Workload meter displays hours allocated per person per day
 *
 * Business Logic:
 * - Sum Task.estimatedHours grouped by assignedTo and dueDate
 * - Factor in UserAvailability for reduced hours periods
 * - Factor in UserWorkloadSettings for capacity
 * - Exclude completed and cancelled tasks
 *
 * Performance Optimizations (PERF-002):
 * - Redis caching for daily workload with 15-minute TTL
 * - Parallel processing for team workload calculations
 * - Cache invalidation on task updates
 */

import { PrismaClient as PrismaClientType, TaskStatus } from '@prisma/client';
import { workloadCacheService } from './workload-cache.service';
import type {
  DailyWorkload,
  UserWorkload,
  TeamWorkloadSummary,
  WorkloadStatus,
  UserBasicInfo,
  WorkloadDateRange,
} from '@legal-platform/types';

/**
 * Workload Calculation Service
 * Handles workload calculations for users and teams
 */
export class WorkloadService {
  private prisma: PrismaClientType;

  /**
   * Create WorkloadService instance
   *
   * @param prismaClient - Optional Prisma client (for testing)
   */
  constructor(prismaClient?: PrismaClientType) {
    if (prismaClient) {
      this.prisma = prismaClient;
    } else {
      const { prisma } = require('@legal-platform/database');
      this.prisma = prisma;
    }
  }

  /**
   * Calculate daily workload for a user on a specific date
   * AC: 2 - Workload meter displays hours allocated per person per day
   *
   * Performance (PERF-002): Results are cached in Redis with 15-minute TTL
   *
   * @param userId - User ID
   * @param date - Date to calculate workload for
   * @param skipCache - Skip cache lookup (for cache invalidation scenarios)
   * @returns Daily workload metrics
   */
  async calculateDailyWorkload(
    userId: string,
    date: Date,
    skipCache: boolean = false
  ): Promise<DailyWorkload> {
    // Normalize date to start of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    // Check cache first (PERF-002)
    if (!skipCache) {
      const cached = await workloadCacheService.getDailyWorkload(userId, startOfDay);
      if (cached) {
        return cached;
      }
    }

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get tasks due on this date for the user
    const tasks = await this.prisma.task.findMany({
      where: {
        assignedTo: userId,
        dueDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          notIn: [TaskStatus.Completed, TaskStatus.Cancelled],
        },
      },
      select: {
        id: true,
        estimatedHours: true,
      },
    });

    // Sum allocated hours
    const allocatedHours = tasks.reduce((sum, task) => {
      return sum + (task.estimatedHours ? Number(task.estimatedHours) : 0);
    }, 0);

    // Get user's capacity for this day
    const capacityHours = await this.getUserDailyCapacity(userId, date);

    // Calculate utilization
    const utilizationPercent = capacityHours > 0 ? (allocatedHours / capacityHours) * 100 : 0;

    // Get overload threshold from settings
    const settings = await this.prisma.userWorkloadSettings.findUnique({
      where: { userId },
      select: { overloadThreshold: true },
    });
    const threshold = settings ? Number(settings.overloadThreshold) : 1.2;

    const result: DailyWorkload = {
      date: startOfDay,
      allocatedHours,
      capacityHours,
      utilizationPercent,
      taskCount: tasks.length,
      overloaded: utilizationPercent > threshold * 100,
    };

    // Cache the result (PERF-002)
    await workloadCacheService.setDailyWorkload(userId, startOfDay, result);

    return result;
  }

  /**
   * Calculate user workload over a date range
   * AC: 2 - Workload meter with daily/weekly views
   *
   * @param userId - User ID
   * @param dateRange - Date range to calculate
   * @returns User workload metrics
   */
  async calculateUserWorkload(
    userId: string,
    dateRange: WorkloadDateRange
  ): Promise<UserWorkload> {
    // Get user info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const userInfo: UserBasicInfo = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };

    // Calculate daily workloads for each day in range
    const dailyWorkloads: DailyWorkload[] = [];
    const currentDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    while (currentDate <= endDate) {
      const daily = await this.calculateDailyWorkload(userId, new Date(currentDate));
      dailyWorkloads.push(daily);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate aggregates
    const weeklyAllocated = dailyWorkloads.reduce((sum, d) => sum + d.allocatedHours, 0);
    const weeklyCapacity = dailyWorkloads.reduce((sum, d) => sum + d.capacityHours, 0);
    const averageUtilization =
      weeklyCapacity > 0 ? (weeklyAllocated / weeklyCapacity) * 100 : 0;

    // Determine status
    const status = this.getWorkloadStatus(averageUtilization);

    return {
      userId,
      user: userInfo,
      dailyWorkloads,
      weeklyAllocated,
      weeklyCapacity,
      averageUtilization,
      status,
    };
  }

  /**
   * Get team workload summary
   * AC: 2 - Workload meter for team view
   *
   * Performance (PERF-002): Uses Promise.all for parallel user workload calculation
   *
   * @param firmId - Firm ID
   * @param dateRange - Date range to calculate
   * @returns Team workload summary
   */
  async getTeamWorkloadSummary(
    firmId: string,
    dateRange: WorkloadDateRange
  ): Promise<TeamWorkloadSummary> {
    // Get all active users in the firm
    const users = await this.prisma.user.findMany({
      where: {
        firmId,
        status: 'Active',
      },
      select: { id: true },
    });

    // Calculate workload for all users in parallel (PERF-002 optimization)
    const members: UserWorkload[] = await Promise.all(
      users.map((user) => this.calculateUserWorkload(user.id, dateRange))
    );

    // Calculate team aggregates
    const teamAverageUtilization =
      members.length > 0
        ? members.reduce((sum, m) => sum + m.averageUtilization, 0) / members.length
        : 0;

    const overloadedCount = members.filter((m) => m.status === 'Overloaded').length;
    const underUtilizedCount = members.filter((m) => m.status === 'UnderUtilized').length;

    return {
      firmId,
      dateRange: { start: dateRange.start, end: dateRange.end },
      members,
      teamAverageUtilization,
      overloadedCount,
      underUtilizedCount,
    };
  }

  /**
   * Determine workload status based on utilization percentage
   *
   * @param utilizationPercent - Current utilization percentage
   * @returns Workload status category
   */
  getWorkloadStatus(utilizationPercent: number): WorkloadStatus {
    if (utilizationPercent < 50) {
      return 'UnderUtilized';
    } else if (utilizationPercent <= 80) {
      return 'Optimal';
    } else if (utilizationPercent <= 100) {
      return 'NearCapacity';
    } else {
      return 'Overloaded';
    }
  }

  /**
   * Get user's daily capacity considering availability overrides
   *
   * @param userId - User ID
   * @param date - Date to check
   * @returns Capacity hours for the day
   */
  async getUserDailyCapacity(userId: string, date: Date): Promise<number> {
    // Check for availability override on this date
    const availability = await this.prisma.userAvailability.findFirst({
      where: {
        userId,
        startDate: { lte: date },
        endDate: { gte: date },
      },
      select: {
        availabilityType: true,
        hoursPerDay: true,
      },
    });

    // If user is out of office or on vacation, capacity is 0 or reduced
    if (availability) {
      if (
        availability.availabilityType === 'OutOfOffice' ||
        availability.availabilityType === 'Vacation' ||
        availability.availabilityType === 'SickLeave'
      ) {
        return 0;
      }
      if (availability.hoursPerDay !== null) {
        return Number(availability.hoursPerDay);
      }
    }

    // Get user's workload settings
    const settings = await this.prisma.userWorkloadSettings.findUnique({
      where: { userId },
      select: {
        dailyCapacityHours: true,
        workingDays: true,
      },
    });

    if (settings) {
      // Check if this is a working day
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      if (!settings.workingDays.includes(dayOfWeek)) {
        return 0;
      }
      return Number(settings.dailyCapacityHours);
    }

    // Default: 8 hours on weekdays
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 0; // Weekend
    }
    return 8;
  }

  /**
   * Get available capacity for a user on a specific date
   * Used by assignment suggestions
   *
   * @param userId - User ID
   * @param date - Date to check
   * @returns Available capacity hours
   */
  async getAvailableCapacity(userId: string, date: Date): Promise<number> {
    const daily = await this.calculateDailyWorkload(userId, date);
    return Math.max(0, daily.capacityHours - daily.allocatedHours);
  }

  /**
   * Get current workload hours for a user
   * Sum of estimatedHours for all active tasks
   *
   * @param userId - User ID
   * @returns Current workload in hours
   */
  async getCurrentWorkload(userId: string): Promise<number> {
    const tasks = await this.prisma.task.findMany({
      where: {
        assignedTo: userId,
        status: {
          notIn: [TaskStatus.Completed, TaskStatus.Cancelled],
        },
      },
      select: {
        estimatedHours: true,
      },
    });

    return tasks.reduce((sum, task) => {
      return sum + (task.estimatedHours ? Number(task.estimatedHours) : 0);
    }, 0);
  }

  // ============================================================================
  // Cache Invalidation Methods (PERF-002)
  // ============================================================================

  /**
   * Invalidate workload cache for a user
   * Call this when tasks are created, updated, completed, or deleted
   *
   * @param userId - User ID
   * @param date - Optional specific date to invalidate
   */
  async invalidateCache(userId: string, date?: Date): Promise<void> {
    await workloadCacheService.invalidateForUser(userId, date);
  }

  /**
   * Invalidate workload cache for multiple users
   * Call this after batch task operations
   *
   * @param userIds - Array of user IDs
   */
  async invalidateCacheForUsers(userIds: string[]): Promise<void> {
    await workloadCacheService.invalidateForUsers(userIds);
  }

  /**
   * Check if caching is enabled
   */
  isCacheEnabled(): boolean {
    return workloadCacheService.isEnabled();
  }
}

// Export singleton instance
export const workloadService = new WorkloadService();
