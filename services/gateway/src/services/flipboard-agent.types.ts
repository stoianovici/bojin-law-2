/**
 * Flipboard Agent Types
 *
 * Types for the user-scoped Flipboard agent that generates
 * actionable items from the user's assigned cases.
 */

// ============================================================================
// Action Types
// ============================================================================

/**
 * Types of actions that can be suggested for a Flipboard item.
 */
export type FlipboardActionType =
  | 'navigate' // Navigate to a page
  | 'view_email' // Open email thread
  | 'reply_email' // Reply to email
  | 'view_document' // Open document viewer
  | 'draft_document' // Start document drafting
  | 'create_task' // Create a new task
  | 'complete_task' // Mark task as complete
  | 'add_note' // Add a note to case
  | 'call_client' // Initiate client call
  | 'schedule' // Schedule a meeting
  | 'snooze' // Snooze/delay the item
  | 'dismiss'; // Dismiss the item

/**
 * A suggested action for a Flipboard item.
 */
export interface FlipboardAction {
  id: string;
  label: string; // Romanian, e.g., "Răspunde", "Revizuiește"
  icon: string; // Lucide icon name
  type: FlipboardActionType;
  href?: string; // For navigate actions
  payload?: Record<string, unknown>; // Additional data for action execution
  isPrimary?: boolean; // Primary action (shown prominently)
}

// ============================================================================
// Item Types
// ============================================================================

/**
 * Priority levels for Flipboard items.
 */
export type FlipboardPriority = 'featured' | 'secondary';

/**
 * Categories of Flipboard items.
 */
export type FlipboardCategory =
  | 'pending_action' // Unaddressed issue requiring action
  | 'alert' // Warning or deadline alert
  | 'news' // Recent change/update
  | 'insight' // Perspective or observation
  | 'summary' // Overview or summary
  | 'upcoming'; // Future event

/**
 * Entity types that can be referenced by a Flipboard item.
 */
export type FlipboardEntityType =
  | 'case'
  | 'email_thread'
  | 'task'
  | 'document'
  | 'deadline'
  | 'client';

/**
 * Source of the Flipboard item (for traceability).
 */
export type FlipboardItemSource =
  | 'pending_email_reply'
  | 'pending_document_review'
  | 'pending_signature'
  | 'pending_submission'
  | 'task_overdue'
  | 'task_due_today'
  | 'task_upcoming'
  | 'deadline_approaching'
  | 'communication_gap'
  | 'case_health_alert'
  | 'new_email_received'
  | 'new_document_uploaded'
  | 'task_completed_by_other'
  | 'hearing_scheduled'
  | 'case_status_changed'
  | 'court_email_received'
  | 'firm_overview'
  | 'case_insight'
  | 'calendar_event'
  | 'client_update'
  | 'weekly_summary'
  | 'email_unassigned'
  | 'case_update'
  | 'email_summary'
  | 'pending_action';

/**
 * A single Flipboard item with actionable content.
 */
export interface FlipboardItem {
  id: string;
  headline: string; // Catchy, max 60 chars
  summary: string; // Brief description, max 150 chars
  priority: FlipboardPriority;
  category: FlipboardCategory;
  source: FlipboardItemSource;

  // Entity linking
  entityType: FlipboardEntityType;
  entityId: string;
  caseId: string;
  caseName: string; // For display, e.g., "Dosar 123/2026"

  // Actionable
  suggestedActions: FlipboardAction[];

  // Metadata
  dueDate?: string; // ISO date for deadline-related items
  actorName?: string; // Who is involved (client name, opposing party, etc.)
  createdAt: string; // When the underlying event occurred
}

// ============================================================================
// Agent Output Types
// ============================================================================

/**
 * Output from the Flipboard agent.
 */
export interface FlipboardAgentOutput {
  items: FlipboardItem[];
  generatedAt: string;
}

// ============================================================================
// Tool Output Types
// ============================================================================

/**
 * A pending action item from user's cases.
 */
