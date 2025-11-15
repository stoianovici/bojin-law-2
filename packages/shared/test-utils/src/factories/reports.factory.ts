import type {
  ReportMetadata,
  ReportData,
  ChartDataPoint,
  ReportSummary,
  ComparisonData,
  CustomReport,
  DrillDownData,
  ColumnDefinition,
  DateRange,
  ReportCategory,
} from '@legal-platform/types';

// Color palette for consistent chart colors
const CHART_COLORS = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  gray: '#6B7280',
  cyan: '#06B6D4',
  pink: '#EC4899',
};

// ============================================================================
// REPORT METADATA FACTORIES
// ============================================================================

export function createMockReportMetadata(): ReportMetadata[] {
  return [
    // Cases Reports
    {
      id: 'cases-by-status',
      categoryId: 'cases',
      name: 'Cases by Status',
      nameRo: 'Dosare după Status',
      description: 'Distribution of cases by current status',
      allowedRoles: ['Partner', 'Associate', 'Paralegal'],
      chartType: 'pie',
      requiresDateRange: true,
    },
    {
      id: 'cases-by-type',
      categoryId: 'cases',
      name: 'Cases by Type',
      nameRo: 'Dosare după Tip',
      description: 'Case count by legal practice area',
      allowedRoles: ['Partner', 'Associate', 'Paralegal'],
      chartType: 'bar',
      requiresDateRange: true,
    },
    {
      id: 'cases-by-value',
      categoryId: 'cases',
      name: 'Cases by Value',
      nameRo: 'Dosare după Valoare',
      description: 'Case value distribution by type',
      allowedRoles: ['Partner'],
      chartType: 'bar',
      requiresDateRange: true,
    },
    {
      id: 'case-timeline',
      categoryId: 'cases',
      name: 'Case Timeline',
      nameRo: 'Cronologie Dosare',
      description: 'Case opening and closing trends',
      allowedRoles: ['Partner', 'Associate'],
      chartType: 'line',
      requiresDateRange: true,
    },

    // Time Tracking Reports
    {
      id: 'billable-hours',
      categoryId: 'time',
      name: 'Billable Hours',
      nameRo: 'Ore Facturabile',
      description: 'Billable hours trend over time',
      allowedRoles: ['Partner', 'Associate', 'Paralegal'],
      chartType: 'area',
      requiresDateRange: true,
    },
    {
      id: 'utilization-rate',
      categoryId: 'time',
      name: 'Utilization Rate',
      nameRo: 'Rata de Utilizare',
      description: 'Team utilization percentage',
      allowedRoles: ['Partner'],
      chartType: 'gauge',
      requiresDateRange: true,
    },
    {
      id: 'time-by-task-type',
      categoryId: 'time',
      name: 'Time by Task Type',
      nameRo: 'Timp după Tip Sarcină',
      description: 'Time distribution across task types',
      allowedRoles: ['Partner', 'Associate', 'Paralegal'],
      chartType: 'pie',
      requiresDateRange: true,
    },
    {
      id: 'time-by-case',
      categoryId: 'time',
      name: 'Time by Case',
      nameRo: 'Timp după Dosar',
      description: 'Top cases by time spent',
      allowedRoles: ['Partner', 'Associate'],
      chartType: 'bar',
      requiresDateRange: true,
    },

    // Financial Reports
    {
      id: 'revenue-trends',
      categoryId: 'financial',
      name: 'Revenue Trends',
      nameRo: 'Tendințe Venituri',
      description: 'Revenue trends over time',
      allowedRoles: ['Partner'],
      chartType: 'composed',
      requiresDateRange: true,
    },
    {
      id: 'billing-summary',
      categoryId: 'financial',
      name: 'Billing Summary',
      nameRo: 'Sumar Facturare',
      description: 'Billing summary by case type',
      allowedRoles: ['Partner'],
      chartType: 'bar',
      requiresDateRange: true,
    },
    {
      id: 'collections-report',
      categoryId: 'financial',
      name: 'Collections Report',
      nameRo: 'Raport Încasări',
      description: 'Collected vs outstanding amounts',
      allowedRoles: ['Partner'],
      chartType: 'bar',
      requiresDateRange: true,
    },
    {
      id: 'outstanding-invoices',
      categoryId: 'financial',
      name: 'Outstanding Invoices',
      nameRo: 'Facturi Restante',
      description: 'Unpaid invoices list',
      allowedRoles: ['Partner'],
      chartType: 'table',
      requiresDateRange: false,
    },

    // Team Performance Reports
    {
      id: 'team-productivity',
      categoryId: 'team',
      name: 'Team Productivity',
      nameRo: 'Productivitate Echipă',
      description: 'Team member billable hours comparison',
      allowedRoles: ['Partner'],
      chartType: 'bar',
      requiresDateRange: true,
    },
    {
      id: 'workload-distribution',
      categoryId: 'team',
      name: 'Workload Distribution',
      nameRo: 'Distribuție Sarcini',
      description: 'Active cases per team member',
      allowedRoles: ['Partner'],
      chartType: 'bar',
      requiresDateRange: false,
    },
    {
      id: 'performance-metrics',
      categoryId: 'team',
      name: 'Performance Metrics',
      nameRo: 'Metrici Performanță',
      description: 'Multi-dimensional performance comparison',
      allowedRoles: ['Partner'],
      chartType: 'radar',
      requiresDateRange: true,
    },
    {
      id: 'capacity-planning',
      categoryId: 'team',
      name: 'Capacity Planning',
      nameRo: 'Planificare Capacitate',
      description: 'Team availability over next 4 weeks',
      allowedRoles: ['Partner'],
      chartType: 'table',
      requiresDateRange: false,
    },

    // Client Reports
    {
      id: 'active-clients',
      categoryId: 'clients',
      name: 'Active Clients',
      nameRo: 'Clienți Activi',
      description: 'Client growth trends',
      allowedRoles: ['Partner', 'Associate'],
      chartType: 'line',
      requiresDateRange: true,
    },
    {
      id: 'client-revenue',
      categoryId: 'clients',
      name: 'Client Revenue',
      nameRo: 'Venituri Clienți',
      description: 'Top clients by revenue',
      allowedRoles: ['Partner'],
      chartType: 'bar',
      requiresDateRange: true,
    },
    {
      id: 'matter-distribution',
      categoryId: 'clients',
      name: 'Matter Distribution',
      nameRo: 'Distribuție Dosare',
      description: 'Matters distribution by client',
      allowedRoles: ['Partner', 'Associate'],
      chartType: 'pie',
      requiresDateRange: true,
    },
    {
      id: 'client-retention',
      categoryId: 'clients',
      name: 'Client Retention',
      nameRo: 'Retenție Clienți',
      description: 'Client retention rate and churn analysis',
      allowedRoles: ['Partner'],
      chartType: 'bar',
      requiresDateRange: true,
    },

    // Document Reports
    {
      id: 'documents-by-type',
      categoryId: 'documents',
      name: 'Documents by Type',
      nameRo: 'Documente după Tip',
      description: 'Document distribution by type',
      allowedRoles: ['Partner', 'Associate', 'Paralegal'],
      chartType: 'pie',
      requiresDateRange: true,
    },
    {
      id: 'document-status',
      categoryId: 'documents',
      name: 'Document Status',
      nameRo: 'Status Documente',
      description: 'Document status by type',
      allowedRoles: ['Partner', 'Associate', 'Paralegal'],
      chartType: 'bar',
      requiresDateRange: false,
    },
    {
      id: 'version-history',
      categoryId: 'documents',
      name: 'Version History',
      nameRo: 'Istoricul Versiunilor',
      description: 'Document version creation trends',
      allowedRoles: ['Partner', 'Associate'],
      chartType: 'line',
      requiresDateRange: true,
    },
    {
      id: 'storage-usage',
      categoryId: 'documents',
      name: 'Storage Usage',
      nameRo: 'Utilizare Stocare',
      description: 'Storage usage by document type',
      allowedRoles: ['Partner'],
      chartType: 'gauge',
      requiresDateRange: false,
    },
  ];
}

