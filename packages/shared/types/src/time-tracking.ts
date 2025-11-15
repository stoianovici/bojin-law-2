/**
 * Time Tracking Types
 * Shared types for time tracking functionality
 */

export type TimeTaskType =
  | 'Research' // Cercetare
  | 'Drafting' // Redactare
  | 'ClientMeeting' // Întâlnire Client
  | 'CourtAppearance' // Prezentare în Instanță
  | 'Email' // Email
  | 'PhoneCall' // Apel Telefonic
  | 'Administrative' // Administrativ
  | 'Other'; // Altele

export interface TimeEntry {
  id: string; // UUID
  userId: string; // UUID (current user for prototype)
  userName: string;
  caseId: string; // UUID
  caseName: string;
  taskType: TimeTaskType;
  date: Date;
  duration: number; // minutes
  description: string;
  isBillable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActiveTimer {
  isRunning: boolean;
  isPaused: boolean;
  startTime: Date | null;
  pausedTime: number; // accumulated minutes when paused
  caseId: string | null;
  caseName: string | null;
  taskType: TimeTaskType | null;
}

export interface TimeTrackingFilters {
  dateRange: { start: Date; end: Date } | null;
  caseIds: string[]; // Filter by specific cases
  userIds: string[]; // Filter by team members (Partner view)
  taskTypes: TimeTaskType[]; // Filter by task type
  billableOnly: boolean;
}

export interface TimeSummary {
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  billableRate: number; // percentage 0-100
  comparisonToPrevious?: {
    totalDiff: number; // minutes difference
    percentChange: number; // percentage change
  };
}

export interface NaturalLanguageParseResult {
  success: boolean;
  confidence: 'Low' | 'Medium' | 'High';
  parsedEntry: Partial<TimeEntry>;
  originalInput: string;
  errors: string[]; // Romanian error messages
}

export interface TimeTrackingState {
  // Entries
  entries: TimeEntry[];

  // Active timer
  activeTimer: ActiveTimer;

  // Filters
  filters: TimeTrackingFilters;

  // Natural language parsing
  lastParseResult: NaturalLanguageParseResult | null;
}

export interface TimeTrackingActions {
  // Entry management
  addTimeEntry: (entry: Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTimeEntry: (id: string, updates: Partial<TimeEntry>) => void;
  deleteTimeEntry: (id: string) => void;

  // Timer management
  startTimer: (caseId: string, caseName: string, taskType: TimeTaskType) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'> | null;

  // Filter management
  setFilters: (filters: Partial<TimeTrackingFilters>) => void;
  clearFilters: () => void;

  // Natural language parsing
  parseNaturalLanguage: (input: string) => NaturalLanguageParseResult;

  // Reset
  resetState: () => void;
}

export type TimeTrackingStore = TimeTrackingState & TimeTrackingActions;
