'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { StatusDot, StatusBadge, PriorityBar } from './StatusDot';

// ====================================================================
// ListItem - Generic list row with hover state (for tasks, items)
// ====================================================================

export interface ListItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether the item shows a checkbox */
  showCheckbox?: boolean;
  /** Whether the checkbox is checked */
  checked?: boolean;
  /** Callback when checkbox changes */
  onCheckedChange?: (checked: boolean) => void;
  /** Make the item clickable with hover state */
  interactive?: boolean;
}

/**
 * ListItem renders a generic list row with:
 * - Optional checkbox
 * - Hover state with negative margin expansion
 * - Bottom border
 */
export function ListItem({
  className,
  children,
  showCheckbox = false,
  checked = false,
  onCheckedChange,
  interactive = true,
  onClick,
  ...props
}: ListItemProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 border-b border-linear-border-subtle py-3 transition-all duration-150',
        interactive && 'cursor-pointer hover:-mx-5 hover:bg-linear-bg-hover hover:px-5',
        'last:border-b-0',
        className
      )}
      onClick={onClick}
      {...props}
    >
      {showCheckbox && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCheckedChange?.(!checked);
          }}
          className={cn(
            'mt-0.5 h-[18px] w-[18px] flex-shrink-0 rounded border-2 transition-all duration-150',
            checked
              ? 'border-linear-accent bg-linear-accent'
              : 'border-[rgba(255,255,255,0.15)] hover:border-linear-accent'
          )}
          aria-label={checked ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {checked && (
            <svg className="h-full w-full text-white" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// ====================================================================
// TaskListItem - Specific list item for tasks
// ====================================================================

export interface TaskListItemProps extends Omit<ListItemProps, 'children'> {
  /** Task title */
  title: string;
  /** Priority level */
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  /** Case reference (e.g., "CAZ-2024-0156") */
  caseRef?: string;
  /** Due date label (e.g., "Scadent: Mâine") */
  dueDate?: string;
  /** Optional additional meta items */
  meta?: React.ReactNode;
  /** Show vertical priority bar on left side */
  showPriorityBar?: boolean;
}

/**
 * TaskListItem renders a task row matching the mockup:
 * - Optional priority bar on left
 * - Checkbox + title
 * - Priority badge + case ref + due date
 */
export function TaskListItem({
  title,
  priority,
  caseRef,
  dueDate,
  meta,
  showPriorityBar = false,
  checked,
  ...props
}: TaskListItemProps) {
  const priorityLabels = {
    urgent: 'Urgent',
    high: 'Prioritate înaltă',
    medium: 'Normal',
    low: 'Scăzut',
  };

  return (
    <ListItem showCheckbox checked={checked} {...props}>
      <div className="flex gap-3">
        {/* Priority Bar */}
        {showPriorityBar && priority && (
          <PriorityBar priority={priority} size="md" className="flex-shrink-0" />
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'mb-1 text-[13px] font-medium text-linear-text-primary',
              checked && 'text-linear-text-muted line-through'
            )}
          >
            {title}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-linear-text-tertiary">
            {priority && !showPriorityBar && (
              <StatusBadge variant={priority}>{priorityLabels[priority]}</StatusBadge>
            )}
            {caseRef && <span>{caseRef}</span>}
            {dueDate && <span>{dueDate}</span>}
            {meta}
          </div>
        </div>
      </div>
    </ListItem>
  );
}

// ====================================================================
// CaseListItem - Specific list item for cases
// ====================================================================

export interface CaseListItemProps extends Omit<ListItemProps, 'children' | 'showCheckbox'> {
  /** Case number (e.g., "CAZ-2024-0156") */
  caseNumber: string;
  /** Case title */
  title: string;
  /** Client name */
  client: string;
  /** Status indicator */
  status?: 'active' | 'pending' | 'at-risk';
  /** Optional value (for high-value cases display) */
  value?: string;
}

/**
 * CaseListItem renders a case row matching the mockup:
 * - Case number (accent color, monospace)
 * - Case title
 * - Client name
 * - Status dot on the right
 */
export function CaseListItem({
  caseNumber,
  title,
  client,
  status,
  value,
  className,
  ...props
}: CaseListItemProps) {
  return (
    <ListItem className={cn('items-center justify-between', className)} {...props}>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-mono text-xs font-semibold text-linear-accent">{caseNumber}</span>
        <span className="text-[13px] font-medium text-linear-text-primary">{title}</span>
        {value ? (
          <span className="text-xs text-linear-success">{value}</span>
        ) : (
          <span className="text-xs text-linear-text-tertiary">{client}</span>
        )}
      </div>
      {status && (
        <div className="flex-shrink-0">
          <StatusDot status={status} />
        </div>
      )}
    </ListItem>
  );
}
