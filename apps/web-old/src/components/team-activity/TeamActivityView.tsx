'use client';

/**
 * TeamActivityView Component
 * OPS-272: Main view mode component for team activity
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
      <Loader2 className="h-8 w-8 text-amber-500 animate-spin mb-4" />
      <p className="text-sm text-gray-500">Se încarcă activitatea echipei...</p>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 bg-gray-100 rounded-full mb-4">
        <Users className="h-8 w-8 text-gray-400" />
      </div>
      <h2 className="text-lg font-medium text-gray-900 mb-2">
        Nicio activitate în această perioadă
      </h2>
      <p className="text-sm text-gray-500 max-w-md">
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
        <div className="text-red-500 mb-2">Eroare la încărcarea datelor</div>
        <p className="text-sm text-gray-500">{error.message}</p>
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
      <div className="flex items-center justify-between pb-2 border-b border-gray-200">
        <h2 className="text-sm font-medium text-gray-700">Activitate echipă</h2>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">
            Total: <span className="font-medium text-gray-900">{totalTasks} sarcini</span>
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">
            <span className="font-medium text-gray-900">{formatHours(totalHours)}</span>
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
