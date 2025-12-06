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

// ============================================================================
// Story 4.3: Time Estimation & Manual Time Logging
// ============================================================================

// ============================================================================
// Time Entry Types (AC: 2, 3, 4)
// ============================================================================

/**
 * Input for creating a manual time entry
 * AC: 2 - Manual time logging via simple entry: hours and description
 * AC: 3 - Quick-log option from task context
 * AC: 4 - Time entries include narrative descriptions for billing clarity
 */
export interface TimeEntryInput {
  caseId: string;
  taskId?: string; // Optional task link (AC: 3)
  date: string; // ISO date string
  hours: number; // Decimal hours (e.g., 1.5 for 1h30m)
  description: string;
  narrative?: string; // Detailed billing narrative (AC: 4)
  billable: boolean;
}

/**
 * Input for updating an existing time entry
 */
export interface UpdateTimeEntryInput {
  date?: string;
  hours?: number;
  description?: string;
  narrative?: string;
  billable?: boolean;
}

/**
 * Time entry with full details and relations
 */
export interface TimeEntryWithDetails {
  id: string;
  caseId: string;
  taskId: string | null;
  userId: string;
  date: Date;
  hours: number;
  hourlyRate: number;
  description: string;
  narrative: string | null;
  billable: boolean;
  firmId: string;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  case?: { id: string; title: string; caseNumber: string };
  task?: {
    id: string;
    title: string;
    type: string;
    estimatedHours: number | null;
  };
  user?: { id: string; firstName: string; lastName: string };
}

/**
 * Date range filter for time entries (optional bounds)
 */
export interface TimeEntryDateRange {
  start?: Date;
  end?: Date;
}

// ============================================================================
// AI Time Estimation Types (AC: 1)
// ============================================================================

/**
 * Request for AI-powered time estimation
 * AC: 1 - Estimated time field required on task creation (AI can suggest based on similar past tasks)
 */
export interface TimeEstimationRequest {
  taskType: string;
  taskTitle: string;
  taskDescription?: string;
  caseType?: string;
  firmId: string;
}

/**
 * AI time estimation response
 * AC: 1 - AI suggestions based on similar past tasks
 */
export interface TimeEstimationResponse {
  estimatedHours: number;
  confidence: number; // 0-1 scale
  reasoning: string;
  basedOnSimilarTasks: number; // Count of similar tasks used
  range: {
    min: number;
    max: number;
  };
}

// ============================================================================
// Weekly Summary Types (AC: 5)
// ============================================================================

/**
 * Weekly time summary with billable/non-billable breakdown
 * AC: 5 - Weekly summary shows logged billable vs non-billable hours with trends
 */
export interface WeeklySummary {
  weekStart: Date;
  weekEnd: Date;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  billableAmount: number; // In cents
  entriesCount: number;
  byDay: DailySummary[];
  trend: TrendIndicator;
}

/**
 * Daily time summary breakdown
 */
export interface DailySummary {
  date: Date;
  dayOfWeek: string;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
}

/**
 * Trend indicator
 * AC: 5 - Trends comparison
 */
export type TrendIndicator = 'up' | 'down' | 'stable';

// ============================================================================
// Estimate vs Actual Comparison Types (AC: 6)
// ============================================================================

/**
 * Comparison of estimated vs actual time by task type
 * AC: 6 - Comparison view: estimated vs actual time per task type (for personal improvement)
 */
export interface TaskTypeComparison {
  taskType: string;
  taskCount: number;
  avgEstimatedHours: number;
  avgActualHours: number;
  accuracy: number; // Percentage (actual/estimated * 100)
  variance: number; // avgActual - avgEstimated
  variancePercent: number; // variance / avgEstimated * 100
}

/**
 * Report comparing estimated vs actual time across task types
 * AC: 6 - Personal improvement tracking
 */
export interface EstimateVsActualReport {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  overallAccuracy: number;
  byTaskType: TaskTypeComparison[];
  improvementTrend: TrendIndicator;
  recommendations: string[];
}
