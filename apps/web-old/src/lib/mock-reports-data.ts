/**
 * Reports Data (OPS-151)
 * Returns predefined report templates
 */

import type {
  ReportMetadata,
  ReportData,
  ReportCategory,
  DateRange,
  ChartDataPoint,
} from '@legal-platform/types';
import { PREDEFINED_REPORT_TEMPLATES } from './report-templates';

export function getReportMetadata(): ReportMetadata[] {
  // Return predefined templates as metadata
  return PREDEFINED_REPORT_TEMPLATES;
}

export function getReportData(
  reportId: string,
  dateRange: DateRange,
  _category: ReportCategory
): ReportData {
  // Return empty report data - actual data should come from API (OPS-153)
  return {
    reportId,
    dateRange,
    data: [] as ChartDataPoint[],
    summary: {
      totalValue: 0,
      averageValue: 0,
      changeFromPrevious: 0,
      trendDirection: 'stable' as const,
    },
  };
}
