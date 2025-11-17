/**
 * Time Tracking Store
 * Zustand store for time tracking state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  TimeTrackingStore,
  TimeEntry,
  TimeTaskType,
  TimeTrackingFilters,
  TimeSummary,
  ActiveTimer,
  NaturalLanguageParseResult,
} from '@legal-platform/types';

// Simple inline mock data generator (avoiding test-utils import for browser compatibility)
function generateMockEntries(): TimeEntry[] {
  const entries: TimeEntry[] = [];
  const cases = [
    'Dosar Popescu vs. SRL Construct',
    'Contract Ionescu - Furnizare Servicii',
    'Litigiu Georgescu - Proprietate',
  ];
  const taskTypes: TimeTaskType[] = ['Research', 'Drafting', 'ClientMeeting', 'Email'];
  const descriptions = [
    'Cercetare jurisprudență',
    'Redactare contract',
    'Întâlnire client',
    'Corespondență email',
  ];

  for (let i = 0; i < 20; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    entries.push({
      id: `time-${i}`,
      userId: 'user-001',
      userName: 'Mihai Bojin',
      caseId: `case-${Math.floor(Math.random() * 3) + 1}`,
      caseName: cases[Math.floor(Math.random() * cases.length)],
      taskType: taskTypes[Math.floor(Math.random() * taskTypes.length)],
      date,
      duration: 30 + Math.floor(Math.random() * 180),
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      isBillable: Math.random() < 0.7,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
}

const initialState = {
  entries: generateMockEntries(),
  activeTimer: {
    isRunning: false,
    isPaused: false,
    startTime: null,
    pausedTime: 0,
    caseId: null,
    caseName: null,
    taskType: null,
  } as ActiveTimer,
  filters: {
    dateRange: null,
    caseIds: [],
    userIds: [],
    taskTypes: [],
    billableOnly: false,
  } as TimeTrackingFilters,
  lastParseResult: null,
};

export const useTimeTrackingStore = create<TimeTrackingStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Entry management
      addTimeEntry: (entry) =>
        set((state) => {
          const now = new Date();
          const newEntry: TimeEntry = {
            ...entry,
            id: `time-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            createdAt: now,
            updatedAt: now,
          };
          return {
            entries: [newEntry, ...state.entries],
          };
        }),

      updateTimeEntry: (id, updates) =>
        set((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === id ? { ...entry, ...updates, updatedAt: new Date() } : entry
          ),
        })),

      deleteTimeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((entry) => entry.id !== id),
        })),

      // Timer management
      startTimer: (caseId, caseName, taskType) =>
        set({
          activeTimer: {
            isRunning: true,
            isPaused: false,
            startTime: new Date(),
            pausedTime: 0,
            caseId,
            caseName,
            taskType,
          },
        }),

      pauseTimer: () =>
        set((state) => {
          if (!state.activeTimer.isRunning || !state.activeTimer.startTime) {
            return state;
          }

          const now = new Date();
          const elapsed = Math.floor(
            (now.getTime() - state.activeTimer.startTime.getTime()) / 1000 / 60
          ); // minutes

          return {
            activeTimer: {
              ...state.activeTimer,
              isRunning: false,
              isPaused: true,
              pausedTime: state.activeTimer.pausedTime + elapsed,
            },
          };
        }),

      resumeTimer: () =>
        set((state) => {
          if (!state.activeTimer.isPaused) {
            return state;
          }

          return {
            activeTimer: {
              ...state.activeTimer,
              isRunning: true,
              isPaused: false,
              startTime: new Date(),
            },
          };
        }),

      stopTimer: () => {
        const state = get();
        if (
          !state.activeTimer.caseId ||
          !state.activeTimer.caseName ||
          !state.activeTimer.taskType
        ) {
          return null;
        }

        let totalMinutes = state.activeTimer.pausedTime;

        if (state.activeTimer.startTime && state.activeTimer.isRunning) {
          const now = new Date();
          const elapsed = Math.floor(
            (now.getTime() - state.activeTimer.startTime.getTime()) / 1000 / 60
          );
          totalMinutes += elapsed;
        }

        const entry = {
          userId: 'user-001',
          userName: 'Current User',
          caseId: state.activeTimer.caseId,
          caseName: state.activeTimer.caseName,
          taskType: state.activeTimer.taskType,
          date: new Date(),
          duration: totalMinutes,
          description: '',
          isBillable: true,
        };

        // Reset timer
        set({
          activeTimer: {
            isRunning: false,
            isPaused: false,
            startTime: null,
            pausedTime: 0,
            caseId: null,
            caseName: null,
            taskType: null,
          },
        });

        return entry;
      },

      // Filter management
      setFilters: (filters) =>
        set((state) => ({
          filters: {
            ...state.filters,
            ...filters,
          },
        })),

      clearFilters: () =>
        set({
          filters: {
            dateRange: null,
            caseIds: [],
            userIds: [],
            taskTypes: [],
            billableOnly: false,
          },
        }),

      // Natural language parsing (simplified inline version)
      parseNaturalLanguage: (input) => {
        // Basic Romanian time parsing
        const durationMatch = input.match(/(\d+(?:\.\d+)?)\s*(ore|oră|min)/i);
        const taskKeywords: Record<string, TimeTaskType> = {
          cercetare: 'Research',
          redactare: 'Drafting',
          întâlnire: 'ClientMeeting',
          client: 'ClientMeeting',
        };

        let duration = 0;
        let taskType: TimeTaskType | undefined;
        let caseName: string | undefined;

        if (durationMatch) {
          const value = parseFloat(durationMatch[1]);
          const unit = durationMatch[2].toLowerCase();
          duration = unit.startsWith('ore') || unit.startsWith('oră') ? value * 60 : value;
        }

        const inputLower = input.toLowerCase();
        for (const [keyword, type] of Object.entries(taskKeywords)) {
          if (inputLower.includes(keyword)) {
            taskType = type;
            break;
          }
        }

        const result: NaturalLanguageParseResult = {
          success: duration > 0 && !!taskType,
          confidence:
            duration > 0 && taskType && caseName
              ? 'High'
              : duration > 0 && taskType
                ? 'Medium'
                : 'Low',
          parsedEntry: {
            duration,
            taskType,
            description: input,
          },
          originalInput: input,
          errors: [],
        };

        set({ lastParseResult: result });
        return result;
      },

      // Reset
      resetState: () => set(initialState),
    }),
    {
      name: 'time-tracking-storage',
      // Persist timer state and filters only
      partialize: (state) => ({
        activeTimer: state.activeTimer,
        filters: state.filters,
      }),
    }
  )
);

// Selectors
export const selectFilteredEntries = (state: TimeTrackingStore): TimeEntry[] => {
  let filtered = [...state.entries];

  const { dateRange, caseIds, userIds, taskTypes, billableOnly } = state.filters;

  if (dateRange) {
    filtered = filtered.filter((entry) => {
      const entryDate = new Date(entry.date);
      return entryDate >= dateRange.start && entryDate <= dateRange.end;
    });
  }

  if (caseIds.length > 0) {
    filtered = filtered.filter((entry) => caseIds.includes(entry.caseId));
  }

  if (userIds.length > 0) {
    filtered = filtered.filter((entry) => userIds.includes(entry.userId));
  }

  if (taskTypes.length > 0) {
    filtered = filtered.filter((entry) => taskTypes.includes(entry.taskType));
  }

  if (billableOnly) {
    filtered = filtered.filter((entry) => entry.isBillable);
  }

  return filtered;
};

export const selectTimeSummary = (state: TimeTrackingStore): TimeSummary => {
  const entries = selectFilteredEntries(state);

  const totalMinutes = entries.reduce((sum, entry) => sum + entry.duration, 0);
  const billableMinutes = entries
    .filter((e) => e.isBillable)
    .reduce((sum, entry) => sum + entry.duration, 0);
  const nonBillableMinutes = totalMinutes - billableMinutes;
  const billableRate = totalMinutes > 0 ? (billableMinutes / totalMinutes) * 100 : 0;

  // Mock comparison (in real app, would compare to previous period)
  const previousTotal = Math.floor(totalMinutes * 0.95); // 5% less
  const totalDiff = totalMinutes - previousTotal;
  const percentChange = previousTotal > 0 ? (totalDiff / previousTotal) * 100 : 0;

  return {
    totalMinutes,
    billableMinutes,
    nonBillableMinutes,
    billableRate,
    comparisonToPrevious: {
      totalDiff,
      percentChange,
    },
  };
};

export const selectActiveTimerElapsed = (state: TimeTrackingStore): number => {
  if (!state.activeTimer.startTime || !state.activeTimer.isRunning) {
    return state.activeTimer.pausedTime;
  }

  const now = new Date();
  const elapsed = Math.floor((now.getTime() - state.activeTimer.startTime.getTime()) / 1000 / 60);

  return state.activeTimer.pausedTime + elapsed;
};
