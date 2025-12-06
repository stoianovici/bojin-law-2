'use client';

/**
 * Team Calendar View Component
 * Story 4.5: Team Workload Management
 *
 * AC: 1 - Team calendar showing all members' tasks and availability
 */

import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  UserX,
  AlertTriangle,
} from 'lucide-react';
import type {
  TeamCalendarView as TeamCalendarViewType,
  TeamMemberCalendar,
  TeamCalendarEntry,
  AvailabilityType,
} from '@legal-platform/types';

interface TeamCalendarViewProps {
  data: TeamCalendarViewType;
  onDateChange: (start: Date, end: Date) => void;
  onTaskClick?: (taskId: string) => void;
  onUserClick?: (userId: string) => void;
  isLoading?: boolean;
}

const AVAILABILITY_COLORS: Record<AvailabilityType, string> = {
  OutOfOffice: 'bg-red-100 text-red-800',
  Vacation: 'bg-blue-100 text-blue-800',
  SickLeave: 'bg-yellow-100 text-yellow-800',
  ReducedHours: 'bg-orange-100 text-orange-800',
  Training: 'bg-purple-100 text-purple-800',
};

const AVAILABILITY_LABELS: Record<AvailabilityType, string> = {
  OutOfOffice: 'OOO',
  Vacation: 'Vacation',
  SickLeave: 'Sick',
  ReducedHours: 'Reduced',
  Training: 'Training',
};

function getUtilizationColor(percent: number): string {
  if (percent > 100) return 'text-red-600';
  if (percent > 80) return 'text-orange-600';
  if (percent > 50) return 'text-green-600';
  return 'text-gray-500';
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ro-RO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(date));
}

export function TeamCalendarView({
  data,
  onDateChange,
  onTaskClick,
  onUserClick,
  isLoading = false,
}: TeamCalendarViewProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.setDate(diff));
  });

  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [currentWeekStart]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newStart);

    const newEnd = new Date(newStart);
    newEnd.setDate(newEnd.getDate() + 6);
    onDateChange(newStart, newEnd);
  };

  const goToToday = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(now.setDate(diff));
    setCurrentWeekStart(start);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    onDateChange(start, end);
  };

  const getEntryForDate = (member: TeamMemberCalendar, date: Date): TeamCalendarEntry | undefined => {
    return member.entries.find(
      (e: Date) => new Date(e.date).toDateString() === date.toDateString()
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Team Calendar</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateWeek('prev')}
            className="p-1 rounded hover:bg-gray-100"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
          >
            Today
          </button>
          <button
            onClick={() => navigateWeek('next')}
            className="p-1 rounded hover:bg-gray-100"
            aria-label="Next week"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b">
              <th className="text-left px-4 py-2 text-sm font-medium text-gray-500 w-48">
                Team Member
              </th>
              {weekDates.map((date) => (
                <th
                  key={date.toISOString()}
                  className={`text-center px-2 py-2 text-sm font-medium ${
                    date.toDateString() === new Date().toDateString()
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-500'
                  }`}
                >
                  {formatDate(date)}
                </th>
              ))}
              <th className="text-right px-4 py-2 text-sm font-medium text-gray-500 w-24">
                Week Total
              </th>
            </tr>
          </thead>
          <tbody>
            {data.members.map((member: typeof teamMembers[number]) => (
              <tr key={member.userId} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <button
                    onClick={() => onUserClick?.(member.userId)}
                    className="flex items-center gap-2 text-left hover:text-blue-600"
                  >
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                      {member.user.firstName[0]}
                      {member.user.lastName[0]}
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {member.user.firstName} {member.user.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{member.user.role}</div>
                    </div>
                  </button>
                </td>
                {weekDates.map((date) => {
                  const entry = getEntryForDate(member, date);
                  return (
                    <td
                      key={date.toISOString()}
                      className={`px-2 py-2 text-center ${
                        date.toDateString() === new Date().toDateString()
                          ? 'bg-blue-50'
                          : ''
                      }`}
                    >
                      {entry ? (
                        <div className="space-y-1">
                          {/* Availability Badge */}
                          {entry.availability && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                                AVAILABILITY_COLORS[entry.availability.availabilityType]
                              }`}
                            >
                              <UserX className="h-3 w-3" />
                              {AVAILABILITY_LABELS[entry.availability.availabilityType]}
                            </span>
                          )}
                          {/* Task Count & Hours */}
                          {!entry.availability ||
                          entry.availability.availabilityType === 'ReducedHours' ||
                          entry.availability.availabilityType === 'Training' ? (
                            <div
                              className={`text-sm ${getUtilizationColor(
                                entry.utilizationPercent
                              )}`}
                            >
                              {entry.tasks.length > 0 ? (
                                <>
                                  <div className="font-medium">
                                    {entry.tasks.length} task{entry.tasks.length !== 1 ? 's' : ''}
                                  </div>
                                  <div className="text-xs flex items-center justify-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {entry.totalAllocatedHours.toFixed(1)}h
                                    {entry.utilizationPercent > 100 && (
                                      <AlertTriangle className="h-3 w-3 text-red-500" />
                                    )}
                                  </div>
                                </>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right">
                  <div className="text-sm font-medium">
                    {member.weeklyTotal.toFixed(1)}h
                  </div>
                  <div className="text-xs text-gray-500">
                    / {member.weeklyCapacity.toFixed(0)}h
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t bg-gray-50 flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="font-medium">Legend:</span>
        {Object.entries(AVAILABILITY_LABELS).map(([type, label]) => (
          <span
            key={type}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
              AVAILABILITY_COLORS[type as AvailabilityType]
            }`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
