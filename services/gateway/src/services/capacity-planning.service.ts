/**
 * Capacity Planning Service
 * Story 4.5: Team Workload Management
 *
 * Provides capacity forecasting and bottleneck detection
 * AC: 6 - Capacity planning shows future bottlenecks based on deadlines
 *
 * Business Logic:
 * - Look ahead 30 days by default
 * - Flag bottlenecks when utilization > 120%
 * - Critical path tasks have higher impact score
 * - Use workload service for real-time capacity
 */

import { PrismaClient as PrismaClientType, TaskStatus } from '@prisma/client';
import type {
  CapacityForecast,
  CapacityBottleneck,
  ResourceAllocationSuggestion,
  BottleneckTask,
  WorkloadDateRange,
} from '@legal-platform/types';
import { WorkloadService } from './workload.service';

/**
 * Capacity Planning Service
 * Handles capacity forecasting and bottleneck detection
 */
export class CapacityPlanningService {
  private prisma: PrismaClientType;
  private workloadService: WorkloadService;

  /**
   * Create CapacityPlanningService instance
   *
   * @param prismaClient - Optional Prisma client (for testing)
   * @param workloadSvc - Optional WorkloadService instance (for testing)
   */
  constructor(prismaClient?: PrismaClientType, workloadSvc?: WorkloadService) {
    if (prismaClient) {
      this.prisma = prismaClient;
    } else {
      const { prisma } = require('@legal-platform/database');
      this.prisma = prisma;
    }
    this.workloadService = workloadSvc || new WorkloadService(prismaClient);
  }

  /**
   * Get capacity forecast for a firm
   * AC: 6 - Capacity planning shows future bottlenecks
   *
   * @param firmId - Firm ID
   * @param days - Number of days to forecast (default 30)
   * @returns Capacity forecast
   */
  async getForecast(firmId: string, days: number = 30): Promise<CapacityForecast> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const dateRange: WorkloadDateRange = { start: startDate, end: endDate };

    // Get bottlenecks
    const bottlenecks = await this.identifyBottlenecks(firmId, dateRange);

    // Get team capacity by day
    const teamCapacityByDay = await this.getTeamCapacityByDay(firmId, dateRange);

    // Calculate overall risk
    const overallRisk = this.calculateOverallRisk(bottlenecks, teamCapacityByDay);

    // Generate recommendations
    const recommendations = this.generateRecommendations(bottlenecks, teamCapacityByDay);

