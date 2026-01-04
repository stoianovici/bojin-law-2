/**
 * Calendar Page
 * Full-featured calendar with week/month/day/agenda views
 * OPS-361: Linear-style calendar implementation
 */

'use client';

import * as React from 'react';
import { useEffect } from 'react';
import { PageLayout } from '@/components/linear/PageLayout';
import type {
  CalendarView,
  CalendarEvent,
  CalendarEventType,
  CalendarFilters,
} from '@/components/calendar';
import {
  CalendarHeader,
  CalendarSidebar,
  WeekView,
  MonthView,
  AgendaView,
  DayView,
  EventModal,
  EventDetailModal,
} from '@/components/calendar';
import { useIsMobile } from '@/hooks/useIsMobile';
import { addHours } from 'date-fns';

// ====================================================================
// Mock Data - Replace with real data fetching
// ====================================================================

const mockTeamMembers = [
  {
    id: '1',
    name: 'Alexandru Bojin',
    initials: 'AB',
    color: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  },
  {
    id: '2',
    name: 'Maria Popescu',
    initials: 'MP',
    color: 'linear-gradient(135deg, #ec4899, #f43f5e)',
  },
  {
    id: '3',
    name: 'Elena Dumitrescu',
    initials: 'ED',
    color: 'linear-gradient(135deg, #14b8a6, #22c55e)',
  },
  {
    id: '4',
    name: 'Andrei Ionescu',
    initials: 'AI',
    color: 'linear-gradient(135deg, #f97316, #fb923c)',
  },
];

// Generate some mock events for demo
function generateMockEvents(): CalendarEvent[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return [
    {
      id: '1',
      title: 'Ședință Tribunalul București',
      type: 'court',
      startTime: addHours(today, 9),
      endTime: addHours(today, 10.5),
      location: 'Sala 5, Secția Civilă',
      assigneeId: '1',
      assigneeName: 'Alexandru Bojin',
      assigneeInitials: 'AB',
      assigneeColor: '#6366f1',
    },
    {
      id: '2',
      title: 'Întâlnire client - SC Alpha',
      type: 'meeting',
      startTime: addHours(today, 14),
      endTime: addHours(today, 15),
      assigneeId: '2',
      assigneeName: 'Maria Popescu',
      assigneeInitials: 'MP',
      assigneeColor: '#ec4899',
    },
    {
      id: '3',
      title: 'Termen depunere contestație',
      type: 'deadline',
      startTime: new Date(today.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
      endTime: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      isAllDay: true,
      caseName: 'Dosar 2847/2024',
    },
    {
      id: '4',
      title: 'Audiere martori - Dosar 1892',
      type: 'hearing',
      startTime: addHours(new Date(today.getTime() + 24 * 60 * 60 * 1000), 10),
      endTime: addHours(new Date(today.getTime() + 24 * 60 * 60 * 1000), 12),
      location: 'Judecătoria Sector 1',
      caseName: 'Dosar 1892/2024',
    },
    {
      id: '5',
      title: 'Pregătire documentație fuziune',
      type: 'task',
      startTime: addHours(new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), 12),
      endTime: addHours(new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), 14),
      assigneeId: '3',
      assigneeName: 'Elena Dumitrescu',
      assigneeInitials: 'ED',
      assigneeColor: '#14b8a6',
    },
    {
      id: '6',
      title: 'Ședință mediere',
      type: 'deadline',
      startTime: addHours(new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000), 9),
      endTime: addHours(new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000), 10.5),
      location: 'Centrul de Mediere',
    },
    {
      id: '7',
      title: 'Reminder: verificare portal ECRIS',
      type: 'reminder',
      startTime: addHours(today, 16),
      endTime: addHours(today, 17),
    },
  ];
}

// ====================================================================
// Calendar Page Component
// ====================================================================

