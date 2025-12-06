// Task Analytics Types
// Story 4.7: Task Analytics and Optimization

import type { TaskType, CaseType } from './entities';

// ============================================================================
// Completion Time Analytics (AC: 1)
// ============================================================================

export interface CompletionTimeMetrics {
  avgCompletionTimeHours: number;
  medianCompletionTimeHours: number;
  minCompletionTimeHours: number;
  maxCompletionTimeHours: number;
  totalTasksAnalyzed: number;
}

export interface CompletionByType {
  taskType: TaskType;
  metrics: CompletionTimeMetrics;
  comparedToPrevious?: number; // Percentage change
}

export interface CompletionByUser {
  userId: string;
  userName: string;
  metrics: CompletionTimeMetrics;
  taskCount: number;
  comparedToTeamAvg?: number; // Percentage vs team average
}

export interface CompletionTimeAnalyticsResponse {
  firmMetrics: CompletionTimeMetrics;
  byType: CompletionByType[];
  byUser: CompletionByUser[];
  dateRange: { start: Date; end: Date };
}

// ============================================================================
// Overdue Analysis (AC: 2)
// ============================================================================

export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';

export interface OverdueTask {
  taskId: string;
  taskTitle: string;
  taskType: TaskType;
  assigneeId: string;
  assigneeName: string;
  caseId: string;
  caseTitle: string;
  dueDate: Date;
  daysOverdue: number;
  blockedBy?: string[]; // Task IDs blocking this task
  estimatedImpact: ImpactLevel;
}

export type BottleneckPatternType =
  | 'user_overload'
  | 'task_type_delay'
  | 'dependency_chain'
  | 'case_complexity';

export interface BottleneckPattern {
  patternType: BottleneckPatternType;
  description: string;
  affectedTasks: number;
  suggestedAction: string;
  relatedUsers?: string[];
  relatedTaskTypes?: TaskType[];
}

export interface OverdueByTypeItem {
  taskType: TaskType;
  count: number;
  avgDaysOverdue: number;
}

export interface OverdueByUserItem {
  userId: string;
  userName: string;
  count: number;
}

export interface OverdueAnalyticsResponse {
  totalOverdue: number;
  overdueByType: OverdueByTypeItem[];
  overdueByUser: OverdueByUserItem[];
  bottleneckPatterns: BottleneckPattern[];
  criticalTasks: OverdueTask[]; // Top 10 most impactful
}

// ============================================================================
// Velocity Trends (AC: 3)
// ============================================================================

export type TrendDirection = 'improving' | 'stable' | 'declining';
export type TrendDirectionSimple = 'up' | 'stable' | 'down';
export type VelocityInterval = 'daily' | 'weekly' | 'monthly';

export interface VelocityDataPoint {
  date: Date;
  tasksCreated: number;
  tasksCompleted: number;
  velocityScore: number; // completed / target
  trend: TrendDirection;
}

export interface VelocityByUser {
  userId: string;
  userName: string;
  currentVelocity: number;
  previousVelocity: number;
  trendDirection: TrendDirectionSimple;
  percentageChange: number;
}

export interface FirmVelocity {
  current: number;
  previous: number;
  trend: TrendDirection;
  percentageChange: number;
}

export interface VelocityTrendsResponse {
  firmVelocity: FirmVelocity;
  timeSeries: VelocityDataPoint[];
  byUser: VelocityByUser[];
  interval: VelocityInterval;
}

// ============================================================================
// Task Pattern Detection (AC: 4)
// ============================================================================

export type TaskPatternType = 'CoOccurrence' | 'Sequence' | 'CaseTypeSpecific';

export interface PatternAssignee {
  userId: string;
  userName: string;
  frequency: number;
}

export interface PatternSampleCase {
  caseId: string;
  caseTitle: string;
}

export interface TaskCoOccurrencePattern {
  id: string;
  taskTypes: TaskType[];
  caseTypes: CaseType[];
  occurrenceCount: number;
  confidence: number; // 0-1
  suggestedTemplateName: string;
  avgSequenceGapDays?: number;
  commonAssignees: PatternAssignee[];
  sampleCases: PatternSampleCase[];
  isTemplateCreated: boolean;
}

export interface PatternDetectionResponse {
  patterns: TaskCoOccurrencePattern[];
  analysisDate: Date;
  totalPatternsFound: number;
  highConfidenceCount: number; // confidence > 0.8
}

export interface CreateTemplateFromPatternInput {
  patternId: string;
  templateName: string;
  description?: string;
}

// ============================================================================
// Delegation Analysis (AC: 5)
// ============================================================================

