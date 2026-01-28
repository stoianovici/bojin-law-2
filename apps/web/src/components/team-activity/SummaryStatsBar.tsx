'use client';

/**
 * SummaryStatsBar Component
 * Displays 4 summary metrics in a horizontal bar for Team Activity Overview
 *
 * Metrics displayed:
 * - Active cases (Dosare active)
 * - Tasks in progress (În progres)
 * - Completed this week (Finalizate)
 * - Documents in draft (Docs ciornă)
 */

import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface SummaryStatsBarProps {
  activeCases: number;
  tasksInProgress: number;
  completedThisWeek: number;
  docsInDraft: number;
  loading?: boolean;
  className?: string;
}

interface StatCardProps {
  value: number;
  label: string;
  loading?: boolean;
}

// ============================================================================
// StatCard Component
// ============================================================================

function StatCard({ value, label, loading }: StatCardProps) {
  return (
    <div className="bg-linear-bg-secondary rounded-lg p-4">
      {loading ? (
        <>
          <div className="h-8 w-16 bg-linear-bg-tertiary rounded animate-pulse mb-1" />
          <div className="h-4 w-20 bg-linear-bg-tertiary rounded animate-pulse" />
        </>
      ) : (
        <>
          <div className="text-2xl font-semibold text-linear-text-primary">{value}</div>
          <div className="text-sm text-linear-text-secondary">{label}</div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function SummaryStatsBar({
  activeCases,
  tasksInProgress,
  completedThisWeek,
  docsInDraft,
  loading = false,
  className,
}: SummaryStatsBarProps) {
  return (
    <div className={clsx('grid grid-cols-4 gap-4', className)}>
      <StatCard value={activeCases} label="Dosare active" loading={loading} />
      <StatCard value={tasksInProgress} label="În progres" loading={loading} />
      <StatCard value={completedThisWeek} label="Finalizate" loading={loading} />
      <StatCard value={docsInDraft} label="Docs ciornă" loading={loading} />
    </div>
  );
}

SummaryStatsBar.displayName = 'SummaryStatsBar';

export default SummaryStatsBar;
