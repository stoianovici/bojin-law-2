/**
 * Workload Management Types
 * Story 4.5: Team Workload Management
 *
 * Types for team calendar, workload metrics, availability,
 * AI assignment suggestions, delegation handoffs, and capacity planning
 */

// ============================================================================
// User Availability Types (AC: 1, 5)
// ============================================================================

export type AvailabilityType =
  | 'OutOfOffice'
  | 'ReducedHours'
  | 'Vacation'
  | 'SickLeave'
  | 'Training';

export interface UserAvailability {
  id: string;
  userId: string;
  firmId: string;
  availabilityType: AvailabilityType;
  startDate: Date;
  endDate: Date;
  hoursPerDay?: number;
  reason?: string;
  autoReassign: boolean;
  delegateTo?: string;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  user?: UserBasicInfo;
  delegate?: UserBasicInfo;
}

export interface CreateAvailabilityInput {
  availabilityType: AvailabilityType;
  startDate: string; // ISO date
  endDate: string;
  hoursPerDay?: number;
  reason?: string;
  autoReassign?: boolean;
  delegateTo?: string;
}

export interface UpdateAvailabilityInput {
  availabilityType?: AvailabilityType;
  startDate?: string;
  endDate?: string;
  hoursPerDay?: number;
  reason?: string;
  autoReassign?: boolean;
  delegateTo?: string;
}

// ============================================================================
// Team Calendar Types (AC: 1)
// ============================================================================

