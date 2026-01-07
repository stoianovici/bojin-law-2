'use client';

import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface OverflowTaskCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> {
  task: {
    id: string;
    title: string;
    remainingDuration: number;
  };
  /** Day index where task is primarily assigned (0-4 for Mon-Fri) */
  primaryDayIndex: number;
  /** Hours that overflow into the previous day */
  overflowDuration: number;
  /** Total duration of the task in hours */
  totalDuration: number;
  onClick?: () => void;
}

// ============================================================================
// Styles
// ============================================================================

const overflowCardVariants = cva(
  [
    'relative',
    'flex',
    'bg-linear-bg-secondary',
    'border border-linear-border-subtle',
    'rounded-linear-sm',
    'cursor-pointer',
    'transition-all duration-300 ease-out',
    'hover:border-linear-border-default',
    'hover:shadow-linear-sm',
  ],
  {
    variants: {
      isAnimating: {
        true: 'animate-pulse',
        false: '',
      },
    },
    defaultVariants: {
      isAnimating: false,
    },
  }
);

// ============================================================================
// Component
// ============================================================================

/**
 * OverflowTaskCard - A task card that spans two grid columns
 *
 * Used when a day's tasks exceed 9 hours and the longest task
 * extends into the previous day. Visually shows:
 * - Overflow section (previous day) with dashed border
 * - Primary section (main day) with solid purple border
 * - "continuă →" badge at the junction point
 *
 * Animation: Width transitions smoothly when overflow status changes
 */
const OverflowTaskCard = React.forwardRef<HTMLDivElement, OverflowTaskCardProps>(
  (
    {
      className,
      task,
      primaryDayIndex,
      overflowDuration,
      totalDuration,
      onClick,
      ...props
    },
    ref
  ) => {
    const [isAnimating, setIsAnimating] = React.useState(true);

    // Calculate the width percentages for each section
    const overflowPercentage = totalDuration > 0 ? (overflowDuration / totalDuration) * 100 : 0;
    const primaryPercentage = 100 - overflowPercentage;

    // Trigger animation on mount and when overflow changes
    React.useEffect(() => {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }, [overflowDuration, totalDuration]);

    // Format duration for display
    const formatDuration = (hours: number): string => {
      if (hours < 1) return `${Math.round(hours * 60)}min`;
      if (hours === Math.floor(hours)) return `${hours}h`;
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      return `${h}h ${m}m`;
    };

    const handleClick = React.useCallback(() => {
      onClick?.();
    }, [onClick]);

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      },
      [onClick]
    );

    // Grid column positioning: span from previous day to primary day
    // primaryDayIndex is 0-based (Mon=0, Tue=1, etc.)
    // Grid columns are 1-based, so we start at primaryDayIndex (previous day + 1)
    const gridColumnStart = primaryDayIndex; // Previous day (0-indexed becomes 1-indexed prev day)
    const gridColumnSpan = 2;

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        className={cn(
          overflowCardVariants({ isAnimating: false }),
          'overflow-hidden',
          className
        )}
        style={{
          gridColumn: `${gridColumnStart} / span ${gridColumnSpan}`,
        }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={`Task spanning days: ${task.title}, ${formatDuration(overflowDuration)} overflow`}
        {...props}
      >
        {/* Overflow section (previous day) - dashed border indicates continuation */}
        <div
          className={cn(
            'flex-shrink-0',
            'border-l-[3px] border-dashed border-l-[#8B5CF6]/50',
            'bg-[#8B5CF6]/5',
            'p-2',
            'transition-all duration-300 ease-out',
          )}
          style={{
            width: `${overflowPercentage}%`,
            minWidth: overflowPercentage > 0 ? '60px' : '0',
          }}
        >
          {/* Overflow duration indicator */}
          <div className="flex items-center gap-1 text-[10px] text-linear-text-tertiary">
            <span className="rounded-linear-sm bg-linear-bg-tertiary px-1 py-px">
              {formatDuration(overflowDuration)}
            </span>
          </div>
        </div>

        {/* Junction badge - "continuă →" */}
        <div
          className={cn(
            'absolute z-10',
            'flex items-center gap-0.5',
            'bg-[#8B5CF6]',
            'text-white text-[9px] font-medium',
            'px-1.5 py-0.5',
            'rounded-full',
            'shadow-sm',
            'whitespace-nowrap',
          )}
          style={{
            left: `calc(${overflowPercentage}% - 32px)`,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          continuă
          <ArrowRight className="h-2.5 w-2.5" />
        </div>

        {/* Primary section (main day) - solid purple border */}
        <div
          className={cn(
            'flex-1',
            'border-l-[3px] border-l-[#8B5CF6]',
            'bg-linear-bg-secondary',
            'p-2',
            'min-w-0',
            'transition-all duration-300 ease-out',
          )}
          style={{
            width: `${primaryPercentage}%`,
          }}
        >
          {/* Task title */}
          <div className="truncate text-xs font-light text-linear-text-primary mb-0.5">
            {task.title}
          </div>

          {/* Task metadata */}
          <div className="flex items-center gap-2 text-[10px]">
            {/* Remaining duration badge */}
            <span className="rounded-linear-sm bg-linear-bg-tertiary px-1 py-px text-linear-text-tertiary">
              {formatDuration(task.remainingDuration)}
            </span>

            {/* Total duration indicator */}
            <span className="text-linear-text-quaternary">
              (total: {formatDuration(totalDuration)})
            </span>
          </div>
        </div>
      </div>
    );
  }
);

OverflowTaskCard.displayName = 'OverflowTaskCard';

export { OverflowTaskCard };
