'use client';

import * as React from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Lock, GripVertical } from 'lucide-react';
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
  // Unified calendar scheduling fields
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  remainingDuration?: number; // Hours remaining for display
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
          'cursor-pointer',
          'hover:border-linear-border-default',
          'hover:shadow-linear-sm',
        ],
        'due-today': [
          'border-l-[#F59E0B]',
          'cursor-pointer',
          'hover:border-linear-border-default',
          'hover:shadow-linear-sm',
        ],
        overdue: [
          'border-l-[#EF4444]',
          'bg-[rgba(239,68,68,0.05)]',
          'cursor-pointer',
          'hover:border-linear-border-default',
          'hover:shadow-linear-sm',
        ],
        locked: [
          'border-l-[#EF4444]',
          'bg-[rgba(239,68,68,0.1)]',
          'opacity-70',
          'cursor-not-allowed',
        ],
      },
    },
    defaultVariants: {
      variant: 'on-track',
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

export interface CalendarTaskCardProps extends VariantProps<typeof taskCardVariants> {
  task: CalendarTask;
  variant: TaskCardVariant;
  onClick?: (e?: React.MouseEvent<HTMLDivElement>) => void;
  className?: string;
  // Unified calendar: Props for absolute positioning in time grid
  /** Position from top of time grid (pixels) - enables time-grid mode */
  top?: number;
  /** Height of task block (pixels) - calculated from remaining duration */
  height?: number;
  /** Left offset as percentage (0-100) for multi-task stacking */
  left?: number;
  /** Width as percentage (0-100) for multi-task stacking */
  width?: number;
  // Drag and drop props
  /** Enable drag functionality */
  isDraggable?: boolean;
  /** Called when drag starts */
  onDragStart?: (task: CalendarTask, position: { x: number; y: number }) => void;
  /** Called during drag */
  onDrag?: (position: { x: number; y: number }) => void;
  /** Called when drag ends */
  onDragEnd?: () => void;
  /** Whether this task is currently being dragged */
  isDragging?: boolean;
}

/**
 * TaskCard - A task card for the Calendar v2 page
 *
 * Displays task information with visual states based on deadline status:
 * - on-track: Purple border, normal state
 * - due-today: Orange border, orange deadline text
 * - overdue: Red border, red-tinted background, red deadline text
 * - locked: Red border, stronger red background, shows lock icon
 *
 * Unified Calendar Mode:
 * When top/height props are provided, renders with absolute positioning in time grid.
 * Shows remaining duration instead of estimated.
 */
const TaskCard = React.forwardRef<HTMLDivElement, CalendarTaskCardProps>(
  (
    {
      className,
      task,
      variant = 'on-track',
      onClick,
      top,
      height,
      left = 0,
      width = 100,
      isDraggable = false,
      onDragStart,
      onDrag,
      onDragEnd,
      isDragging = false,
    },
    ref
  ) => {
    const isLocked = variant === 'locked';
    const isTimeGridMode = top !== undefined && height !== undefined;

    // Track if we're in a drag operation to prevent click
    const isDraggingRef = React.useRef(false);
    const dragStartPosRef = React.useRef<{ x: number; y: number } | null>(null);

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        // Don't trigger click if we just finished dragging
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          return;
        }
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

    // Drag handlers for framer-motion
    const handleDragStart = React.useCallback(
      (event: MouseEvent | TouchEvent | PointerEvent) => {
        if (!isDraggable || isLocked) return;

        isDraggingRef.current = true;
        const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
        const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
        dragStartPosRef.current = { x: clientX, y: clientY };

        onDragStart?.(task, { x: clientX, y: clientY });
      },
      [isDraggable, isLocked, task, onDragStart]
    );

    const handleDrag = React.useCallback(
      (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (!isDraggable || isLocked) return;

        // Use info.point from framer-motion which is the actual pointer position
        const { x, y } = info.point;
        console.log('[TaskCard] handleDrag - point:', { x, y });
        onDrag?.({ x, y });
      },
      [isDraggable, isLocked, onDrag]
    );

    const handleDragEnd = React.useCallback(() => {
      if (!isDraggable || isLocked) return;

      // Small delay to prevent click from firing
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 100);

      onDragEnd?.();
    }, [isDraggable, isLocked, onDragEnd]);

    // Format remaining duration for display
    const displayDuration = React.useMemo(() => {
      if (task.remainingDuration !== undefined) {
        const hours = task.remainingDuration;
        if (hours < 1) return `${Math.round(hours * 60)}min`;
        if (hours === Math.floor(hours)) return `${hours}h`;
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;
      }
      return task.estimatedDuration;
    }, [task.remainingDuration, task.estimatedDuration]);

    // Build positioning styles for time grid mode
    const positionStyles: React.CSSProperties = isTimeGridMode
      ? {
          position: 'absolute',
          top: `${top}px`,
          left: `${left}%`,
          width: `${width}%`,
          height: `${height}px`,
          minHeight: '24px',
          zIndex: 1,
        }
      : {};

    return (
      <motion.div
        layout
        layoutId={task.id}
        ref={ref}
        role="button"
        tabIndex={0}
        className={cn(
          'group',
          taskCardVariants({ variant }),
          isTimeGridMode && 'overflow-hidden',
          isDraggable && !isLocked && 'cursor-grab active:cursor-grabbing',
          isDragging && 'opacity-50 shadow-linear-lg ring-2 ring-linear-accent z-50',
          className
        )}
        style={positionStyles}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={`Task: ${task.title}`}
        aria-disabled={isLocked}
        // Drag props - use pointer events for better control
        // We use dragSnapToOrigin to snap back after drag ends (preview handles visual)
        drag={isDraggable && !isLocked}
        dragSnapToOrigin
        dragElastic={0.1}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        whileDrag={{
          scale: 1.02,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          zIndex: 100,
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: isDragging ? 0.5 : 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{
          layout: { type: 'spring', stiffness: 300, damping: 30 },
          opacity: { duration: 0.2 },
          scale: { duration: 0.2 },
        }}
      >
        {/* Lock icon for locked state */}
        {isLocked && (
          <Lock className="absolute right-1 top-1 h-2.5 w-2.5 text-[#EF4444]" aria-hidden="true" />
        )}

        {/* Drag handle for draggable tasks */}
        {isDraggable && !isLocked && (
          <GripVertical
            className="absolute right-1 top-1 h-3 w-3 text-linear-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity"
            aria-hidden="true"
          />
        )}

        {/* Task title */}
        <div className="truncate text-xs font-light text-linear-text-primary mb-0.5">
          {task.title}
        </div>

        {/* Task metadata */}
        <div className="flex items-center gap-2 text-[10px]">
          {/* Duration badge */}
          {displayDuration && (
            <span className="rounded-linear-sm bg-linear-bg-tertiary px-1 py-px text-linear-text-tertiary">
              {displayDuration}
            </span>
          )}

          {/* Deadline text - only show in non-time-grid mode or if space allows */}
          {!isTimeGridMode && (
            <span className={cn(deadlineVariants({ variant }))}>Scadenta: {task.dueDate}</span>
          )}
        </div>
      </motion.div>
    );
  }
);

TaskCard.displayName = 'TaskCard';

export { TaskCard, taskCardVariants };