export interface UserBasicInfo {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface TeamCalendarEntry {
  userId: string;
  user: UserBasicInfo;
  date: Date;
  tasks: CalendarTask[];
  availability?: UserAvailability;
  totalAllocatedHours: number;
  capacityHours: number;
  utilizationPercent: number;
}

export interface CalendarTask {
  id: string;
  title: string;
  type: string;
  dueDate: Date;
  dueTime?: string;
  status: string;
  estimatedHours: number | null;
  caseId: string;
  caseTitle: string;
  isCriticalPath: boolean;
}

export interface TeamCalendarView {
  firmId: string;
  startDate: Date;
  endDate: Date;
  members: TeamMemberCalendar[];
}

export interface TeamMemberCalendar {
  userId: string;
  user: UserBasicInfo;
  entries: TeamCalendarEntry[];
  weeklyTotal: number;
  weeklyCapacity: number;
  hasAvailabilityOverride: boolean;
}

// ============================================================================
// Workload Meter Types (AC: 2)
// ============================================================================

export interface DailyWorkload {
  date: Date;
  allocatedHours: number;
  capacityHours: number;
  utilizationPercent: number;
  taskCount: number;
  overloaded: boolean;
}

export interface UserWorkload {
  userId: string;
  user: UserBasicInfo;
  dailyWorkloads: DailyWorkload[];
  weeklyAllocated: number;
  weeklyCapacity: number;
  averageUtilization: number;
  status: WorkloadStatus;
}

export type WorkloadStatus = 'UnderUtilized' | 'Optimal' | 'NearCapacity' | 'Overloaded';

export interface TeamWorkloadSummary {
  firmId: string;
  dateRange: { start: Date; end: Date };
  members: UserWorkload[];
  teamAverageUtilization: number;
  overloadedCount: number;
  underUtilizedCount: number;
}

// ============================================================================
// AI Assignment Suggestion Types (AC: 3)
// ============================================================================

export type SkillType =
  | 'Litigation'
  | 'ContractDrafting'
  | 'LegalResearch'
  | 'ClientCommunication'
  | 'CourtProcedures'
  | 'DocumentReview'
  | 'Negotiation'
  | 'DueDiligence'
  | 'RegulatoryCompliance'
  | 'IntellectualProperty';

export interface UserSkill {
  id: string;
  userId: string;
  skillType: SkillType;
  proficiency: number; // 1-5
  verified: boolean;
}

export interface AssignmentSuggestionRequest {
  taskId?: string;
  taskType: string;
  taskTitle: string;
  caseId: string;
  estimatedHours: number;
  dueDate: Date;
  requiredSkills?: SkillType[];
  excludeUserIds?: string[];
}

export interface AssignmentSuggestion {
  userId: string;
  user: UserBasicInfo;
  matchScore: number; // 0-100
  skillMatch: number; // 0-100
  capacityMatch: number; // 0-100
  currentWorkload: number; // Hours
  availableCapacity: number; // Hours on due date
  reasoning: string;
  caveats?: string[];
}

export interface AssignmentSuggestionResponse {
  suggestions: AssignmentSuggestion[];
  noSuitableCandidates: boolean;
  allOverloaded: boolean;
  recommendedAssignee?: string;
}

// ============================================================================
// Delegation Handoff Types (AC: 4)
// ============================================================================

export interface DelegationHandoff {
  id: string;
  delegationId: string;
  handoffNotes: string;
  contextSummary?: string;
  relatedTaskIds: string[];
  relatedDocIds: string[];
  aiGenerated: boolean;
  createdAt: Date;
}

export interface GenerateHandoffInput {
  delegationId: string;
  sourceTaskId: string;
  delegatorNotes?: string;
  includeCaseContext?: boolean;
  includeRecentActivity?: boolean;
}

export interface GenerateHandoffResponse {
  handoffNotes: string;
  contextSummary: string;
  suggestedDocs: string[];
  suggestedTasks: string[];
}

// ============================================================================
// Out-of-Office Reassignment Types (AC: 5)
// ============================================================================

export interface OOOReassignmentConfig {
  userId: string;
  autoReassign: boolean;
  delegateTo?: string;
  urgentOnly: boolean;
  notifyDelegator: boolean;
  notifyOriginalAssignee: boolean;
}

export interface ReassignmentResult {
  taskId: string;
  taskTitle: string;
  originalAssignee: string;
  newAssignee: string;
  reason: string;
  success: boolean;
  error?: string;
}

export interface OOOReassignmentSummary {
  userId: string;
  period: { start: Date; end: Date };
  tasksReassigned: ReassignmentResult[];
  tasksSkipped: { taskId: string; reason: string }[];
  delegateTo: string;
}

// ============================================================================
// Capacity Planning Types (AC: 6)
// ============================================================================

export interface CapacityBottleneck {
  date: Date;
  userId: string;
  user: { id: string; firstName: string; lastName: string };
  overageHours: number;
  impactedTasks: BottleneckTask[];
  severity: 'Warning' | 'Critical';
  suggestedAction: string;
}

export interface BottleneckTask {
  id: string;
  title: string;
  dueDate: Date;
  estimatedHours: number;
  isCriticalPath: boolean;
  caseId: string;
}

export interface CapacityForecast {
  firmId: string;
  forecastRange: { start: Date; end: Date };
  bottlenecks: CapacityBottleneck[];
  teamCapacityByDay: { date: Date; totalCapacity: number; totalAllocated: number }[];
  overallRisk: 'Low' | 'Medium' | 'High';
  recommendations: string[];
}

export interface ResourceAllocationSuggestion {
  overloadedUserId: string;
  suggestedDelegateId: string;
  taskId: string;
  rationale: string;
  impactScore: number; // 0-100, higher = more beneficial
}

// ============================================================================
// User Workload Settings Types (AC: 2, 6)
// ============================================================================

export interface UserWorkloadSettings {
  id: string;
  userId: string;
  dailyCapacityHours: number;
  weeklyCapacityHours: number;
  workingDays: number[]; // 0=Sun, 1=Mon, ... 6=Sat
  maxConcurrentTasks: number;
  overloadThreshold: number; // e.g., 1.2 = 120%
}

export interface UpdateWorkloadSettingsInput {
  dailyCapacityHours?: number;
  weeklyCapacityHours?: number;
  workingDays?: number[];
  maxConcurrentTasks?: number;
  overloadThreshold?: number;
}

// ============================================================================
// Workload Date Range Type
// ============================================================================

// Note: Uses DateRange from reports module when needed
// This is a local interface for workload-specific use
export interface WorkloadDateRange {
  start: Date;
  end: Date;
}
