/**
 * Document Intelligence Dashboard Types
 * Story 3.7: AI Document Intelligence Dashboard
 *
 * Type definitions for all document intelligence metrics and analytics
 */

// ============================================================================
// Document Velocity Types (AC: 1)
// ============================================================================

export interface UserDocumentVelocity {
  userId: string;
  userName: string;
  userRole: string;
  documentCount: number;
  averagePerWeek: number;
  trend: number; // Percentage change
}

export interface DocumentTypeVelocity {
  documentType: string;
  documentCount: number;
  averageCreationTimeMinutes: number;
  trend: number;
}

export interface DocumentVelocityStats {
  byUser: UserDocumentVelocity[];
  byType: DocumentTypeVelocity[];
  totalDocuments: number;
  averagePerDay: number;
  trendPercentage: number; // Change vs previous period
}

// ============================================================================
// AI Utilization Types (AC: 2)
// ============================================================================

export interface UserAIUtilization {
  userId: string;
  userName: string;
  utilizationRate: number;
  aiDocumentCount: number;
  totalDocumentCount: number;
  lastAIUsage: Date | null;
}

export interface AdoptionTrendPoint {
  date: string;
  utilizationRate: number;
  documentCount: number;
}

export interface AIUtilizationStats {
  overallUtilizationRate: number; // Percentage of documents using AI
  byUser: UserAIUtilization[];
  adoptionTrend: AdoptionTrendPoint[];
  totalAIAssistedDocuments: number;
  totalManualDocuments: number;
}

// ============================================================================
// Error Detection Types (AC: 3)
// ============================================================================

export interface SeverityBreakdown {
  severity: string;
  count: number;
  percentage: number;
}

export interface ConcernTypeBreakdown {
  concernType: string;
  count: number;
  percentage: number;
}

export interface ErrorDetectionTrendPoint {
  date: string;
  detected: number;
  resolved: number;
}

export interface ErrorDetectionStats {
  totalConcernsDetected: number;
  concernsResolvedBeforeFiling: number;
  detectionRate: number; // Percentage
  bySeverity: SeverityBreakdown[];
  byType: ConcernTypeBreakdown[];
  trendData: ErrorDetectionTrendPoint[];
}

// ============================================================================
// Time Savings Types (AC: 4)
// ============================================================================

export interface UserTimeSavings {
  userId: string;
  userName: string;
  minutesSaved: number;
  documentsCreated: number;
  averageSavedPerDocument: number;
}

export interface DocumentTypeTimeSavings {
  documentType: string;
  averageManualTimeMinutes: number;
  averageAIAssistedTimeMinutes: number;
  timeSavedPercentage: number;
  sampleSize: number;
}

export interface TimeSavingsStats {
  totalMinutesSaved: number;
  averageMinutesSavedPerDocument: number;
  estimatedCostSavings: number; // In RON
  byUser: UserTimeSavings[];
  byDocumentType: DocumentTypeTimeSavings[];
  methodology: string; // Explanation of calculation
}

// ============================================================================
// Template Usage Types (AC: 5)
// ============================================================================

export interface TemplateUsage {
  templateId: string;
  templateName: string;
  category: string;
  usageCount: number;
  lastUsed: Date;
  averageQualityScore: number | null;
}

export interface ClauseUsage {
  clauseId: string;
  clauseText: string;
  category: string;
  frequency: number;
  insertionRate: number; // % of suggestions accepted
}

export interface TemplateUsageStats {
  topTemplates: TemplateUsage[];
  topClauses: ClauseUsage[];
  totalTemplateUsage: number;
  templateAdoptionRate: number;
}

// ============================================================================
// Document Quality Types (AC: 6)
// ============================================================================

export interface QualityTrendPoint {
  date: string;
  averageEditPercentage: number;
  documentCount: number;
  qualityScore: number;
}

export interface DocumentTypeQuality {
  documentType: string;
  averageEditPercentage: number;
  averageRevisionCount: number;
  documentCount: number;
  qualityScore: number;
}

export interface DocumentQualityTrends {
  overallQualityScore: number; // Based on revision counts
  averageRevisionCount: number;
  qualityTrend: QualityTrendPoint[];
  byDocumentType: DocumentTypeQuality[];
  qualityThreshold: number; // Target: < 30% edit
}

// ============================================================================
// Dashboard Aggregate Types
// ============================================================================

export interface DocumentIntelligenceDateRange {
  startDate: Date;
  endDate: Date;
}

export interface DocumentIntelligenceDashboard {
  dateRange: DocumentIntelligenceDateRange;
  velocity: DocumentVelocityStats;
  aiUtilization: AIUtilizationStats;
  errorDetection: ErrorDetectionStats;
  timeSavings: TimeSavingsStats;
  templateUsage: TemplateUsageStats;
  qualityTrends: DocumentQualityTrends;
  lastUpdated: Date;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface DocumentIntelligenceFilters {
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  userIds?: string[];
  documentTypes?: string[];
  compareWithPrevious?: boolean;
}

// ============================================================================
// Manual Baseline Times (for time savings calculation)
// ============================================================================

export const MANUAL_BASELINE_TIMES: Record<string, number> = {
  Contract: 120, // minutes
  Motion: 90,
  Letter: 45,
  Memo: 60,
  Pleading: 150,
  Other: 60, // Default fallback
};

// Default hourly rate in RON if firm rates not set
export const DEFAULT_HOURLY_RATE_RON = 200;

// ============================================================================
// Quality Color Thresholds
// ============================================================================

export const QUALITY_THRESHOLDS = {
  excellent: 15, // < 15% edit = green
  good: 25, // < 25% edit = yellow
  acceptable: 30, // < 30% edit = orange
  poor: 30, // >= 30% = red
};

// ============================================================================
// Chart Colors (consistent with existing analytics)
// ============================================================================

export const CHART_COLORS = {
  primary: '#0088FE', // blue
  secondary: '#00C49F', // green
  tertiary: '#FFBB28', // yellow
  quaternary: '#FF8042', // orange
  quinary: '#8884D8', // purple
};

export const CHART_COLOR_ARRAY = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.tertiary,
  CHART_COLORS.quaternary,
  CHART_COLORS.quinary,
];

// ============================================================================
// Severity Colors
// ============================================================================

export const SEVERITY_COLORS = {
  ERROR: '#EF4444', // red-500
  WARNING: '#F97316', // orange-500
  INFO: '#3B82F6', // blue-500
};

// ============================================================================
// Quality Color Scale
// ============================================================================

export const QUALITY_COLORS = {
  excellent: { text: 'text-green-600', bg: 'bg-green-500' },
  good: { text: 'text-yellow-600', bg: 'bg-yellow-500' },
  acceptable: { text: 'text-orange-500', bg: 'bg-orange-500' },
  poor: { text: 'text-red-600', bg: 'bg-red-500' },
};

/**
 * Get quality color based on edit percentage
 */
export function getQualityColorClass(editPercentage: number): {
  text: string;
  bg: string;
} {
  if (editPercentage < QUALITY_THRESHOLDS.excellent) {
    return QUALITY_COLORS.excellent;
  }
  if (editPercentage < QUALITY_THRESHOLDS.good) {
    return QUALITY_COLORS.good;
  }
  if (editPercentage < QUALITY_THRESHOLDS.acceptable) {
    return QUALITY_COLORS.acceptable;
  }
  return QUALITY_COLORS.poor;
}

/**
 * Calculate quality score from edit percentage
 * Formula: 100 - (editPercentage * 2.5)
 */
export function calculateQualityScore(editPercentage: number): number {
  return Math.max(0, Math.min(100, 100 - editPercentage * 2.5));
}
