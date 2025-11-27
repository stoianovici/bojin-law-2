/**
 * Financial KPIs Service
 * Story 2.11.3: Financial KPIs Backend Service
 *
 * Calculates comprehensive financial KPIs for Partners and Business Owners.
 * All calculations respect data scope from Story 2.11.1:
 * - BusinessOwner: sees all firm cases ('firm' scope)
 * - Partner: sees only managed cases ('own' scope)
 *
 * Implements 5-minute caching for expensive calculations (AC: 9)
 */

import { prisma } from '@legal-platform/database';
import { Prisma, BillingType, UserRole, CaseStatus } from '@prisma/client';
import { getFinancialDataFilter, getFinancialDataScope, FinancialDataScope } from '../graphql/resolvers/utils/financialDataScope';
import type { Context } from '../graphql/resolvers/case.resolvers';

// ============================================================================
// Types
// ============================================================================

export interface DateRange {
  start: Date;
  end: Date;
}

export interface RevenueByBillingType {
  hourly: number;
  fixed: number;
  retainer: number;
}

export interface RevenueTrendPoint {
  date: Date;
  revenue: number;
  caseCount: number;
}

export interface UtilizationByRole {
  role: UserRole;
  billableHours: number;
  totalHours: number;
  utilizationRate: number;
}

export interface CaseProfitability {
  caseId: string;
  caseName: string;
  billingType: BillingType;
  revenue: number;
  cost: number;
  margin: number;
  marginPercent: number;
}

export interface RevenueComparison {
  caseId: string;
  caseTitle: string;
  billingType: 'Hourly' | 'Fixed';
  actualRevenue: number;
  projectedRevenue: number;
  variance: number;
  variancePercent: number;
  timeEntriesCount: number;
  totalHours: number;
}

export interface FirmRevenueKPIsResult {
  totalCases: number;
  hourlyCount: number;
  fixedCount: number;
  avgVariance: number;
  avgVariancePercent: number;
  topPerformingCases: RevenueComparison[];
  underperformingCases: RevenueComparison[];
}

export interface FinancialKPIsResult {
  // Revenue Metrics
  totalRevenue: number;
  revenueByBillingType: RevenueByBillingType;
  revenueTrend: RevenueTrendPoint[];

  // Utilization Metrics
  totalBillableHours: number;
  totalNonBillableHours: number;
  utilizationRate: number;
  utilizationByRole: UtilizationByRole[];

  // Realization Metrics
  realizationRate: number;
  billedHours: number;
  workedHours: number;

  // Profitability Metrics
  effectiveHourlyRate: number;
  profitabilityByCase: CaseProfitability[];

  // Retainer Metrics
  retainerUtilizationAverage: number | null;
  retainerCasesCount: number;

  // Metadata
  dataScope: 'OWN' | 'FIRM';
  calculatedAt: Date;
  caseCount: number;
  dateRange: DateRange;
}

// ============================================================================
// Cache Implementation (AC: 9)
// ============================================================================

interface CacheEntry {
  data: FinancialKPIsResult;
  expiry: number;
}

// Simple in-memory cache - placeholder for Redis upgrade
const kpiCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Clear expired cache entries periodically
 */
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of kpiCache.entries()) {
    if (entry.expiry < now) {
      kpiCache.delete(key);
    }
  }
}

// Clean cache every minute
setInterval(cleanExpiredCache, 60 * 1000);

/**
 * Clear all cache entries (useful for testing)
 */
export function clearKpiCache(): void {
  kpiCache.clear();
}

// ============================================================================
// Service Implementation
// ============================================================================

export class FinancialKPIsService {
  private context: Context;

  constructor(context: Context) {
    this.context = context;
  }

  /**
   * Generate cache key from user context and date range
   */
  private getCacheKey(dateRange: DateRange): string {
    const user = this.context.user;
    if (!user) return '';
    return `kpi:${user.id}:${user.firmId}:${dateRange.start.toISOString()}:${dateRange.end.toISOString()}`;
  }