// ============================================================================
// CASES REPORT DATA FACTORIES
// ============================================================================

export function createMockCasesReportData(
  reportId: string,
  dateRange: DateRange
): ReportData {
  switch (reportId) {
    case 'cases-by-status':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'Activ', value: 42, color: CHART_COLORS.success },
          { label: 'În Așteptare', value: 8, color: CHART_COLORS.warning },
          { label: 'Închis', value: 27, color: CHART_COLORS.gray },
          { label: 'Arhivat', value: 13, color: CHART_COLORS.cyan },
        ],
        summary: {
          totalValue: 90,
          averageValue: 22.5,
          changeFromPrevious: 8.5,
          trendDirection: 'up',
        },
      };

    case 'cases-by-type':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'Litigii', value: 28, color: CHART_COLORS.primary },
          { label: 'Contracte', value: 24, color: CHART_COLORS.success },
          { label: 'Consultanță', value: 18, color: CHART_COLORS.purple },
          { label: 'Penal', value: 12, color: CHART_COLORS.danger },
          { label: 'Familie', value: 8, color: CHART_COLORS.pink },
        ],
        summary: {
          totalValue: 90,
          averageValue: 18,
        },
      };

    case 'cases-by-value':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'Litigii', value: 450000, color: CHART_COLORS.primary },
          { label: 'Contracte', value: 320000, color: CHART_COLORS.success },
          { label: 'Consultanță', value: 180000, color: CHART_COLORS.purple },
          { label: 'Penal', value: 240000, color: CHART_COLORS.danger },
          { label: 'Familie', value: 90000, color: CHART_COLORS.pink },
        ],
        summary: {
          totalValue: 1280000,
          averageValue: 14222,
        },
      };

    case 'case-timeline':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'Ian', value: 12 },
          { label: 'Feb', value: 15 },
          { label: 'Mar', value: 10 },
          { label: 'Apr', value: 18 },
          { label: 'Mai', value: 14 },
          { label: 'Iun', value: 16 },
        ],
        summary: {
          totalValue: 85,
          averageValue: 14.2,
          changeFromPrevious: 12.3,
          trendDirection: 'up',
        },
      };

    default:
      return createDefaultReportData(reportId, dateRange);
  }
}

