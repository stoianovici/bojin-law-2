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
// Collapsible Sections
// ====================================================================

export { CollapsibleSection, PeriodSection, TaskSection } from './CollapsibleSection';
export type {
  CollapsibleSectionProps,
  PeriodSectionProps,
  TaskSectionProps,
  TaskSectionType,
} from './CollapsibleSection';

// ====================================================================
// Status Indicators
// ====================================================================

export {
  StatusDot,
  StatusBadge,
  PriorityBadge,
  PriorityBar,
  WorkflowStatusBadge,
  FileTypeBadge,
  CountBadge,
} from './StatusDot';
export type {
  StatusDotProps,
  StatusBadgeProps,
  PriorityBadgeProps,
  PriorityBarProps,
  WorkflowStatusBadgeProps,
  FileTypeBadgeProps,
  CountBadgeProps,
  PriorityLevel,
  WorkflowStatus,
  FileType,
} from './StatusDot';

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

export { FilterChip, FilterChipsRow, FilterSelect, SearchBox, IconButton } from './FilterChips';
export type {
  FilterChipProps,
  FilterChipsRowProps,
  FilterSelectProps,
  SearchBoxProps,
  IconButtonProps,
} from './FilterChips';

// ====================================================================
// Data Tables
// ====================================================================

export { MinimalTable, TitleSubtitleCell, NumericCell, ActionsCell } from './MinimalTable';
export type {
  MinimalTableProps,
  ColumnDef,
  SortDirection,
  TitleSubtitleCellProps,
  NumericCellProps,
  ActionsCellProps,
} from './MinimalTable';

export {
  GroupedTable,
  groupByDate,
  getDateGroupKey,
  TableFooterCell,
  TotalsRow,
} from './GroupedTable';
export type {
  GroupedTableProps,
  GroupDef,
  GroupedColumnDef,
  DateGroupKey,
  TableFooterCellProps,
  TotalsRowProps,
} from './GroupedTable';

// ====================================================================
// Modals & Dialogs
// ====================================================================

export { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
export type {
  ConfirmDialogProps,
  ConfirmDialogSeverity,
  UseConfirmDialogOptions,
} from './ConfirmDialog';

export { FormModal, FormGroup, FormRow, FormDivider } from './FormModal';
export type { FormModalProps, FormGroupProps, FormRowProps } from './FormModal';

export { SlideOver, SlideOverSection } from './SlideOver';
export type { SlideOverProps, SlideOverSectionProps } from './SlideOver';

// ====================================================================
// Navigation Components
// ====================================================================

export { StatusToggle, StatusToggleItem, StatusToggleGroup } from './StatusToggle';
export type { StatusToggleProps, StatusToggleOption, StatusToggleItemProps } from './StatusToggle';

export { ViewToggle, ViewToggleButton } from './ViewToggle';
export type {
  ViewToggleProps,
  ViewToggleOption,
  ViewToggleButtonProps,
  ViewType,
} from './ViewToggle';

export { TabBar, Tab, TabList, TabPanel } from './TabBar';
export type { TabBarProps, TabOption, TabProps, TabListProps, TabPanelProps } from './TabBar';

export {
  Breadcrumb,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbCurrent,
  BreadcrumbList,
} from './Breadcrumb';
export type {
  BreadcrumbProps,
  BreadcrumbItem,
  BreadcrumbLinkProps,
  BreadcrumbSeparatorProps,
  BreadcrumbCurrentProps,
  BreadcrumbListProps,
} from './Breadcrumb';

// ====================================================================
// Document Components
// ====================================================================

export { DocumentCard, DocumentGrid } from './DocumentCard';
export type { DocumentCardProps, DocumentGridProps } from './DocumentCard';

// ====================================================================
// State Components (Empty, Error, Loading)
// ====================================================================

export { EmptyState } from './EmptyState';
export type { EmptyStateProps, EmptyStateVariant, EmptyStatePreset } from './EmptyState';

export { ErrorState, PageError, SectionError, InlineError } from './ErrorState';
export type { ErrorStateProps, ErrorStateVariant, ErrorCode } from './ErrorState';