    return {
      firmId,
      forecastRange: { start: startDate, end: endDate },
      bottlenecks,
      teamCapacityByDay,
      overallRisk,
      recommendations,
    };
  }

  /**
   * Identify capacity bottlenecks
   *
   * @param firmId - Firm ID
   * @param dateRange - Date range to analyze
   * @returns Array of bottlenecks
   */
  async identifyBottlenecks(
    firmId: string,
    dateRange: WorkloadDateRange
  ): Promise<CapacityBottleneck[]> {
    // Get all active users in the firm
    const users = await this.prisma.user.findMany({
      where: {
        firmId,
        status: 'Active',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    const bottlenecks: CapacityBottleneck[] = [];

    // Check each day in the range for each user
    const currentDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    while (currentDate <= endDate) {
      for (const user of users) {
        const daily = await this.workloadService.calculateDailyWorkload(
          user.id,
          new Date(currentDate)
        );

        // Check if overloaded (> 120% capacity)
        if (daily.overloaded && daily.capacityHours > 0) {
          const overageHours = daily.allocatedHours - daily.capacityHours;

          // Get impacted tasks for this day
          const impactedTasks = await this.getImpactedTasks(user.id, new Date(currentDate));

          // Determine severity
          const severity: 'Warning' | 'Critical' =
            daily.utilizationPercent > 150 ? 'Critical' : 'Warning';

          // Generate suggested action
          const suggestedAction = this.generateSuggestedAction(
            user,
            overageHours,
            impactedTasks
          );

          bottlenecks.push({
            date: new Date(currentDate),
            userId: user.id,
            user: {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
            },
            overageHours,
            impactedTasks,
            severity,
            suggestedAction,
          });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Sort by date and severity
    bottlenecks.sort((a, b) => {
      const dateCompare = a.date.getTime() - b.date.getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.severity === 'Critical' ? -1 : 1;
    });

    return bottlenecks;
  }

  /**
   * Suggest resource reallocation
   *
   * @param firmId - Firm ID
   * @returns Array of allocation suggestions
   */
  async suggestResourceAllocation(
    firmId: string
  ): Promise<ResourceAllocationSuggestion[]> {
    // Get current day forecast
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const dateRange: WorkloadDateRange = { start: today, end: nextWeek };
    const bottlenecks = await this.identifyBottlenecks(firmId, dateRange);

    if (bottlenecks.length === 0) {
      return [];
    }

    const suggestions: ResourceAllocationSuggestion[] = [];

    // Get users with available capacity
    const users = await this.prisma.user.findMany({
      where: {
        firmId,
        status: 'Active',
      },
      select: { id: true },
    });

    for (const bottleneck of bottlenecks) {
      // Find users with available capacity on the bottleneck date
      for (const user of users) {
        if (user.id === bottleneck.userId) continue;

        const capacity = await this.workloadService.getAvailableCapacity(
          user.id,
          bottleneck.date
        );

        if (capacity < 2) continue; // Need at least 2 hours available

        // Find a task to suggest moving
        for (const task of bottleneck.impactedTasks) {
          if (task.estimatedHours <= capacity) {
            const impactScore = this.calculateImpactScore(
              task,
              bottleneck.overageHours,
              capacity
            );

            suggestions.push({
              overloadedUserId: bottleneck.userId,
              suggestedDelegateId: user.id,
              taskId: task.id,
              rationale: `Moving "${task.title}" would reduce overload by ${task.estimatedHours}h`,
              impactScore,
            });

            break; // One suggestion per bottleneck-user pair
          }
        }
      }
    }

    // Sort by impact score descending
    suggestions.sort((a, b) => b.impactScore - a.impactScore);

    // Return top 10 suggestions
    return suggestions.slice(0, 10);
  }

  /**
   * Get team capacity by day
   *
   * @param firmId - Firm ID
   * @param dateRange - Date range
   * @returns Daily capacity totals
   */
  async getTeamCapacityByDay(
    firmId: string,
    dateRange: WorkloadDateRange
  ): Promise<{ date: Date; totalCapacity: number; totalAllocated: number }[]> {
    // Get all active users
    const users = await this.prisma.user.findMany({
      where: {
        firmId,
        status: 'Active',
      },
      select: { id: true },
    });

    const results: { date: Date; totalCapacity: number; totalAllocated: number }[] = [];

    const currentDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    while (currentDate <= endDate) {
      let totalCapacity = 0;
      let totalAllocated = 0;

      for (const user of users) {
        const daily = await this.workloadService.calculateDailyWorkload(
          user.id,
          new Date(currentDate)
        );
        totalCapacity += daily.capacityHours;
        totalAllocated += daily.allocatedHours;
      }

      results.push({
        date: new Date(currentDate),
        totalCapacity,
        totalAllocated,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return results;
  }

  /**
   * Get tasks impacting a user on a specific date
   */
  private async getImpactedTasks(userId: string, date: Date): Promise<BottleneckTask[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

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
        title: true,
        dueDate: true,
        estimatedHours: true,
        isCriticalPath: true,
        caseId: true,
      },
      orderBy: [{ isCriticalPath: 'desc' }, { estimatedHours: 'desc' }],
    });

    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      estimatedHours: t.estimatedHours ? Number(t.estimatedHours) : 0,
      isCriticalPath: t.isCriticalPath,
      caseId: t.caseId,
    }));
  }

  /**
   * Calculate overall risk level
   */
  private calculateOverallRisk(
    bottlenecks: CapacityBottleneck[],
    teamCapacity: { date: Date; totalCapacity: number; totalAllocated: number }[]
  ): 'Low' | 'Medium' | 'High' {
    const criticalCount = bottlenecks.filter((b) => b.severity === 'Critical').length;
    const totalBottlenecks = bottlenecks.length;

    // Calculate average team utilization
    const avgUtilization =
      teamCapacity.length > 0
        ? teamCapacity.reduce(
            (sum, d) => sum + (d.totalCapacity > 0 ? d.totalAllocated / d.totalCapacity : 0),
            0
          ) / teamCapacity.length
        : 0;

    if (criticalCount >= 3 || avgUtilization > 1.2) {
      return 'High';
    } else if (totalBottlenecks >= 5 || avgUtilization > 1.0) {
      return 'Medium';
    }

    return 'Low';
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    bottlenecks: CapacityBottleneck[],
    teamCapacity: { date: Date; totalCapacity: number; totalAllocated: number }[]
  ): string[] {
    const recommendations: string[] = [];

    // Check for critical bottlenecks
    const criticalBottlenecks = bottlenecks.filter((b) => b.severity === 'Critical');
    if (criticalBottlenecks.length > 0) {
      const uniqueUsers = new Set(criticalBottlenecks.map((b) => b.userId));
      recommendations.push(
        `${uniqueUsers.size} team member(s) have critical capacity issues. Consider reassigning tasks.`
      );
    }

    // Check for overall team capacity
    const overloadedDays = teamCapacity.filter(
      (d) => d.totalCapacity > 0 && d.totalAllocated / d.totalCapacity > 1.1
    );
    if (overloadedDays.length > 3) {
      recommendations.push(
        `Team is overloaded on ${overloadedDays.length} days in the forecast period. Consider deadline adjustments.`
      );
    }

    // Check for critical path tasks in bottlenecks
    const criticalPathTasks = bottlenecks.flatMap((b) =>
      b.impactedTasks.filter((t: BottleneckTask) => t.isCriticalPath)
    );
    if (criticalPathTasks.length > 0) {
      recommendations.push(
        `${criticalPathTasks.length} critical path task(s) are at risk. Prioritize these for reassignment.`
      );
    }

    // Default recommendation if no issues
    if (recommendations.length === 0) {
      recommendations.push('Team capacity looks healthy for the forecast period.');
    }

    return recommendations;
  }

  /**
   * Generate suggested action for bottleneck
   */
  private generateSuggestedAction(
    user: { firstName: string; lastName: string },
    overageHours: number,
    impactedTasks: BottleneckTask[]
  ): string {
    const criticalPath = impactedTasks.filter((t) => t.isCriticalPath);

    if (criticalPath.length > 0) {
      return `Reassign non-critical tasks (${overageHours.toFixed(1)}h overage). Critical path tasks should remain with ${user.firstName}.`;
    }

    if (impactedTasks.length > 2) {
      return `Redistribute ${overageHours.toFixed(1)}h of work. Consider moving ${impactedTasks.length - 1} tasks to team members with capacity.`;
    }

    return `Reduce ${overageHours.toFixed(1)}h from ${user.firstName}'s workload or extend deadlines.`;
  }

  /**
   * Calculate impact score for reallocation suggestion
   */
  private calculateImpactScore(
    task: BottleneckTask,
    overageHours: number,
    availableCapacity: number
  ): number {
    let score = 50; // Base score

    // Higher score if task fully fits in available capacity
    if (task.estimatedHours <= availableCapacity) {
      score += 20;
    }

    // Higher score if task significantly reduces overage
    const reductionPercent = (task.estimatedHours / overageHours) * 100;
    score += Math.min(20, reductionPercent / 5);

    // Lower score for critical path tasks (shouldn't move them)
    if (task.isCriticalPath) {
      score -= 30;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }
}

// Export singleton instance
export const capacityPlanningService = new CapacityPlanningService();
