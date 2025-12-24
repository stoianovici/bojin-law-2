/**
 * Reports Resolvers
 * OPS-154: Reports GraphQL Schema & Resolvers
 *
 * Exposes predefined report templates, data aggregation, and AI insights.
 */

import type { UserRole, ReportCategory, DateRange, ChartType } from '@legal-platform/types';
import { createReportDataService, type ReportDataResult } from '../../services/report-data.service';
import { reportAIService } from '../../services/report-ai.service';

// ============================================================================
// Types
// ============================================================================

interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
    email: string;
  };
}

interface DateRangeInput {
  start: Date;
  end: Date;
  preset?: 'thisWeek' | 'thisMonth' | 'thisQuarter' | 'thisYear' | null;
}

interface PredefinedReportTemplate {
  id: string;
  categoryId: ReportCategory;
  name: string;
  nameRo: string;
  description: string;
  chartType: ChartType;
  requiresDateRange: boolean;
  allowedRoles: UserRole[];
  dataQuery: { type: string; filters?: Record<string, unknown> };
  aiPromptTemplate: string;
}

// ============================================================================
// Predefined Report Templates (duplicated from web for gateway access)
// ============================================================================

const PREDEFINED_REPORT_TEMPLATES: PredefinedReportTemplate[] = [
  // Cases
  {
    id: 'cases-status-overview',
    categoryId: 'cases',
    name: 'Case Status Overview',
    nameRo: 'Situația Dosarelor',
    description: 'Vizualizare generală a statutului tuturor dosarelor active',
    allowedRoles: ['Partner', 'Associate', 'Paralegal', 'BusinessOwner'],
    chartType: 'pie',
    requiresDateRange: false,
    dataQuery: { type: 'cases', filters: {} },
    aiPromptTemplate: `Analizează distribuția dosarelor pe statusuri și generează un rezumat în limba română.
Evidențiază:
- Câte dosare sunt în fiecare status
- Dacă există dezechilibre (prea multe dosare într-un anumit status)
- Recomandări pentru îmbunătățirea fluxului de lucru`,
  },
  {
    id: 'cases-by-type',
    categoryId: 'cases',
    name: 'Cases by Type',
    nameRo: 'Dosare pe Tipuri',
    description: 'Distribuția dosarelor pe domenii juridice',
    allowedRoles: ['Partner', 'Associate', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: false,
    dataQuery: { type: 'cases', filters: {} },
    aiPromptTemplate: `Analizează distribuția dosarelor pe tipuri/domenii juridice și generează un rezumat în limba română.`,
  },
  {
    id: 'cases-deadline-tracker',
    categoryId: 'cases',
    name: 'Deadline Tracker',
    nameRo: 'Monitor Termene',
    description: 'Termenele apropiate și depășite pentru toate dosarele',
    allowedRoles: ['Partner', 'Associate', 'Paralegal', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: true,
    dataQuery: { type: 'cases', filters: {} },
    aiPromptTemplate: `Analizează termenele dosarelor și generează un rezumat în limba română.`,
  },
  // Time
  {
    id: 'time-billable-hours',
    categoryId: 'time',
    name: 'Billable Hours',
    nameRo: 'Ore Facturabile',
    description: 'Totalul orelor facturabile pe perioadă',
    allowedRoles: ['Partner', 'Associate', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: true,
    dataQuery: { type: 'timeEntries', filters: { billable: true } },
    aiPromptTemplate: `Analizează orele facturabile și generează un rezumat în limba română.`,
  },
  {
    id: 'time-team-utilization',
    categoryId: 'time',
    name: 'Team Utilization',
    nameRo: 'Utilizare Echipă',
    description: 'Gradul de utilizare pe membru al echipei',
    allowedRoles: ['Partner', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: true,
    dataQuery: { type: 'timeEntries', filters: {} },
    aiPromptTemplate: `Analizează utilizarea echipei și generează un rezumat în limba română.`,
  },
  {
    id: 'time-monthly-trend',
    categoryId: 'time',
    name: 'Monthly Trend',
    nameRo: 'Tendință Lunară',
    description: 'Evoluția orelor lucrate pe luni',
    allowedRoles: ['Partner', 'Associate', 'BusinessOwner'],
    chartType: 'line',
    requiresDateRange: true,
    dataQuery: { type: 'timeEntries', filters: {} },
    aiPromptTemplate: `Analizează tendința lunară a orelor lucrate și generează un rezumat în limba română.`,
  },
  // Financial
  {
    id: 'financial-revenue-breakdown',
    categoryId: 'financial',
    name: 'Revenue Breakdown',
    nameRo: 'Defalcare Venituri',
    description: 'Veniturile defalcate pe client și tip de serviciu',
    allowedRoles: ['Partner', 'BusinessOwner'],
    chartType: 'pie',
    requiresDateRange: true,
    dataQuery: { type: 'invoices', filters: {} },
    aiPromptTemplate: `Analizează veniturile și generează un rezumat în limba română.`,
  },
  {
    id: 'financial-realization-rate',
    categoryId: 'financial',
    name: 'Realization Rate',
    nameRo: 'Rata de Realizare',
    description: 'Procentul orelor facturate vs. lucrate',
    allowedRoles: ['Partner', 'BusinessOwner'],
    chartType: 'gauge',
    requiresDateRange: true,
    dataQuery: { type: 'invoices', filters: {} },
    aiPromptTemplate: `Analizează rata de realizare și generează un rezumat în limba română.`,
  },
  {
    id: 'financial-profitability',
    categoryId: 'financial',
    name: 'Profitability Analysis',
    nameRo: 'Analiză Profitabilitate',
    description: 'Profitabilitatea pe client și tip de dosar',
    allowedRoles: ['Partner', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: true,
    dataQuery: { type: 'invoices', filters: {} },
    aiPromptTemplate: `Analizează profitabilitatea și generează un rezumat în limba română.`,
  },
  // Team
  {
    id: 'team-workload-distribution',
    categoryId: 'team',
    name: 'Workload Distribution',
    nameRo: 'Distribuție Sarcini',
    description: 'Cum sunt distribuite dosarele în echipă',
    allowedRoles: ['Partner', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: false,
    dataQuery: { type: 'cases', filters: {} },
    aiPromptTemplate: `Analizează distribuția sarcinilor și generează un rezumat în limba română.`,
  },
  {
    id: 'team-task-completion',
    categoryId: 'team',
    name: 'Task Completion',
    nameRo: 'Finalizare Sarcini',
    description: 'Rata de finalizare a sarcinilor pe membru',
    allowedRoles: ['Partner', 'Associate', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: true,
    dataQuery: { type: 'cases', filters: {} },
    aiPromptTemplate: `Analizează finalizarea sarcinilor și generează un rezumat în limba română.`,
  },
  // Clients
  {
    id: 'clients-top-clients',
    categoryId: 'clients',
    name: 'Top Clients',
    nameRo: 'Clienți Principali',
    description: 'Cei mai importanți clienți după venituri și activitate',
    allowedRoles: ['Partner', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: true,
    dataQuery: { type: 'clients', filters: { activeOnly: true } },
    aiPromptTemplate: `Analizează clienții principali și generează un rezumat în limba română.`,
  },
  {
    id: 'clients-activity-metrics',
    categoryId: 'clients',
    name: 'Activity Metrics',
    nameRo: 'Metrici Activitate',
    description: 'Nivelul de activitate și angajament per client',
    allowedRoles: ['Partner', 'Associate', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: true,
    dataQuery: { type: 'clients', filters: { hasOpenCases: true } },
    aiPromptTemplate: `Analizează activitatea clienților și generează un rezumat în limba română.`,
  },
  // Documents
  {
    id: 'documents-processing-stats',
    categoryId: 'documents',
    name: 'Processing Stats',
    nameRo: 'Statistici Procesare',
    description: 'Volumul de documente procesate și starea lor',
    allowedRoles: ['Partner', 'Associate', 'Paralegal', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: true,
    dataQuery: { type: 'documents', filters: {} },
    aiPromptTemplate: `Analizează procesarea documentelor și generează un rezumat în limba română.`,
  },
  {
    id: 'documents-template-usage',
    categoryId: 'documents',
    name: 'Template Usage',
    nameRo: 'Utilizare Șabloane',
    description: 'Frecvența utilizării șabloanelor de comunicări, sarcini și mape',
    allowedRoles: ['Partner', 'Associate', 'Paralegal', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: false,
    dataQuery: { type: 'documents', filters: {} },
    aiPromptTemplate: `Analizează utilizarea șabloanelor și generează un rezumat în limba română.`,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getDefaultDateRange(): DateRange {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1); // Default to last month

  return {
    start,
    end,
    preset: 'thisMonth',
  };
}

function parseDateRange(input?: DateRangeInput): DateRange {
  if (!input) {
    return getDefaultDateRange();
  }

  return {
    start: new Date(input.start),
    end: new Date(input.end),
    preset: input.preset || null,
  };
}

function canAccessReport(template: PredefinedReportTemplate, userRole: string): boolean {
  return template.allowedRoles.includes(userRole as UserRole);
}

// ============================================================================
// Query Resolvers
// ============================================================================

export const reportsQueryResolvers = {
  /**
   * Get all predefined report templates, optionally filtered by category
   */
  predefinedReports: async (
    _: unknown,
    { categoryId }: { categoryId?: ReportCategory },
    context: Context
  ) => {
    if (!context.user?.firmId) {
      throw new Error('Autentificare necesară');
    }

    const userRole = context.user.role;
    let templates = PREDEFINED_REPORT_TEMPLATES;

    // Filter by category if provided
    if (categoryId) {
      templates = templates.filter((t) => t.categoryId === categoryId);
    }

    // Filter by role access
    templates = templates.filter((t) => canAccessReport(t, userRole));

    // Return without internal fields (dataQuery, aiPromptTemplate)
    return templates.map((t) => ({
      id: t.id,
      categoryId: t.categoryId,
      name: t.name,
      nameRo: t.nameRo,
      description: t.description,
      chartType: t.chartType,
      requiresDateRange: t.requiresDateRange,
      allowedRoles: t.allowedRoles,
    }));
  },

  /**
   * Get report data with chart points and summary
   */
  reportData: async (
    _: unknown,
    { reportId, dateRange }: { reportId: string; dateRange?: DateRangeInput },
    context: Context
  ) => {
    if (!context.user?.firmId) {
      throw new Error('Autentificare necesară');
    }

    // Find template
    const template = PREDEFINED_REPORT_TEMPLATES.find((t) => t.id === reportId);
    if (!template) {
      throw new Error('Raport inexistent');
    }

    // Check role access
    if (!canAccessReport(template, context.user.role)) {
      throw new Error('Acces interzis la acest raport');
    }

    // Parse date range
    const range = parseDateRange(dateRange);

    // Create data service and fetch data
    const dataService = createReportDataService(context);
    let result: ReportDataResult;

    try {
      // Route to specialized methods based on reportId for different aggregations
      switch (reportId) {
        case 'cases-status-overview':
          // OPS-156: No date filtering for status overview - show ALL non-archived cases
          result = await dataService.getCasesByStatus();
          break;
        case 'cases-by-type':
          result = await dataService.getCasesByType(range);
          break;
        case 'cases-deadline-tracker':
          // OPS-159: Shows deadlines grouped by urgency (overdue, today, this week, etc.)
          result = await dataService.getDeadlineTracker();
          break;
        case 'team-task-completion':
          result = await dataService.getTasksByStatus(range);
          break;
        case 'team-workload-distribution':
          // OPS-157: Shows cases per team member (not tasks)
          result = await dataService.getWorkloadDistribution();
          break;
        case 'time-team-utilization':
          result = await dataService.getTeamUtilization(range);
          break;
        case 'time-monthly-trend':
          result = await dataService.getMonthlyRevenueTrend(range);
          break;
        case 'financial-realization-rate':
          // OPS-158: Returns single percentage for gauge chart
          result = await dataService.getRealizationRate(range);
          break;
        case 'documents-template-usage':
          // OPS-160: Template usage frequency across all template types
          result = await dataService.getTemplateUsage();
          break;
        case 'clients-top-clients':
          // OPS-161: Top clients by revenue (hours × hourlyRate)
          result = await dataService.getTopClientsByRevenue(range);
          break;
        default:
          // Use generic data query for other reports
          result = await dataService.getReportData(
            template.dataQuery as {
              type: 'cases' | 'timeEntries' | 'invoices' | 'clients' | 'documents';
              filters?: Record<string, unknown>;
            },
            range
          );
      }
    } catch (error) {
      console.error('[Reports Resolver] Failed to get report data:', error);
      // Return empty data on error
      return {
        reportId,
        data: [],
        summary: {
          totalValue: 0,
          averageValue: 0,
          trendDirection: 'stable',
        },
      };
    }

    return {
      reportId,
      data: result.data,
      summary: result.summary,
    };
  },

  /**
   * Get AI-generated insights for a report
   */
  reportAIInsight: async (
    _: unknown,
    { reportId, dateRange }: { reportId: string; dateRange?: DateRangeInput },
    context: Context
  ) => {
    if (!context.user?.firmId) {
      throw new Error('Autentificare necesară');
    }

    // Find template
    const template = PREDEFINED_REPORT_TEMPLATES.find((t) => t.id === reportId);
    if (!template) {
      throw new Error('Raport inexistent');
    }

    // Check role access
    if (!canAccessReport(template, context.user.role)) {
      throw new Error('Acces interzis la acest raport');
    }

    // Parse date range
    const range = parseDateRange(dateRange);

    // First get the report data
    const dataService = createReportDataService(context);
    let reportData: ReportDataResult;

    try {
      reportData = await dataService.getReportData(
        template.dataQuery as {
          type: 'cases' | 'timeEntries' | 'invoices' | 'clients' | 'documents';
          filters?: Record<string, unknown>;
        },
        range
      );
    } catch (error) {
      console.error('[Reports Resolver] Failed to get report data for AI insight:', error);
      return {
        summary: 'Nu s-au putut obține datele pentru analiză.',
        keyFindings: [],
        recommendations: [],
        generatedAt: new Date(),
        confidence: 0,
      };
    }

    // Generate AI insight
    try {
      const insight = await reportAIService.generateInsight({
        reportData: {
          reportId,
          dateRange: range,
          data: reportData.data,
          summary: reportData.summary,
        },
        template: template as unknown as import('@legal-platform/types').PredefinedReportTemplate,
        dateRange: range,
        firmId: context.user.firmId,
        userId: context.user.id,
      });

      return insight;
    } catch (error) {
      console.error('[Reports Resolver] Failed to generate AI insight:', error);
      return {
        summary: 'Nu s-a putut genera analiza automată. Vă rugăm să încercați din nou.',
        keyFindings: [],
        recommendations: [],
        generatedAt: new Date(),
        confidence: 0,
      };
    }
  },
};

// ============================================================================
// Export Combined Resolvers
// ============================================================================

export const reportsResolvers = {
  Query: reportsQueryResolvers,
};
