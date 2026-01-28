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
  getRetainerPeriodDates(period: RetainerPeriod, referenceDate: Date = new Date()): PeriodDates {
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
   * @param _caseId - The case ID (unused - rollover tracking removed)
   * @param _currentPeriodStart - Start of the current period (unused)
   * @param retainerRollover - Whether rollover is enabled for this case
   * @returns Always returns 0 - rollover tracking has been removed
   */
  async calculateRollover(
    _caseId: string,
    _currentPeriodStart: Date,
    retainerRollover: boolean
  ): Promise<number> {
    if (!retainerRollover) {
      return 0;
    }

    // Note: RetainerPeriodUsage model has been removed from the schema.
    // Rollover calculation is no longer supported without stored period records.
    // Return 0 to maintain API compatibility.
    return 0;
  }

  /**
   * Calculate current retainer usage for a case
   * @param caseId - The case ID
   * @param firmId - The firm ID for authorization scope
   */
  async calculateCurrentUsage(caseId: string, firmId: string): Promise<RetainerUsageData | null> {
    // Get the case with retainer configuration
    const caseData = await prisma.case.findFirst({
      where: {
        id: caseId,
        firmId,
        billingType: 'Retainer',
      },
      include: {
        firm: true,
        client: true,
      },
    });

    if (!caseData || !caseData.retainerPeriod || !caseData.retainerAmount) {
      return null;
    }

    // Get period boundaries
    const { start: periodStart, end: periodEnd } = this.getRetainerPeriodDates(
      caseData.retainerPeriod
    );

    // Get effective rate using hierarchy: case → client → firm
    const caseRates = caseData.customRates as { partnerRate?: number } | null;
    const clientRates = caseData.client?.customRates as { partnerRate?: number } | null;
    const firmRates = caseData.firm.defaultRates as { partnerRate?: number } | null;
    const effectiveRate =
      caseRates?.partnerRate ?? clientRates?.partnerRate ?? firmRates?.partnerRate ?? 0;

    if (effectiveRate <= 0) {
      return null;
    }

    // Calculate included hours
    const retainerAmount = Number(caseData.retainerAmount);
    const hoursIncluded = this.getIncludedHours(retainerAmount, effectiveRate);

    // Calculate rollover from previous period
    const rolledOver = await this.calculateRollover(caseId, periodStart, caseData.retainerRollover);

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
    const utilizationPercent = totalAvailable > 0 ? (hoursUsed / totalAvailable) * 100 : 0;

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
        client: true,
      },
    });

    if (!caseData || !caseData.retainerPeriod || !caseData.retainerAmount) {
      return null;
    }

    // Determine which period to query
    const referenceDate = periodStart || new Date();
    const { start, end } = this.getRetainerPeriodDates(caseData.retainerPeriod, referenceDate);

    // Get effective rate using hierarchy: case → client → firm
    const caseRates = caseData.customRates as { partnerRate?: number } | null;
    const clientRates = caseData.client?.customRates as { partnerRate?: number } | null;
    const firmRates = caseData.firm.defaultRates as { partnerRate?: number } | null;
    const effectiveRate =
      caseRates?.partnerRate ?? clientRates?.partnerRate ?? firmRates?.partnerRate ?? 0;

    if (effectiveRate <= 0) {
      return null;
    }

    const retainerAmount = Number(caseData.retainerAmount);
    const hoursIncluded = this.getIncludedHours(retainerAmount, effectiveRate);
    const rolledOver = await this.calculateRollover(caseId, start, caseData.retainerRollover);

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
    const utilizationPercent = totalAvailable > 0 ? (hoursUsed / totalAvailable) * 100 : 0;

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
   * @param _limit - Maximum number of periods to return (unused - only current period available)
   * @returns Array with current period usage only (historical tracking has been removed)
   */
  async getUsageHistory(
    caseId: string,
    firmId: string,
    _limit: number = 12
  ): Promise<RetainerUsageData[]> {
    // Note: RetainerPeriodUsage model has been removed from the schema.
    // Historical usage tracking is no longer available.
    // Return only the current period usage.
    const currentUsage = await this.calculateCurrentUsage(caseId, firmId);
    if (currentUsage) {
      return [currentUsage];
    }
    return [];
  }

  /**
   * Create or update a retainer usage record for period tracking
   * @deprecated RetainerPeriodUsage model has been removed from the schema.
   * This method is kept for API compatibility but does nothing.
   */
  async upsertPeriodUsage(
    _caseId: string,
    _firmId: string,
    _periodStart: Date,
    _periodEnd: Date,
    _hoursUsed: number,
    _hoursIncluded: number,
    _rolledOver: number
  ): Promise<void> {
    // Note: RetainerPeriodUsage model has been removed from the schema.
    // This method is kept for API compatibility but no longer persists data.
    return;
  }
}

// Export singleton instance
export const retainerService = new RetainerService();
