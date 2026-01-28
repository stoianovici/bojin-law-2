'use client';

import { cn } from '@/lib/utils';
import { Clock, RefreshCw } from 'lucide-react';

interface RetainerUsageProps {
  periodStart: string;
  periodEnd: string;
  hoursUsed: number;
  hoursIncluded: number;
  rolledOver: number;
  remaining: number;
  utilizationPercent: number;
  className?: string;
}

// Format period for display
function formatPeriod(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

  // Same month
  if (
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getFullYear() === endDate.getFullYear()
  ) {
    return `${startDate.getDate()} - ${endDate.toLocaleDateString('ro-RO', options)}`;
  }

  return `${startDate.toLocaleDateString('ro-RO', options)} - ${endDate.toLocaleDateString('ro-RO', options)}`;
}

export function RetainerUsageCard({
  periodStart,
  periodEnd,
  hoursUsed,
  hoursIncluded,
  rolledOver,
  remaining,
  utilizationPercent,
  className,
}: RetainerUsageProps) {
  const totalAvailable = hoursIncluded + rolledOver;
  const isOverage = hoursUsed > totalAvailable;
  const overageHours = isOverage ? hoursUsed - totalAvailable : 0;

  // Determine status color
  let statusColor = 'bg-emerald-500';
  if (utilizationPercent >= 100) {
    statusColor = 'bg-red-500';
  } else if (utilizationPercent >= 80) {
    statusColor = 'bg-amber-500';
  } else if (utilizationPercent >= 60) {
    statusColor = 'bg-yellow-500';
  }

  return (
    <div
      className={cn(
        'bg-linear-bg-secondary border border-linear-border-subtle rounded-lg p-4',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-linear-text-tertiary" />
          <span className="text-xs font-medium text-linear-text-secondary uppercase tracking-wider">
            Abonament
          </span>
        </div>
        <span className="text-xs text-linear-text-tertiary">
          {formatPeriod(periodStart, periodEnd)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="h-2 bg-linear-bg-quaternary rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all', statusColor)}
            style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm">
        <div>
          <span className="font-medium text-linear-text-primary">{hoursUsed.toFixed(1)}h</span>
          <span className="text-linear-text-tertiary"> / {totalAvailable.toFixed(1)}h</span>
        </div>

        <div className="flex items-center gap-3">
          {rolledOver > 0 && (
            <div className="flex items-center gap-1 text-xs text-linear-text-tertiary">
              <RefreshCw className="w-3 h-3" />
              <span>+{rolledOver.toFixed(1)}h report</span>
            </div>
          )}

          {isOverage ? (
            <span className="text-xs font-medium text-red-400">
              +{overageHours.toFixed(1)}h depasire
            </span>
          ) : (
            <span className="text-xs text-linear-text-secondary">
              {remaining.toFixed(1)}h ramase
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default RetainerUsageCard;
