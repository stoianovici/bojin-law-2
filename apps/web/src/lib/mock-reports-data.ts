/**
 * Reports Data
 * CLEANED: Mock data removed - use real API calls instead
 */

import type {
  ReportMetadata,
  ReportData,
  ReportCategory,
  DateRange,
  ChartDataPoint,
} from '@legal-platform/types';

export function getReportMetadata(): ReportMetadata[] {
  // Return empty array - report metadata should come from API
  return [];
}

export function getReportData(
  reportId: string,
  dateRange: DateRange,
  _category: ReportCategory
): ReportData {
  // Return empty report data - should come from API
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
