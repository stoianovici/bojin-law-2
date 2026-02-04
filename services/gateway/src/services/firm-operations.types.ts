/**
 * Firm Operations Agent Types
 *
 * Shared TypeScript interfaces for the Firm Operations agent.
 * Used across handlers, agent service, and GraphQL resolvers.
 *
 * V2 (Editor-in-Chief Model): The agent makes editorial decisions about
 * visual hierarchy through slot placement (lead/secondary/tertiary) rather
 * than severity-based classification.
 */

// ============================================================================
// V2 Editorial Types (Editor-in-Chief Model)
// ============================================================================

/**
 * Edition mood - guides agent editorial decisions (internal, not displayed in UI).
 */
export type EditionMood = 'urgent' | 'focused' | 'celebratory' | 'steady' | 'cautious';

/**
 * Optional urgency badge for individual stories.
 * Used sparingly for subtle emphasis, not layout-driving.
 */
export type StoryUrgency = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Category of the story for filtering/grouping.
 */
export type StoryCategory = 'client' | 'team' | 'deadline' | 'email' | 'case';

/**
 * Entity type referenced by a story item.
 * Expanded to support anchor-to-parent linking for all navigable entities.
 */
export type StoryEntityType =
  | 'case'
  | 'client'
  | 'user'
  | 'email_thread'
  | 'task'
  | 'document'
  | 'event'
  | 'deadline';

/**
 * Status of a detail item within a story.
 */
export type StoryDetailStatus = 'on_track' | 'at_risk' | 'overdue';

/**
 * A single detail within an expanded story item.
 * Pre-computed during generation for instant UI rendering.
 */
export interface StoryDetail {
  id: string;
  title: string;
  subtitle: string;
  dueDate?: string;
  dueDateLabel?: string;
  status?: StoryDetailStatus;
  href: string;
  metadata?: Record<string, unknown>;
}

/**
 * A single story item in the briefing.
 * Agent assigns these to slots (lead/secondary/tertiary) based on editorial judgment.
 */
export interface StoryItem {
  id: string;
  headline: string; // Captivating, max 60 chars
  summary: string; // Clear, max 150 chars
  details: StoryDetail[];
  category: StoryCategory;
  urgency?: StoryUrgency; // Optional badge, not layout-driving
  href?: string; // Primary navigation link
  entityType?: StoryEntityType;
  entityId?: string;
  parentType?: 'case' | 'client'; // Parent entity type for anchor linking
  parentId?: string; // Parent entity ID (e.g., caseId for tasks/docs)
  dueDate?: string; // ISO date for tasks/deadlines (used for calendar linking)
  canAskFollowUp?: boolean;
}

/**
 * A section with dynamic title (secondary or tertiary).
 */
export interface BriefingSection {
  title: string; // e.g., "Termene Importante", "Pe Scurt"
  items: StoryItem[];
}

/**
 * Edition metadata for the briefing.
 */
export interface BriefingEdition {
  date: string; // ISO date string
  mood: EditionMood;
  editorNote?: string; // Optional internal note from agent
}

/**
 * V2 Briefing structure - Editor-in-Chief model.
 * Agent decides slot placement based on editorial judgment.
 */
export interface FirmBriefingV2 {
  edition: BriefingEdition;
  lead: StoryItem[]; // 1-2 items, full prominence
  secondary: BriefingSection; // Dynamic title + items
  tertiary: BriefingSection; // Dynamic title + compact items
  quickStats: QuickStats;
}

/**
 * V2 Agent output structure.
 */
export interface FirmOperationsAgentOutputV2 {
  edition: BriefingEdition;
  lead: StoryItem[];
  secondary: BriefingSection;
  tertiary: BriefingSection;
  quickStats: QuickStats;
  toolErrors?: string[];
}

// Constraints for V2 structure
export const BRIEFING_CONSTRAINTS = {
  LEAD_MIN: 1,
  LEAD_MAX: 2,
  HEADLINE_MAX_CHARS: 60,
  SUMMARY_MAX_CHARS: 150,
} as const;

// ============================================================================
// V1 Legacy Types (Deprecated - for backwards compatibility)
// ============================================================================

/** @deprecated Use StoryUrgency instead */
export type BriefingItemSeverity = 'critical' | 'warning' | 'info';
/** @deprecated Use StoryCategory instead */
export type BriefingItemCategory = 'client' | 'team' | 'deadline' | 'email' | 'case';
/** @deprecated Use StoryEntityType instead */
export type BriefingEntityType = StoryEntityType;
/** @deprecated Use StoryDetailStatus instead */
export type BriefingDetailStatus = 'on_track' | 'at_risk' | 'overdue';

/**
 * A single detail item within an expanded briefing item.
 * Pre-computed during generation for instant UI rendering.
 */
export interface FirmBriefingDetail {
  id: string;
  title: string; // e.g., "Dosar 123/2026 - Întâmpinare"
  subtitle: string; // e.g., "Gata pentru depunere, așteaptă semnătură"
  dueDate?: string; // ISO date
  dueDateLabel?: string; // e.g., "Vineri"
  status?: BriefingDetailStatus;
  href: string; // Link to entity: "/cases/uuid"
  metadata?: Record<string, unknown>; // Additional context for follow-up
}

/**
 * A single item in the briefing widget.
 * Shows collapsed headline + summary, expands to show pre-computed details.
 */
