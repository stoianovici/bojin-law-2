/**
 * Proactive AI Suggestions Types
 * Story 5.4: Proactive AI Suggestions System
 */

// Proactive suggestion types (renamed to avoid conflict with word-integration.ts)
export type ProactiveSuggestionType =
  | 'MorningBriefing'
  | 'TaskSuggestion'
  | 'PatternMatch'
  | 'DeadlineWarning'
  | 'DocumentCheck'
  | 'FollowUp'
  | 'RiskAlert';

export type SuggestionCategory = 'Task' | 'Communication' | 'Document' | 'Calendar' | 'Compliance';

export type SuggestionPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

export type SuggestionStatus = 'Pending' | 'Accepted' | 'Dismissed' | 'Expired' | 'AutoApplied';

// User action types for tracking
export interface UserAction {
  id: string;
  type: string;
  timestamp: Date;
  context: Record<string, unknown>;
}

// Context for generating suggestions
export interface SuggestionContext {
  userId: string;
  firmId: string;
  currentScreen?: string; // 'case_detail', 'task_list', 'email_view', etc.
  currentCaseId?: string;
  currentDocumentId?: string;
  recentActions: UserAction[];
  userPreferences: {
    language: 'ro' | 'en';
    aiSuggestionLevel: 'aggressive' | 'moderate' | 'minimal';
    timeZone: string;
  };
}

// Generated suggestion structure
export interface GeneratedSuggestion {
  type: ProactiveSuggestionType;
  category: SuggestionCategory;
  title: string;
  description: string;
  suggestedAction: string;
  actionPayload: Record<string, unknown>;
  confidence: number;
  priority: SuggestionPriority;
  expiresAt?: Date;
}

