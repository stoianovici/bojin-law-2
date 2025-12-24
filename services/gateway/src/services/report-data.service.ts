/**
 * Report Data Aggregation Service
 * OPS-153: Aggregates real data for predefined reports
 *
 * Provides query handlers for each data source (cases, timeEntries, clients, documents)
 * with firmId scoping and Romanian translations for enum values.
 */

import { prisma } from '@legal-platform/database';
import type { Prisma, CaseStatus, BillingType, TaskStatus } from '@prisma/client';
import type { Context } from '../graphql/resolvers/case.resolvers';
import type {
  ReportDataQuery,
  ChartDataPoint,
  ReportSummary,
  DateRange,
  CaseReportFilters,
  TimeReportFilters,
  FinancialReportFilters,
  ClientReportFilters,
  DocumentReportFilters,
} from '@legal-platform/types';

// ============================================================================
// Romanian Translations for Enum Values
// ============================================================================

const CASE_STATUS_RO: Record<CaseStatus, string> = {
  PendingApproval: 'În așteptare',
  Active: 'Activ',
  OnHold: 'Suspendat',
  Closed: 'Închis',
  Archived: 'Arhivat',
};

const BILLING_TYPE_RO: Record<BillingType, string> = {
  Hourly: 'Orar',
  Fixed: 'Sumă fixă',
  Retainer: 'Abonament',
};

// Dynamic case types are stored in case_type_configs table
// No static translation needed - names come from the database

const TASK_STATUS_RO: Record<TaskStatus, string> = {
  Pending: 'În așteptare',
  InProgress: 'În lucru',
  Completed: 'Finalizat',
  Cancelled: 'Anulat',
};

const DOCUMENT_STATUS_RO: Record<string, string> = {
  DRAFT: 'Ciornă',
  PENDING: 'În așteptare',
  FINAL: 'Final',
  ARCHIVED: 'Arhivat',
};

// ============================================================================
// Chart Colors
// ============================================================================

const CHART_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
];

// ============================================================================
// Types
// ============================================================================

