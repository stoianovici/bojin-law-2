/**
 * Linear-style Design System Components
 *
 * Reusable components matching the Linear/dark mode design mockup.
 * Use these for building desktop dashboard pages.
 *
 * @see docs/design/linear-style-mockup.html for reference
 * @see docs/design/linear-style-tokens.md for design tokens
 */

// ====================================================================
// Page Layout Components
// ====================================================================

export { PageLayout, PageHeader, PageContent } from './PageLayout';
export type { PageLayoutProps, PageHeaderProps, PageContentProps } from './PageLayout';

// ====================================================================
// Section Headers
// ====================================================================

export { SectionHeader, LinearCardHeader, CardActionButton } from './SectionHeader';
export type {
  SectionHeaderProps,
  LinearCardHeaderProps,
  CardActionButtonProps,
} from './SectionHeader';

// ====================================================================
// Status Indicators
// ====================================================================

export { StatusDot, StatusBadge } from './StatusDot';
export type { StatusDotProps, StatusBadgeProps } from './StatusDot';

// ====================================================================
// List Items
// ====================================================================

export { ListItem, TaskListItem, CaseListItem } from './ListItem';
export type { ListItemProps, TaskListItemProps, CaseListItemProps } from './ListItem';

// ====================================================================
// Metrics and Stats
// ====================================================================

export { MetricCard, MetricGrid, BriefingStat, BriefingStatsRow } from './MetricCard';
export type {
  MetricCardProps,
  MetricGridProps,
  BriefingStatProps,
  BriefingStatsRowProps,
} from './MetricCard';

// ====================================================================
// Grid and Widget Layout
// ====================================================================

export { WidgetGrid, Widget, WidgetBody, BriefingCard, WorkloadItem } from './WidgetGrid';
export type {
  WidgetGridProps,
  WidgetProps,
  WidgetBodyProps,
  BriefingCardProps,
  WorkloadItemProps,
} from './WidgetGrid';

// ====================================================================
// Filters and Search
// ====================================================================

export {
  FilterChip,
  FilterChipsRow,
  FilterSelect,
  SearchBox,
  IconButton,
} from './FilterChips';
export type {
  FilterChipProps,
  FilterChipsRowProps,
  FilterSelectProps,
  SearchBoxProps,
  IconButtonProps,
} from './FilterChips';