export interface FirmBriefingItem {
  id: string;
  severity: BriefingItemSeverity;
  category: BriefingItemCategory;
  icon: string; // Lucide icon name
  headline: string; // e.g., "Client X - termene multiple"
  summary: string; // e.g., "3 cazuri cu termene în următoarele 5 zile"

  // Pre-computed expansion data (renders instantly on expand)
  details: FirmBriefingDetail[];

  // For navigation + follow-up
  entityType: BriefingEntityType;
  entityId: string;
  canAskFollowUp: boolean;
}

// ============================================================================
// Quick Stats Types
// ============================================================================

/**
 * Quick stats shown at the bottom of the briefing widget.
 */
export interface QuickStats {
  activeCases: number;
  urgentTasks: number;
  teamUtilization: number; // 0-100 percentage
  unreadEmails: number;
  overdueItems: number;
  upcomingDeadlines: number; // Next 7 days
}

// ============================================================================
// Agent Output Types
// ============================================================================

/**
 * Structured output from the Firm Operations agent.
 */
export interface FirmOperationsAgentOutput {
  // Narrative content for greeting area
  summary: string;

  // Structured items for interactive UI
  items: FirmBriefingItem[];

  // Quick stats for footer
  quickStats: QuickStats;

  // Partial failure tracking
  toolErrors?: string[];
}

// ============================================================================
// Tool Handler Types
// ============================================================================

/**
 * Context passed to tool handlers.
 * Includes firm/user info and role for authorization.
 */
export interface FirmOperationsToolContext {
  firmId: string;
  userId: string;
  userRole: string;
  isPartner: boolean;
  correlationId: string;
}

// ============================================================================
// Tool Output Types
// ============================================================================

/**
 * Output from read_active_cases_summary tool.
 */
export interface ActiveCasesSummary {
  totalActive: number;
  byStatus: Record<string, number>;
  urgentCases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    clientName: string;
    healthScore: number;
    nextDeadline?: string;
    assignedTo: string[];
  }>;
  riskAlerts: Array<{
    caseId: string;
    caseNumber: string;
    title: string;
    alertType: string;
    message: string;
  }>;
}

/**
 * Output from read_deadlines_overview tool.
 */
export interface DeadlinesOverview {
  today: DeadlineGroup;
  thisWeek: DeadlineGroup;
  nextTwoWeeks: DeadlineGroup;
  conflicts: Array<{
    date: string;
    deadlines: DeadlineItem[];
  }>;
}

export interface DeadlineGroup {
  count: number;
  items: DeadlineItem[];
}

export interface DeadlineItem {
  id: string;
  caseId: string;
  caseNumber: string;
  title: string;
  type: string;
  dueDate: string;
  dueTime?: string;
  assignedTo: string;
  priority: string;
  status: string;
}

/**
 * Output from read_team_workload tool.
 */
export interface TeamWorkload {
  members: Array<{
    userId: string;
    name: string;
    role: string;
    activeTasks: number;
    overdueTasks: number;
    upcomingTasks: number;
    utilizationScore: number; // 0-100
    status: 'available' | 'busy' | 'overloaded';
  }>;
  firmTotals: {
    totalActiveTasks: number;
    totalOverdueTasks: number;
    averageUtilization: number;
  };
}

/**
 * Output from read_client_portfolio tool.
 */
export interface ClientPortfolio {
  totalClients: number;
  activeClients: number;
  clients: Array<{
    id: string;
    name: string;
    activeCases: number;
    totalCases: number;
    lastActivityDate: string;
    daysSinceActivity: number;
    needsAttention: boolean;
    totalValue?: number;
  }>;
  needsAttention: Array<{
    clientId: string;
    clientName: string;
    reason: string;
    daysSinceActivity: number;
  }>;
}

/**
 * Output from read_email_status tool.
 */
export interface EmailStatus {
  unreadCount: number;
  pendingResponses: Array<{
    conversationId: string;
    subject: string;
    caseId?: string;
    caseNumber?: string;
    lastSentAt: string;
    hoursSinceSent: number;
    sentBy: string;
  }>;
  awaitingAction: Array<{
    conversationId: string;
    subject: string;
    caseId?: string;
    caseNumber?: string;
    actionRequired: string;
    receivedAt: string;
  }>;
  byCase?: Record<
    string,
    {
      caseNumber: string;
      unread: number;
      pending: number;
    }
  >;
}

/**
 * Output from read_platform_metrics tool.
 */
export interface PlatformMetrics {
  healthScore: number; // 0-100
  taskCompletionRate: number; // 0-100
  aiAdoptionRate: number; // 0-100
  trends?: {
    healthScoreChange: number;
    taskCompletionChange: number;
    aiAdoptionChange: number;
  };
  weeklyStats: {
    tasksCompleted: number;
    documentsGenerated: number;
    emailsProcessed: number;
    comprehensionsGenerated: number;
  };
}

// ============================================================================
// Follow-up Types
// ============================================================================

/**
 * Input for follow-up questions.
 */
export interface BriefingFollowUpInput {
  briefingItemId: string;
  question: string;
  entityType: BriefingEntityType;
  entityId: string;
}

/**
 * Output for follow-up answers.
 */
export interface BriefingFollowUpOutput {
  answer: string;
  suggestedActions: Array<{
    label: string;
    href: string;
  }>;
}
