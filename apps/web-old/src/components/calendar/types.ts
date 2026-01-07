/**
 * Calendar Types
 * Shared types for calendar components
 */

// ====================================================================
// Event Types
// ====================================================================

export type CalendarEventType =
  | 'court' // Termene Instanță (red)
  | 'hearing' // Audieri (pink)
  | 'deadline' // Termene Legale (orange)
  | 'meeting' // Întâlniri Clienți (blue)
  | 'task' // Sarcini (purple)
  | 'reminder' // Reminders (green)
  | 'vacation'; // Concediu (gray)

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  startTime: Date;
  endTime: Date;
  isAllDay?: boolean;
  location?: string;
  description?: string;
  caseId?: string;
  caseName?: string;
  assigneeId?: string;
  assigneeName?: string;
  assigneeInitials?: string;
  assigneeColor?: string;
}

// ====================================================================
// View Types
// ====================================================================

export type CalendarView = 'day' | 'week' | 'month' | 'agenda';

// ====================================================================
// Filter Types
// ====================================================================

export interface CalendarFilters {
  eventTypes: CalendarEventType[];
  teamMembers: string[];
}

// ====================================================================
// Event Colors - from design spec
// ====================================================================

export const eventColors: Record<CalendarEventType, { bg: string; border: string; text: string }> =
  {
    court: {
      bg: 'rgba(239, 68, 68, 0.2)',
      border: '#EF4444',
      text: '#FCA5A5',
    },
    hearing: {
      bg: 'rgba(236, 72, 153, 0.2)',
      border: '#EC4899',
      text: '#F9A8D4',
    },
    deadline: {
      bg: 'rgba(245, 158, 11, 0.2)',
      border: '#F59E0B',
      text: '#FCD34D',
    },
    meeting: {
      bg: 'rgba(59, 130, 246, 0.2)',
      border: '#3B82F6',
      text: '#93C5FD',
    },
    task: {
      bg: 'rgba(139, 92, 246, 0.2)',
      border: '#8B5CF6',
      text: '#C4B5FD',
    },
    reminder: {
      bg: 'rgba(34, 197, 94, 0.2)',
      border: '#22C55E',
      text: '#86EFAC',
    },
    vacation: {
      bg: 'rgba(74, 85, 104, 0.3)',
      border: '#4a5568',
      text: '#a1a1aa',
    },
  };

// ====================================================================
// Event Type Labels (Romanian)
// ====================================================================

export const eventTypeLabels: Record<CalendarEventType, string> = {
  court: 'Termene Instanță',
  hearing: 'Audieri',
  deadline: 'Termene Legale',
  meeting: 'Întâlniri Clienți',
  task: 'Sarcini',
  reminder: 'Remindere',
  vacation: 'Concediu',
};

// ====================================================================
// View Labels (Romanian)
// ====================================================================

export const viewLabels: Record<CalendarView, string> = {
  day: 'Zi',
  week: 'Săptămână',
  month: 'Lună',
  agenda: 'Agendă',
};
