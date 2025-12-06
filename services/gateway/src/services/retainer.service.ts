/**
 * Retainer Service
 * Story 2.11.2: Retainer Billing Support
 *
 * Handles retainer period calculations, usage tracking, and rollover logic
 */

import { prisma } from '@legal-platform/database';
import type { RetainerPeriod } from '@prisma/client';

// Types for retainer usage data
export interface RetainerUsageData {
  periodStart: Date;
  periodEnd: Date;
  hoursUsed: number;
  hoursIncluded: number;
  rolledOver: number;
  remaining: number;
  utilizationPercent: number;
}

export interface PeriodDates {
  start: Date;
  end: Date;
}

export class RetainerService {
  /**
   * Get the start and end dates for a retainer period
   * @param period - The retainer billing period (Monthly, Quarterly, Annually)
   * @param referenceDate - The date to calculate period boundaries for (defaults to today)
   */
  getRetainerPeriodDates(
    period: RetainerPeriod,
    referenceDate: Date = new Date()
  ): PeriodDates {
    const start = new Date(referenceDate);
    const end = new Date(referenceDate);

    // Reset time to start of day for consistency
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    switch (period) {
      case 'Monthly':
        // Start: First day of the month
        start.setDate(1);
        // End: Last day of the month
        end.setMonth(end.getMonth() + 1);
        end.setDate(0); // Setting date to 0 gives last day of previous month
        break;

      case 'Quarterly': {
        // Determine which quarter we're in (0-3)
        const quarter = Math.floor(start.getMonth() / 3);
        // Start: First day of the quarter
        start.setMonth(quarter * 3, 1);
        // End: Last day of the quarter
        end.setMonth((quarter + 1) * 3, 0);
        break;
      }

      case 'Annually':
        // Start: January 1st
        start.setMonth(0, 1);
        // End: December 31st
        end.setMonth(11, 31);
        break;
    }

    return { start, end };
  }

  /**
   * Calculate included hours from retainer amount and effective rate
   * @param retainerAmount - The retainer amount in USD cents per period
   * @param effectiveRate - The effective hourly rate in USD cents
   * @returns The number of hours included in the retainer
   */
  getIncludedHours(retainerAmount: number, effectiveRate: number): number {
    if (effectiveRate <= 0) {
      throw new Error('Effective rate must be greater than zero');
    }
    return retainerAmount / effectiveRate;
  }

  /**
   * Calculate rollover from previous period
   * @param caseId - The case ID
   * @param currentPeriodStart - Start of the current period
   * @param retainerRollover - Whether rollover is enabled for this case
   */
  async calculateRollover(
    caseId: string,
    currentPeriodStart: Date,
    retainerRollover: boolean
  ): Promise<number> {
    if (!retainerRollover) {
      return 0;
    }

    // Find the most recent period before current
    const previousUsage = await prisma.retainerPeriodUsage.findFirst({
      where: {
        caseId,
        periodEnd: {
          lt: currentPeriodStart,
        },
      },
      orderBy: {
        periodEnd: 'desc',
      },
    });

    if (!previousUsage) {
      return 0;
    }

    // Calculate unused hours from previous period
    const hoursUsed = Number(previousUsage.hoursUsed);
    const hoursIncluded = Number(previousUsage.hoursIncluded);
    const previousRolledOver = Number(previousUsage.rolledOver);
    const totalAvailable = hoursIncluded + previousRolledOver;
    const unused = Math.max(0, totalAvailable - hoursUsed);

    return unused;
  }