// AI Suggestion entity (matches Prisma model) - renamed to avoid conflict with workspace.ts
export interface ProactiveAISuggestion {
  id: string;
  firmId: string;
  userId: string;
  caseId?: string | null;
  type: ProactiveSuggestionType;
  category: SuggestionCategory;
  title: string;
  description: string;
  suggestedAction?: string | null;
  actionPayload?: Record<string, unknown> | null;
  confidence: number;
  priority: SuggestionPriority;
  context?: Record<string, unknown> | null;
  status: SuggestionStatus;
  dismissedAt?: Date | null;
  dismissReason?: string | null;
  acceptedAt?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Morning briefing types
export interface PrioritizedTask {
  taskId: string;
  priority: number; // 1-10 scale
  priorityReason: string;
  suggestedTimeSlot?: string;
}

export interface DeadlineInfo {
  id: string;
  taskId?: string;
  title: string;
  dueDate: Date;
  daysUntilDue: number;
  severity: 'info' | 'warning' | 'critical';
  caseId?: string;
  case?: {
    id: string;
    title: string;
  };
  suggestedActions: SuggestedAction[];
  blockedBy?: string[];
}

export interface RiskAlert {
  type: string;
  description: string;
  suggestedAction: string;
  severity: 'low' | 'medium' | 'high';
}

export interface SuggestedAction {
  action: string;
  description: string;
  actionType: 'create_task' | 'send_email' | 'schedule_meeting' | 'review_document' | 'navigate';
  payload: Record<string, unknown>;
}

export interface MorningBriefingContent {
  prioritizedTasks: PrioritizedTask[];
  keyDeadlines: DeadlineInfo[];
  riskAlerts: RiskAlert[];
  suggestions: GeneratedSuggestion[];
  summary: string;
  tokensUsed: number;
}

// User action pattern types
export interface DetectedPattern {
  patternType: string;
  description: string;
  triggerContext: Record<string, unknown>;
  actionSequence: ActionStep[];
  occurrenceCount: number;
  confidence: number;
  suggestable: boolean; // Can we suggest this action?
}

export interface ActionStep {
  action: string;
  timestamp?: Date;
  context?: Record<string, unknown>;
}

export interface PatternAnalysisResult {
  patterns: DetectedPattern[];
  newPatterns: DetectedPattern[];
  updatedPatterns: DetectedPattern[];
}

// Document completeness types
export interface MissingItem {
  item: string;
  severity: 'required' | 'recommended' | 'optional';
  section?: string;
  suggestion: string;
}

export interface CompletenessCheckResult {
  documentId: string;
  documentType: string;
  completenessScore: number; // 0.0 - 1.0
  missingItems: MissingItem[];
  suggestions: string[];
}

// Suggestion feedback types
export interface SuggestionFeedbackRecord {
  suggestionId: string;
  action: 'accepted' | 'dismissed' | 'modified' | 'ignored';
  modifiedAction?: Record<string, unknown>;
  feedbackReason?: string;
  responseTimeMs: number;
}

// Deadline warning types
export interface DeadlineWarning {
  taskId?: string;
  caseId: string;
  title: string;
  dueDate: Date;
  daysUntilDue: number;
  severity: 'info' | 'warning' | 'critical';
  suggestedActions: SuggestedAction[];
  blockedBy?: string[]; // Dependent tasks not completed
}

// Suggestion analytics types
export interface SuggestionAnalytics {
  totalSuggestions: number;
  acceptedCount: number;
  dismissedCount: number;
  acceptanceRate: number;
  averageResponseTimeMs: number;
  byType: Record<
    ProactiveSuggestionType,
    {
      count: number;
      acceptanceRate: number;
    }
  >;
  byCategory: Record<
    SuggestionCategory,
    {
      count: number;
      acceptanceRate: number;
    }
  >;
}

// AI prompt templates
export const CONTEXTUAL_SUGGESTION_PROMPT = `
You are an AI assistant for a Romanian law firm platform. Based on the current context, suggest helpful next actions.

USER CONTEXT:
- Current screen: {currentScreen}
- Current case: {caseSummary}
- Recent actions: {recentActions}
- Time of day: {timeOfDay}
- User role: {userRole}

USER PREFERENCES:
- Suggestion level: {aiSuggestionLevel}
- Language: {language}

ACTIVE ITEMS:
- Pending tasks: {pendingTasksSummary}
- Upcoming deadlines: {upcomingDeadlines}
- Unread emails: {unreadEmailCount}

Generate 1-3 relevant suggestions. Each suggestion should:
1. Be actionable and specific
2. Include clear benefit
3. Consider user's current context
4. Respect the suggestion level preference

Return as JSON array:
[{
  "type": "TaskSuggestion" | "PatternMatch" | "DeadlineWarning" | "DocumentCheck" | "FollowUp",
  "category": "Task" | "Communication" | "Document" | "Calendar" | "Compliance",
  "title": string,
  "description": string,
  "suggestedAction": string,
  "actionPayload": object,
  "confidence": number (0-1),
  "priority": "Low" | "Normal" | "High" | "Urgent"
}]
`;

export const MORNING_BRIEFING_PROMPT = `
Generate a morning briefing for a legal professional. Prioritize their tasks and highlight key items for today.

TODAY'S DATE: {date}
USER: {userName} ({userRole})

TASKS DUE TODAY:
{tasksDueToday}

TASKS DUE THIS WEEK:
{tasksDueThisWeek}

OVERDUE TASKS:
{overdueTasks}

UPCOMING DEADLINES:
{upcomingDeadlines}

PENDING EXTRACTED ITEMS:
{pendingExtractions}

RISK INDICATORS:
{activeRisks}

Generate a briefing with:
1. Summary paragraph (2-3 sentences, encouraging tone)
2. Prioritized task list (top 5) with priority reasons
3. Key deadlines to watch
4. Risk alerts requiring attention
5. Proactive suggestions for the day

Prioritize based on:
- Due date urgency (30%)
- Task priority level (25%)
- Client importance (15%)
- Blocking dependencies (15%)
- Historical patterns (15%)

Return as JSON:
{
  "summary": string,
  "prioritizedTasks": [{ "taskId": string, "priority": number (1-10), "priorityReason": string }],
  "keyDeadlines": [{ "title": string, "dueDate": string, "severity": string }],
  "riskAlerts": [{ "type": string, "description": string, "suggestedAction": string }],
  "suggestions": [{ ... }]
}
`;

// Document completeness rules for Romanian legal documents
export const DOCUMENT_COMPLETENESS_RULES: Record<
  string,
  {
    required: string[];
    recommended: string[];
    signatureBlocks: number;
  }
> = {
  Contract: {
    required: ['parties', 'object', 'price', 'signatures', 'date'],
    recommended: ['witnesses', 'notarization'],
    signatureBlocks: 2,
  },
  Motion: {
    required: ['caption', 'court', 'caseNumber', 'prayer', 'signature', 'certificateOfService'],
    recommended: ['exhibits', 'memorandum'],
    signatureBlocks: 1,
  },
  Pleading: {
    required: ['caption', 'allegations', 'relief', 'signature'],
    recommended: ['exhibits'],
    signatureBlocks: 1,
  },
  Letter: {
    required: ['date', 'recipient', 'salutation', 'body', 'closing', 'signature'],
    recommended: ['reference'],
    signatureBlocks: 1,
  },
};
