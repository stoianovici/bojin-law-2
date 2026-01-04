'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CountBadge } from './StatusDot';

// ====================================================================
// CollapsibleSection - Expandable section with header and smooth animation
// ====================================================================

export interface CollapsibleSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Section title (displayed uppercase) */
  title: string;
  /** Optional item count to display */
  count?: number;
  /** Whether section is expanded (controlled mode) */
  expanded?: boolean;
  /** Default expanded state (uncontrolled mode) */
  defaultExpanded?: boolean;
  /** Callback when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void;
  /** Whether to show the divider line after title */
  showDivider?: boolean;
}

/**
 * CollapsibleSection renders an expandable section matching the Linear mockup:
 * - Chevron toggle icon with rotation animation
 * - Uppercase title (11px, tertiary color)
 * - Optional count badge
 * - Optional divider line
 * - Smooth height animation on collapse/expand
 */
export function CollapsibleSection({
  className,
  children,
  title,
  count,
  expanded: controlledExpanded,
  defaultExpanded = true,
  onExpandedChange,
  showDivider = false,
  ...props
}: CollapsibleSectionProps) {
  const [internalExpanded, setInternalExpanded] = React.useState(defaultExpanded);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    const newValue = !isExpanded;
    if (!isControlled) {
      setInternalExpanded(newValue);
    }
    onExpandedChange?.(newValue);
  };

  return (
    <div className={cn('mb-6', className)} {...props}>
      {/* Section Header */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        className="group flex w-full items-center gap-2 py-2 text-left"
      >
        {/* Toggle Icon */}
        <ChevronDown
          className={cn(
            'h-4 w-4 text-linear-text-tertiary transition-transform duration-150',
            !isExpanded && '-rotate-90'
          )}
        />

        {/* Title */}
        <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-linear-text-tertiary transition-colors group-hover:text-linear-text-secondary">
          {title}
        </span>

        {/* Count Badge */}
        {count !== undefined && count > 0 && <CountBadge count={count} size="sm" variant="muted" />}

        {/* Optional Divider Line */}
        {showDivider && <div className="ml-2 h-px flex-1 bg-linear-border-subtle" />}
      </button>

      {/* Collapsible Content */}
      <div
        className={cn(
          'grid transition-all duration-200 ease-in-out',
          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ====================================================================
// PeriodSection - Variant for document grouping by time period
// ====================================================================

export interface PeriodSectionProps extends Omit<CollapsibleSectionProps, 'showDivider'> {
  /** Description text (e.g., "4 documente") */
  description?: string;
}

/**
 * PeriodSection is a variant for grouping documents by time period:
 * - Same as CollapsibleSection but always shows divider
 * - Includes optional description text
 */
export function PeriodSection({ title, description, count, ...props }: PeriodSectionProps) {
  return (
    <CollapsibleSection
      title={title}
      count={description ? undefined : count}
      showDivider
      {...props}
    >
      {props.children}
    </CollapsibleSection>
  );
}

// ====================================================================
// TaskSection - Pre-configured section for task grouping
// ====================================================================

export type TaskSectionType = 'urgent' | 'thisWeek' | 'completed';

const taskSectionConfig: Record<TaskSectionType, { title: string; defaultExpanded: boolean }> = {
  urgent: { title: 'URGENTE', defaultExpanded: true },
  thisWeek: { title: 'ACEASTĂ SĂPTĂMÂNĂ', defaultExpanded: true },
  completed: { title: 'FINALIZATE RECENT', defaultExpanded: false },
};

export interface TaskSectionProps
  extends Omit<CollapsibleSectionProps, 'title' | 'defaultExpanded'> {
  /** Section type determines title and default expanded state */
  type: TaskSectionType;
  /** Override the default title */
  title?: string;
}

/**
 * TaskSection is a pre-configured CollapsibleSection for task grouping:
 * - Urgent: Expanded by default
 * - This Week: Expanded by default
 * - Completed: Collapsed by default
 */
export function TaskSection({ type, title, ...props }: TaskSectionProps) {
  const config = taskSectionConfig[type];

  return (
    <CollapsibleSection
      title={title || config.title}
      defaultExpanded={config.defaultExpanded}
      {...props}
    />
  );
}