  /**
   * Calculate current retainer usage for a case
   * @param caseId - The case ID
   * @param firmId - The firm ID for authorization scope
   */
  async calculateCurrentUsage(
    caseId: string,
    firmId: string
  ): Promise<RetainerUsageData | null> {
    // Get the case with retainer configuration
    const caseData = await prisma.case.findFirst({
      where: {
        id: caseId,
        firmId,
        billingType: 'Retainer',
      },
      include: {
        firm: true,
      },
    });

    if (!caseData || !caseData.retainerPeriod || !caseData.retainerAmount) {
      return null;
    }

    // Get period boundaries
    const { start: periodStart, end: periodEnd } = this.getRetainerPeriodDates(
      caseData.retainerPeriod
    );

    // Get effective rate (use custom rate if set, otherwise firm default)
    const customRates = caseData.customRates as { partnerRate?: number } | null;
    const firmRates = caseData.firm.defaultRates as { partnerRate?: number } | null;
    const effectiveRate =
      customRates?.partnerRate ?? firmRates?.partnerRate ?? 0;

    if (effectiveRate <= 0) {
      return null;
    }

    // Calculate included hours
    const retainerAmount = Number(caseData.retainerAmount);
    const hoursIncluded = this.getIncludedHours(retainerAmount, effectiveRate);

    // Calculate rollover from previous period
    const rolledOver = await this.calculateRollover(
      caseId,
      periodStart,
      caseData.retainerRollover
    );

    // Sum hours used in current period from time entries
    const timeEntriesAggregate = await prisma.timeEntry.aggregate({
      where: {
        caseId,
        firmId,
        date: {
          gte: periodStart,
          lte: periodEnd,
        },
        billable: true,
      },
      _sum: {
        hours: true,
      },
    });

    const hoursUsed = Number(timeEntriesAggregate._sum.hours ?? 0);
    const totalAvailable = hoursIncluded + rolledOver;
    const remaining = Math.max(0, totalAvailable - hoursUsed);
    const utilizationPercent =
      totalAvailable > 0 ? (hoursUsed / totalAvailable) * 100 : 0;

    return {
      periodStart,
      periodEnd,
      hoursUsed,
      hoursIncluded,
      rolledOver,
      remaining,
      utilizationPercent,
    };
  }

  /**
   * Get retainer usage for a specific period
   * @param caseId - The case ID
   * @param firmId - The firm ID for authorization scope
   * @param periodStart - Optional start of period to query (defaults to current)
   */
  async getUsageForPeriod(
    caseId: string,
    firmId: string,
    periodStart?: Date
  ): Promise<RetainerUsageData | null> {
    // Get the case with retainer configuration
    const caseData = await prisma.case.findFirst({
      where: {
        id: caseId,
        firmId,
        billingType: 'Retainer',
      },
      include: {
        firm: true,
      },
    });

    if (!caseData || !caseData.retainerPeriod || !caseData.retainerAmount) {
      return null;
    }

    // Determine which period to query
    const referenceDate = periodStart || new Date();
    const { start, end } = this.getRetainerPeriodDates(
      caseData.retainerPeriod,
      referenceDate
    );

    // Check if we have a stored usage record for this period
    const storedUsage = await prisma.retainerPeriodUsage.findFirst({
      where: {
        caseId,
        periodStart: start,
      },
    });

    // Get effective rate
    const customRates = caseData.customRates as { partnerRate?: number } | null;
    const firmRates = caseData.firm.defaultRates as { partnerRate?: number } | null;
    const effectiveRate =
      customRates?.partnerRate ?? firmRates?.partnerRate ?? 0;

    if (effectiveRate <= 0) {
      return null;
    }

    const retainerAmount = Number(caseData.retainerAmount);
    const hoursIncluded = storedUsage
      ? Number(storedUsage.hoursIncluded)
      : this.getIncludedHours(retainerAmount, effectiveRate);

    const rolledOver = storedUsage
      ? Number(storedUsage.rolledOver)
      : await this.calculateRollover(caseId, start, caseData.retainerRollover);

    // Sum hours used in this period from time entries
    const timeEntriesAggregate = await prisma.timeEntry.aggregate({
      where: {
        caseId,
        firmId,
        date: {
          gte: start,
          lte: end,
        },
        billable: true,
      },
      _sum: {
        hours: true,
      },
    });

    const hoursUsed = Number(timeEntriesAggregate._sum.hours ?? 0);
    const totalAvailable = hoursIncluded + rolledOver;
    const remaining = Math.max(0, totalAvailable - hoursUsed);
    const utilizationPercent =
      totalAvailable > 0 ? (hoursUsed / totalAvailable) * 100 : 0;

    return {
      periodStart: start,
      periodEnd: end,
      hoursUsed,
      hoursIncluded,
      rolledOver,
      remaining,
      utilizationPercent,
    };
  }

