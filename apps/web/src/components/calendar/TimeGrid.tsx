'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TimeGridProps {
  startHour?: number;
  endHour?: number;
  showCurrentTime?: boolean;
  currentDate?: Date;
}

/**
 * Formats an hour number as a time string (e.g., 8 -> "08:00")
 */
function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}

/**
 * Calculates the current time position as a percentage within the grid.
 * Returns a value between 0 and 100 representing the percentage from the top.
 * Returns null if the current time is outside the grid hours.
 */
export function getCurrentTimePosition(
  startHour: number,
  endHour: number,
  currentDate?: Date
): number | null {
  const now = currentDate ?? new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Calculate current time as a decimal hour (e.g., 9:30 = 9.5)
  const currentTimeDecimal = currentHour + currentMinute / 60;

  // Check if current time is within the grid range
  if (currentTimeDecimal < startHour || currentTimeDecimal > endHour) {
    return null;
  }

  // Calculate percentage position
  const totalHours = endHour - startHour;
  const hoursFromStart = currentTimeDecimal - startHour;
  const percentage = (hoursFromStart / totalHours) * 100;

  return percentage;
}

/**
 * TimeGrid displays the time column with hour labels and optional current time indicator.
 *
 * Features:
 * - Time column (60px width) with hour labels
 * - Hour slots with 60px height
 * - Half-hour divider line at 50% opacity
 * - Current time indicator (red line with dot) when showCurrentTime is true
 */
export function TimeGrid({
  startHour = 8,
  endHour = 18,
  showCurrentTime = true,
  currentDate,
}: TimeGridProps) {
  const [currentTimePosition, setCurrentTimePosition] = React.useState<number | null>(null);

  // Generate array of hours to display
  const hours = React.useMemo(() => {
    const result: number[] = [];
    for (let hour = startHour; hour < endHour; hour++) {
      result.push(hour);
    }
    return result;
  }, [startHour, endHour]);

  // Update current time position
  React.useEffect(() => {
    if (!showCurrentTime) {
      setCurrentTimePosition(null);
      return;
    }

    const updatePosition = () => {
      const position = getCurrentTimePosition(startHour, endHour, currentDate);
      setCurrentTimePosition(position);
    };

    // Initial update
    updatePosition();

    // Update every minute
    const interval = setInterval(updatePosition, 60000);

    return () => clearInterval(interval);
  }, [showCurrentTime, startHour, endHour, currentDate]);

  const hourHeight = 60; // Increased to fill available vertical space
  const totalHeight = hours.length * hourHeight;

  return (
    <div className="relative border-r border-linear-border-subtle">
      {/* Time slots */}
      {hours.map((hour) => (
        <div
          key={hour}
          className="relative border-b border-linear-border-subtle"
          style={{ height: `${hourHeight}px` }}
        >
          {/* Hour label */}
          <span
            className={cn(
              'absolute right-2 text-right text-linear-text-tertiary',
              'text-[11px] leading-none'
            )}
            style={{ top: '-8px' }}
          >
            {formatHour(hour)}
          </span>

          {/* Half-hour divider line */}
          <div
            className="absolute left-0 right-0 h-px bg-linear-border-subtle"
            style={{ top: '50%', opacity: 0.5 }}
          />
        </div>
      ))}

      {/* Current time indicator */}
      {showCurrentTime && currentTimePosition !== null && (
        <div
          className="absolute left-0 right-0 h-0.5 bg-linear-error z-10 pointer-events-none"
          style={{ top: `${(currentTimePosition / 100) * totalHeight}px` }}
        >
          {/* Red dot on left edge */}
          <div
            className="absolute bg-linear-error rounded-full"
            style={{
              width: '10px',
              height: '10px',
              left: '-4px',
              top: '-4px',
            }}
          />
        </div>
      )}
    </div>
  );
}
