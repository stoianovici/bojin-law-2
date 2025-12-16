// Platform Intelligence Types
// Story 5.7: Platform Intelligence Dashboard

// ============================================================================
// Common Types
// ============================================================================

export interface PlatformDateRange {
  startDate: Date;
  endDate: Date;
}

// ============================================================================
// Communication Response Analytics (AC: 2)
// ============================================================================

export interface ResponseTimeMetrics {
  avgResponseTimeHours: number;
  medianResponseTimeHours: number;
  p90ResponseTimeHours: number;
  totalEmailsAnalyzed: number;
  withinSLAPercent: number; // Responded within 24h
}

export interface ResponseTimeComparison {
  currentPeriod: ResponseTimeMetrics;
  baselinePeriod: ResponseTimeMetrics; // Before platform adoption
  improvementPercent: number;
}

export type EmailRecipientType = 'client' | 'opposing_counsel' | 'court' | 'internal';

export interface ResponseTimeByType {
  emailType: EmailRecipientType;
  metrics: ResponseTimeMetrics;
  volumeCount: number;
}

export interface ResponseTimeTrend {
  date: Date;
  avgResponseTimeHours: number;
  volumeCount: number;
}

export interface CommunicationAnalytics {
  currentResponseTime: ResponseTimeMetrics;
  baselineComparison: ResponseTimeComparison | null;
  byRecipientType: ResponseTimeByType[];
  trend: ResponseTimeTrend[];
}

// ============================================================================
// Document Quality Analytics (AC: 3)
// ============================================================================

export interface DocumentRevisionMetrics {
  totalDocumentsCreated: number;
  avgRevisionsPerDocument: number;
  documentsWithZeroRevisions: number; // First-time right
  documentsWithMultipleRevisions: number;
  firstTimeRightPercent: number;
}

export type IssueCategory = 'spelling' | 'legal_reference' | 'formatting' | 'content';

export interface DocumentErrorMetrics {
  totalReviewsCompleted: number;
  reviewsWithIssues: number;
  issuesByCategory: Record<IssueCategory, number>;
  avgIssuesPerReview: number;
  issueResolutionTimeHours: number;
}

export interface DocumentQualityTrend {
  date: Date;
  firstTimeRightPercent: number;
  avgRevisions: number;
  issueCount: number;
}

export interface DocumentQualityAnalytics {
  revisionMetrics: DocumentRevisionMetrics;
  errorMetrics: DocumentErrorMetrics;
  qualityTrend: DocumentQualityTrend[];
}

// ============================================================================
// AI Utilization Analytics (AC: 5)
// ============================================================================

export type AIFeatureType =
  | 'email_drafting'
  | 'document_generation'
  | 'clause_suggestions'
  | 'task_parsing'
  | 'morning_briefing'
  | 'proactive_suggestions'
  | 'semantic_search'
  | 'version_comparison'
  | 'style_analysis';

export interface FeatureUsage {
  feature: AIFeatureType;
  requestCount: number;
  tokenCount: number;
  avgLatencyMs: number;
  acceptanceRate?: number; // For suggestions
}

export interface AIUtilizationByUser {
  userId: string;
  userName: string;
  totalRequests: number;
  totalTokens: number;
  totalCostCents: number;
  byFeature: FeatureUsage[];
  adoptionScore: number; // 0-100, based on feature usage breadth
}

export interface FirmAITotal {
  totalRequests: number;
  totalTokens: number;
  totalCostCents: number;
  avgRequestsPerUser: number;
}

export interface AIUtilizationSummary {
  firmTotal: FirmAITotal;
  byUser: AIUtilizationByUser[];
  byFeature: FeatureUsage[];
  topUsers: AIUtilizationByUser[];
  underutilizedUsers: AIUtilizationByUser[]; // Below average adoption
}

// ============================================================================
// Efficiency Metrics (AC: 1)
// ============================================================================

export interface EfficiencyMetrics {
  totalTimeSavedHours: number;
  aiAssistedActions: number;
  automationTriggers: number;
  manualVsAutomatedRatio: number;
}

// ============================================================================
// Task Completion Summary (AC: 4)
// ============================================================================

export interface TaskCompletionTrend {
  date: Date;
  completionRate: number;
  deadlineAdherence: number;
  tasksCompleted: number;
}

export interface TaskCompletionSummary {
  completionRate: number;
  deadlineAdherence: number;
  avgCompletionTimeHours: number;
  overdueCount: number;
  trend: TaskCompletionTrend[];
}

// ============================================================================
// ROI Summary (AC: 6)
// ============================================================================

export interface PlatformSavingsCategory {
  category: string; // 'document_drafting', 'email_response', 'task_automation', etc.
  hoursSaved: number;
  valueInCurrency: number; // Based on blended hourly rate
  percentOfTotal: number;
}

export interface ROISummary {
  totalValueSaved: number;
  billableHoursRecovered: number;
  projectedAnnualSavings: number;
  savingsByCategory: PlatformSavingsCategory[];
}

// ============================================================================
// Platform Recommendations
// ============================================================================

export type RecommendationCategory = 'efficiency' | 'communication' | 'quality' | 'adoption';
export type RecommendationPriority = 'low' | 'medium' | 'high';