  /**
   * Get default date range (last 30 days)
   */
  private getDefaultDateRange(): DateRange {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  /**
   * Main entry point - calculate all KPIs with caching
   * AC: 3, 9
   */
  async calculateKPIs(inputDateRange?: DateRange): Promise<FinancialKPIsResult> {
    const dateRange = inputDateRange || this.getDefaultDateRange();
    const cacheKey = this.getCacheKey(dateRange);

    // Check cache (AC: 9)
    const cached = kpiCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // Get data scope filter (Story 2.11.1)
    const filter = getFinancialDataFilter(this.context);
    const scope = getFinancialDataScope(this.context);

    // Calculate all metrics in parallel for performance
    const [
      revenueMetrics,
      utilizationMetrics,
      realizationMetrics,
      profitabilityMetrics,
      retainerMetrics,
      caseCount,
    ] = await Promise.all([
      this.calculateRevenueMetrics(filter, dateRange),
      this.calculateUtilizationMetrics(filter, dateRange),
      this.calculateRealizationMetrics(filter, dateRange),
      this.calculateProfitabilityMetrics(filter, dateRange),
      this.calculateRetainerMetrics(filter, dateRange),
      this.getCaseCount(filter, dateRange),
    ]);

    const result: FinancialKPIsResult = {
      ...revenueMetrics,
      ...utilizationMetrics,
      ...realizationMetrics,
      ...profitabilityMetrics,
      ...retainerMetrics,
      dataScope: scope === 'firm' ? 'FIRM' : 'OWN',
      calculatedAt: new Date(),
      caseCount,
      dateRange,
    };

    // Cache result (AC: 9)
    kpiCache.set(cacheKey, {
      data: result,
      expiry: Date.now() + CACHE_TTL_MS,
    });

    return result;
  }

  /**
   * Get count of cases in scope
   */
  private async getCaseCount(
    filter: Prisma.CaseWhereInput,
    dateRange: DateRange
  ): Promise<number> {
    return prisma.case.count({
      where: {
        ...filter,
        status: { not: 'Archived' },
        openedDate: { lte: dateRange.end },
        OR: [
          { closedDate: null },
          { closedDate: { gte: dateRange.start } },
        ],
      },
    });
  }

  // ============================================================================
  // Task 3: Revenue Metrics (AC: 4)
  // ============================================================================

  private async calculateRevenueMetrics(
    filter: Prisma.CaseWhereInput,
    dateRange: DateRange
  ): Promise<{
    totalRevenue: number;
    revenueByBillingType: RevenueByBillingType;
    revenueTrend: RevenueTrendPoint[];
  }> {
    // Get all cases in scope
    const cases = await prisma.case.findMany({
      where: {
        ...filter,
        status: { not: 'Archived' },
      },
      select: {
        id: true,
        billingType: true,
        fixedAmount: true,
        retainerAmount: true,
        status: true,
      },
    });

    const caseIds = cases.map(c => c.id);

    // Get time entries for hourly revenue calculation
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        caseId: { in: caseIds },
        date: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
        billable: true,
      },
      select: {
        hours: true,
        hourlyRate: true,
        caseId: true,
        date: true,
      },
    });

    // Calculate hourly revenue
    let hourlyRevenue = 0;
    for (const entry of timeEntries) {
      const hours = Number(entry.hours);
      const rate = Number(entry.hourlyRate);
      hourlyRevenue += hours * rate;
    }

    // Calculate fixed revenue (only from completed cases)
    let fixedRevenue = 0;
    const fixedCases = cases.filter(c => c.billingType === 'Fixed' && c.status === 'Closed');
    for (const c of fixedCases) {
      fixedRevenue += Number(c.fixedAmount || 0);
    }

    // Calculate retainer revenue
    let retainerRevenue = 0;
    const retainerCases = cases.filter(c => c.billingType === 'Retainer');
    for (const c of retainerCases) {
      // Monthly retainer amount prorated to date range
      retainerRevenue += Number(c.retainerAmount || 0);
    }

    const totalRevenue = hourlyRevenue + fixedRevenue + retainerRevenue;

    // Calculate revenue trend (group by day)
    const revenueTrend = await this.calculateRevenueTrend(caseIds, dateRange);

    return {
      totalRevenue,
      revenueByBillingType: {
        hourly: hourlyRevenue,
        fixed: fixedRevenue,
        retainer: retainerRevenue,
      },
      revenueTrend,
    };
  }

  /**
   * Calculate revenue trend over time for chart display
   */
  private async calculateRevenueTrend(
    caseIds: string[],
    dateRange: DateRange
  ): Promise<RevenueTrendPoint[]> {
    if (caseIds.length === 0) {
      return [];
    }

    // Group time entries by date
    const timeEntries = await prisma.timeEntry.groupBy({
      by: ['date'],
      where: {
        caseId: { in: caseIds },
        date: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
        billable: true,
      },
      _sum: {
        hours: true,
      },
      _count: {
        caseId: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Get average hourly rate for approximation
    const avgRate = await prisma.timeEntry.aggregate({
      where: {
        caseId: { in: caseIds },
        date: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
        billable: true,
      },
      _avg: {
        hourlyRate: true,
      },
    });

    const avgHourlyRate = Number(avgRate._avg.hourlyRate || 0);

    return timeEntries.map(entry => ({
      date: entry.date,
      revenue: Number(entry._sum.hours || 0) * avgHourlyRate,
      caseCount: entry._count.caseId,
    }));
  }

  // ============================================================================
  // Task 4: Utilization Metrics (AC: 5)
  // ============================================================================

  private async calculateUtilizationMetrics(
    filter: Prisma.CaseWhereInput,
    dateRange: DateRange
  ): Promise<{
    totalBillableHours: number;
    totalNonBillableHours: number;
    utilizationRate: number;
    utilizationByRole: UtilizationByRole[];
  }> {
    // Get case IDs in scope
    const cases = await prisma.case.findMany({
      where: {
        ...filter,
        status: { not: 'Archived' },
      },
      select: { id: true },
    });

    const caseIds = cases.map(c => c.id);

    if (caseIds.length === 0) {
      return {
        totalBillableHours: 0,
        totalNonBillableHours: 0,
        utilizationRate: 0,
        utilizationByRole: [],
      };
    }

    // Get all time entries with user role
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        caseId: { in: caseIds },
        date: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      select: {
        hours: true,
        billable: true,
        user: {
          select: {
            role: true,
          },
        },
      },
    });

    let totalBillableHours = 0;
    let totalNonBillableHours = 0;

    // Group by role
    const roleMap = new Map<UserRole, { billable: number; total: number }>();

    for (const entry of timeEntries) {
      const hours = Number(entry.hours);
      const role = entry.user.role;

      if (entry.billable) {
        totalBillableHours += hours;
      } else {
        totalNonBillableHours += hours;
      }

      if (!roleMap.has(role)) {
        roleMap.set(role, { billable: 0, total: 0 });
      }

      const roleData = roleMap.get(role)!;
      roleData.total += hours;
      if (entry.billable) {
        roleData.billable += hours;
      }
    }

    const totalHours = totalBillableHours + totalNonBillableHours;
    const utilizationRate = totalHours > 0 ? (totalBillableHours / totalHours) * 100 : 0;

    const utilizationByRole: UtilizationByRole[] = [];
    for (const [role, data] of roleMap.entries()) {
      utilizationByRole.push({
        role,
        billableHours: data.billable,
        totalHours: data.total,
        utilizationRate: data.total > 0 ? (data.billable / data.total) * 100 : 0,
      });
    }

    // Sort by role name for consistent ordering
    utilizationByRole.sort((a, b) => a.role.localeCompare(b.role));

    return {
      totalBillableHours,
      totalNonBillableHours,
      utilizationRate,
      utilizationByRole,
    };
  }

  // ============================================================================
  // Task 5: Realization Metrics (AC: 6)
  // ============================================================================

  private async calculateRealizationMetrics(
    filter: Prisma.CaseWhereInput,
    dateRange: DateRange
  ): Promise<{
    realizationRate: number;
    billedHours: number;
    workedHours: number;
  }> {
    // Get case IDs in scope
    const cases = await prisma.case.findMany({
      where: {
        ...filter,
        status: { not: 'Archived' },
      },
      select: { id: true },
    });

    const caseIds = cases.map(c => c.id);

    if (caseIds.length === 0) {
      return {
        realizationRate: 0,
        billedHours: 0,
        workedHours: 0,
      };
    }

    // Get time entries
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        caseId: { in: caseIds },
        date: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      select: {
        hours: true,
        hourlyRate: true,
        billable: true,
      },
    });

    let billedAmount = 0;
    let workedHours = 0;
    let billedHours = 0;
    let expectedAmount = 0;

    for (const entry of timeEntries) {
      const hours = Number(entry.hours);
      const rate = Number(entry.hourlyRate);

      // All billable hours are considered "worked"
      if (entry.billable) {
        workedHours += hours;
        billedHours += hours;
        billedAmount += hours * rate;
        expectedAmount += hours * rate;
      }
    }

    // Realization rate: (billed amount / expected amount) * 100
    // For simplicity, assuming all billable hours are actually billed
    // In a real system, you'd track actual invoiced amounts
    const realizationRate = expectedAmount > 0 ? (billedAmount / expectedAmount) * 100 : 0;

    return {
      realizationRate,
      billedHours,
      workedHours,
    };
  }

  // ============================================================================
  // Task 6: Profitability Metrics (AC: 7)
  // ============================================================================

  private async calculateProfitabilityMetrics(
    filter: Prisma.CaseWhereInput,
    dateRange: DateRange
  ): Promise<{
    effectiveHourlyRate: number;
    profitabilityByCase: CaseProfitability[];
  }> {
    // Get cases in scope with their details
    const cases = await prisma.case.findMany({
      where: {
        ...filter,
        status: { not: 'Archived' },
      },
      select: {
        id: true,
        title: true,
        billingType: true,
        fixedAmount: true,
        retainerAmount: true,
        customRates: true,
        firm: {
          select: {
            defaultRates: true,
          },
        },
      },
    });

    const caseIds = cases.map(c => c.id);

    if (caseIds.length === 0) {
      return {
        effectiveHourlyRate: 0,
        profitabilityByCase: [],
      };
    }

    // Get time entries grouped by case
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        caseId: { in: caseIds },
        date: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
        billable: true,
      },
      select: {
        caseId: true,
        hours: true,
        hourlyRate: true,
      },
    });

    // Calculate total revenue and hours for effective hourly rate
    let totalRevenue = 0;
    let totalBillableHours = 0;

    // Group by case for profitability
    const caseDataMap = new Map<string, { revenue: number; hours: number; cost: number }>();

    for (const entry of timeEntries) {
      const hours = Number(entry.hours);
      const rate = Number(entry.hourlyRate);
      const revenue = hours * rate;

      totalRevenue += revenue;
      totalBillableHours += hours;

      if (!caseDataMap.has(entry.caseId)) {
        caseDataMap.set(entry.caseId, { revenue: 0, hours: 0, cost: 0 });
      }

      const caseData = caseDataMap.get(entry.caseId)!;
      caseData.revenue += revenue;
      caseData.hours += hours;
      // Cost estimation: 50% of revenue as approximate labor cost
      // In real implementation, this would use actual cost rates
      caseData.cost += revenue * 0.5;
    }

    // Add fixed and retainer revenue to cases
    for (const c of cases) {
      if (!caseDataMap.has(c.id)) {
        caseDataMap.set(c.id, { revenue: 0, hours: 0, cost: 0 });
      }

      const caseData = caseDataMap.get(c.id)!;

      if (c.billingType === 'Fixed' && c.fixedAmount) {
        const fixedAmount = Number(c.fixedAmount);
        caseData.revenue += fixedAmount;
        totalRevenue += fixedAmount;
      } else if (c.billingType === 'Retainer' && c.retainerAmount) {
        const retainerAmount = Number(c.retainerAmount);
        caseData.revenue += retainerAmount;
        totalRevenue += retainerAmount;
      }
    }

    const effectiveHourlyRate = totalBillableHours > 0 ? totalRevenue / totalBillableHours : 0;

    // Build profitability by case (top 10 by margin)
    const profitabilityByCase: CaseProfitability[] = [];

    for (const c of cases) {
      const caseData = caseDataMap.get(c.id);
      if (!caseData || caseData.revenue === 0) continue;

      const margin = caseData.revenue - caseData.cost;
      const marginPercent = caseData.revenue > 0 ? (margin / caseData.revenue) * 100 : 0;

      profitabilityByCase.push({
        caseId: c.id,
        caseName: c.title,
        billingType: c.billingType,
        revenue: caseData.revenue,
        cost: caseData.cost,
        margin,
        marginPercent,
      });
    }

    // Sort by margin descending and take top 10
    profitabilityByCase.sort((a, b) => b.margin - a.margin);
    const top10Profitable = profitabilityByCase.slice(0, 10);

    return {
      effectiveHourlyRate,
      profitabilityByCase: top10Profitable,
    };
  }

  // ============================================================================
  // Retainer Metrics
  // ============================================================================

  private async calculateRetainerMetrics(
    filter: Prisma.CaseWhereInput,
    dateRange: DateRange
  ): Promise<{
    retainerUtilizationAverage: number | null;
    retainerCasesCount: number;
  }> {
    // Get retainer cases in scope
    const retainerCases = await prisma.case.findMany({
      where: {
        ...filter,
        billingType: 'Retainer',
        status: { not: 'Archived' },
      },
      select: {
        id: true,
        retainerAmount: true,
        customRates: true,
        firm: {
          select: {
            defaultRates: true,
          },
        },
      },
    });

    const retainerCasesCount = retainerCases.length;

    if (retainerCasesCount === 0) {
      return {
        retainerUtilizationAverage: null,
        retainerCasesCount: 0,
      };
    }

    // Calculate average utilization across retainer cases
    let totalUtilization = 0;
    let validCases = 0;

    for (const c of retainerCases) {
      const retainerAmount = Number(c.retainerAmount || 0);
      if (retainerAmount <= 0) continue;

      // Get effective rate
      const customRates = c.customRates as { partnerRate?: number } | null;
      const firmRates = c.firm.defaultRates as { partnerRate?: number } | null;
      const effectiveRate = customRates?.partnerRate ?? firmRates?.partnerRate ?? 0;

      if (effectiveRate <= 0) continue;

      // Calculate included hours
      const hoursIncluded = retainerAmount / effectiveRate;

      // Get hours used in date range
      const hoursUsedAggregate = await prisma.timeEntry.aggregate({
        where: {
          caseId: c.id,
          date: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
          billable: true,
        },
        _sum: {
          hours: true,
        },
      });

      const hoursUsed = Number(hoursUsedAggregate._sum.hours || 0);
      const utilization = hoursIncluded > 0 ? (hoursUsed / hoursIncluded) * 100 : 0;

      totalUtilization += utilization;
      validCases++;
    }

    const retainerUtilizationAverage = validCases > 0 ? totalUtilization / validCases : null;

    return {
      retainerUtilizationAverage,
      retainerCasesCount,
    };
  }

  // ============================================================================
  // Case Revenue KPI (Story 2.8.1)
  // ============================================================================

  /**
   * Calculate revenue KPI for a specific case
   * Returns comparison between actual and projected revenue
   */
  async calculateCaseRevenueKPI(caseId: string): Promise<RevenueComparison | null> {
    const user = this.context.user;
    if (!user) return null;

    // Get case with billing info
    const caseData = await prisma.case.findFirst({
      where: {
        id: caseId,
        firmId: user.firmId,
      },
      select: {
        id: true,
        title: true,
        billingType: true,
        fixedAmount: true,
        customRates: true,
        firm: {
          select: {
            defaultRates: true,
          },
        },
      },
    });

    if (!caseData) {
      return null;
    }

    // Get time entries for this case
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        caseId,
        billable: true,
      },
      select: {
        hours: true,
        hourlyRate: true,
      },
    });

    const timeEntriesCount = timeEntries.length;
    let totalHours = 0;
    let projectedRevenue = 0;

    for (const entry of timeEntries) {
      const hours = Number(entry.hours);
      const rate = Number(entry.hourlyRate);
      totalHours += hours;
      projectedRevenue += hours * rate;
    }

    // Calculate actual revenue based on billing type
    let actualRevenue = 0;
    const billingType = caseData.billingType === 'Fixed' ? 'Fixed' : 'Hourly';

    if (billingType === 'Fixed') {
      actualRevenue = Number(caseData.fixedAmount || 0);
    } else {
      actualRevenue = projectedRevenue;
    }

    // Calculate variance
    const variance = actualRevenue - projectedRevenue;
    const variancePercent = projectedRevenue > 0 ? (variance / projectedRevenue) * 100 : 0;

    return {
      caseId: caseData.id,
      caseTitle: caseData.title,
      billingType,
      actualRevenue,
      projectedRevenue,
      variance,
      variancePercent,
      timeEntriesCount,
      totalHours,
    };
  }

  // ============================================================================
  // Firm Revenue KPIs (Story 2.8.1)
  // ============================================================================

  /**
   * Calculate firm-wide revenue KPIs aggregation
   * Shows overall performance metrics and top/underperforming cases
   */
  async calculateFirmRevenueKPIs(inputDateRange?: DateRange): Promise<FirmRevenueKPIsResult> {
    const dateRange = inputDateRange || this.getDefaultDateRange();
    const filter = getFinancialDataFilter(this.context);

    // Get all cases in scope
    const cases = await prisma.case.findMany({
      where: {
        ...filter,
        status: { not: 'Archived' },
      },
      select: {
        id: true,
        title: true,
        billingType: true,
        fixedAmount: true,
        customRates: true,
        firm: {
          select: {
            defaultRates: true,
          },
        },
      },
    });

    const totalCases = cases.length;
    const hourlyCount = cases.filter(c => c.billingType === 'Hourly').length;
    const fixedCount = cases.filter(c => c.billingType === 'Fixed').length;

    if (totalCases === 0) {
      return {
        totalCases: 0,
        hourlyCount: 0,
        fixedCount: 0,
        avgVariance: 0,
        avgVariancePercent: 0,
        topPerformingCases: [],
        underperformingCases: [],
      };
    }

    // Calculate KPI for each case
    const caseKPIs: RevenueComparison[] = [];

    for (const caseData of cases) {
      // Get time entries for this case
      const timeEntries = await prisma.timeEntry.findMany({
        where: {
          caseId: caseData.id,
          billable: true,
          date: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        select: {
          hours: true,
          hourlyRate: true,
        },
      });

      const timeEntriesCount = timeEntries.length;
      let totalHours = 0;
      let projectedRevenue = 0;

      for (const entry of timeEntries) {
        const hours = Number(entry.hours);
        const rate = Number(entry.hourlyRate);
        totalHours += hours;
        projectedRevenue += hours * rate;
      }

      // Calculate actual revenue based on billing type
      let actualRevenue = 0;
      const billingType = caseData.billingType === 'Fixed' ? 'Fixed' : 'Hourly';

      if (billingType === 'Fixed') {
        actualRevenue = Number(caseData.fixedAmount || 0);
      } else {
        actualRevenue = projectedRevenue;
      }

      // Calculate variance
      const variance = actualRevenue - projectedRevenue;
      const variancePercent = projectedRevenue > 0 ? (variance / projectedRevenue) * 100 : 0;

      caseKPIs.push({
        caseId: caseData.id,
        caseTitle: caseData.title,
        billingType,
        actualRevenue,
        projectedRevenue,
        variance,
        variancePercent,
        timeEntriesCount,
        totalHours,
      });
    }

    // Calculate averages
    const totalVariance = caseKPIs.reduce((sum, c) => sum + c.variance, 0);
    const totalVariancePercent = caseKPIs.reduce((sum, c) => sum + c.variancePercent, 0);
    const avgVariance = totalCases > 0 ? totalVariance / totalCases : 0;
    const avgVariancePercent = totalCases > 0 ? totalVariancePercent / totalCases : 0;

    // Sort for top and underperforming
    const sortedByVariance = [...caseKPIs].sort((a, b) => b.variance - a.variance);
    const topPerformingCases = sortedByVariance.filter(c => c.variance > 0).slice(0, 5);
    const underperformingCases = sortedByVariance.filter(c => c.variance < 0).slice(-5).reverse();

    return {
      totalCases,
      hourlyCount,
      fixedCount,
      avgVariance,
      avgVariancePercent,
      topPerformingCases,
      underperformingCases,
    };
  }
}

// Export factory function for creating service instances
export function createFinancialKPIsService(context: Context): FinancialKPIsService {
  return new FinancialKPIsService(context);
}
