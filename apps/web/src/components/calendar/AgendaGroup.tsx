'use client';

import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgendaItem, AgendaItemProps } from './AgendaItem';

/**
 * Romanian day names (starting from Sunday = 0)
 */
const romanianDays = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];

/**
 * Romanian month names (starting from January = 0)
 */
const romanianMonths = [
  'Ianuarie',
  'Februarie',
  'Martie',
  'Aprilie',
  'Mai',
  'Iunie',
  'Iulie',
  'August',
  'Septembrie',
  'Octombrie',
  'Noiembrie',
  'Decembrie',
];

/**
 * Format a date in Romanian format
 * @example "Luni, 2 Ianuarie 2026"
 */
function formatRomanianDate(date: Date): string {
  const dayName = romanianDays[date.getDay()];
  const day = date.getDate();
  const monthName = romanianMonths[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName}, ${day} ${monthName} ${year}`;
}

/**
 * Props for the AgendaGroup component
 */
export interface AgendaGroupProps {
  /** Date key in YYYY-MM-DD format */
  dateKey: string;
  /** Array of agenda items for this date */
  items: Omit<AgendaItemProps, 'onClick'>[];
  /** Whether the group should be expanded by default */
  defaultExpanded?: boolean;
  /** Callback when an item is clicked */
  onItemClick: (id: string, type: 'event' | 'task') => void;
}

/**
 * AgendaGroup - A collapsible group of agenda items for a specific date
 *
 * Displays a date header with Romanian formatting and a list of agenda items.
 * The group can be expanded/collapsed to show/hide the items.
 *
 * @example
 * ```tsx
 * <AgendaGroup
 *   dateKey="2026-01-02"
 *   items={[
 *     { id: '1', title: 'Meeting', type: 'event', eventType: 'meeting', startTime: '09:00' },
 *     { id: '2', title: 'Review docs', type: 'task' },
 *   ]}
 *   defaultExpanded={true}
 *   onItemClick={(id, type) => console.log(`Clicked ${type} ${id}`)}
 * />
 * ```
 */
const AgendaGroup = React.forwardRef<HTMLDivElement, AgendaGroupProps>(
  ({ dateKey, items, defaultExpanded = false, onItemClick }, ref) => {
    const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

    const toggleExpanded = React.useCallback(() => {
      setIsExpanded((prev) => !prev);
    }, []);

    // Parse dateKey to Date for formatting
    const date = React.useMemo(() => {
      const [year, month, day] = dateKey.split('-').map(Number);
      return new Date(year, month - 1, day);
    }, [dateKey]);

    const formattedDate = formatRomanianDate(date);

    return (
      <div ref={ref} className="border-b border-linear-border-subtle">
        {/* Header - sticky */}
        <button
          type="button"
          onClick={toggleExpanded}
          className={cn(
            'w-full sticky top-0 z-10',
            'flex items-center justify-between gap-2',
            'px-4 py-3',
            'bg-linear-bg-secondary',
            'border-b border-linear-border-subtle',
            'hover:bg-linear-bg-tertiary',
            'transition-colors'
          )}
          aria-expanded={isExpanded}
          aria-controls={`agenda-group-${dateKey}`}
        >
          <div className="flex items-center gap-2">
            <ChevronRight
              className={cn(
                'w-4 h-4 text-linear-text-secondary transition-transform',
                isExpanded && 'rotate-90'
              )}
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-linear-text-primary">{formattedDate}</span>
          </div>
          <span className="text-xs text-linear-text-tertiary bg-linear-bg-tertiary px-2 py-0.5 rounded-full">
            {items.length}
          </span>
        </button>

        {/* Collapsible content */}
        {isExpanded && (
          <div id={`agenda-group-${dateKey}`} role="region">
            {items.map((item) => (
              <AgendaItem key={item.id} {...item} onClick={() => onItemClick(item.id, item.type)} />
            ))}
          </div>
        )}
      </div>
    );
  }
);

AgendaGroup.displayName = 'AgendaGroup';

export { AgendaGroup };
