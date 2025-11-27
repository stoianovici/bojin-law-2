/**
 * Analytics Widgets Index
 * Story 2.11.4: Financial Dashboard UI
 *
 * Export all widget components for easy importing.
 */

export { BaseWidget } from './BaseWidget';
export type { BaseWidgetProps } from './BaseWidget';

export {
  WidgetSkeleton,
  ChartSkeleton,
  NumberSkeleton,
  ListSkeleton,
  GaugeSkeleton,
  KPISkeleton,
} from './WidgetSkeleton';

export { RevenueOverviewWidget } from './RevenueOverviewWidget';
export type { RevenueOverviewWidgetProps } from './RevenueOverviewWidget';

export { RevenueTrendWidget } from './RevenueTrendWidget';
export type { RevenueTrendWidgetProps } from './RevenueTrendWidget';

export { UtilizationWidget } from './UtilizationWidget';
export type { UtilizationWidgetProps } from './UtilizationWidget';

export { ProfitabilityWidget } from './ProfitabilityWidget';
export type { ProfitabilityWidgetProps } from './ProfitabilityWidget';

export { RetainerStatusWidget } from './RetainerStatusWidget';
export type { RetainerStatusWidgetProps } from './RetainerStatusWidget';
