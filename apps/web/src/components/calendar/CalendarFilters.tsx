'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Static data for calendars
const CALENDARS = [
  { id: 'court', label: 'Termene Instanta', color: '#EF4444', count: 4 },
  { id: 'hearing', label: 'Audieri', color: '#EC4899', count: 2 },
  { id: 'deadline', label: 'Termene Legale', color: '#F59E0B', count: 3 },
  { id: 'meeting', label: 'Intalniri', color: '#3B82F6', count: 5 },
  { id: 'task', label: 'Sarcini', color: '#8B5CF6', count: 8 },
  { id: 'reminder', label: 'Mementouri', color: '#22C55E', count: 3 },
] as const;

// Static data for team members
const TEAM_MEMBERS = [
  { id: 'ab', initials: 'AB', name: 'Alexandru Bojin', gradient: 'from-[#5E6AD2] to-[#8B5CF6]' },
  { id: 'mp', initials: 'MP', name: 'Maria Popescu', gradient: 'from-[#EC4899] to-[#F472B6]' },
  { id: 'ed', initials: 'ED', name: 'Elena Dumitrescu', gradient: 'from-[#22C55E] to-[#4ADE80]' },
  { id: 'ai', initials: 'AI', name: 'Andrei Ionescu', gradient: 'from-[#F59E0B] to-[#FBBF24]' },
  { id: 'cv', initials: 'CV', name: 'Cristina Vasile', gradient: 'from-[#3B82F6] to-[#60A5FA]' },
] as const;

export type CalendarType = (typeof CALENDARS)[number]['id'];
export type TeamMemberId = (typeof TEAM_MEMBERS)[number]['id'];

export interface CalendarFiltersProps {
  selectedCalendars: string[];
  selectedTeamMembers: string[];
  onCalendarToggle: (calendarId: string) => void;
  onTeamToggle: (memberId: string) => void;
}

interface FilterCheckboxProps {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}

function FilterCheckbox({ checked, onChange, children }: FilterCheckboxProps) {
  return (
    <div
      className="flex items-center gap-3 px-1 py-2 rounded-sm cursor-pointer transition-colors duration-150 hover:bg-linear-bg-hover"
      onClick={onChange}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onChange();
        }
      }}
    >
      <div
        className={cn(
          'w-4 h-4 border-2 rounded flex items-center justify-center flex-shrink-0 transition-all duration-150',
          checked
            ? 'bg-[#60A5FA] border-[#60A5FA] dark:bg-linear-accent dark:border-linear-accent'
            : 'border-[rgba(0,0,0,0.15)] dark:border-linear-border-default'
        )}
      >
        {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
      </div>
      {children}
    </div>
  );
}

export function CalendarFilters({
  selectedCalendars,
  selectedTeamMembers,
  onCalendarToggle,
  onTeamToggle,
}: CalendarFiltersProps) {
  return (
    <div className="flex flex-col">
      {/* Calendars Section */}
      <div className="p-4 border-b border-linear-border-subtle">
        <h3 className="text-xs font-normal text-linear-text-tertiary uppercase tracking-[0.5px] mb-3">
          Calendare
        </h3>
        <div className="space-y-0.5">
          {CALENDARS.map((calendar) => {
            const isSelected = selectedCalendars.includes(calendar.id);
            return (
              <FilterCheckbox
                key={calendar.id}
                checked={isSelected}
                onChange={() => onCalendarToggle(calendar.id)}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: calendar.color }}
                />
                <span className="text-sm text-linear-text-secondary flex-1">{calendar.label}</span>
                <span className="text-xs text-linear-text-muted bg-linear-bg-tertiary px-1.5 py-0.5 rounded-sm">
                  {calendar.count}
                </span>
              </FilterCheckbox>
            );
          })}
        </div>
      </div>

      {/* Team Section */}
      <div className="p-4">
        <h3 className="text-xs font-normal text-linear-text-tertiary uppercase tracking-[0.5px] mb-3">
          Echipa
        </h3>
        <div className="space-y-0.5">
          {TEAM_MEMBERS.map((member) => {
            const isSelected = selectedTeamMembers.includes(member.id);
            return (
              <FilterCheckbox
                key={member.id}
                checked={isSelected}
                onChange={() => onTeamToggle(member.id)}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white flex-shrink-0 bg-gradient-to-br',
                    member.gradient
                  )}
                >
                  {member.initials}
                </div>
                <span className="text-sm text-linear-text-secondary flex-1">{member.name}</span>
              </FilterCheckbox>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { CALENDARS, TEAM_MEMBERS };
