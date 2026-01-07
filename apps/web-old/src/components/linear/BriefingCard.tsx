'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { BriefingStat, BriefingStatsRow } from './MetricCard';

// ====================================================================
// BriefingCard - Morning briefing card with accent gradient border
// ====================================================================

export interface BriefingCardStat {
  value: string | number;
  label: string;
}

export interface BriefingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Greeting text (e.g., "Bună dimineața, Maria!") */
  greeting: string;
  /** Summary text describing the day ahead */
  summary?: string;
  /** Array of stats to display in the bottom row */
  stats?: BriefingCardStat[];
}

/**
 * BriefingCard renders a special card for the morning briefing with:
 * - Accent gradient top border
 * - Greeting text (large)
 * - Summary text
 * - Stats row (tasks, hearings, deadlines, etc.)
 */
export function BriefingCard({
  className,
  greeting,
  summary,
  stats,
  children,
  ...props
}: BriefingCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-linear-border-subtle bg-linear-bg-secondary p-5',
        className
      )}
      {...props}
    >
      {/* Accent gradient top border */}
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: 'linear-gradient(90deg, var(--linear-accent) 0%, #8B5CF6 50%, #EC4899 100%)',
          opacity: 0.7,
        }}
      />

      {/* Greeting */}
      <h2 className="text-lg font-semibold text-linear-text-primary">{greeting}</h2>

      {/* Summary */}
      {summary && <p className="mt-2 text-sm text-linear-text-secondary">{summary}</p>}

      {/* Custom children (for additional content) */}
      {children}

      {/* Stats row */}
      {stats && stats.length > 0 && (
        <BriefingStatsRow>
          {stats.map((stat, index) => (
            <BriefingStat key={index} value={stat.value} label={stat.label} />
          ))}
        </BriefingStatsRow>
      )}
    </div>
  );
}