export default function CalendarPage() {
  const isMobile = useIsMobile();

  // Set document title
  useEffect(() => {
    document.title = 'Calendar';
  }, []);

  // State
  const [view, setView] = React.useState<CalendarView>('week');
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [events, setEvents] = React.useState<CalendarEvent[]>(generateMockEvents);
  const [filters, setFilters] = React.useState<CalendarFilters>({
    eventTypes: [],
    teamMembers: [],
  });

  // Modal state
  const [isEventModalOpen, setIsEventModalOpen] = React.useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null);
  const [newEventDate, setNewEventDate] = React.useState<Date | undefined>();
  const [newEventHour, setNewEventHour] = React.useState<number | undefined>();

  // Filter events based on sidebar filters
  const filteredEvents = React.useMemo(() => {
    return events.filter((event) => {
      // Filter by event type
      if (filters.eventTypes.length > 0 && !filters.eventTypes.includes(event.type)) {
        return false;
      }
      // Filter by team member
      if (
        filters.teamMembers.length > 0 &&
        event.assigneeId &&
        !filters.teamMembers.includes(event.assigneeId)
      ) {
        return false;
      }
      return true;
    });
  }, [events, filters]);

  // Calculate event type counts
  const eventTypeCounts = React.useMemo(() => {
    const counts: Record<CalendarEventType, number> = {
      court: 0,
      hearing: 0,
      deadline: 0,
      meeting: 0,
      task: 0,
      reminder: 0,
      vacation: 0,
    };
    events.forEach((event) => {
      counts[event.type]++;
    });
    return counts;
  }, [events]);

  // Handle event click
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDetailModalOpen(true);
  };

  // Handle time slot click (create new event)
  const handleTimeSlotClick = (date: Date, hour: number) => {
    setNewEventDate(date);
    setNewEventHour(hour);
    setSelectedEvent(null);
    setIsEventModalOpen(true);
  };

  // Handle date click in month view
  const handleDateClick = (date: Date) => {
    setNewEventDate(date);
    setNewEventHour(9);
    setSelectedEvent(null);
    setIsEventModalOpen(true);
  };

  // Handle create button click
  const handleCreateEvent = () => {
    setNewEventDate(currentDate);
    setNewEventHour(9);
    setSelectedEvent(null);
    setIsEventModalOpen(true);
  };

  // Handle edit event
  const handleEditEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  };

  // Handle save event
  const handleSaveEvent = (eventData: Partial<CalendarEvent>) => {
    if (eventData.id) {
      // Update existing event
      setEvents((prev) => prev.map((e) => (e.id === eventData.id ? { ...e, ...eventData } : e)));
    } else {
      // Create new event
      const newEvent: CalendarEvent = {
        id: String(Date.now()),
        title: eventData.title || 'Eveniment nou',
        type: eventData.type || 'meeting',
        startTime: eventData.startTime || new Date(),
        endTime: eventData.endTime || addHours(new Date(), 1),
        isAllDay: eventData.isAllDay,
        location: eventData.location,
        description: eventData.description,
      };
      setEvents((prev) => [...prev, newEvent]);
    }
    setIsEventModalOpen(false);
  };

  // Handle delete event
  const handleDeleteEvent = (eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  // Mobile placeholder
  if (isMobile) {
    return (
      <PageLayout className="flex items-center justify-center p-6">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-linear-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p className="mt-3 text-sm text-linear-text-secondary">
            Calendarul este disponibil pe desktop
          </p>
        </div>
      </PageLayout>
    );
  }

  // Render view based on selection
  const renderView = () => {
    switch (view) {
      case 'day':
        return (
          <DayView
            currentDate={currentDate}
            events={filteredEvents}
            onEventClick={handleEventClick}
            onTimeSlotClick={handleTimeSlotClick}
          />
        );
      case 'week':
        return (
          <WeekView
            currentDate={currentDate}
            events={filteredEvents}
            onEventClick={handleEventClick}
            onTimeSlotClick={handleTimeSlotClick}
          />
        );
      case 'month':
        return (
          <MonthView
            currentDate={currentDate}
            events={filteredEvents}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
          />
        );
      case 'agenda':
        return (
          <AgendaView
            currentDate={currentDate}
            events={filteredEvents}
            onEventClick={handleEventClick}
          />
        );
    }
  };

  return (
    <PageLayout className="flex h-screen flex-col p-0">
      {/* Header */}
      <CalendarHeader
        view={view}
        onViewChange={setView}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        onCreateEvent={handleCreateEvent}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <CalendarSidebar
          filters={filters}
          onFiltersChange={setFilters}
          eventTypeCounts={eventTypeCounts}
          teamMembers={mockTeamMembers}
        />

        {/* Calendar View */}
        <div className="flex-1 overflow-hidden">{renderView()}</div>
      </div>

      {/* Event Create/Edit Modal */}
      <EventModal
        open={isEventModalOpen}
        onOpenChange={setIsEventModalOpen}
        event={selectedEvent}
        defaultDate={newEventDate}
        defaultHour={newEventHour}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
      />

      {/* Event Detail Modal */}
      <EventDetailModal
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        event={selectedEvent}
        onEdit={handleEditEvent}
        onDelete={handleDeleteEvent}
      />
    </PageLayout>
  );
}
