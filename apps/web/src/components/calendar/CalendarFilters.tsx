'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeamMembers } from '@/hooks/mobile/useTeamMembers';
import { useCalendarStore } from '@/store/calendarStore';

// Static data for calendars
const CALENDARS = [
  { id: 'court', label: 'Termene Instanta', color: '#EF4444', count: 4 },
  { id: 'hearing', label: 'Audieri', color: '#EC4899', count: 2 },
  { id: 'deadline', label: 'Termene Legale', color: '#F59E0B', count: 3 },
  { id: 'meeting', label: 'Intalniri', color: '#3B82F6', count: 5 },
  { id: 'task', label: 'Sarcini', color: '#8B5CF6', count: 8 },
  { id: 'reminder', label: 'Mementouri', color: '#22C55E', count: 3 },
] as const;

// Gradient colors for team members (assigned based on index)
const TEAM_GRADIENTS = [
  'from-[#5E6AD2] to-[#8B5CF6]',
  'from-[#EC4899] to-[#F472B6]',
  'from-[#22C55E] to-[#4ADE80]',
  'from-[#F59E0B] to-[#FBBF24]',
  'from-[#3B82F6] to-[#60A5FA]',
  'from-[#EF4444] to-[#F87171]',
  'from-[#8B5CF6] to-[#A78BFA]',
  'from-[#06B6D4] to-[#22D3EE]',
];

// Helper to get initials from name
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// Helper to get consistent gradient based on user ID
function getGradient(userId: string, index: number): string {
  // Use a simple hash of the user ID for consistent color assignment
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return (
    TEAM_GRADIENTS[hash % TEAM_GRADIENTS.length] || TEAM_GRADIENTS[index % TEAM_GRADIENTS.length]
  );
}

export type CalendarType = (typeof CALENDARS)[number]['id'];
export type TeamMemberId = string;

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
  const { members: teamMembers, loading: teamLoading } = useTeamMembers();
  const setTeamMembers = useCalendarStore((state) => state.setTeamMembers);
  const hasInitializedRef = React.useRef(false);

  // Auto-select all team members when they load for the first time
  React.useEffect(() => {
    if (!teamLoading && teamMembers.length > 0 && !hasInitializedRef.current) {
      // Only auto-select if no team members are currently selected
      // (avoids overriding user's manual selections from localStorage)
      if (selectedTeamMembers.length === 0) {
        setTeamMembers(teamMembers.map((m) => m.id));
      }
      hasInitializedRef.current = true;
    }
  }, [teamLoading, teamMembers, selectedTeamMembers.length, setTeamMembers]);

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
          {teamLoading ? (
            <div className="text-sm text-linear-text-tertiary py-2">Se încarcă...</div>
          ) : (
            teamMembers.map((member, index) => {
              const isSelected = selectedTeamMembers.includes(member.id);
              const initials = getInitials(member.firstName, member.lastName);
              const gradient = getGradient(member.id, index);
              const fullName = `${member.firstName} ${member.lastName}`;
              return (
                <FilterCheckbox
                  key={member.id}
                  checked={isSelected}
                  onChange={() => onTeamToggle(member.id)}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white flex-shrink-0 bg-gradient-to-br',
                      gradient
                    )}
                  >
                    {initials}
                  </div>
                  <span className="text-sm text-linear-text-secondary flex-1">{fullName}</span>
                </FilterCheckbox>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export { CALENDARS };
