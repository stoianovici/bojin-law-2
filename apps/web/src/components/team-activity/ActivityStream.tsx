'use client';

/**
 * ActivityStream Component
 * Collapsible recent activity feed at the bottom of the team activity page
 *
 * Features:
 * - Collapsible via Radix UI Collapsible
 * - Groups activity by time period (Today, Yesterday, This Week, Earlier)
 * - Compact rows with small avatar + description + relative time
 * - Default state: collapsed
 */

import { useState, useMemo } from 'react';
import { ChevronDown, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useTeamActivity, getMonthRange, type ActivityEntry } from '@/hooks/useTeamActivity';
import { useTimePeriodGroups, type TimePeriod } from '@/hooks/useTimePeriodGroups';

// ============================================================================
// Types
// ============================================================================

export interface ActivityStreamProps {
  className?: string;
  defaultOpen?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function getUserInitials(firstName: string, lastName: string, email: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function getUserDisplayName(firstName: string, lastName: string, email: string): string {
  const name = `${firstName || ''} ${lastName || ''}`.trim();
  return name || email;
}

function formatActivityDescription(entry: ActivityEntry): string {
  const userName = getUserDisplayName(entry.user.firstName, entry.user.lastName, entry.user.email);
  const taskTitle = entry.task.title;

  // Build context (case or client)
  let context = '';
  if (entry.task.case) {
    context = ` pe ${entry.task.case.referenceNumbers?.[0] || entry.task.case.title}`;
  } else if (entry.task.client) {
    context = ` pentru ${entry.task.client.name}`;
  }

  return `${userName} a finalizat "${taskTitle}"${context}`;
}

function formatRelativeTime(dateString: string): string {
  return formatDistanceToNow(new Date(dateString), {
    addSuffix: true,
    locale: ro,
  });
}

// ============================================================================
// Activity Row Component
// ============================================================================

interface ActivityRowProps {
  entry: ActivityEntry;
}

function ActivityRow({ entry }: ActivityRowProps) {
  const initials = getUserInitials(entry.user.firstName, entry.user.lastName, entry.user.email);

  return (
    <div className="flex items-center gap-3 py-2 px-1">
      {/* Small avatar (24x24) */}
      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-linear-accent/20 flex items-center justify-center">
        <span className="text-[10px] font-medium text-linear-accent">{initials}</span>
      </div>

      {/* Description */}
      <p className="flex-1 text-sm text-linear-text-secondary truncate">
        {formatActivityDescription(entry)}
      </p>

      {/* Relative time */}
      <span className="flex-shrink-0 text-xs text-linear-text-muted">
        {formatRelativeTime(entry.completedAt)}
      </span>
    </div>
  );
}

// ============================================================================
// Period Group Component
// ============================================================================

interface PeriodGroupProps {
  period: TimePeriod<ActivityEntry>;
}

function PeriodGroup({ period }: PeriodGroupProps) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-linear-text-muted uppercase tracking-wide px-1 py-1">
        {period.label}
      </h4>
      <div className="divide-y divide-linear-border-subtle">
        {period.items.map((entry) => (
          <ActivityRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ActivityStream({ className, defaultOpen = false }: ActivityStreamProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Use current month as default range for recent activity
  const dateRange = useMemo(() => getMonthRange(), []);

  // Fetch team activity data
  const { entries, loading } = useTeamActivity({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  // Sort entries by date descending (most recent first) and limit to recent activity
  const recentEntries = useMemo(() => {
    return [...entries]
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, 50); // Limit to 50 most recent entries
  }, [entries]);

  // Group entries by time period
  const periods = useTimePeriodGroups(recentEntries, (entry) => entry.completedAt);

  const hasActivity = recentEntries.length > 0;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={clsx(
        'border-t border-linear-border-subtle',
        'bg-linear-bg-secondary rounded-lg',
        className
      )}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={clsx(
            'w-full flex items-center justify-between p-4',
            'text-left transition-colors',
            'hover:bg-linear-bg-tertiary/50',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent focus-visible:ring-inset',
            'rounded-lg'
          )}
        >
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-linear-text-muted" aria-hidden="true" />
            <h3 className="text-sm font-medium text-linear-text-primary">Activitate recentă</h3>
            {hasActivity && (
              <span className="text-xs text-linear-text-muted">
                ({recentEntries.length} {recentEntries.length === 1 ? 'intrare' : 'intrări'})
              </span>
            )}
          </div>

          <ChevronDown
            className={clsx(
              'h-5 w-5 text-linear-text-muted transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-4 pb-4">
          {loading && recentEntries.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-linear-text-muted">Se încarcă activitatea...</p>
            </div>
          ) : !hasActivity ? (
            <div className="py-6 text-center">
              <Activity
                className="h-8 w-8 text-linear-text-muted mx-auto mb-2"
                aria-hidden="true"
              />
              <p className="text-sm text-linear-text-muted">
                Nicio activitate înregistrată în această perioadă
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {periods.map((period) => (
                <PeriodGroup key={period.key} period={period} />
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

ActivityStream.displayName = 'ActivityStream';

export default ActivityStream;
