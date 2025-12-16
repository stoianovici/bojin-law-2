/**
 * Response Time Pattern Service
 * Story 5.6: AI Learning and Personalization (Task 14)
 *
 * Tracks and analyzes user response time patterns for task completion.
 * Uses historical data to predict completion times and identify productivity patterns.
 */

import { prisma } from '@legal-platform/database';
import type {
  ResponseTimePattern,
  DayOfWeekPattern,
  TimeOfDayPattern,
  CompletionTimePrediction,
} from '@legal-platform/types';

// Input types
interface RecordResponseTimeInput {
  taskType: string;
  caseType?: string;
  responseHours: number;
  completedAt: Date;
}

interface GetPatternsInput {
  taskType?: string;
  caseType?: string;
  limit?: number;
}

export class ResponseTimePatternService {
  /**
   * Record a new response time measurement
   */
  async recordResponseTime(
    input: RecordResponseTimeInput,
    userId: string,
    firmId: string
  ): Promise<ResponseTimePattern> {
    const { taskType, caseType, responseHours, completedAt } = input;

    // Find existing pattern for this task/case type combination
    const existing = await prisma.responseTimePattern.findFirst({
      where: {
        userId,
        taskType,
        caseType: caseType || null,
      },
    });

    if (existing) {
      // Update existing pattern with new data point
      return this.updatePatternWithNewSample(existing, responseHours, completedAt);
    } else {
      // Create new pattern
      const dayPattern = this.initializeDayOfWeekPattern(completedAt, responseHours);
      const timePattern = this.initializeTimeOfDayPattern(completedAt, responseHours);

      const pattern = await prisma.responseTimePattern.create({
        data: {
          firmId,
          userId,
          taskType,
          caseType: caseType || null,
          averageResponseHours: responseHours,
          medianResponseHours: responseHours,
          minResponseHours: responseHours,
          maxResponseHours: responseHours,
          sampleCount: 1,
          stdDeviation: null,
          dayOfWeekPattern: dayPattern as object,
          timeOfDayPattern: timePattern as object,
          lastCalculatedAt: new Date(),
        },
      });

      return this.mapToPattern(pattern);
    }
  }

  /**
   * Get patterns for a user
   */
  async getUserPatterns(
    userId: string,
    input: GetPatternsInput = {}
  ): Promise<ResponseTimePattern[]> {
    const { taskType, caseType, limit = 50 } = input;

    const patterns = await prisma.responseTimePattern.findMany({
      where: {
        userId,
        ...(taskType && { taskType }),
        ...(caseType !== undefined && { caseType }),
      },
      orderBy: [{ sampleCount: 'desc' }, { lastCalculatedAt: 'desc' }],
      take: limit,
    });

    return patterns.map(this.mapToPattern);
  }

  /**
   * Get pattern for a specific task type
   */
  async getPatternByTaskType(
    taskType: string,
    userId: string,
    caseType?: string
  ): Promise<ResponseTimePattern | null> {
    const pattern = await prisma.responseTimePattern.findFirst({
      where: {
        userId,
        taskType,
        caseType: caseType || null,
      },
    });

    return pattern ? this.mapToPattern(pattern) : null;
  }

  /**
   * Predict completion time for a task based on patterns
   */
  async predictCompletionTime(
    taskType: string,
    userId: string,
    caseType?: string,
    scheduledFor?: Date
  ): Promise<CompletionTimePrediction | null> {
    // Get pattern for this task type
    const pattern = await this.getPatternByTaskType(taskType, userId, caseType);

    if (!pattern || pattern.sampleCount < 3) {
      // Not enough data for prediction
      return null;
    }

    let estimatedHours = pattern.averageResponseHours;
    let adjustedForDayOfWeek = false;
    let adjustedForTimeOfDay = false;
    const factors: string[] = [];

    const targetDate = scheduledFor || new Date();

    // Adjust based on day of week
    if (pattern.dayOfWeekPattern) {
      const dayAdjustment = this.getDayOfWeekAdjustment(pattern.dayOfWeekPattern, targetDate);
      if (dayAdjustment !== 1) {
        estimatedHours *= dayAdjustment;
        adjustedForDayOfWeek = true;
        factors.push(`Day of week adjustment: ${(dayAdjustment * 100 - 100).toFixed(0)}%`);
      }
    }

    // Adjust based on time of day
    if (pattern.timeOfDayPattern) {
      const timeAdjustment = this.getTimeOfDayAdjustment(pattern.timeOfDayPattern, targetDate);
      if (timeAdjustment !== 1) {
        estimatedHours *= timeAdjustment;
        adjustedForTimeOfDay = true;
        factors.push(`Time of day adjustment: ${(timeAdjustment * 100 - 100).toFixed(0)}%`);
      }
    }

    // Calculate confidence based on sample size and std deviation
    let confidenceLevel = this.calculateConfidence(pattern);

    return {
      estimatedHours: Math.round(estimatedHours * 10) / 10,
      confidenceLevel,
      basedOnSamples: pattern.sampleCount,
      adjustedForDayOfWeek,
      adjustedForTimeOfDay,
      factors,
    };
  }