export interface PendingActionItem {
  id: string;
  type: 'reply' | 'review' | 'sign' | 'submit' | 'complete' | 'other';
  description: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  entityType: FlipboardEntityType;
  entityId: string;
  dueDate?: string;
  actorName?: string;
  actorId?: string;
  hoursOverdue?: number;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Output from read_my_pending_actions tool.
 */
export interface PendingActionsOutput {
  totalCount: number;
  items: PendingActionItem[];
}

/**
 * A case alert/warning item.
 */
export interface CaseAlertItem {
  id: string;
  type: 'deadline' | 'health' | 'communication' | 'risk' | 'compliance';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  entityType?: FlipboardEntityType;
  entityId?: string;
  dueDate?: string;
  daysUntil?: number;
}

/**
 * Output from read_my_case_alerts tool.
 */
export interface CaseAlertsOutput {
  totalCount: number;
  items: CaseAlertItem[];
}

/**
 * A news/activity item from user's cases.
 */
export interface CaseNewsItem {
  id: string;
  type:
    | 'email_received'
    | 'email_from_court'
    | 'document_uploaded'
    | 'document_received'
    | 'task_completed'
    | 'hearing_scheduled'
    | 'status_changed'
    | 'note_added';
  description: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  entityType: FlipboardEntityType;
  entityId: string;
  actorName?: string;
  occurredAt: string;
  isHighPriority: boolean;
}

/**
 * Output from read_my_case_news tool.
 */
export interface CaseNewsOutput {
  totalCount: number;
  items: CaseNewsItem[];
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * Context passed to the Flipboard agent tools.
 */
export interface FlipboardAgentContext {
  userId: string;
  firmId: string;
  correlationId: string;
  /** Whether the user is a partner (sees all firm cases) */
  isPartner: boolean;
}

// ============================================================================
// Trigger Types
// ============================================================================

/**
 * Types of events that trigger Flipboard regeneration.
 */
export type FlipboardTriggerType = 'login' | 'event' | 'batch' | 'manual' | 'scheduled';

/**
 * High-priority events that trigger immediate regeneration.
 */
export type FlipboardTriggerEvent =
  | 'email_from_court'
  | 'task_overdue'
  | 'deadline_within_48h'
  | 'urgent_document'
  | 'case_health_critical';

// ============================================================================
// Constants
// ============================================================================

/**
 * Constraints for Flipboard generation.
 */
export const FLIPBOARD_CONSTRAINTS = {
  MAX_ITEMS: 20,
  HEADLINE_MAX_CHARS: 60,
  SUMMARY_MAX_CHARS: 150,
  MAX_ACTIONS_PER_ITEM: 4,
  PENDING_RESPONSE_HOURS: 24, // Show emails pending 24h+
  DEADLINE_WARNING_DAYS: 14, // Show deadlines 2 weeks out
  COMMUNICATION_GAP_DAYS: 14, // Flag cases inactive 2 weeks
  UPCOMING_TASK_DAYS: 7, // Show tasks due in next 7 days
  NEWS_HOURS_BACK: 168, // Extended to 7 days for better coverage
} as const;

/**
 * Default action mappings by pending action type.
 */
export const DEFAULT_ACTIONS_BY_TYPE: Record<
  PendingActionItem['type'],
  Omit<FlipboardAction, 'id'>[]
> = {
  reply: [
    { label: 'Răspunde', icon: 'reply', type: 'reply_email', isPrimary: true },
    { label: 'Vezi email', icon: 'mail', type: 'view_email' },
    { label: 'Amână', icon: 'clock', type: 'snooze' },
  ],
  review: [
    { label: 'Revizuiește', icon: 'file-text', type: 'view_document', isPrimary: true },
    { label: 'Adaugă notă', icon: 'sticky-note', type: 'add_note' },
    { label: 'Amână', icon: 'clock', type: 'snooze' },
  ],
  sign: [
    { label: 'Semnează', icon: 'pen-tool', type: 'view_document', isPrimary: true },
    { label: 'Amână', icon: 'clock', type: 'snooze' },
  ],
  submit: [
    { label: 'Pregătește', icon: 'send', type: 'create_task', isPrimary: true },
    { label: 'Vezi dosar', icon: 'folder', type: 'navigate' },
  ],
  complete: [
    { label: 'Finalizează', icon: 'check', type: 'complete_task', isPrimary: true },
    { label: 'Amână', icon: 'clock', type: 'snooze' },
  ],
  other: [
    { label: 'Vezi', icon: 'eye', type: 'navigate', isPrimary: true },
    { label: 'Creează task', icon: 'plus', type: 'create_task' },
  ],
};

/**
 * Default action mappings by alert type.
 */
export const DEFAULT_ACTIONS_BY_ALERT: Record<
  CaseAlertItem['type'],
  Omit<FlipboardAction, 'id'>[]
> = {
  deadline: [
    { label: 'Vezi termen', icon: 'calendar', type: 'navigate', isPrimary: true },
    { label: 'Creează task', icon: 'plus', type: 'create_task' },
  ],
  health: [
    { label: 'Vezi dosar', icon: 'folder', type: 'navigate', isPrimary: true },
    { label: 'Adaugă notă', icon: 'sticky-note', type: 'add_note' },
  ],
  communication: [
    { label: 'Contactează', icon: 'phone', type: 'call_client', isPrimary: true },
    { label: 'Scrie email', icon: 'mail', type: 'draft_document' },
  ],
  risk: [
    { label: 'Analizează', icon: 'alert-triangle', type: 'navigate', isPrimary: true },
    { label: 'Adaugă notă', icon: 'sticky-note', type: 'add_note' },
  ],
  compliance: [
    { label: 'Verifică', icon: 'shield', type: 'navigate', isPrimary: true },
    { label: 'Creează task', icon: 'plus', type: 'create_task' },
  ],
};

/**
 * Default action mappings by news type.
 */
export const DEFAULT_ACTIONS_BY_NEWS: Record<CaseNewsItem['type'], Omit<FlipboardAction, 'id'>[]> =
  {
    email_received: [
      { label: 'Citește', icon: 'mail', type: 'view_email', isPrimary: true },
      { label: 'Răspunde', icon: 'reply', type: 'reply_email' },
    ],
    email_from_court: [
      { label: 'Citește urgent', icon: 'mail', type: 'view_email', isPrimary: true },
      { label: 'Creează task', icon: 'plus', type: 'create_task' },
    ],
    document_uploaded: [
      { label: 'Vezi document', icon: 'file-text', type: 'view_document', isPrimary: true },
      { label: 'Adaugă notă', icon: 'sticky-note', type: 'add_note' },
    ],
    document_received: [
      { label: 'Vezi document', icon: 'file-text', type: 'view_document', isPrimary: true },
      { label: 'Creează task', icon: 'plus', type: 'create_task' },
    ],
    task_completed: [
      { label: 'Vezi', icon: 'check-circle', type: 'navigate', isPrimary: true },
      { label: 'Adaugă notă', icon: 'sticky-note', type: 'add_note' },
    ],
    hearing_scheduled: [
      { label: 'Vezi calendar', icon: 'calendar', type: 'navigate', isPrimary: true },
      { label: 'Pregătește mapă', icon: 'folder', type: 'create_task' },
    ],
    status_changed: [{ label: 'Vezi dosar', icon: 'folder', type: 'navigate', isPrimary: true }],
    note_added: [{ label: 'Vezi notă', icon: 'sticky-note', type: 'navigate', isPrimary: true }],
  };