// ============================================================================
// TIME TRACKING REPORT DATA FACTORIES
// ============================================================================

export function createMockTimeReportData(
  reportId: string,
  dateRange: DateRange
): ReportData {
  switch (reportId) {
    case 'billable-hours':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'Săpt 1', value: 156 },
          { label: 'Săpt 2', value: 168 },
          { label: 'Săpt 3', value: 142 },
          { label: 'Săpt 4', value: 175 },
        ],
        summary: {
          totalValue: 641,
          averageValue: 160.25,
          changeFromPrevious: 5.2,
          trendDirection: 'up',
        },
      };

    case 'utilization-rate':
      return {
        reportId,
        dateRange,
        data: [{ label: 'Utilizare', value: 78, color: CHART_COLORS.success }],
        summary: {
          totalValue: 78,
          averageValue: 78,
          changeFromPrevious: 3.5,
          trendDirection: 'up',
        },
      };

    case 'time-by-task-type':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'Cercetare', value: 245, color: CHART_COLORS.primary },
          { label: 'Redactare', value: 189, color: CHART_COLORS.success },
          { label: 'Întâlniri', value: 142, color: CHART_COLORS.purple },
          { label: 'Instanță', value: 98, color: CHART_COLORS.danger },
          { label: 'Administrative', value: 67, color: CHART_COLORS.gray },
        ],
        summary: {
          totalValue: 741,
          averageValue: 148.2,
        },
      };

    case 'time-by-case':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'DOS-2024-0156', value: 124 },
          { label: 'DOS-2024-0143', value: 98 },
          { label: 'DOS-2024-0167', value: 87 },
          { label: 'DOS-2024-0132', value: 76 },
          { label: 'DOS-2024-0178', value: 65 },
        ],
        summary: {
          totalValue: 450,
          averageValue: 90,
        },
      };

    default:
      return createDefaultReportData(reportId, dateRange);
  }
}