export interface PlatformRecommendation {
  category: RecommendationCategory;
  priority: RecommendationPriority;
  message: string;
  actionableSteps: string[];
}

// ============================================================================
// Platform Intelligence Dashboard (AC: 1-6)
// ============================================================================

export interface PlatformIntelligenceDashboard {
  dateRange: PlatformDateRange;
  firmId: string;
  generatedAt: Date;

  // AC: 1 - Efficiency metrics
  efficiency: EfficiencyMetrics;

  // AC: 2 - Communication response times
  communication: CommunicationAnalytics;

  // AC: 3 - Document quality
  documentQuality: DocumentQualityAnalytics;

  // AC: 4 - Task completion
  taskCompletion: TaskCompletionSummary;

  // AC: 5 - AI utilization
  aiUtilization: AIUtilizationSummary;

  // AC: 6 - ROI calculation
  roi: ROISummary;

  // Overall platform health score
  platformHealthScore: number; // 0-100
  recommendations: PlatformRecommendation[];
}

// ============================================================================
// Export Types
// ============================================================================

export type ExportFormat = 'pdf' | 'excel' | 'csv';

export type ExportSection = 'efficiency' | 'communication' | 'quality' | 'tasks' | 'ai' | 'roi';

export interface ExportOptions {
  format: ExportFormat;
  dateRange: PlatformDateRange;
  sections?: ExportSection[];
}

export interface ExportResult {
  url: string;
  expiresAt: Date;
  format: ExportFormat;
}

// ============================================================================
// Service Interfaces
// ============================================================================

export interface CommunicationResponseAnalyticsInput {
  firmId: string;
  dateRange: PlatformDateRange;
}

export interface DocumentQualityAnalyticsInput {
  firmId: string;
  dateRange: PlatformDateRange;
  interval?: 'day' | 'week' | 'month';
}

export interface AIUtilizationAnalyticsInput {
  firmId: string;
  dateRange: PlatformDateRange;
}

export interface PlatformIntelligenceDashboardInput {
  firmId: string;
  dateRange: PlatformDateRange;
}

// ============================================================================
// Platform Health Score Calculation
// ============================================================================

export interface HealthScoreWeights {
  communicationImprovement: number; // Response time improvement weight
  documentQuality: number; // First-time-right % weight
  taskCompletion: number; // Completion rate weight
  aiAdoption: number; // Avg adoption score weight
  roiGrowth: number; // ROI growth % weight
}

export const DEFAULT_HEALTH_SCORE_WEIGHTS: HealthScoreWeights = {
  communicationImprovement: 0.2,
  documentQuality: 0.2,
  taskCompletion: 0.2,
  aiAdoption: 0.2,
  roiGrowth: 0.2,
};

// Health score targets (100% score = meeting these targets)
export interface HealthScoreTargets {
  communicationImprovementPercent: number; // 30% improvement = 100 points
  documentFirstTimeRightPercent: number; // 80% first-time-right = 100 points
  taskCompletionRatePercent: number; // 90% completion rate = 100 points
  aiAdoptionScorePercent: number; // 70% avg adoption = 100 points
  roiGrowthPercent: number; // 20% month-over-month = 100 points
}

export const DEFAULT_HEALTH_SCORE_TARGETS: HealthScoreTargets = {
  communicationImprovementPercent: 30,
  documentFirstTimeRightPercent: 80,
  taskCompletionRatePercent: 90,
  aiAdoptionScorePercent: 70,
  roiGrowthPercent: 20,
};

// ============================================================================
// Feature Map for AI Operations
// ============================================================================

export const AI_FEATURE_MAP: Record<string, AIFeatureType> = {
  email_draft_generate: 'email_drafting',
  email_draft_refine: 'email_drafting',
  document_generate: 'document_generation',
  document_clause_suggest: 'clause_suggestions',
  task_parse_nlp: 'task_parsing',
  suggestion_morning_brief: 'morning_briefing',
  suggestion_proactive: 'proactive_suggestions',
  semantic_search: 'semantic_search',
  semantic_diff: 'version_comparison',
  style_analysis: 'style_analysis',
};

// ============================================================================
// Category Classification
// ============================================================================

export interface CategoryClassification {
  commentId: string;
  category: IssueCategory;
  confidence: number;
}

// Keywords for rule-based classification fallback
export const ISSUE_CATEGORY_KEYWORDS: Record<IssueCategory, string[]> = {
  spelling: ['typo', 'spelling', 'grammar', 'punctuation', 'ortografie', 'greșeală'],
  legal_reference: ['citation', 'reference', 'article', 'articol', 'lege', 'cod', 'decret'],
  formatting: ['format', 'layout', 'spacing', 'font', 'margin', 'aliniere', 'formatare'],
  content: ['incorrect', 'wrong', 'error', 'missing', 'conținut', 'greșit', 'lipsește'],
};

// ============================================================================
// Firm Metadata Extension
// ============================================================================

export interface PlatformIntelligenceMetadata {
  baselineStartDate?: string; // ISO date string
  baselineEndDate?: string; // Calculated as baselineStartDate + 30 days
}

export interface FirmMetadataWithIntelligence {
  platformIntelligence?: PlatformIntelligenceMetadata;
}
