// @ts-nocheck
/**
 * Estimate Comparison Service
 * Story 4.3: Time Estimation & Manual Time Logging
 *
 * Provides analysis of estimated vs actual time for personal improvement
 * AC: 6 - Comparison view: estimated vs actual time per task type (for personal improvement)
 *
 * Business Logic:
 * - Only includes completed tasks with both estimated and actual hours
 * - Accuracy = (actual / estimated) * 100
 * - Variance = actual - estimated
 * - Groups by task type for analysis
 */

import { PrismaClient as PrismaClientType, TaskTypeEnum } from '@prisma/client';
import type {
  EstimateVsActualReport,
  TaskTypeComparison,
  TimeEntryDateRange,
  TrendIndicator,
} from '@legal-platform/types';
import { startOfDay, endOfDay, subMonths } from 'date-fns';

/**
 * Estimate Comparison Service
 * Analyzes estimated vs actual time for task type accuracy
 */
export class EstimateComparisonService {
  private prisma: PrismaClientType;

  /**
   * Create EstimateComparisonService instance
   *
   * @param prismaClient - Optional Prisma client (for testing)
   */
  constructor(prismaClient?: PrismaClientType) {
    // Use injected client or import from database package
    if (prismaClient) {
      this.prisma = prismaClient;
    } else {
      // Import prisma from database package
      const { prisma } = require('@legal-platform/database');
      this.prisma = prisma;
    }
  }

  /**
   * Get estimate vs actual report for a user
   * AC: 6 - Comparison view: estimated vs actual time per task type
   *
   * @param userId - User ID
   * @param period - Date range for analysis
   * @returns Report with accuracy analysis by task type
   */
  async getEstimateVsActualReport(
    userId: string,
    period: TimeEntryDateRange
  ): Promise<EstimateVsActualReport> {
    const periodStart = new Date(period.start);
    const periodEnd = new Date(period.end);

    // Fetch completed tasks with estimated hours and time entries
    const tasksWithActualHours = await this.fetchCompletedTasksWithHours(
      userId,
      periodStart,
      periodEnd
    );

    // Group by task type
    const byTaskType = this.groupByTaskType(tasksWithActualHours);

    // Calculate overall accuracy
    const overallAccuracy = this.calculateOverallAccuracy(tasksWithActualHours);

    // Calculate improvement trend
    const improvementTrend = await this.calculateImprovementTrend(userId, period);

    // Generate AI recommendations (placeholder for now)
    const recommendations = this.generateRecommendations(byTaskType);

    return {
      userId,
      periodStart,
      periodEnd,
      overallAccuracy,
      byTaskType,
      improvementTrend,
      recommendations,
    };
  }

  /**
   * Fetch completed tasks with actual hours (extracted to avoid recursion)
   *
   * @param userId - User ID
   * @param periodStart - Start of date range
   * @param periodEnd - End of date range
   * @returns Array of tasks with estimated and actual hours
   * @private
   */
  private async fetchCompletedTasksWithHours(userId: string, periodStart: Date, periodEnd: Date) {
    const completedTasks = await this.prisma.task.findMany({
      where: {
        assignedTo: userId,
        status: 'Completed',
        completedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        estimatedHours: {
          not: null,
        },
      },
      select: {
        id: true,
        type: true,
        estimatedHours: true,
        timeEntries: {
          select: {
            hours: true,
          },
        },
      },
    });

    // Calculate actual hours for each task
    return completedTasks
      .map((task) => {
        const actualHours = task.timeEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
        return {
          id: task.id,
          type: task.type,
          estimatedHours: Number(task.estimatedHours),
          actualHours,
        };
      })
      .filter((task) => task.actualHours > 0); // Only tasks with logged time
  }

  /**
   * Get accuracy comparison for a specific task type
   * AC: 6 - Comparison view per task type
   *
   * @param userId - User ID
   * @param taskType - Task type to analyze
   * @returns Accuracy comparison for the task type
   */
  async getTaskTypeAccuracy(userId: string, taskType: TaskTypeEnum): Promise<TaskTypeComparison> {
    // Get all completed tasks of this type (last 6 months)
    const sixMonthsAgo = subMonths(new Date(), 6);

    const tasks = await this.prisma.task.findMany({
      where: {
        assignedTo: userId,
        type: taskType,
        status: 'Completed',
        completedAt: {
          gte: sixMonthsAgo,
        },
        estimatedHours: {
          not: null,
        },
      },
      select: {
        id: true,
        estimatedHours: true,
        timeEntries: {
          select: {
            hours: true,
          },
        },
      },
    });

    // Calculate actual hours
    const tasksWithActualHours = tasks
      .map((task) => {
        const actualHours = task.timeEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
        return {
          estimatedHours: Number(task.estimatedHours),
          actualHours,
        };
      })
      .filter((task) => task.actualHours > 0);

    if (tasksWithActualHours.length === 0) {
      // Return empty comparison
      return {
        taskType: taskType as string,
        taskCount: 0,
        avgEstimatedHours: 0,
        avgActualHours: 0,
        accuracy: 0,
        variance: 0,
        variancePercent: 0,
      };
    }

    // Calculate averages
    const avgEstimated =
      tasksWithActualHours.reduce((sum, t) => sum + t.estimatedHours, 0) /
      tasksWithActualHours.length;

    const avgActual =
      tasksWithActualHours.reduce((sum, t) => sum + t.actualHours, 0) / tasksWithActualHours.length;

    // Calculate metrics
    const accuracy = (avgActual / avgEstimated) * 100;
    const variance = avgActual - avgEstimated;
    const variancePercent = (variance / avgEstimated) * 100;

    return {
      taskType: taskType as string,
      taskCount: tasksWithActualHours.length,
      avgEstimatedHours: avgEstimated,
      avgActualHours: avgActual,
      accuracy,
      variance,
      variancePercent,
    };
  }

