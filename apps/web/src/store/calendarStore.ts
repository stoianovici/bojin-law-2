import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CalendarState {
  // Current navigation
  currentDate: Date;
  view: 'day' | 'week' | 'month' | 'agenda';

  // Selection
  selectedEventId: string | null;
  agendaDays: number; // default 30

  // Filters
  selectedCalendars: string[]; // calendar type IDs
  selectedTeamMembers: string[]; // team member IDs

  // Actions
  setCurrentDate: (date: Date) => void;
  setView: (view: CalendarState['view']) => void;
  selectEvent: (eventId: string | null) => void;
  setAgendaDays: (days: number) => void;
  toggleCalendar: (calendarId: string) => void;
  toggleTeamMember: (memberId: string) => void;
  goToToday: () => void;
  navigateWeek: (direction: 'prev' | 'next') => void;
  navigateDay: (direction: 'prev' | 'next') => void;
  navigateMonth: (direction: 'prev' | 'next') => void;
}

const DEFAULT_CALENDARS = ['court', 'hearing', 'deadline', 'meeting', 'task', 'reminder'];
const DEFAULT_TEAM_MEMBERS = ['ab', 'mp', 'ed', 'ai', 'cv'];

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set) => ({
      currentDate: new Date(),
      view: 'week',
      selectedEventId: null,
      agendaDays: 30,
      selectedCalendars: DEFAULT_CALENDARS,
      selectedTeamMembers: DEFAULT_TEAM_MEMBERS,

      setCurrentDate: (currentDate) => set({ currentDate }),

      setView: (view) => set({ view }),

      selectEvent: (eventId) => set({ selectedEventId: eventId }),

      setAgendaDays: (days) => set({ agendaDays: days }),

      toggleCalendar: (calendarId) =>
        set((state) => ({
          selectedCalendars: state.selectedCalendars.includes(calendarId)
            ? state.selectedCalendars.filter((id) => id !== calendarId)
            : [...state.selectedCalendars, calendarId],
        })),

      toggleTeamMember: (memberId) =>
        set((state) => ({
          selectedTeamMembers: state.selectedTeamMembers.includes(memberId)
            ? state.selectedTeamMembers.filter((id) => id !== memberId)
            : [...state.selectedTeamMembers, memberId],
        })),

      goToToday: () => set({ currentDate: new Date() }),

      navigateWeek: (direction) =>
        set((state) => {
          const newDate = new Date(state.currentDate);
          newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
          return { currentDate: newDate };
        }),

      navigateDay: (direction) =>
        set((state) => {
          const newDate = new Date(state.currentDate);
          newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
          return { currentDate: newDate };
        }),

      navigateMonth: (direction) =>
        set((state) => {
          const newDate = new Date(state.currentDate);
          newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
          return { currentDate: newDate };
        }),
    }),
    {
      name: 'calendar-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        view: state.view,
        agendaDays: state.agendaDays,
        selectedCalendars: state.selectedCalendars,
        selectedTeamMembers: state.selectedTeamMembers,
      }),
    }
  )
);