  /**
   * Get productivity insights for a user
   */
  async getProductivityInsights(userId: string): Promise<{
    mostProductiveDay: string | null;
    mostProductiveTime: string | null;
    fastestTaskType: string | null;
    slowestTaskType: string | null;
    averageResponseTime: number;
  }> {
    const patterns = await prisma.responseTimePattern.findMany({
      where: {
        userId,
        sampleCount: { gte: 5 },
      },
      orderBy: { sampleCount: 'desc' },
    });

    if (patterns.length === 0) {
      return {
        mostProductiveDay: null,
        mostProductiveTime: null,
        fastestTaskType: null,
        slowestTaskType: null,
        averageResponseTime: 0,
      };
    }

    // Find most productive day across all patterns
    const dayTotals: Record<string, { sum: number; count: number }> = {};
    const timeTotals: Record<string, { sum: number; count: number }> = {};

    for (const pattern of patterns) {
      if (pattern.dayOfWeekPattern) {
        const dayPattern = pattern.dayOfWeekPattern as unknown as DayOfWeekPattern;
        for (const [day, value] of Object.entries(dayPattern)) {
          if (!dayTotals[day]) dayTotals[day] = { sum: 0, count: 0 };
          dayTotals[day].sum += value as number;
          dayTotals[day].count += 1;
        }
      }

      if (pattern.timeOfDayPattern) {
        const timePattern = pattern.timeOfDayPattern as unknown as TimeOfDayPattern;
        for (const [time, value] of Object.entries(timePattern)) {
          if (!timeTotals[time]) timeTotals[time] = { sum: 0, count: 0 };
          timeTotals[time].sum += value as number;
          timeTotals[time].count += 1;
        }
      }
    }

    // Find day with lowest average response time (most productive)
    let mostProductiveDay: string | null = null;
    let lowestDayAvg = Infinity;
    for (const [day, data] of Object.entries(dayTotals)) {
      const avg = data.sum / data.count;
      if (avg < lowestDayAvg) {
        lowestDayAvg = avg;
        mostProductiveDay = this.formatDayName(day);
      }
    }

    // Find time with lowest average response time
    let mostProductiveTime: string | null = null;
    let lowestTimeAvg = Infinity;
    for (const [time, data] of Object.entries(timeTotals)) {
      const avg = data.sum / data.count;
      if (avg < lowestTimeAvg) {
        lowestTimeAvg = avg;
        mostProductiveTime = this.formatTimeName(time);
      }
    }

    // Sort patterns by average response time
    const sortedBySpeed = [...patterns].sort(
      (a, b) => a.averageResponseHours - b.averageResponseHours
    );

    // Calculate overall average
    const totalHours = patterns.reduce((sum, p) => sum + p.averageResponseHours * p.sampleCount, 0);
    const totalSamples = patterns.reduce((sum, p) => sum + p.sampleCount, 0);
    const averageResponseTime = totalSamples > 0 ? totalHours / totalSamples : 0;

    return {
      mostProductiveDay,
      mostProductiveTime,
      fastestTaskType: sortedBySpeed[0]?.taskType || null,
      slowestTaskType: sortedBySpeed[sortedBySpeed.length - 1]?.taskType || null,
      averageResponseTime: Math.round(averageResponseTime * 10) / 10,
    };
  }

  /**
   * Delete patterns for a user (cleanup)
   */
  async deleteUserPatterns(userId: string): Promise<number> {
    const result = await prisma.responseTimePattern.deleteMany({
      where: { userId },
    });
    return result.count;
  }

  /**
   * Recalculate patterns from historical data
   */
  async recalculatePattern(patternId: string, userId: string): Promise<ResponseTimePattern | null> {
    const pattern = await prisma.responseTimePattern.findFirst({
      where: { id: patternId, userId },
    });

    if (!pattern) {
      return null;
    }

    // Mark as recalculated
    const updated = await prisma.responseTimePattern.update({
      where: { id: patternId },
      data: {
        lastCalculatedAt: new Date(),
      },
    });

    return this.mapToPattern(updated);
  }

