'use client';

import * as React from 'react';
import { Lock } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Task data structure for calendar task cards
 */
export interface CalendarTask {
  id: string;
  title: string;
  estimatedDuration?: string;
  dueDate: string;
}

/**
 * Visual state variants for task cards
 */
export type TaskCardVariant = 'on-track' | 'due-today' | 'overdue' | 'locked';

const taskCardVariants = cva(
  [
    'relative',
    'bg-linear-bg-secondary',
    'border border-linear-border-subtle',
    'border-l-[3px]',
    'rounded-linear-sm',
    'p-2',
    'transition-all duration-150 ease-out',
  ],
  {
    variants: {
      variant: {
        'on-track': [
          'border-l-[#8B5CF6]',
          'cursor-grab',
          'hover:border-linear-border-default',
          'hover:shadow-linear-sm',
          'active:cursor-grabbing',
        ],
        'due-today': [
          'border-l-[#F59E0B]',
          'cursor-grab',
          'hover:border-linear-border-default',
          'hover:shadow-linear-sm',
          'active:cursor-grabbing',
        ],
        overdue: [
          'border-l-[#EF4444]',
          'bg-[rgba(239,68,68,0.05)]',
          'cursor-grab',
          'hover:border-linear-border-default',
          'hover:shadow-linear-sm',
          'active:cursor-grabbing',
        ],
        locked: [
          'border-l-[#EF4444]',
          'bg-[rgba(239,68,68,0.1)]',
          'opacity-70',
          'cursor-not-allowed',
        ],
      },
      isDragging: {
        true: 'opacity-50 rotate-[2deg]',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'on-track',
      isDragging: false,
    },
  }
);

const deadlineVariants = cva('text-linear-text-tertiary', {
  variants: {
    variant: {
      'on-track': '',
      'due-today': 'text-[#F59E0B]',
      overdue: 'text-[#EF4444]',
      locked: 'text-[#EF4444]',
    },
  },
  defaultVariants: {
    variant: 'on-track',
  },
});

export interface CalendarTaskCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick' | 'onDragStart' | 'onDragEnd'>,
    VariantProps<typeof taskCardVariants> {
  task: CalendarTask;
  variant: TaskCardVariant;
  onDragStart?: (e: React.DragEvent, taskId: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onClick?: (e?: React.MouseEvent<HTMLDivElement>) => void;
}

/**
 * TaskCard - A draggable task card for the Calendar v2 page
 *
 * Displays task information with visual states based on deadline status:
 * - on-track: Purple border, normal state
 * - due-today: Orange border, orange deadline text
 * - overdue: Red border, red-tinted background, red deadline text
 * - locked: Red border, stronger red background, not draggable, shows lock icon
 */
const TaskCard = React.forwardRef<HTMLDivElement, CalendarTaskCardProps>(
  ({ className, task, variant = 'on-track', onDragStart, onDragEnd, onClick, ...props }, ref) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const isLocked = variant === 'locked';

    const handleDragStart = React.useCallback(
      (e: React.DragEvent<HTMLDivElement>) => {
        if (isLocked) {
          e.preventDefault();
          return;
        }
        setIsDragging(true);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart?.(e, task.id);
      },
      [isLocked, task.id, onDragStart]
    );

    const handleDragEnd = React.useCallback(
      (e: React.DragEvent<HTMLDivElement>) => {
        setIsDragging(false);
        onDragEnd?.(e);
      },
      [onDragEnd]
    );

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        onClick?.(e);
      },
      [onClick]
    );

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      },
      [onClick]
    );

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        draggable={!isLocked}
        className={cn(taskCardVariants({ variant, isDragging }), className)}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={`Task: ${task.title}`}
        aria-disabled={isLocked}
        {...props}
      >
        {/* Lock icon for locked state */}
        {isLocked && (
          <Lock className="absolute right-1 top-1 h-2.5 w-2.5 text-[#EF4444]" aria-hidden="true" />
        )}

        {/* Task title */}
        <div className="truncate text-xs font-light text-linear-text-primary mb-0.5">
          {task.title}
        </div>

        {/* Task metadata */}
        <div className="flex items-center gap-2 text-[10px]">
          {/* Duration badge */}
          {task.estimatedDuration && (
            <span className="rounded-linear-sm bg-linear-bg-tertiary px-1 py-px text-linear-text-tertiary">
              {task.estimatedDuration}
            </span>
          )}

          {/* Deadline text */}
          <span className={cn(deadlineVariants({ variant }))}>Scadenta: {task.dueDate}</span>
        </div>
      </div>
    );
  }
);

TaskCard.displayName = 'TaskCard';

export { TaskCard, taskCardVariants };
