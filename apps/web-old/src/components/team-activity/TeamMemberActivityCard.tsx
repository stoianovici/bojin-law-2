'use client';

/**
 * TeamMemberActivityCard Component
 * OPS-272: Collapsible card showing team member's activity
 *
 * Features:
 * - Avatar + name header
 * - Task count + total hours badge
 * - Expandable task list
 */

import { useState, useCallback, useMemo } from 'react';
import { ChevronDown, User } from 'lucide-react';
import { clsx } from 'clsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ActivityTaskItem } from './ActivityTaskItem';
import type { ActivityEntry, ActivityUser } from '../../hooks/useTeamActivity';

// ============================================================================
// Types
// ============================================================================

export interface TeamMemberActivityCardProps {
  user: ActivityUser;
  entries: ActivityEntry[];
  defaultOpen?: boolean;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatHours(hours: number): string {
  if (hours === 0) return '0 ore';
  if (hours === 1) return '1 oră';
  return `${hours.toFixed(1)} ore`;
}

function getUserDisplayName(user: ActivityUser): string {
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name || user.email;
}

function getUserInitials(user: ActivityUser): string {
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}

// ============================================================================
// Component
// ============================================================================

export function TeamMemberActivityCard({
  user,
  entries,
  defaultOpen = true,
  className,
}: TeamMemberActivityCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  // Calculate totals
  const stats = useMemo(() => {
    const totalTasks = entries.length;
    const totalHours = entries.reduce((sum, entry) => sum + entry.hoursLogged, 0);
    return { totalTasks, totalHours };
  }, [entries]);

  const displayName = getUserDisplayName(user);
  const initials = getUserInitials(user);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={handleOpenChange}
      className={clsx('rounded-lg border border-gray-200 bg-white overflow-hidden', className)}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={clsx(
            'w-full flex items-center gap-3 px-4 py-3',
            'text-left transition-colors',
            'hover:bg-gray-50',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-inset'
          )}
        >
          {/* Avatar */}
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
            <span className="text-sm font-medium text-amber-700">{initials}</span>
          </div>

          {/* Name and role */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-500">{user.role}</p>
          </div>

          {/* Stats badges */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {stats.totalTasks} {stats.totalTasks === 1 ? 'sarcină' : 'sarcini'}
            </span>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              {formatHours(stats.totalHours)}
            </span>
          </div>

          {/* Chevron */}
          <ChevronDown
            className={clsx(
              'h-5 w-5 text-gray-400 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t border-gray-100">
          {entries.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <User className="h-8 w-8 text-gray-300 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm text-gray-500">Nicio activitate înregistrată</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <ActivityTaskItem key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

TeamMemberActivityCard.displayName = 'TeamMemberActivityCard';

export default TeamMemberActivityCard;