export type TrainingPriority = 'low' | 'medium' | 'high';

export interface TrainingSuggestion {
  skillArea: TaskType;
  reason: string;
  priority: TrainingPriority;
  suggestedAction: string;
}

export interface DelegationPatternUser {
  userId: string;
  userName: string;
  role: string;
  delegationsReceived: number;
  delegationsGiven: number;
  successRate: number; // Percentage completed on time
  avgCompletionDays: number;
  strengthAreas: TaskType[];
  struggleAreas: TaskType[];
  suggestedTraining: TrainingSuggestion[];
}

export interface DelegationFlow {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  count: number;
  avgSuccessRate: number;
}

export interface UserTrainingOpportunities {
  userId: string;
  userName: string;
  suggestions: TrainingSuggestion[];
}

export interface DelegationAnalyticsResponse {
  byUser: DelegationPatternUser[];
  topDelegationFlows: DelegationFlow[];
  firmWideSuccessRate: number;
  trainingOpportunities: UserTrainingOpportunities[];
}

// ============================================================================
// ROI Calculator (AC: 6)
// ============================================================================

export interface ROIMetrics {
  // Template automation
  templateTasksCreated: number;
  manualTasksCreated: number;
  templateAdoptionRate: number; // Percentage
  estimatedTemplateTimeSavedHours: number;

  // NLP parser
  nlpTasksCreated: number;
  estimatedNLPTimeSavedHours: number;

  // Automation features
  autoRemindersSet: number;
  autoDependencyTriggers: number;
  autoReassignments: number;
  estimatedAutomationTimeSavedHours: number;

  // Total savings
  totalTimeSavedHours: number;
  avgHourlyRate: number;
  totalValueSaved: number;

  // Comparison
  comparisonPeriod: { start: Date; end: Date };
  previousPeriodSavings?: number;
  savingsGrowthPercent?: number;
}

export interface ROITimeSeriesPoint {
  date: Date;
  timeSavedHours: number;
  valueSaved: number;
}

export interface SavingsCategory {
  category: string;
  hoursSaved: number;
  valueSaved: number;
  percentageOfTotal: number;
}

export interface ROIDashboardResponse {
  currentPeriod: ROIMetrics;
  timeSeries: ROITimeSeriesPoint[];
  projectedAnnualSavings: number;
  topSavingsCategories: SavingsCategory[];
}

// ============================================================================
// Combined Analytics Dashboard
// ============================================================================

export interface TaskAnalyticsDashboard {
  completion: CompletionTimeAnalyticsResponse;
  overdue: OverdueAnalyticsResponse;
  velocity: VelocityTrendsResponse;
  dateRange: { start: Date; end: Date };
}

export interface AnalyticsFilters {
  firmId: string;
  dateRange: { start: Date; end: Date };
  taskTypes?: TaskType[];
  userIds?: string[];
  caseIds?: string[];
  limit?: number; // Default 100, max 500
  offset?: number; // Default 0
}

// ============================================================================
// Analytics Error Handling
// ============================================================================

export type AnalyticsErrorCode =
  | 'INSUFFICIENT_DATA'
  | 'DATE_RANGE_INVALID'
  | 'DATE_RANGE_TOO_LARGE'
  | 'DATA_STALE'
  | 'FIRM_NOT_FOUND';

export interface AnalyticsError {
  code: AnalyticsErrorCode;
  message: string;
  lastDataUpdate?: Date;
}

// ============================================================================
// Worker Health Status
// ============================================================================

export type WorkerStatus = 'HEALTHY' | 'STALE' | 'ERROR' | 'DISABLED';

export interface WorkerHealthStatus {
  workerName: string;
  lastRunAt?: Date;
  nextScheduledRun?: Date;
  status: WorkerStatus;
  lastError?: string;
}

// ============================================================================
// Snapshot Types (matching Prisma enums)
// ============================================================================

export type SnapshotType = 'Daily' | 'Weekly' | 'Monthly';

export interface TaskAnalyticsSnapshot {
  id: string;
  firmId: string;
  snapshotDate: Date;
  snapshotType: SnapshotType;
  totalTasksCreated: number;
  totalTasksCompleted: number;
  avgCompletionTimeHours: number;
  completionByType: Record<TaskType, { count: number; avgHours: number }>;
  completionByUser: Record<string, { count: number; avgHours: number }>;
  overdueCount: number;
  overdueByType: Record<TaskType, number>;
  overdueByUser: Record<string, number>;
  bottleneckTasks: string[];
  velocityScore: number;
  velocityTrend: TrendDirection;
  createdAt: Date;
}