  /**
   * Update pattern with a new sample measurement
   */
  private async updatePatternWithNewSample(
    existing: {
      id: string;
      averageResponseHours: number;
      medianResponseHours: number;
      minResponseHours: number;
      maxResponseHours: number;
      sampleCount: number;
      stdDeviation: number | null;
      dayOfWeekPattern: unknown;
      timeOfDayPattern: unknown;
    },
    newResponseHours: number,
    completedAt: Date
  ): Promise<ResponseTimePattern> {
    const n = existing.sampleCount;
    const oldAvg = existing.averageResponseHours;

    // Calculate new average using running average formula
    const newAvg = (oldAvg * n + newResponseHours) / (n + 1);

    // Update min/max
    const newMin = Math.min(existing.minResponseHours, newResponseHours);
    const newMax = Math.max(existing.maxResponseHours, newResponseHours);

    // Approximate new std deviation (Welford's online algorithm simplified)
    let newStdDev = existing.stdDeviation;
    if (n >= 2 && existing.stdDeviation !== null) {
      const variance = existing.stdDeviation * existing.stdDeviation;
      const delta = newResponseHours - oldAvg;
      const delta2 = newResponseHours - newAvg;
      const newVariance = (variance * n + delta * delta2) / (n + 1);
      newStdDev = Math.sqrt(newVariance);
    } else if (n >= 1) {
      // Calculate initial std dev with 2 samples
      newStdDev = Math.abs(newResponseHours - oldAvg) / Math.sqrt(2);
    }

    // Update day of week pattern
    const dayPattern = this.updateDayOfWeekPattern(
      existing.dayOfWeekPattern as DayOfWeekPattern | null,
      completedAt,
      newResponseHours,
      n
    );

    // Update time of day pattern
    const timePattern = this.updateTimeOfDayPattern(
      existing.timeOfDayPattern as TimeOfDayPattern | null,
      completedAt,
      newResponseHours,
      n
    );

    const updated = await prisma.responseTimePattern.update({
      where: { id: existing.id },
      data: {
        averageResponseHours: newAvg,
        minResponseHours: newMin,
        maxResponseHours: newMax,
        sampleCount: n + 1,
        stdDeviation: newStdDev,
        dayOfWeekPattern: dayPattern as object,
        timeOfDayPattern: timePattern as object,
        lastCalculatedAt: new Date(),
      },
    });

    return this.mapToPattern(updated);
  }

  /**
   * Initialize day of week pattern
   */
  private initializeDayOfWeekPattern(completedAt: Date, responseHours: number): DayOfWeekPattern {
    const days: DayOfWeekPattern = {
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
      sunday: 0,
    };

    const dayOfWeek = completedAt.getDay();
    const dayName = this.getDayName(dayOfWeek);
    days[dayName as keyof DayOfWeekPattern] = responseHours;

    return days;
  }

  /**
   * Initialize time of day pattern
   */
  private initializeTimeOfDayPattern(completedAt: Date, responseHours: number): TimeOfDayPattern {
    const times: TimeOfDayPattern = {
      earlyMorning: 0,
      morning: 0,
      afternoon: 0,
      evening: 0,
      night: 0,
    };

    const hour = completedAt.getHours();
    const timePeriod = this.getTimePeriod(hour);
    times[timePeriod as keyof TimeOfDayPattern] = responseHours;

    return times;
  }

  /**
   * Update day of week pattern with new sample
   */
  private updateDayOfWeekPattern(
    existing: DayOfWeekPattern | null,
    completedAt: Date,
    responseHours: number,
    sampleCount: number
  ): DayOfWeekPattern {
    const pattern = existing || this.initializeDayOfWeekPattern(completedAt, 0);
    const dayOfWeek = completedAt.getDay();
    const dayName = this.getDayName(dayOfWeek) as keyof DayOfWeekPattern;

    // Running average for this day
    const oldValue = pattern[dayName] || 0;
    const weight = Math.min(sampleCount, 10); // Cap influence of old data
    pattern[dayName] = (oldValue * weight + responseHours) / (weight + 1);

    return pattern;
  }

  /**
   * Update time of day pattern with new sample
   */
  private updateTimeOfDayPattern(
    existing: TimeOfDayPattern | null,
    completedAt: Date,
    responseHours: number,
    sampleCount: number
  ): TimeOfDayPattern {
    const pattern = existing || this.initializeTimeOfDayPattern(completedAt, 0);
    const hour = completedAt.getHours();
    const timePeriod = this.getTimePeriod(hour) as keyof TimeOfDayPattern;

    // Running average for this time period
    const oldValue = pattern[timePeriod] || 0;
    const weight = Math.min(sampleCount, 10);
    pattern[timePeriod] = (oldValue * weight + responseHours) / (weight + 1);

    return pattern;
  }