// ============================================================================
// FINANCIAL REPORT DATA FACTORIES
// ============================================================================

export function createMockFinancialReportData(
  reportId: string,
  dateRange: DateRange
): ReportData {
  switch (reportId) {
    case 'revenue-trends':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'Ian', value: 145000 },
          { label: 'Feb', value: 168000 },
          { label: 'Mar', value: 152000 },
          { label: 'Apr', value: 189000 },
          { label: 'Mai', value: 176000 },
          { label: 'Iun', value: 198000 },
        ],
        summary: {
          totalValue: 1028000,
          averageValue: 171333,
          changeFromPrevious: 14.2,
          trendDirection: 'up',
        },
      };

    case 'billing-summary':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'Litigii', value: 420000, color: CHART_COLORS.primary },
          { label: 'Contracte', value: 310000, color: CHART_COLORS.success },
          { label: 'Consultanță', value: 165000, color: CHART_COLORS.purple },
          { label: 'Penal', value: 98000, color: CHART_COLORS.danger },
          { label: 'Familie', value: 35000, color: CHART_COLORS.pink },
        ],
        summary: {
          totalValue: 1028000,
          averageValue: 205600,
        },
      };

    case 'collections-report':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'Încasat', value: 876000, color: CHART_COLORS.success },
          { label: 'Restant', value: 152000, color: CHART_COLORS.warning },
        ],
        summary: {
          totalValue: 1028000,
          averageValue: 514000,
          changeFromPrevious: -3.2,
          trendDirection: 'down',
        },
      };

    case 'outstanding-invoices':
      return {
        reportId,
        dateRange,
        data: [
          {
            label: 'SC ALPHA SRL',
            value: 45000,
            metadata: { dueDate: '2024-11-01', daysOverdue: 14 },
          },
          {
            label: 'SC BETA SRL',
            value: 32000,
            metadata: { dueDate: '2024-11-08', daysOverdue: 7 },
          },
          {
            label: 'SC GAMMA SRL',
            value: 28000,
            metadata: { dueDate: '2024-11-15', daysOverdue: 0 },
          },
        ],
        summary: {
          totalValue: 152000,
          averageValue: 38000,
        },
      };

    default:
      return createDefaultReportData(reportId, dateRange);
  }
}

// ============================================================================
// TEAM PERFORMANCE REPORT DATA FACTORIES
// ============================================================================

export function createMockTeamReportData(
  reportId: string,
  dateRange: DateRange
): ReportData {
  switch (reportId) {
    case 'team-productivity':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'Maria Popescu', value: 168 },
          { label: 'Ion Ionescu', value: 156 },
          { label: 'Ana Marin', value: 142 },
          { label: 'Andrei Georgescu', value: 135 },
          { label: 'Elena Stan', value: 128 },
        ],
        summary: {
          totalValue: 729,
          averageValue: 145.8,
        },
      };

    case 'workload-distribution':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'Maria Popescu', value: 12, color: CHART_COLORS.success },
          { label: 'Ion Ionescu', value: 14, color: CHART_COLORS.warning },
          { label: 'Ana Marin', value: 9, color: CHART_COLORS.success },
          { label: 'Andrei Georgescu', value: 16, color: CHART_COLORS.danger },
          { label: 'Elena Stan', value: 11, color: CHART_COLORS.success },
        ],
        summary: {
          totalValue: 62,
          averageValue: 12.4,
        },
      };

    case 'performance-metrics':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'Ore Facturabile', value: 85 },
          { label: 'Cazuri Câștigate', value: 78 },
          { label: 'Satisfacție Client', value: 92 },
          { label: 'Calitate Documente', value: 88 },
          { label: 'Promptitudine', value: 95 },
        ],
      };

    case 'capacity-planning':
      return {
        reportId,
        dateRange,
        data: [
          {
            label: 'Maria Popescu',
            value: 85,
            metadata: { available: 160, allocated: 136 },
          },
          {
            label: 'Ion Ionescu',
            value: 92,
            metadata: { available: 160, allocated: 147 },
          },
          {
            label: 'Ana Marin',
            value: 68,
            metadata: { available: 160, allocated: 109 },
          },
        ],
        summary: {
          totalValue: 245,
          averageValue: 81.7,
        },
      };

    default:
      return createDefaultReportData(reportId, dateRange);
  }
}

