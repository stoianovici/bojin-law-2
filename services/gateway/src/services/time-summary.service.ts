/**
 * Time Summary Service
 * Story 4.3: Time Estimation & Manual Time Logging
 *
 * Provides weekly summaries of logged time
 * AC: 5 - Weekly summary shows logged billable vs non-billable hours with trends
 *
 * Business Logic:
 * - Week starts on Monday (ISO week)
 * - Trend calculated by comparing to previous week
 * - Trend = UP if >5% increase, DOWN if >5% decrease, otherwise STABLE
 * - Billable amount calculated from hourly rates
 */

import { PrismaClient as PrismaClientType } from '@prisma/client';
import type { WeeklySummary, TrendIndicator, DailySummary } from '@legal-platform/types';
import {
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  format,
  subWeeks,
  eachDayOfInterval,
} from 'date-fns';

/**
 * Time Summary Service
 * Generates weekly summaries and trends for time tracking
 */
export class TimeSummaryService {
  private prisma: PrismaClientType;

  // Threshold for trend calculation (5% change)
  private readonly TREND_THRESHOLD = 0.05;

  /**
   * Create TimeSummaryService instance
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
   * Get weekly summary for a user
   * AC: 5 - Weekly summary shows logged billable vs non-billable hours with trends
   *
   * @param userId - User ID
   * @param weekStart - Start of the week (will be adjusted to Monday)
   * @returns Weekly summary with daily breakdown and trend
   */
  async getWeeklySummary(userId: string, weekStart: Date): Promise<WeeklySummary> {
    // Normalize to start of week (Monday)
    const normalizedWeekStart = startOfWeek(weekStart, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(normalizedWeekStart, { weekStartsOn: 1 });

    // Fetch time entries for the week
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        userId,
        date: {
          gte: normalizedWeekStart,
          lte: weekEnd,
        },
      },
      select: {
        date: true,
        hours: true,
        hourlyRate: true,
        billable: true,
      },
    });

    // Calculate totals
    let totalHours = 0;
    let billableHours = 0;
    let nonBillableHours = 0;
    let billableAmount = 0; // In cents

    entries.forEach((entry) => {
      const hours = Number(entry.hours);
      totalHours += hours;

      if (entry.billable) {
        billableHours += hours;
        billableAmount += hours * Number(entry.hourlyRate);
      } else {
        nonBillableHours += hours;
      }
    });

    // Group by day
    const byDay = this.calculateDailySummary(entries, normalizedWeekStart, weekEnd);

    // Calculate trend by comparing to previous week
    const trend = await this.calculateTrend(userId, normalizedWeekStart);

    return {
      weekStart: normalizedWeekStart,
      weekEnd,
      totalHours,
      billableHours,
      nonBillableHours,
      billableAmount: Math.round(billableAmount), // Round to nearest cent
      entriesCount: entries.length,
      byDay,
      trend,
    };
  }

  /**
   * Get weekly trend for multiple weeks
   * AC: 5 - Weekly summary with trends
   *
   * @param userId - User ID
   * @param weekCount - Number of weeks to retrieve (including current week)
   * @returns Array of weekly summaries
   */
  async getWeeklyTrend(userId: string, weekCount: number): Promise<WeeklySummary[]> {
    const summaries: WeeklySummary[] = [];
    const now = new Date();

    // Generate summaries for each week
    for (let i = 0; i < weekCount; i++) {
      const weekStart = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), i);
      const summary = await this.getWeeklySummary(userId, weekStart);
      summaries.push(summary);
    }

    return summaries.reverse(); // Oldest first
  }

  /**
   * Calculate daily summary breakdown for the week
   *
   * @param entries - Time entries for the week
   * @param weekStart - Start of week
   * @param weekEnd - End of week
   * @returns Array of daily summaries
   * @private
   */
  private calculateDailySummary(
    entries: Array<{ date: Date; hours: any; billable: boolean }>,
    weekStart: Date,
    weekEnd: Date
  ): DailySummary[] {
    // Get all days in the week
    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

    // Group entries by date
    const entriesByDate = new Map<string, typeof entries>();
    entries.forEach((entry) => {
      const dateKey = format(startOfDay(entry.date), 'yyyy-MM-dd');
      if (!entriesByDate.has(dateKey)) {
        entriesByDate.set(dateKey, []);
      }
      entriesByDate.get(dateKey)!.push(entry);
    });

    // Calculate summary for each day
    return daysInWeek.map((day) => {
      const dateKey = format(startOfDay(day), 'yyyy-MM-dd');
      const dayEntries = entriesByDate.get(dateKey) || [];

      let totalHours = 0;
      let billableHours = 0;
      let nonBillableHours = 0;

      dayEntries.forEach((entry) => {
        const hours = Number(entry.hours);
        totalHours += hours;

        if (entry.billable) {
          billableHours += hours;
        } else {
          nonBillableHours += hours;
        }
      });

      return {
        date: day,
        dayOfWeek: format(day, 'EEEE'), // Full day name (e.g., "Monday")
        totalHours,
        billableHours,
        nonBillableHours,
      };
    });
  }

  /**
   * Calculate trend indicator by comparing to previous week
   * Trend = UP if >5% increase, DOWN if >5% decrease, otherwise STABLE
   *
   * @param userId - User ID
   * @param currentWeekStart - Start of current week
   * @returns Trend indicator (UP, DOWN, STABLE)
   * @private
   */
  private async calculateTrend(userId: string, currentWeekStart: Date): Promise<TrendIndicator> {
    // Get current week total hours
    const currentWeekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const currentWeekEntries = await this.prisma.timeEntry.findMany({
      where: {
        userId,
        date: {
          gte: currentWeekStart,
          lte: currentWeekEnd,
        },
      },
      select: {
        hours: true,
      },
    });

    const currentWeekHours = currentWeekEntries.reduce(
      (sum, entry) => sum + Number(entry.hours),
      0
    );

    // Get previous week total hours
    const previousWeekStart = subWeeks(currentWeekStart, 1);
    const previousWeekEnd = endOfWeek(previousWeekStart, { weekStartsOn: 1 });
    const previousWeekEntries = await this.prisma.timeEntry.findMany({
      where: {
        userId,
        date: {
          gte: previousWeekStart,
          lte: previousWeekEnd,
        },
      },
      select: {
        hours: true,
      },
    });

    const previousWeekHours = previousWeekEntries.reduce(
      (sum, entry) => sum + Number(entry.hours),
      0
    );

    // Calculate trend (values must match GraphQL TrendIndicator enum: up, down, stable)
    if (previousWeekHours === 0) {
      // No previous data, consider stable
      return currentWeekHours > 0 ? 'up' : 'stable';
    }

    const percentChange = (currentWeekHours - previousWeekHours) / previousWeekHours;

    if (percentChange > this.TREND_THRESHOLD) {
      return 'up';
    } else if (percentChange < -this.TREND_THRESHOLD) {
      return 'down';
    } else {
      return 'stable';
    }
  }
}

// Export singleton instance
export const timeSummaryService = new TimeSummaryService();