  /**
   * Group tasks by task type and calculate comparisons
   *
   * @param tasks - Tasks with estimated and actual hours
   * @returns Array of task type comparisons
   * @private
   */
  private groupByTaskType(
    tasks: Array<{ type: TaskTypeEnum; estimatedHours: number; actualHours: number }>
  ): TaskTypeComparison[] {
    // Group by task type
    const grouped = new Map<TaskTypeEnum, typeof tasks>();
    tasks.forEach((task) => {
      if (!grouped.has(task.type)) {
        grouped.set(task.type, []);
      }
      grouped.get(task.type)!.push(task);
    });

    // Calculate comparisons for each type
    const comparisons: TaskTypeComparison[] = [];
    grouped.forEach((typeTasks, taskType) => {
      const avgEstimated =
        typeTasks.reduce((sum, t) => sum + t.estimatedHours, 0) / typeTasks.length;

      const avgActual = typeTasks.reduce((sum, t) => sum + t.actualHours, 0) / typeTasks.length;

      const accuracy = (avgActual / avgEstimated) * 100;
      const variance = avgActual - avgEstimated;
      const variancePercent = (variance / avgEstimated) * 100;

      comparisons.push({
        taskType: taskType as string,
        taskCount: typeTasks.length,
        avgEstimatedHours: avgEstimated,
        avgActualHours: avgActual,
        accuracy,
        variance,
        variancePercent,
      });
    });

    // Sort by task count (most common types first)
    return comparisons.sort((a, b) => b.taskCount - a.taskCount);
  }

  /**
   * Calculate overall accuracy across all tasks
   *
   * @param tasks - Tasks with estimated and actual hours
   * @returns Overall accuracy percentage
   * @private
   */
  private calculateOverallAccuracy(
    tasks: Array<{ estimatedHours: number; actualHours: number }>
  ): number {
    if (tasks.length === 0) return 0;

    const totalEstimated = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
    const totalActual = tasks.reduce((sum, t) => sum + t.actualHours, 0);

    return (totalActual / totalEstimated) * 100;
  }

  /**
   * Calculate improvement trend by comparing to previous period
   * Fixed: Avoids infinite recursion by directly fetching and calculating accuracy
   *
   * @param userId - User ID
   * @param currentPeriod - Current date range
   * @returns Trend indicator (UP = improving, DOWN = worsening, STABLE)
   * @private
   */
  private async calculateImprovementTrend(
    userId: string,
    currentPeriod: TimeEntryDateRange
  ): Promise<TrendIndicator> {
    // Get current period tasks and calculate accuracy
    const currentStart = new Date(currentPeriod.start);
    const currentEnd = new Date(currentPeriod.end);
    const currentTasks = await this.fetchCompletedTasksWithHours(userId, currentStart, currentEnd);
    const currentAccuracy = this.calculateOverallAccuracy(currentTasks);

    // Calculate previous period (same duration, just shifted back)
    const periodDuration = currentEnd.getTime() - currentStart.getTime();
    const previousStart = new Date(currentStart.getTime() - periodDuration);
    const previousEnd = new Date(currentStart);

    // Get previous period tasks and calculate accuracy
    const previousTasks = await this.fetchCompletedTasksWithHours(
      userId,
      previousStart,
      previousEnd
    );
    const previousAccuracy = this.calculateOverallAccuracy(previousTasks);

    // If no previous data, consider stable
    if (previousAccuracy === 0) {
      return currentAccuracy > 0 ? 'up' : 'stable';
    }

    // Compare accuracy (closer to 100% is better)
    const currentDistance = Math.abs(100 - currentAccuracy);
    const previousDistance = Math.abs(100 - previousAccuracy);

    const improvementPercent = (previousDistance - currentDistance) / previousDistance;

    // Trend: UP if improving by >5%, DOWN if worsening by >5%
    if (improvementPercent > 0.05) {
      return 'up'; // Improving
    } else if (improvementPercent < -0.05) {
      return 'down'; // Worsening
    } else {
      return 'stable';
    }
  }

  /**
   * Generate AI-powered recommendations based on accuracy analysis
   *
   * @param comparisons - Task type comparisons
   * @returns Array of recommendation strings
   * @private
   */
  private generateRecommendations(comparisons: TaskTypeComparison[]): string[] {
    const recommendations: string[] = [];

    // Find task types with significant over/under estimation
    comparisons.forEach((comparison) => {
      if (comparison.taskCount < 3) {
        // Not enough data for recommendation
        return;
      }

      const variancePercent = Math.abs(comparison.variancePercent);

      if (variancePercent > 30) {
        // Significant variance
        if (comparison.variance > 0) {
          // Under-estimating
          recommendations.push(
            `You tend to under-estimate ${comparison.taskType} tasks by ${variancePercent.toFixed(0)}%. Consider adding buffer time for unexpected complexities.`
          );
        } else {
          // Over-estimating
          recommendations.push(
            `You tend to over-estimate ${comparison.taskType} tasks by ${variancePercent.toFixed(0)}%. You may be more efficient than you think at these tasks.`
          );
        }
      }
    });

    // Overall recommendation if no specific ones
    if (recommendations.length === 0) {
      recommendations.push(
        'Your time estimates are generally accurate. Keep tracking to maintain this precision.'
      );
    }

    return recommendations;
  }
}

// Export singleton instance
export const estimateComparisonService = new EstimateComparisonService();
