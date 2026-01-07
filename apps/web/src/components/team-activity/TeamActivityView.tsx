'use client';

/**
 * TeamActivityView Component
 * Main view mode component for team activity
 *
 * Features:
 * - Time-grouped activity (Astazi, Saptamana, Luna, etc.)
 * - Within each period, grouped by team member
 * - Summary stats per section
 * - Empty state handling
 */

import { useMemo } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { TimePeriodSection } from '../ui/TimePeriodSection';
import { TeamMemberActivityCard } from './TeamMemberActivityCard';
import {
  useTeamActivity,
  type ActivityEntry,
  type ActivityUser,
} from '../../hooks/useTeamActivity';
import { useTimePeriodGroups, type TimePeriod } from '../../hooks/useTimePeriodGroups';
import type { TimesheetFiltersValue } from './TimesheetFilters';

// ============================================================================
// Types
// ============================================================================

export interface TeamActivityViewProps {
  filters: TimesheetFiltersValue;
  className?: string;
}

interface UserGroup {
  user: ActivityUser;
  entries: ActivityEntry[];
}

// ============================================================================
// Helpers
// ============================================================================

function formatHours(hours: number): string {
  if (hours === 0) return '0 ore';
  if (hours === 1) return '1 oră';
  return `${hours.toFixed(1)} ore`;
}

/**
 * Group entries by user ID
 */
function groupEntriesByUser(entries: ActivityEntry[]): UserGroup[] {
  const userMap = new Map<string, UserGroup>();

  for (const entry of entries) {
    const userId = entry.user.id;
    if (!userMap.has(userId)) {
      userMap.set(userId, {
        user: entry.user,
        entries: [],
      });
    }
    userMap.get(userId)!.entries.push(entry);
  }

  // Sort by user name
  return Array.from(userMap.values()).sort((a, b) => {
    const nameA = `${a.user.firstName} ${a.user.lastName}`.toLowerCase();
    const nameB = `${b.user.firstName} ${b.user.lastName}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

/**
 * Calculate section stats
 */
function getSectionStats(entries: ActivityEntry[]): { tasks: number; hours: number } {
  return {
    tasks: entries.length,
    hours: entries.reduce((sum, entry) => sum + entry.hoursLogged, 0),
  };
}

// ============================================================================
// Loading State
// ============================================================================

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="h-8 w-8 text-linear-accent animate-spin mb-4" />
      <p className="text-sm text-linear-text-muted">Se încarcă activitatea echipei...</p>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 bg-linear-bg-tertiary rounded-full mb-4">
        <Users className="h-8 w-8 text-linear-text-muted" />
      </div>
      <h2 className="text-lg font-medium text-linear-text-primary mb-2">
        Nicio activitate în această perioadă
      </h2>
      <p className="text-sm text-linear-text-muted max-w-md">
        Nu există sarcini finalizate în perioada selectată. Încearcă să modifici filtrele sau să
        selectezi o altă perioadă.
      </p>
    </div>
  );
}

// ============================================================================
// Period Section Component
// ============================================================================

interface PeriodSectionProps {
  period: TimePeriod<ActivityEntry>;
  storageKeyPrefix: string;
}

function PeriodSection({ period, storageKeyPrefix }: PeriodSectionProps) {
  const userGroups = useMemo(() => groupEntriesByUser(period.items), [period.items]);
  const stats = useMemo(() => getSectionStats(period.items), [period.items]);

  return (
    <TimePeriodSection
      periodKey={period.key}
      label={`${period.label} · ${stats.tasks} ${stats.tasks === 1 ? 'sarcină' : 'sarcini'} · ${formatHours(stats.hours)}`}
      count={stats.tasks}
      defaultOpen={period.defaultOpen}
      storageKey={storageKeyPrefix}
    >
      <div className="space-y-3 pt-2">
        {userGroups.map((group) => (
          <TeamMemberActivityCard
            key={group.user.id}
            user={group.user}
            entries={group.entries}
            defaultOpen={userGroups.length <= 3}
          />
        ))}
      </div>
    </TimePeriodSection>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TeamActivityView({ filters, className }: TeamActivityViewProps) {
  // Fetch team activity data
  const { entries, totalTasks, totalHours, loading, error } = useTeamActivity({
    caseId: filters.caseId,
    teamMemberIds: filters.teamMemberIds,
    startDate: filters.startDate,
    endDate: filters.endDate,
  });

  // Group entries by time period
  const periods = useTimePeriodGroups(entries, (entry) => entry.completedAt);

  // Loading state
  if (loading && entries.length === 0) {
    return (
      <div className={className}>
        <LoadingState />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={clsx('p-6 text-center', className)}>
        <div className="text-linear-error mb-2">Eroare la încărcarea datelor</div>
        <p className="text-sm text-linear-text-muted">{error.message}</p>
      </div>
    );
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <div className={className}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Summary header */}
      <div className="flex items-center justify-between pb-2 border-b border-linear-border-subtle">
        <h2 className="text-sm font-medium text-linear-text-secondary">Activitate echipă</h2>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-linear-text-muted">
            Total: <span className="font-medium text-linear-text-primary">{totalTasks} sarcini</span>
          </span>
          <span className="text-linear-border">·</span>
          <span className="text-linear-text-muted">
            <span className="font-medium text-linear-text-primary">{formatHours(totalHours)}</span>
          </span>
        </div>
      </div>

      {/* Time-grouped sections */}
      <div className="space-y-4">
        {periods.map((period) => (
          <PeriodSection key={period.key} period={period} storageKeyPrefix="team-activity" />
        ))}
      </div>
    </div>
  );
}

TeamActivityView.displayName = 'TeamActivityView';

export default TeamActivityView;
