'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  Briefcase,
} from 'lucide-react';
import { LargeHeader } from '@/components/layout';
import { Card, Badge, Skeleton, BottomSheet, BottomSheetContent, Button } from '@/components/ui';
import { useCalendar, type CalendarEvent, type CalendarDay } from '@/hooks/useCalendar';
import { clsx } from 'clsx';

// ============================================
// Page Component
// ============================================

export default function CalendarPage() {
  const router = useRouter();
  const {
    monthName,
    weekDays,
    calendarDays,
    selectedDate,
    setSelectedDate,
    selectedDateEvents,
    loading,
    goToNextMonth,
    goToPreviousMonth,
    goToToday,
  } = useCalendar();

  const [showEvents, setShowEvents] = useState(false);

  const handleDayClick = (day: CalendarDay) => {
    setSelectedDate(day.date);
    if (day.events.length > 0) {
      setShowEvents(true);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="px-6 pt-safe-top pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-text-primary capitalize">{monthName}</h1>
          <Link href="/calendar/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              Eveniment
            </Button>
          </Link>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-bg-elevated"
          >
            <ChevronLeft className="w-5 h-5 text-text-primary" />
          </button>
          <button
            onClick={goToToday}
            className="px-4 h-10 flex items-center justify-center rounded-lg bg-bg-elevated text-sm font-medium text-text-primary"
          >
            Azi
          </button>
          <button
            onClick={goToNextMonth}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-bg-elevated"
          >
            <ChevronRight className="w-5 h-5 text-text-primary" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="px-6 py-2">
        <Card padding="md">
          {/* Week Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day, i) => (
              <div
                key={i}
                className="h-8 flex items-center justify-center text-xs font-medium text-text-tertiary"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          {loading ? (
            <CalendarSkeleton />
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, i) => (
                <CalendarDayCell
                  key={i}
                  day={day}
                  isSelected={
                    selectedDate !== null &&
                    format(day.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
                  }
                  onClick={() => handleDayClick(day)}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Selected Date Events Preview */}
      {selectedDate && selectedDateEvents.length > 0 && !showEvents && (
        <div className="px-6 py-2">
          <button onClick={() => setShowEvents(true)} className="w-full">
            <Card interactive padding="md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {format(selectedDate, 'd MMMM', { locale: ro })}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {selectedDateEvents.length} eveniment
                    {selectedDateEvents.length !== 1 ? 'e' : ''}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-text-tertiary" />
              </div>
            </Card>
          </button>
        </div>
      )}

      {/* Upcoming Events */}
      <div className="px-6 py-4">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Evenimente viitoare</h2>
        <UpcomingEventsList events={calendarDays} />
      </div>

      {/* Events Bottom Sheet */}
      <BottomSheet
        open={showEvents}
        onClose={() => setShowEvents(false)}
        title={selectedDate ? format(selectedDate, 'd MMMM yyyy', { locale: ro }) : 'Evenimente'}
      >
        <BottomSheetContent>
          <div className="space-y-2">
            {selectedDateEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onClick={() => {
                  setShowEvents(false);
                  router.push(`/tasks/${event.id}`);
                }}
              />
            ))}
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}

// ============================================
// Calendar Day Cell
// ============================================

interface CalendarDayCellProps {
  day: CalendarDay;
  isSelected: boolean;
  onClick: () => void;
}

function CalendarDayCell({ day, isSelected, onClick }: CalendarDayCellProps) {
  const hasEvents = day.events.length > 0;
  const hasUrgent = day.events.some((e) => e.priority === 'Urgent');

  return (
    <button
      onClick={onClick}
      className={clsx(
        'aspect-square flex flex-col items-center justify-center rounded-lg transition-colors relative',
        !day.isCurrentMonth && 'opacity-30',
        isSelected && 'bg-accent',
        !isSelected && day.isToday && 'bg-accent-muted',
        !isSelected && !day.isToday && 'hover:bg-bg-hover'
      )}
    >
      <span
        className={clsx(
          'text-sm font-medium',
          isSelected ? 'text-white' : day.isToday ? 'text-accent' : 'text-text-primary'
        )}
      >
        {format(day.date, 'd')}
      </span>

      {/* Event indicators */}
      {hasEvents && (
        <div className="flex gap-0.5 mt-0.5">
          {day.events.slice(0, 3).map((_, i) => (
            <div
              key={i}
              className={clsx(
                'w-1 h-1 rounded-full',
                isSelected ? 'bg-white/80' : hasUrgent ? 'bg-error' : 'bg-accent'
              )}
            />
          ))}
        </div>
      )}
    </button>
  );
}

// ============================================
// Event Card
// ============================================

interface EventCardProps {
  event: CalendarEvent;
  onClick: () => void;
}

function EventCard({ event, onClick }: EventCardProps) {
  const priorityVariants: Record<string, 'default' | 'warning' | 'error'> = {
    Low: 'default',
    Normal: 'default',
    High: 'warning',
    Urgent: 'error',
  };

  const eventTime = event.scheduledStartTime || event.dueTime;

  return (
    <Card interactive padding="md" onClick={onClick}>
      <div className="flex items-start gap-3">
        <div
          className={clsx(
            'w-1 h-full rounded-full self-stretch',
            event.priority === 'Urgent'
              ? 'bg-error'
              : event.priority === 'High'
                ? 'bg-warning'
                : 'bg-accent'
          )}
        />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary">{event.title}</p>

          <div className="flex items-center gap-2 mt-1 text-xs text-text-tertiary">
            {eventTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {eventTime.slice(0, 5)}
              </span>
            )}
            {event.case && (
              <span className="flex items-center gap-1">
                <Briefcase className="w-3 h-3" />
                {event.case.caseNumber}
              </span>
            )}
          </div>
        </div>

        <Badge variant={priorityVariants[event.priority] || 'default'} size="sm">
          {event.type}
        </Badge>
      </div>
    </Card>
  );
}

// ============================================
// Upcoming Events List
// ============================================

interface UpcomingEventsListProps {
  events: CalendarDay[];
}

function UpcomingEventsList({ events }: UpcomingEventsListProps) {
  const router = useRouter();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get upcoming events (today and future)
  const upcomingDays = events
    .filter((day) => day.date >= today && day.events.length > 0)
    .slice(0, 5);

  if (upcomingDays.length === 0) {
    return (
      <div className="text-center py-8">
        <CalendarIcon className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
        <p className="text-sm text-text-secondary">Niciun eveniment în perioada următoare</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {upcomingDays.map((day) => (
        <div key={format(day.date, 'yyyy-MM-dd')}>
          <p className="text-xs font-medium text-text-tertiary mb-2">
            {day.isToday ? 'Azi' : format(day.date, 'EEEE, d MMMM', { locale: ro })}
          </p>
          <div className="space-y-2">
            {day.events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onClick={() => router.push(`/tasks/${event.id}`)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Calendar Skeleton
// ============================================

function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-1">
      {Array.from({ length: 35 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-lg" />
      ))}
    </div>
  );
}