  /**
   * Get retainer usage history for a case
   * @param caseId - The case ID
   * @param firmId - The firm ID for authorization scope
   * @param limit - Maximum number of periods to return (default 12)
   */
  async getUsageHistory(
    caseId: string,
    firmId: string,
    limit: number = 12
  ): Promise<RetainerUsageData[]> {
    // Get the case with retainer configuration
    const caseData = await prisma.case.findFirst({
      where: {
        id: caseId,
        firmId,
        billingType: 'Retainer',
      },
      include: {
        firm: true,
      },
    });

    if (!caseData || !caseData.retainerPeriod || !caseData.retainerAmount) {
      return [];
    }

    // Get stored usage records
    const usageRecords = await prisma.retainerPeriodUsage.findMany({
      where: {
        caseId,
        firmId,
      },
      orderBy: {
        periodStart: 'desc',
      },
      take: limit,
    });

    // Get effective rate for calculating historical data
    const customRates = caseData.customRates as { partnerRate?: number } | null;
    const firmRates = caseData.firm.defaultRates as { partnerRate?: number } | null;
    const effectiveRate =
      customRates?.partnerRate ?? firmRates?.partnerRate ?? 0;

    if (effectiveRate <= 0) {
      return [];
    }

    // Convert stored records to RetainerUsageData
    const history: RetainerUsageData[] = [];

    for (const record of usageRecords) {
      const hoursUsed = Number(record.hoursUsed);
      const hoursIncluded = Number(record.hoursIncluded);
      const rolledOver = Number(record.rolledOver);
      const totalAvailable = hoursIncluded + rolledOver;
      const remaining = Math.max(0, totalAvailable - hoursUsed);
      const utilizationPercent =
        totalAvailable > 0 ? (hoursUsed / totalAvailable) * 100 : 0;

      history.push({
        periodStart: record.periodStart,
        periodEnd: record.periodEnd,
        hoursUsed,
        hoursIncluded,
        rolledOver,
        remaining,
        utilizationPercent,
      });
    }

    // Add current period if not already in history
    const currentPeriod = this.getRetainerPeriodDates(caseData.retainerPeriod);
    const hasCurrentPeriod = history.some(
      (h) => h.periodStart.getTime() === currentPeriod.start.getTime()
    );

    if (!hasCurrentPeriod) {
      const currentUsage = await this.calculateCurrentUsage(caseId, firmId);
      if (currentUsage) {
        history.unshift(currentUsage);
      }
    }

    return history.slice(0, limit);
  }

  /**
   * Create or update a retainer usage record for period tracking
   * This should be called when periods close or when needing to snapshot usage
   */
  async upsertPeriodUsage(
    caseId: string,
    firmId: string,
    periodStart: Date,
    periodEnd: Date,
    hoursUsed: number,
    hoursIncluded: number,
    rolledOver: number
  ): Promise<void> {
    await prisma.retainerPeriodUsage.upsert({
      where: {
        caseId_periodStart: {
          caseId,
          periodStart,
        },
      },
      create: {
        caseId,
        firmId,
        periodStart,
        periodEnd,
        hoursUsed,
        hoursIncluded,
        rolledOver,
      },
      update: {
        hoursUsed,
        hoursIncluded,
        rolledOver,
      },
    });
  }
}

// Export singleton instance
export const retainerService = new RetainerService();