// ============================================================================
// CLIENT REPORT DATA FACTORIES
// ============================================================================

export function createMockClientReportData(
  reportId: string,
  dateRange: DateRange
): ReportData {
  switch (reportId) {
    case 'active-clients':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'Ian', value: 45 },
          { label: 'Feb', value: 48 },
          { label: 'Mar', value: 46 },
          { label: 'Apr', value: 52 },
          { label: 'Mai', value: 54 },
          { label: 'Iun', value: 56 },
        ],
        summary: {
          totalValue: 56,
          averageValue: 50.2,
          changeFromPrevious: 11.1,
          trendDirection: 'up',
        },
      };

    case 'client-revenue':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'SC ALPHA SRL', value: 285000 },
          { label: 'SC BETA SRL', value: 198000 },
          { label: 'SC GAMMA SRL', value: 165000 },
          { label: 'SC DELTA SRL', value: 132000 },
          { label: 'SC EPSILON SRL', value: 98000 },
        ],
        summary: {
          totalValue: 878000,
          averageValue: 175600,
        },
      };

    case 'matter-distribution':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'SC ALPHA SRL', value: 8, color: CHART_COLORS.primary },
          { label: 'SC BETA SRL', value: 6, color: CHART_COLORS.success },
          { label: 'SC GAMMA SRL', value: 5, color: CHART_COLORS.purple },
          { label: 'Alții', value: 27, color: CHART_COLORS.gray },
        ],
        summary: {
          totalValue: 46,
          averageValue: 11.5,
        },
      };

    case 'client-retention':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'Rată Retenție', value: 89, color: CHART_COLORS.success },
          { label: 'Clienți Plecați', value: 11, color: CHART_COLORS.danger },
        ],
        summary: {
          totalValue: 89,
          averageValue: 89,
          changeFromPrevious: 4.2,
          trendDirection: 'up',
        },
      };

    default:
      return createDefaultReportData(reportId, dateRange);
  }
}

// ============================================================================
// DOCUMENT REPORT DATA FACTORIES
// ============================================================================

export function createMockDocumentReportData(
  reportId: string,
  dateRange: DateRange
): ReportData {
  switch (reportId) {
    case 'documents-by-type':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'Contracte', value: 245, color: CHART_COLORS.primary },
          { label: 'Cereri', value: 189, color: CHART_COLORS.success },
          { label: 'Scrisori', value: 142, color: CHART_COLORS.purple },
          { label: 'Hotărâri', value: 98, color: CHART_COLORS.danger },
          { label: 'Alte', value: 76, color: CHART_COLORS.gray },
        ],
        summary: {
          totalValue: 750,
          averageValue: 150,
        },
      };

    case 'document-status':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'Ciornă', value: 125, color: CHART_COLORS.warning },
          { label: 'Revizuire', value: 87, color: CHART_COLORS.cyan },
          { label: 'Aprobat', value: 342, color: CHART_COLORS.success },
          { label: 'Depus', value: 196, color: CHART_COLORS.primary },
        ],
        summary: {
          totalValue: 750,
          averageValue: 187.5,
        },
      };

    case 'version-history':
      return {
        reportId,
        dateRange,
        data: [
          { label: 'Săpt 1', value: 42 },
          { label: 'Săpt 2', value: 56 },
          { label: 'Săpt 3', value: 38 },
          { label: 'Săpt 4', value: 64 },
        ],
        summary: {
          totalValue: 200,
          averageValue: 50,
        },
      };

    case 'storage-usage':
      return {
        reportId,
        dateRange,
        data: [{ label: 'Utilizare', value: 68, color: CHART_COLORS.primary }],
        summary: {
          totalValue: 68,
          averageValue: 68,
        },
      };

    default:
      return createDefaultReportData(reportId, dateRange);
  }
}