  /**
   * Get day name from day number
   */
  private getDayName(dayOfWeek: number): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[dayOfWeek];
  }

  /**
   * Get time period from hour
   */
  private getTimePeriod(hour: number): string {
    if (hour >= 6 && hour < 9) return 'earlyMorning';
    if (hour >= 9 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  /**
   * Format day name for display
   */
  private formatDayName(day: string): string {
    const names: Record<string, string> = {
      monday: 'Luni',
      tuesday: 'Marți',
      wednesday: 'Miercuri',
      thursday: 'Joi',
      friday: 'Vineri',
      saturday: 'Sâmbătă',
      sunday: 'Duminică',
    };
    return names[day] || day;
  }

  /**
   * Format time period name for display
   */
  private formatTimeName(time: string): string {
    const names: Record<string, string> = {
      earlyMorning: 'Dimineața devreme (6-9)',
      morning: 'Dimineața (9-12)',
      afternoon: 'După-amiază (12-17)',
      evening: 'Seara (17-21)',
      night: 'Noaptea (21-6)',
    };
    return names[time] || time;
  }

  /**
   * Get adjustment factor based on day of week pattern
   */
  private getDayOfWeekAdjustment(pattern: DayOfWeekPattern, targetDate: Date): number {
    const dayOfWeek = targetDate.getDay();
    const dayName = this.getDayName(dayOfWeek) as keyof DayOfWeekPattern;
    const dayValue = pattern[dayName];

    // Calculate average across all days
    const values = Object.values(pattern).filter(
      (v): v is number => typeof v === 'number' && v > 0
    );
    if (values.length === 0) return 1;

    const avg = values.reduce((sum: number, v: number) => sum + v, 0) / values.length;
    if (avg === 0 || !dayValue) return 1;

    // Return ratio compared to average
    return dayValue / avg;
  }

  /**
   * Get adjustment factor based on time of day pattern
   */
  private getTimeOfDayAdjustment(pattern: TimeOfDayPattern, targetDate: Date): number {
    const hour = targetDate.getHours();
    const timePeriod = this.getTimePeriod(hour) as keyof TimeOfDayPattern;
    const timeValue = pattern[timePeriod];

    // Calculate average across all time periods
    const values = Object.values(pattern).filter(
      (v): v is number => typeof v === 'number' && v > 0
    );
    if (values.length === 0) return 1;

    const avg = values.reduce((sum: number, v: number) => sum + v, 0) / values.length;
    if (avg === 0 || !timeValue) return 1;

    // Return ratio compared to average
    return timeValue / avg;
  }

  /**
   * Calculate confidence level based on sample size and consistency
   */
  private calculateConfidence(pattern: ResponseTimePattern): number {
    const { sampleCount, stdDeviation, averageResponseHours } = pattern;

    // Base confidence from sample size (logarithmic)
    let confidence = Math.min(0.5, Math.log10(sampleCount + 1) * 0.2);

    // Adjust based on consistency (low std dev = high confidence)
    if (stdDeviation !== null && averageResponseHours > 0) {
      const coefficientOfVariation = stdDeviation / averageResponseHours;
      // Lower CV = higher confidence bonus
      const consistencyBonus = Math.max(0, 0.5 - coefficientOfVariation * 0.5);
      confidence += consistencyBonus;
    } else {
      // Without std dev, give moderate consistency bonus
      confidence += 0.25;
    }

    // Cap at 95% confidence
    return Math.min(0.95, Math.round(confidence * 100) / 100);
  }

  /**
   * Map Prisma model to domain type
   */
  private mapToPattern(pattern: {
    id: string;
    firmId: string;
    userId: string;
    taskType: string;
    caseType: string | null;
    averageResponseHours: number;
    medianResponseHours: number;
    minResponseHours: number;
    maxResponseHours: number;
    sampleCount: number;
    stdDeviation: number | null;
    dayOfWeekPattern: unknown;
    timeOfDayPattern: unknown;
    lastCalculatedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): ResponseTimePattern {
    return {
      id: pattern.id,
      firmId: pattern.firmId,
      userId: pattern.userId,
      taskType: pattern.taskType,
      caseType: pattern.caseType,
      averageResponseHours: pattern.averageResponseHours,
      medianResponseHours: pattern.medianResponseHours,
      minResponseHours: pattern.minResponseHours,
      maxResponseHours: pattern.maxResponseHours,
      sampleCount: pattern.sampleCount,
      stdDeviation: pattern.stdDeviation,
      dayOfWeekPattern: pattern.dayOfWeekPattern as DayOfWeekPattern | null,
      timeOfDayPattern: pattern.timeOfDayPattern as TimeOfDayPattern | null,
      lastCalculatedAt: pattern.lastCalculatedAt,
      createdAt: pattern.createdAt,
      updatedAt: pattern.updatedAt,
    };
  }
}

// Export singleton instance
export const responseTimePatternService = new ResponseTimePatternService();
