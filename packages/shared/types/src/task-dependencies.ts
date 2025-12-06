// Story 4.4: Task Dependencies and Automation - Type Definitions

import type { Task, CaseType, TaskType } from './entities';

// ============================================================================
// Template Types (AC: 1)
// ============================================================================

export interface TaskTemplate {
  id: string;
  firmId: string;
  name: string;
  description?: string;
  caseType?: CaseType;
  isDefault: boolean;
  isActive: boolean;
  steps: TaskTemplateStep[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskTemplateStep {
  id: string;
  templateId: string;
  stepOrder: number;
  taskType: TaskType;
  title: string;
  description?: string;
  estimatedHours?: number;
  typeMetadata?: Record<string, unknown>;
  offsetDays: number;
  offsetFrom: OffsetType;
  isParallel: boolean;
  isCriticalPath: boolean;
  dependencies: TemplateStepDependency[];
}

export type OffsetType = 'CaseStart' | 'PreviousTask' | 'CaseDeadline';
export type DependencyType = 'FinishToStart' | 'StartToStart' | 'FinishToFinish' | 'StartToFinish';

export interface TemplateStepDependency {
  id: string;
  sourceStepId: string;
  targetStepId: string;
  dependencyType: DependencyType;
  lagDays: number;
}

// ============================================================================
// Task Dependency Types (AC: 2, 3)
// ============================================================================

export interface TaskDependency {
  id: string;
  predecessorId: string;
  successorId: string;
  dependencyType: DependencyType;
  lagDays: number;
  predecessor?: Task;
  successor?: Task;
}

// ============================================================================
// Dependency Analysis Types (AC: 5)
// ============================================================================

export interface DependencyChain {
  taskId: string;
  task: Task;
  predecessors: DependencyChain[];
  successors: DependencyChain[];
  depth: number;
  isCriticalPath: boolean;
}

export interface CriticalPathResult {
  caseId: string;
  criticalTasks: Task[];
  totalDuration: number; // Days
  estimatedCompletionDate: Date;
  bottlenecks: BottleneckInfo[];
}

export interface BottleneckInfo {
  taskId: string;
  taskTitle: string;
  dependentCount: number;
  slackDays: number; // Days of buffer before impacting case deadline
}

// ============================================================================
// Cascade Analysis Types (AC: 3)
// ============================================================================

export interface DeadlineCascadeResult {
  affectedTasks: AffectedTask[];
  conflicts: DeadlineConflict[];
  suggestedResolution?: string;
}

export interface AffectedTask {
  taskId: string;
  taskTitle: string;
  currentDueDate: Date;
  newDueDate: Date;
  daysDelta: number;
}

export interface DeadlineConflict {
  taskId: string;
  taskTitle: string;
  conflictType: 'PastDeadline' | 'OverlapConflict' | 'ResourceConflict';
  message: string;
  severity: 'Warning' | 'Error';
}

// ============================================================================
// Template Application Types (AC: 1, 2)
// ============================================================================

export interface ApplyTemplateInput {
  templateId: string;
  caseId: string;
  startDate: Date;
  assignees?: Record<string, string>; // stepId -> userId mapping
}

export interface ApplyTemplateResult {
  usageId: string;
  createdTasks: Task[];
  dependenciesCreated: number;
  warnings: string[];
}

// ============================================================================
// Parallel Task Identification (AC: 4)
// ============================================================================

export interface ParallelTaskGroup {
  groupId: string;
  tasks: Task[];
  canRunSimultaneously: boolean;
  requiredSkills?: string[];
  suggestedAssignees?: AssigneeSuggestion[];
}

export interface AssigneeSuggestion {
  userId: string;
  userName: string;
  matchScore: number; // 0-100
  currentWorkload: number; // Hours
  availableCapacity: number; // Hours
  reasoning: string;
}

// ============================================================================
// Reminder Types (AC: 6)
// ============================================================================

export interface TaskReminder {
  taskId: string;
  userId: string;
  reminderType: ReminderType;
  scheduledFor: Date;
  sent: boolean;
  sentAt?: Date;
}

export type ReminderType = '24Hours' | '48Hours' | '7Days' | 'Overdue';

export interface ReminderConfig {
  enableEmailReminders: boolean;
  reminderIntervals: number[]; // Days before due date [1, 2, 7]
  overdueReminderIntervalHours: number;
  excludeWeekends: boolean;
}

export interface EmailReminderPayload {
  to: string;
  toName: string;
  taskId: string;
  taskTitle: string;
  caseTitle: string;
  dueDate: Date;
  daysUntilDue: number;
  isOverdue: boolean;
  taskUrl: string;
}