export interface ReportDataResult {
  data: ChartDataPoint[];
  summary: ReportSummary;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class ReportDataService {
  private context: Context;
  private firmId: string;

  constructor(context: Context) {
    this.context = context;
    if (!context.user?.firmId) {
      throw new Error('User context with firmId required');
    }
    this.firmId = context.user.firmId;
  }

  /**
   * Main entry point - routes to appropriate query handler based on data source type
   */
  async getReportData(query: ReportDataQuery, dateRange: DateRange): Promise<ReportDataResult> {
    switch (query.type) {
      case 'cases':
        return this.queryCases(query.filters, dateRange);
      case 'timeEntries':
        return this.queryTimeEntries(query.filters, dateRange);
      case 'clients':
        return this.queryClients(query.filters);
      case 'documents':
        return this.queryDocuments(query.filters, dateRange);
      case 'invoices':
        // No Invoice model - use time entries for financial data
        return this.queryFinancialData(query.filters, dateRange);
      default:
        throw new Error(`Unknown data source type: ${(query as ReportDataQuery).type}`);
    }
  }

  // ============================================================================
  // Cases Query Handler
  // ============================================================================

  private async queryCases(
    filters: CaseReportFilters | undefined,
    dateRange: DateRange
  ): Promise<ReportDataResult> {
    const where: Prisma.CaseWhereInput = {
      firmId: this.firmId,
    };

    // Apply filters
    if (filters?.status?.length) {
      where.status = { in: filters.status as CaseStatus[] };
    }
    if (filters?.assignedTo?.length) {
      where.teamMembers = {
        some: {
          userId: { in: filters.assignedTo },
        },
      };
    }
    if (filters?.clientId) {
      where.clientId = filters.clientId;
    }
    if (filters?.dateRange || dateRange) {
      const range = filters?.dateRange || dateRange;
      where.openedDate = {
        gte: range.start,
        lte: range.end,
      };
    }

    // Group cases by status
    const cases = await prisma.case.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const data: ChartDataPoint[] = cases.map((group, index) => ({
      label: CASE_STATUS_RO[group.status] || group.status,
      value: group._count.id,
      color: CHART_COLORS[index % CHART_COLORS.length],
      metadata: { status: group.status },
    }));

    // Calculate summary
    const totalValue = data.reduce((sum, point) => sum + point.value, 0);
    const averageValue = data.length > 0 ? totalValue / data.length : 0;

    return {
      data,
      summary: {
        totalValue,
        averageValue,
        trendDirection: 'stable',
      },
    };
  }

  // ============================================================================
  // Time Entries Query Handler
  // ============================================================================

  private async queryTimeEntries(
    filters: TimeReportFilters | undefined,
    dateRange: DateRange
  ): Promise<ReportDataResult> {
    const where: Prisma.TimeEntryWhereInput = {
      firmId: this.firmId,
    };

    // Apply filters
    if (filters?.userId?.length) {
      where.userId = { in: filters.userId };
    }
    if (filters?.caseId) {
      where.caseId = filters.caseId;
    }
    if (filters?.billable !== undefined) {
      where.billable = filters.billable;
    }

    const range = filters?.dateRange || dateRange;
    where.date = {
      gte: range.start,
      lte: range.end,
    };

    // Get time entries grouped by user
    const timeEntries = await prisma.timeEntry.findMany({
      where,
      select: {
        userId: true,
        hours: true,
        hourlyRate: true,
        billable: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Aggregate by user
    const userMap = new Map<string, { name: string; hours: number; revenue: number }>();

    for (const entry of timeEntries) {
      const userName = `${entry.user.firstName} ${entry.user.lastName}`.trim();
      const existing = userMap.get(entry.userId) || {
        name: userName,
        hours: 0,
        revenue: 0,
      };

      const hours = Number(entry.hours);
      const rate = Number(entry.hourlyRate);

      existing.hours += hours;
      if (entry.billable) {
        existing.revenue += hours * rate;
      }

      userMap.set(entry.userId, existing);
    }

    const data: ChartDataPoint[] = Array.from(userMap.entries()).map(
      ([userId, userData], index) => ({
        label: userData.name,
        value: userData.hours,
        color: CHART_COLORS[index % CHART_COLORS.length],
        metadata: {
          userId,
          revenue: userData.revenue,
        },
      })
    );

    // Sort by hours descending
    data.sort((a, b) => b.value - a.value);

    // Calculate summary
    const totalValue = data.reduce((sum, point) => sum + point.value, 0);
    const averageValue = data.length > 0 ? totalValue / data.length : 0;
    const totalRevenue = data.reduce((sum, point) => sum + (point.metadata?.revenue || 0), 0);

    return {
      data,
      summary: {
        totalValue,
        averageValue,
        trendDirection: 'stable',
      },
    };
  }

  // ============================================================================
  // Clients Query Handler
  // ============================================================================

  private async queryClients(filters: ClientReportFilters | undefined): Promise<ReportDataResult> {
    const where: Prisma.ClientWhereInput = {
      firmId: this.firmId,
    };

    // Get clients with case counts
    const clients = await prisma.client.findMany({
      where,
      select: {
        id: true,
        name: true,
        cases: {
          select: {
            id: true,
            status: true,
          },
          where: filters?.hasOpenCases
            ? {
                status: { in: ['Active', 'PendingApproval', 'OnHold'] },
              }
            : undefined,
        },
      },
    });

    // Filter for active clients if requested
    let filteredClients = clients;
    if (filters?.activeOnly) {
      filteredClients = clients.filter((c) => c.cases.length > 0);
    }

    const data: ChartDataPoint[] = filteredClients
      .map((client, index) => ({
        label: client.name,
        value: client.cases.length,
        color: CHART_COLORS[index % CHART_COLORS.length],
        metadata: {
          clientId: client.id,
          activeCases: client.cases.filter((c) =>
            ['Active', 'PendingApproval', 'OnHold'].includes(c.status)
          ).length,
        },
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20); // Top 20 clients

    // Calculate summary
    const totalValue = data.reduce((sum, point) => sum + point.value, 0);
    const averageValue = data.length > 0 ? totalValue / data.length : 0;

    return {
      data,
      summary: {
        totalValue,
        averageValue,
        trendDirection: 'stable',
      },
    };
  }

  // ============================================================================
  // Documents Query Handler
  // ============================================================================

  private async queryDocuments(
    filters: DocumentReportFilters | undefined,
    dateRange: DateRange
  ): Promise<ReportDataResult> {
    const where: Prisma.DocumentWhereInput = {
      firmId: this.firmId,
    };

    // Apply filters
    if (filters?.caseId) {
      where.caseLinks = {
        some: {
          caseId: filters.caseId,
        },
      };
    }
    if (filters?.documentType?.length) {
      where.fileType = { in: filters.documentType };
    }

    const range = filters?.dateRange || dateRange;
    where.uploadedAt = {
      gte: range.start,
      lte: range.end,
    };

    // Group documents by status
    const documents = await prisma.document.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
      _sum: { fileSize: true },
    });

    const data: ChartDataPoint[] = documents.map((group, index) => ({
      label: DOCUMENT_STATUS_RO[group.status] || group.status,
      value: group._count.id,
      color: CHART_COLORS[index % CHART_COLORS.length],
      metadata: {
        status: group.status,
        totalSizeBytes: group._sum.fileSize || 0,
      },
    }));

    // Calculate summary
    const totalValue = data.reduce((sum, point) => sum + point.value, 0);
    const averageValue = data.length > 0 ? totalValue / data.length : 0;

    return {
      data,
      summary: {
        totalValue,
        averageValue,
        trendDirection: 'stable',
      },
    };
  }

  // ============================================================================
  // Financial Data Query Handler (replaces invoices)
  // ============================================================================

  private async queryFinancialData(
    filters: FinancialReportFilters | undefined,
    dateRange: DateRange
  ): Promise<ReportDataResult> {
    const range = filters?.dateRange || dateRange;

    // Get billable time entries with case info
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        firmId: this.firmId,
        billable: true,
        date: {
          gte: range.start,
          lte: range.end,
        },
        case: filters?.clientId
          ? {
              clientId: filters.clientId,
            }
          : undefined,
      },
      select: {
        hours: true,
        hourlyRate: true,
        case: {
          select: {
            id: true,
            title: true,
            billingType: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Aggregate by client
    const clientMap = new Map<
      string,
      { name: string; revenue: number; hours: number; caseCount: Set<string> }
    >();

    for (const entry of timeEntries) {
      const clientId = entry.case.client.id;
      const existing = clientMap.get(clientId) || {
        name: entry.case.client.name,
        revenue: 0,
        hours: 0,
        caseCount: new Set<string>(),
      };

      const hours = Number(entry.hours);
      const rate = Number(entry.hourlyRate);

      existing.hours += hours;
      existing.revenue += hours * rate;
      existing.caseCount.add(entry.case.id);

      clientMap.set(clientId, existing);
    }

    // Apply min/max amount filters
    let entries = Array.from(clientMap.entries());
    if (filters?.minAmount !== undefined) {
      entries = entries.filter(([, data]) => data.revenue >= filters.minAmount!);
    }
    if (filters?.maxAmount !== undefined) {
      entries = entries.filter(([, data]) => data.revenue <= filters.maxAmount!);
    }

    const data: ChartDataPoint[] = entries
      .map(([clientId, clientData], index) => ({
        label: clientData.name,
        value: clientData.revenue,
        color: CHART_COLORS[index % CHART_COLORS.length],
        metadata: {
          clientId,
          hours: clientData.hours,
          caseCount: clientData.caseCount.size,
        },
      }))
      .sort((a, b) => b.value - a.value);

    // Calculate summary
    const totalValue = data.reduce((sum, point) => sum + point.value, 0);
    const averageValue = data.length > 0 ? totalValue / data.length : 0;

    return {
      data,
      summary: {
        totalValue,
        averageValue,
        trendDirection: 'stable',
      },
    };
  }

  // ============================================================================
  // Additional Query Methods for Specific Report Types
  // ============================================================================

  /**
   * Get cases grouped by status (no date filtering)
   * OPS-156: For cases-status-overview report that needs ALL non-archived cases
   */
  async getCasesByStatus(): Promise<ReportDataResult> {
    const cases = await prisma.case.groupBy({
      by: ['status'],
      where: {
        firmId: this.firmId,
        status: { not: 'Archived' },
      },
      _count: { id: true },
    });

    const data: ChartDataPoint[] = cases.map((group, index) => ({
      label: CASE_STATUS_RO[group.status] || group.status,
      value: group._count.id,
      color: CHART_COLORS[index % CHART_COLORS.length],
      metadata: { status: group.status },
    }));

    const totalValue = data.reduce((sum, point) => sum + point.value, 0);

    return {
      data,
      summary: {
        totalValue,
        averageValue: data.length > 0 ? totalValue / data.length : 0,
        trendDirection: 'stable',
      },
    };
  }

  /**
   * Get cases grouped by billing type
   */
  async getCasesByBillingType(dateRange: DateRange): Promise<ReportDataResult> {
    const cases = await prisma.case.groupBy({
      by: ['billingType'],
      where: {
        firmId: this.firmId,
        openedDate: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
        status: { not: 'Archived' },
      },
      _count: { id: true },
    });

    const data: ChartDataPoint[] = cases.map((group, index) => ({
      label: BILLING_TYPE_RO[group.billingType] || group.billingType,
      value: group._count.id,
      color: CHART_COLORS[index % CHART_COLORS.length],
      metadata: { billingType: group.billingType },
    }));

    const totalValue = data.reduce((sum, point) => sum + point.value, 0);

    return {
      data,
      summary: {
        totalValue,
        averageValue: data.length > 0 ? totalValue / data.length : 0,
        trendDirection: 'stable',
      },
    };
  }

  /**
   * Get cases grouped by case type (dynamic types from case_type_configs)
   */
  async getCasesByType(_dateRange: DateRange): Promise<ReportDataResult> {
    // Get case type configs for this firm to lookup display names
    const caseTypeConfigs = await prisma.caseTypeConfig.findMany({
      where: { firmId: this.firmId, isActive: true },
      select: { code: true, name: true },
    });

    const typeNameMap = new Map(caseTypeConfigs.map((c) => [c.code, c.name]));

    // Group cases by their dynamic 'type' field (not date-filtered)
    const cases = await prisma.case.groupBy({
      by: ['type'],
      where: {
        firmId: this.firmId,
        status: { not: 'Archived' },
      },
      _count: { id: true },
    });

    const data: ChartDataPoint[] = cases.map((group, index) => ({
      label: typeNameMap.get(group.type) || group.type,
      value: group._count.id,
      color: CHART_COLORS[index % CHART_COLORS.length],
      metadata: { caseType: group.type },
    }));

    // Sort by value descending
    data.sort((a, b) => b.value - a.value);

    const totalValue = data.reduce((sum, point) => sum + point.value, 0);

    return {
      data,
      summary: {
        totalValue,
        averageValue: data.length > 0 ? totalValue / data.length : 0,
        trendDirection: 'stable',
      },
    };
  }

  /**
   * Get tasks grouped by status
   */
  async getTasksByStatus(dateRange: DateRange): Promise<ReportDataResult> {
    const tasks = await prisma.task.groupBy({
      by: ['status'],
      where: {
        firmId: this.firmId,
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      _count: { id: true },
    });

    const data: ChartDataPoint[] = tasks.map((group, index) => ({
      label: TASK_STATUS_RO[group.status] || group.status,
      value: group._count.id,
      color: CHART_COLORS[index % CHART_COLORS.length],
      metadata: { status: group.status },
    }));

    const totalValue = data.reduce((sum, point) => sum + point.value, 0);

    return {
      data,
      summary: {
        totalValue,
        averageValue: data.length > 0 ? totalValue / data.length : 0,
        trendDirection: 'stable',
      },
    };
  }

  /**
   * Get monthly revenue trend
   */
  async getMonthlyRevenueTrend(dateRange: DateRange): Promise<ReportDataResult> {
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        firmId: this.firmId,
        billable: true,
        date: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      select: {
        date: true,
        hours: true,
        hourlyRate: true,
      },
    });

    // Group by month
    const monthMap = new Map<string, number>();

    for (const entry of timeEntries) {
      const monthKey = `${entry.date.getFullYear()}-${String(entry.date.getMonth() + 1).padStart(2, '0')}`;
      const revenue = Number(entry.hours) * Number(entry.hourlyRate);
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + revenue);
    }

    // Sort by month
    const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    const MONTH_NAMES_RO = [
      'Ianuarie',
      'Februarie',
      'Martie',
      'Aprilie',
      'Mai',
      'Iunie',
      'Iulie',
      'August',
      'Septembrie',
      'Octombrie',
      'Noiembrie',
      'Decembrie',
    ];

    const data: ChartDataPoint[] = sortedMonths.map(([monthKey, revenue], index) => {
      const [year, month] = monthKey.split('-');
      const monthName = MONTH_NAMES_RO[parseInt(month, 10) - 1];
      return {
        label: `${monthName} ${year}`,
        value: revenue,
        color: CHART_COLORS[index % CHART_COLORS.length],
        metadata: { month: monthKey },
      };
    });

    const totalValue = data.reduce((sum, point) => sum + point.value, 0);
    const averageValue = data.length > 0 ? totalValue / data.length : 0;

    // Calculate trend
    let trendDirection: 'up' | 'down' | 'stable' = 'stable';
    if (data.length >= 2) {
      const lastTwo = data.slice(-2);
      const change = lastTwo[1].value - lastTwo[0].value;
      if (change > 0) trendDirection = 'up';
      else if (change < 0) trendDirection = 'down';
    }

    return {
      data,
      summary: {
        totalValue,
        averageValue,
        trendDirection,
      },
    };
  }

  /**
   * Get realization rate (billable hours / total hours as single percentage)
   * OPS-158: Returns single data point for gauge chart
   */
  async getRealizationRate(dateRange: DateRange): Promise<ReportDataResult> {
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        firmId: this.firmId,
        date: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      select: {
        hours: true,
        billable: true,
      },
    });

    // Calculate totals
    let billableHours = 0;
    let totalHours = 0;

    for (const entry of timeEntries) {
      const hours = Number(entry.hours);
      totalHours += hours;
      if (entry.billable) {
        billableHours += hours;
      }
    }

    // Calculate realization rate percentage
    const realizationRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;
    const roundedRate = Math.round(realizationRate * 10) / 10;

    // Determine color based on rate (green for good, yellow for medium, red for low)
    let color = '#10b981'; // emerald-500 (good: >= 70%)
    if (roundedRate < 50) {
      color = '#ef4444'; // red-500 (low: < 50%)
    } else if (roundedRate < 70) {
      color = '#f59e0b'; // amber-500 (medium: 50-70%)
    }

    const data: ChartDataPoint[] = [
      {
        label: 'Rata de Realizare',
        value: roundedRate,
        color,
        metadata: {
          billableHours: Math.round(billableHours * 10) / 10,
          totalHours: Math.round(totalHours * 10) / 10,
        },
      },
    ];

    return {
      data,
      summary: {
        totalValue: roundedRate,
        averageValue: roundedRate,
        trendDirection: 'stable',
      },
    };
  }

  /**
   * Get workload distribution (active cases per team member)
   * OPS-157: Shows how cases are distributed across the team
   */
  async getWorkloadDistribution(): Promise<ReportDataResult> {
    // Query CaseTeam to get user-case assignments for non-archived cases
    const assignments = await prisma.caseTeam.findMany({
      where: {
        case: {
          firmId: this.firmId,
          status: { not: 'Archived' },
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        case: {
          select: {
            id: true,
          },
        },
      },
    });

    // Aggregate by user
    const userMap = new Map<string, { name: string; caseCount: number }>();

    for (const assignment of assignments) {
      const userName = `${assignment.user.firstName} ${assignment.user.lastName}`.trim();
      const existing = userMap.get(assignment.userId) || {
        name: userName,
        caseCount: 0,
      };

      existing.caseCount += 1;
      userMap.set(assignment.userId, existing);
    }

    const data: ChartDataPoint[] = Array.from(userMap.entries())
      .map(([userId, userData], index) => ({
        label: userData.name,
        value: userData.caseCount,
        color: CHART_COLORS[index % CHART_COLORS.length],
        metadata: { userId },
      }))
      .sort((a, b) => b.value - a.value);

    const totalValue = data.reduce((sum, point) => sum + point.value, 0);
    const averageValue = data.length > 0 ? totalValue / data.length : 0;

    return {
      data,
      summary: {
        totalValue,
        averageValue,
        trendDirection: 'stable',
      },
    };
  }

  /**
   * Get deadline tracker (tasks grouped by urgency bucket)
   * OPS-159: Shows overdue and upcoming deadlines from tasks
   */
  async getDeadlineTracker(): Promise<ReportDataResult> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const endOfMonth = new Date(today);
    endOfMonth.setDate(endOfMonth.getDate() + 30);

    // Query all tasks with due dates from firm's cases
    const tasks = await prisma.task.findMany({
      where: {
        firmId: this.firmId,
        dueDate: { not: null },
        status: { not: 'Cancelled' },
      },
      select: {
        id: true,
        dueDate: true,
        status: true,
      },
    });

    // Group by urgency bucket
    const buckets = {
      overdue: { label: 'Depășite', count: 0, color: '#ef4444' }, // red-500
      today: { label: 'Astăzi', count: 0, color: '#f59e0b' }, // amber-500
      thisWeek: { label: 'Săptămâna aceasta', count: 0, color: '#3b82f6' }, // blue-500
      thisMonth: { label: 'Luna aceasta', count: 0, color: '#10b981' }, // emerald-500
      later: { label: 'Mai târziu', count: 0, color: '#6b7280' }, // gray-500
    };

    for (const task of tasks) {
      if (!task.dueDate) continue;

      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        buckets.overdue.count++;
      } else if (dueDate <= endOfToday) {
        buckets.today.count++;
      } else if (dueDate <= endOfWeek) {
        buckets.thisWeek.count++;
      } else if (dueDate <= endOfMonth) {
        buckets.thisMonth.count++;
      } else {
        buckets.later.count++;
      }
    }

    const data: ChartDataPoint[] = [
      {
        label: buckets.overdue.label,
        value: buckets.overdue.count,
        color: buckets.overdue.color,
        metadata: { bucket: 'overdue' },
      },
      {
        label: buckets.today.label,
        value: buckets.today.count,
        color: buckets.today.color,
        metadata: { bucket: 'today' },
      },
      {
        label: buckets.thisWeek.label,
        value: buckets.thisWeek.count,
        color: buckets.thisWeek.color,
        metadata: { bucket: 'thisWeek' },
      },
      {
        label: buckets.thisMonth.label,
        value: buckets.thisMonth.count,
        color: buckets.thisMonth.color,
        metadata: { bucket: 'thisMonth' },
      },
      {
        label: buckets.later.label,
        value: buckets.later.count,
        color: buckets.later.color,
        metadata: { bucket: 'later' },
      },
    ];

    const totalValue = data.reduce((sum, point) => sum + point.value, 0);

    return {
      data,
      summary: {
        totalValue,
        averageValue: data.length > 0 ? totalValue / data.length : 0,
        trendDirection: buckets.overdue.count > 0 ? 'down' : 'stable',
      },
    };
  }

  /**
   * Get template usage across different template types
   * OPS-160: Shows which templates are used most frequently
   */
  async getTemplateUsage(): Promise<ReportDataResult> {
    // Aggregate usage from multiple template types:
    // 1. CommunicationTemplate - has usageCount field
    // 2. TaskTemplate - count from TaskTemplateUsage join table
    // 3. MapaTemplate - count Mapa instances using each template

    const templateUsage: { name: string; type: string; count: number }[] = [];

    // 1. Communication Templates
    const commTemplates = await prisma.communicationTemplate.findMany({
      where: {
        firmId: this.firmId,
        isActive: true,
      },
      select: {
        name: true,
        usageCount: true,
      },
      orderBy: { usageCount: 'desc' },
    });

    for (const template of commTemplates) {
      if (template.usageCount > 0) {
        templateUsage.push({
          name: template.name,
          type: 'Comunicări',
          count: template.usageCount,
        });
      }
    }

    // 2. Task Templates with usage counts
    const taskTemplates = await prisma.taskTemplate.findMany({
      where: {
        firmId: this.firmId,
        isActive: true,
      },
      select: {
        name: true,
        _count: {
          select: {
            usages: true,
          },
        },
      },
    });

    for (const template of taskTemplates) {
      if (template._count.usages > 0) {
        templateUsage.push({
          name: template.name,
          type: 'Sarcini',
          count: template._count.usages,
        });
      }
    }

    // 3. Mapa Templates with mapa counts
    const mapaTemplates = await prisma.mapaTemplate.findMany({
      where: {
        firmId: this.firmId,
        isActive: true,
      },
      select: {
        name: true,
        _count: {
          select: {
            mape: true,
          },
        },
      },
    });

    for (const template of mapaTemplates) {
      if (template._count.mape > 0) {
        templateUsage.push({
          name: template.name,
          type: 'Mape',
          count: template._count.mape,
        });
      }
    }

    // Sort by usage count descending and take top entries
    templateUsage.sort((a, b) => b.count - a.count);
    const topTemplates = templateUsage.slice(0, 10);

    // If no templates have been used, return helpful message
    if (topTemplates.length === 0) {
      return {
        data: [
          {
            label: 'Nu există date',
            value: 0,
            color: CHART_COLORS[0],
            metadata: { message: 'Niciun șablon nu a fost utilizat încă.' },
          },
        ],
        summary: {
          totalValue: 0,
          averageValue: 0,
          trendDirection: 'stable',
        },
      };
    }

    const data: ChartDataPoint[] = topTemplates.map((template, index) => ({
      label: template.name,
      value: template.count,
      color: CHART_COLORS[index % CHART_COLORS.length],
      metadata: {
        templateType: template.type,
      },
    }));

    const totalValue = data.reduce((sum, point) => sum + point.value, 0);
    const averageValue = data.length > 0 ? totalValue / data.length : 0;

    return {
      data,
      summary: {
        totalValue,
        averageValue,
        trendDirection: 'stable',
      },
    };
  }

  /**
   * Get top clients by revenue
   * OPS-161: Shows clients sorted by revenue (hours × hourlyRate) from billable time entries
   */
  async getTopClientsByRevenue(dateRange: DateRange): Promise<ReportDataResult> {
    // Get billable time entries with client info
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        firmId: this.firmId,
        billable: true,
        date: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      select: {
        hours: true,
        hourlyRate: true,
        case: {
          select: {
            id: true,
            status: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Aggregate by client
    const clientMap = new Map<
      string,
      {
        name: string;
        revenue: number;
        billableHours: number;
        caseIds: Set<string>;
        activeCaseIds: Set<string>;
      }
    >();

    for (const entry of timeEntries) {
      const clientId = entry.case.client.id;
      const existing = clientMap.get(clientId) || {
        name: entry.case.client.name,
        revenue: 0,
        billableHours: 0,
        caseIds: new Set<string>(),
        activeCaseIds: new Set<string>(),
      };

      const hours = Number(entry.hours);
      const rate = Number(entry.hourlyRate);

      existing.billableHours += hours;
      existing.revenue += hours * rate;
      existing.caseIds.add(entry.case.id);

      if (['Active', 'PendingApproval', 'OnHold'].includes(entry.case.status)) {
        existing.activeCaseIds.add(entry.case.id);
      }

      clientMap.set(clientId, existing);
    }

    // Sort by revenue descending and take top 20
    const sortedClients = Array.from(clientMap.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 20);

    const data: ChartDataPoint[] = sortedClients.map(([clientId, clientData], index) => ({
      label: clientData.name,
      value: Math.round(clientData.revenue * 100) / 100, // Round to 2 decimals
      color: CHART_COLORS[index % CHART_COLORS.length],
      metadata: {
        clientId,
        caseCount: clientData.caseIds.size,
        activeCases: clientData.activeCaseIds.size,
        billableHours: Math.round(clientData.billableHours * 10) / 10,
      },
    }));

    // If no revenue data, return helpful message
    if (data.length === 0) {
      return {
        data: [
          {
            label: 'Nu există date',
            value: 0,
            color: CHART_COLORS[0],
            metadata: { message: 'Nu s-au înregistrat ore facturabile în această perioadă.' },
          },
        ],
        summary: {
          totalValue: 0,
          averageValue: 0,
          trendDirection: 'stable',
        },
      };
    }

    const totalValue = data.reduce((sum, point) => sum + point.value, 0);
    const averageValue = data.length > 0 ? totalValue / data.length : 0;

    return {
      data,
      summary: {
        totalValue: Math.round(totalValue * 100) / 100,
        averageValue: Math.round(averageValue * 100) / 100,
        trendDirection: 'stable',
      },
    };
  }

  /**
   * Get team utilization (billable vs non-billable hours)
   */
  async getTeamUtilization(dateRange: DateRange): Promise<ReportDataResult> {
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        firmId: this.firmId,
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
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    // Aggregate by user
    const userMap = new Map<
      string,
      { name: string; role: string; billableHours: number; totalHours: number }
    >();

    for (const entry of timeEntries) {
      const userId = entry.user.id;
      const userName = `${entry.user.firstName} ${entry.user.lastName}`.trim();
      const existing = userMap.get(userId) || {
        name: userName,
        role: entry.user.role,
        billableHours: 0,
        totalHours: 0,
      };

      const hours = Number(entry.hours);
      existing.totalHours += hours;
      if (entry.billable) {
        existing.billableHours += hours;
      }

      userMap.set(userId, existing);
    }

    const data: ChartDataPoint[] = Array.from(userMap.entries())
      .map(([userId, userData], index) => {
        const utilizationRate =
          userData.totalHours > 0 ? (userData.billableHours / userData.totalHours) * 100 : 0;
        return {
          label: userData.name,
          value: Math.round(utilizationRate * 10) / 10, // Round to 1 decimal
          color: CHART_COLORS[index % CHART_COLORS.length],
          metadata: {
            userId,
            role: userData.role,
            billableHours: userData.billableHours,
            totalHours: userData.totalHours,
          },
        };
      })
      .sort((a, b) => b.value - a.value);

    const totalValue = data.reduce((sum, point) => sum + point.value, 0);
    const averageValue = data.length > 0 ? totalValue / data.length : 0;

    return {
      data,
      summary: {
        totalValue: averageValue, // For utilization, total is the average rate
        averageValue,
        trendDirection: 'stable',
      },
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createReportDataService(context: Context): ReportDataService {
  return new ReportDataService(context);
}
