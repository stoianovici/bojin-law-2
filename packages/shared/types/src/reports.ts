import type { UserRole } from './entities';
import type { ChartType } from './dashboard';

export type ReportCategory =
  | 'cases'
  | 'time'
  | 'financial'
  | 'team'
  | 'clients'
  | 'documents';

export interface ReportMetadata {
  id: string;
  categoryId: ReportCategory;
  name: string;
  nameRo: string; // Romanian name
  description: string;
  allowedRoles: UserRole[]; // Who can access this report
  chartType: ChartType;
  requiresDateRange: boolean;
}

export interface DateRange {
  start: Date;
  end: Date;
  preset: DateRangePreset | null;
}

export type DateRangePreset =
  | 'thisWeek'
  | 'thisMonth'
  | 'thisQuarter'
  | 'thisYear';

export interface ReportData {
  reportId: string;
  dateRange: DateRange;
  data: ChartDataPoint[];
  summary?: ReportSummary;
  comparisonData?: ComparisonData;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  metadata?: Record<string, any>; // For drill-down
}

export interface ReportSummary {
  totalValue: number;
  averageValue: number;
  changeFromPrevious?: number; // percentage
  trendDirection?: 'up' | 'down' | 'stable';
}

export interface ComparisonData {
  previousPeriod: ChartDataPoint[];
  percentChange: number;
}

export interface CustomReport {
  id: string;
  name: string;
  dataSource: ReportDataSource;
  selectedFields: string[];
  filters: ReportFilter[];
  groupBy?: string;
  chartType: ChartType;
  createdAt: Date;
  createdBy: string;
}

export type ReportDataSource =
  | 'cases'
  | 'timeEntries'
  | 'invoices'
  | 'clients'
  | 'documents';

export interface ReportFilter {
  field: string;
  operator: FilterOperator;
  value: string | number | Date;
}

export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'lessThan'
  | 'contains'
  | 'between';

export interface DrillDownData {
  reportId: string;
  dataPoint: ChartDataPoint;
  detailRows: Record<string, any>[];
  columns: ColumnDefinition[];
}

export interface ColumnDefinition {
  key: string;
  label: string;
  labelRo: string;
  type: 'text' | 'number' | 'date' | 'currency';
}
