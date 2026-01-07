/**
 * Analytics Components Index
 * Story 2.11.4: Financial Dashboard UI
 *
 * Export all analytics components for easy importing.
 */

export { DashboardHeader } from './DashboardHeader';
export type { DashboardHeaderProps } from './DashboardHeader';

export { DateRangePicker } from './DateRangePicker';
export type { DateRangePickerProps } from './DateRangePicker';

export { PeriodComparisonToggle } from './PeriodComparisonToggle';
export type { PeriodComparisonToggleProps } from './PeriodComparisonToggle';

export { DeltaBadge } from './DeltaBadge';
export type { DeltaBadgeProps } from './DeltaBadge';

// Re-export widgets
export * from './widgets';

// Re-export formatters
export * from './utils/formatters';

// Story 4.7: Task Analytics Components
export { CompletionTimeCharts } from './CompletionTimeCharts';
export { OverdueAnalysisPanel } from './OverdueAnalysisPanel';
export { VelocityTrendsChart } from './VelocityTrendsChart';
export { PatternDetectionPanel } from './PatternDetectionPanel';
export { DelegationAnalysisPanel } from './DelegationAnalysisPanel';
export { ROIDashboard } from './ROIDashboard';
export { AnalyticsFilterBar } from './AnalyticsFilterBar';

// Tab components for unified analytics page
export { FinancialAnalyticsTab } from './FinancialAnalyticsTab';
export { TaskAnalyticsTab } from './TaskAnalyticsTab';

// Story 5.7: Platform Intelligence Components
export { PlatformHealthScoreCard } from './PlatformHealthScoreCard';
export { KeyMetricsSummaryRow } from './KeyMetricsSummaryRow';
export { ResponseTimeAnalyticsPanel } from './ResponseTimeAnalyticsPanel';
export { ResponseTimeTrendChart } from './ResponseTimeTrendChart';
export { DocumentQualityPanel } from './DocumentQualityPanel';
export { DocumentIssuesBreakdown } from './DocumentIssuesBreakdown';
export { AIUtilizationPanel } from './AIUtilizationPanel';
export { UserAdoptionLeaderboard } from './UserAdoptionLeaderboard';
export { FeatureUsageBreakdown } from './FeatureUsageBreakdown';
export { RecommendationsPanel } from './RecommendationsPanel';
