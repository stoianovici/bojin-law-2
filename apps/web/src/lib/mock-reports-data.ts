/**
 * Client-safe mock data for reports
 * Simplified version without Node.js dependencies
 */

import type {
  ReportMetadata,
  ReportData,
  ReportCategory,
  DateRange,
  ChartDataPoint,
} from '@legal-platform/types';

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

export function getReportMetadata(): ReportMetadata[] {
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
      chartType: 'line',
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
  ];
}

function generateMockDataPoints(reportId: string): ChartDataPoint[] {
  const dataMap: Record<string, ChartDataPoint[]> = {
    'cases-by-status': [
      { label: 'Activ', value: 42, color: CHART_COLORS.success },
      { label: 'În Așteptare', value: 8, color: CHART_COLORS.warning },
      { label: 'Închis', value: 27, color: CHART_COLORS.gray },
      { label: 'Arhivat', value: 13, color: CHART_COLORS.cyan },
    ],
    'cases-by-type': [
      { label: 'Litigii', value: 28, color: CHART_COLORS.primary },
      { label: 'Contracte', value: 24, color: CHART_COLORS.success },
      { label: 'Consultanță', value: 18, color: CHART_COLORS.purple },
      { label: 'Penal', value: 12, color: CHART_COLORS.danger },
      { label: 'Familie', value: 8, color: CHART_COLORS.pink },
    ],
    'cases-by-value': [
      { label: 'Litigii', value: 450000, color: CHART_COLORS.primary },
      { label: 'Contracte', value: 320000, color: CHART_COLORS.success },
      { label: 'Consultanță', value: 180000, color: CHART_COLORS.purple },
      { label: 'Penal', value: 240000, color: CHART_COLORS.danger },
    ],
    'case-timeline': [
      { label: 'Ian', value: 12 },
      { label: 'Feb', value: 15 },
      { label: 'Mar', value: 10 },
      { label: 'Apr', value: 18 },
      { label: 'Mai', value: 14 },
      { label: 'Iun', value: 16 },
    ],
    'billable-hours': [
      { label: 'Săpt 1', value: 156 },
      { label: 'Săpt 2', value: 168 },
      { label: 'Săpt 3', value: 142 },
      { label: 'Săpt 4', value: 175 },
    ],
    'utilization-rate': [
      { label: 'Utilizare', value: 78, color: CHART_COLORS.success },
    ],
    'time-by-task-type': [
      { label: 'Cercetare', value: 245, color: CHART_COLORS.primary },
      { label: 'Redactare', value: 189, color: CHART_COLORS.success },
      { label: 'Întâlniri', value: 142, color: CHART_COLORS.purple },
      { label: 'Instanță', value: 98, color: CHART_COLORS.danger },
    ],
    'time-by-case': [
      { label: 'DOS-2024-0156', value: 124 },
      { label: 'DOS-2024-0143', value: 98 },
      { label: 'DOS-2024-0167', value: 87 },
      { label: 'DOS-2024-0132', value: 76 },
    ],
    'revenue-trends': [
      { label: 'Ian', value: 145000 },
      { label: 'Feb', value: 168000 },
      { label: 'Mar', value: 152000 },
      { label: 'Apr', value: 189000 },
      { label: 'Mai', value: 176000 },
      { label: 'Iun', value: 198000 },
    ],
    'billing-summary': [
      { label: 'Litigii', value: 420000, color: CHART_COLORS.primary },
      { label: 'Contracte', value: 310000, color: CHART_COLORS.success },
      { label: 'Consultanță', value: 165000, color: CHART_COLORS.purple },
    ],
    'team-productivity': [
      { label: 'Maria Popescu', value: 168 },
      { label: 'Ion Ionescu', value: 156 },
      { label: 'Ana Marin', value: 142 },
      { label: 'Andrei Georgescu', value: 135 },
    ],
    'workload-distribution': [
      { label: 'Maria Popescu', value: 12, color: CHART_COLORS.success },
      { label: 'Ion Ionescu', value: 14, color: CHART_COLORS.warning },
      { label: 'Ana Marin', value: 9, color: CHART_COLORS.success },
    ],
    'active-clients': [
      { label: 'Ian', value: 45 },
      { label: 'Feb', value: 48 },
      { label: 'Mar', value: 46 },
      { label: 'Apr', value: 52 },
      { label: 'Mai', value: 54 },
      { label: 'Iun', value: 56 },
    ],
    'client-revenue': [
      { label: 'SC ALPHA SRL', value: 285000 },
      { label: 'SC BETA SRL', value: 198000 },
      { label: 'SC GAMMA SRL', value: 165000 },
    ],
    'documents-by-type': [
      { label: 'Contracte', value: 245, color: CHART_COLORS.primary },
      { label: 'Cereri', value: 189, color: CHART_COLORS.success },
      { label: 'Scrisori', value: 142, color: CHART_COLORS.purple },
      { label: 'Hotărâri', value: 98, color: CHART_COLORS.danger },
    ],
    'document-status': [
      { label: 'Ciornă', value: 125, color: CHART_COLORS.warning },
      { label: 'Revizuire', value: 87, color: CHART_COLORS.cyan },
      { label: 'Aprobat', value: 342, color: CHART_COLORS.success },
    ],
  };

  return dataMap[reportId] || [
    { label: 'Sample A', value: 100 },
    { label: 'Sample B', value: 80 },
    { label: 'Sample C', value: 60 },
  ];
}

export function getReportData(
  reportId: string,
  dateRange: DateRange,
  _category: ReportCategory
): ReportData {
  const data = generateMockDataPoints(reportId);
  const totalValue = data.reduce((sum, point) => sum + point.value, 0);
  const averageValue = totalValue / data.length;

  return {
    reportId,
    dateRange,
    data,
    summary: {
      totalValue,
      averageValue,
      changeFromPrevious: Math.random() > 0.5 ? 8.5 : -3.2,
      trendDirection: Math.random() > 0.5 ? 'up' : 'down',
    },
  };
}
