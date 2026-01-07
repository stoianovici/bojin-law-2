'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { CalendarEventType, CalendarFilters } from './types';
import { eventColors, eventTypeLabels } from './types';

// ====================================================================
// CalendarSidebar - Filters for event types and team members
// ====================================================================

interface TeamMember {
  id: string;
  name: string;
  initials: string;
  color: string;
}

interface CalendarSidebarProps {
  filters: CalendarFilters;
  onFiltersChange: (filters: CalendarFilters) => void;
  eventTypeCounts?: Record<CalendarEventType, number>;
  teamMembers?: TeamMember[];
  className?: string;
}

const defaultEventTypes: CalendarEventType[] = [
  'court',
  'hearing',
  'deadline',
  'meeting',
  'task',
  'reminder',
];

export function CalendarSidebar({
  filters,
  onFiltersChange,
  eventTypeCounts = {} as Record<CalendarEventType, number>,
  teamMembers = [],
  className,
}: CalendarSidebarProps) {
  const toggleEventType = (type: CalendarEventType) => {
    const isActive = filters.eventTypes.includes(type);
    const newTypes = isActive
      ? filters.eventTypes.filter((t) => t !== type)
      : [...filters.eventTypes, type];
    onFiltersChange({ ...filters, eventTypes: newTypes });
  };

  const toggleTeamMember = (memberId: string) => {
    const isActive = filters.teamMembers.includes(memberId);
    const newMembers = isActive
      ? filters.teamMembers.filter((m) => m !== memberId)
      : [...filters.teamMembers, memberId];
    onFiltersChange({ ...filters, teamMembers: newMembers });
  };

  return (
    <aside
      className={cn(
        'w-[260px] flex-shrink-0 border-r border-linear-border-subtle bg-linear-bg-secondary',
        'flex flex-col overflow-y-auto',
        className
      )}
    >
      {/* Calendar Types Section */}
      <div className="border-b border-linear-border-subtle p-4">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-linear-text-muted">
          Calendare
        </h3>
        <div className="flex flex-col gap-1">
          {defaultEventTypes.map((type) => {
            const isActive = filters.eventTypes.length === 0 || filters.eventTypes.includes(type);
            const colors = eventColors[type];
            const count = eventTypeCounts[type] ?? 0;

            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleEventType(type)}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
                  'hover:bg-linear-bg-hover',
                  !isActive && 'opacity-50'
                )}
              >
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: colors.border }}
                />
                <span className="flex-1 text-[13px] text-linear-text-secondary">
                  {eventTypeLabels[type]}
                </span>
                {count > 0 && (
                  <span className="rounded-full bg-linear-bg-tertiary px-1.5 py-0.5 text-[11px] text-linear-text-muted">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Team Filter Section */}
      {teamMembers.length > 0 && (
        <div className="p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-linear-text-muted">
            Echipă
          </h3>
          <div className="flex flex-col gap-1">
            {teamMembers.map((member) => {
              const isActive =
                filters.teamMembers.length === 0 || filters.teamMembers.includes(member.id);

              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleTeamMember(member.id)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
                    'hover:bg-linear-bg-hover',
                    !isActive && 'opacity-50'
                  )}
                >
                  {/* Checkbox */}
                  <span
                    className={cn(
                      'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded',
                      'border-[1.5px] transition-all',
                      isActive
                        ? 'border-linear-accent bg-linear-accent'
                        : 'border-linear-border-default'
                    )}
                  >
                    {isActive && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>

                  {/* Avatar */}
                  <span
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                    style={{ background: member.color }}
                  >
                    {member.initials}
                  </span>

                  {/* Name */}
                  <span className="flex-1 text-[13px] text-linear-text-secondary">
                    {member.name}
                  </span>

                  {/* Color indicator */}
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: member.color }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