// ============================================================================
// GENERIC HELPERS
// ============================================================================

function createDefaultReportData(
  reportId: string,
  dateRange: DateRange
): ReportData {
  return {
    reportId,
    dateRange,
    data: [
      { label: 'Sample A', value: 100 },
      { label: 'Sample B', value: 80 },
      { label: 'Sample C', value: 60 },
    ],
    summary: {
      totalValue: 240,
      averageValue: 80,
    },
  };
}

export function createMockReportData(
  reportId: string,
  dateRange: DateRange,
  category: ReportCategory
): ReportData {
  switch (category) {
    case 'cases':
      return createMockCasesReportData(reportId, dateRange);
    case 'time':
      return createMockTimeReportData(reportId, dateRange);
    case 'financial':
      return createMockFinancialReportData(reportId, dateRange);
    case 'team':
      return createMockTeamReportData(reportId, dateRange);
    case 'clients':
      return createMockClientReportData(reportId, dateRange);
    case 'documents':
      return createMockDocumentReportData(reportId, dateRange);
    default:
      return createDefaultReportData(reportId, dateRange);
  }
}

// ============================================================================
// CUSTOM REPORT FACTORY
// ============================================================================

export function createMockCustomReport(): CustomReport {
  return {
    id: `custom-${Date.now()}`,
    name: 'Raport Personalizat',
    dataSource: 'cases',
    selectedFields: ['caseNumber', 'title', 'status', 'clientName'],
    filters: [
      { field: 'status', operator: 'equals', value: 'Active' },
      { field: 'value', operator: 'greaterThan', value: 50000 },
    ],
    groupBy: 'status',
    chartType: 'bar',
    createdAt: new Date(),
    createdBy: 'Maria Popescu',
  };
}

// ============================================================================
// DRILL-DOWN DATA FACTORY
// ============================================================================

export function createMockDrillDownData(
  reportId: string,
  dataPoint: ChartDataPoint
): DrillDownData {
  const columns: ColumnDefinition[] = [
    { key: 'id', label: 'ID', labelRo: 'ID', type: 'text' },
    { key: 'name', label: 'Name', labelRo: 'Nume', type: 'text' },
    { key: 'value', label: 'Value', labelRo: 'Valoare', type: 'number' },
    { key: 'date', label: 'Date', labelRo: 'Dată', type: 'date' },
  ];

  const detailRows = Array.from({ length: 10 }, (_, i) => ({
    id: `ITEM-${i + 1}`,
    name: `${dataPoint.label} - Element ${i + 1}`,
    value: Math.floor(dataPoint.value / 10),
    date: new Date().toISOString(),
  }));

  return {
    reportId,
    dataPoint,
    detailRows,
    columns,
  };
}

// ============================================================================
// COMPARISON DATA FACTORY
// ============================================================================

export function createMockComparisonData(
  currentData: ChartDataPoint[]
): ComparisonData {
  const previousPeriod = currentData.map((point) => ({
    ...point,
    value: Math.floor(point.value * (0.8 + Math.random() * 0.4)), // ±20% variation
  }));

  const currentTotal = currentData.reduce((sum, p) => sum + p.value, 0);
  const previousTotal = previousPeriod.reduce((sum, p) => sum + p.value, 0);
  const percentChange = ((currentTotal - previousTotal) / previousTotal) * 100;

  return {
    previousPeriod,
    percentChange: Math.round(percentChange * 10) / 10,
  };
}
