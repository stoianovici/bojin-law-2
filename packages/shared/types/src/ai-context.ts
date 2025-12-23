/**
 * AI Context Files Types
 * OPS-115: Data model types for AI context optimization
 *
 * These types support:
 * - User activity event tracking
 * - Pre-computed daily context for fast AI access
 * - Per-case briefings for context-aware conversations
 */

// ============================================================================
// Enums (matching Prisma schema)
// ============================================================================

/**
 * Types of activity events tracked for users
 */
export enum ActivityEventType {
  // Email events
  EMAIL_RECEIVED = 'EMAIL_RECEIVED',
  EMAIL_CLASSIFIED = 'EMAIL_CLASSIFIED',
  EMAIL_FROM_COURT = 'EMAIL_FROM_COURT',

  // Document events
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  DOCUMENT_SHARED = 'DOCUMENT_SHARED',

  // Task events
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_DUE_TODAY = 'TASK_DUE_TODAY',
  TASK_OVERDUE = 'TASK_OVERDUE',
  TASK_COMPLETED = 'TASK_COMPLETED',

  // Case events
  CASE_DEADLINE_APPROACHING = 'CASE_DEADLINE_APPROACHING',
  CASE_HEARING_TODAY = 'CASE_HEARING_TODAY',
  CASE_STATUS_CHANGED = 'CASE_STATUS_CHANGED',

  // Calendar events
  CALENDAR_EVENT_TODAY = 'CALENDAR_EVENT_TODAY',
  CALENDAR_EVENT_REMINDER = 'CALENDAR_EVENT_REMINDER',
}

/**
 * Entity types for activity events
 */
export enum ActivityEntityType {
  EMAIL = 'EMAIL',
  DOCUMENT = 'DOCUMENT',
  TASK = 'TASK',
  CASE = 'CASE',
  CALENDAR_EVENT = 'CALENDAR_EVENT',
}

/**
 * Importance levels for events
 */
export enum EventImportance {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

// ============================================================================
// UserActivityEvent Types
// ============================================================================

/**
 * User activity event record
 */
export interface UserActivityEvent {
  id: string;
  userId: string;
  firmId: string;

  eventType: ActivityEventType;
  entityType: ActivityEntityType;
  entityId: string;
  entityTitle?: string;

  metadata?: Record<string, unknown>;
  importance: EventImportance;

  notified: boolean;
  seenAt?: Date;

  occurredAt: Date;
  createdAt: Date;
}

/**
 * Input for creating a new activity event
 */
export interface CreateActivityEventInput {
  userId: string;
  firmId: string;
  eventType: ActivityEventType;
  entityType: ActivityEntityType;
  entityId: string;
  entityTitle?: string;
  metadata?: Record<string, unknown>;
  importance?: EventImportance;
  occurredAt?: Date;
}

// ============================================================================
// UserDailyContext Types
// ============================================================================

/**
 * Schedule event for today's context
 */
export interface TodayScheduleEvent {
  id: string;
  type: 'hearing' | 'meeting' | 'deadline' | 'task';
  title: string;
  time?: string;
  caseId?: string;
  caseName?: string;
}

/**
 * Urgent item requiring attention
 */
export interface UrgentItem {
  type: 'overdue_task' | 'court_email' | 'deadline_today';
  title: string;
  entityId: string;
  caseId?: string;
  daysOverdue?: number;
}

/**
 * Recent activity entry
 */
export interface RecentActivityEntry {
  type: ActivityEventType;
  title: string;
  entityId: string;
  occurredAt: string;
}

/**
 * Active case summary
 */
export interface ActiveCaseSummary {
  id: string;
  name: string;
  nextDeadline?: string;
  unreadEmails: number;
  recentActivity: boolean;
}

/**
 * User context data stored in UserDailyContext.contextData
 */
export interface UserContextData {
  // Summary counts
  newEmailsCount: number;
  newDocumentsCount: number;
  pendingTasksCount: number;
  overdueTasksCount: number;

  // Today's schedule
  todayEvents: TodayScheduleEvent[];

  // Urgent items
  urgentItems: UrgentItem[];

  // Recent activity (last 24h)
  recentActivity: RecentActivityEntry[];

  // Active cases summary
  activeCases: ActiveCaseSummary[];
}

/**
 * User daily context record
 */
export interface UserDailyContext {
  id: string;
  userId: string;
  firmId: string;

  contextData: UserContextData;

  lastComputedAt: Date;
  lastBriefingAt?: Date;
  lastSeenEventId?: string;

  validUntil: Date;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// CaseBriefing Types
// ============================================================================

/**
 * Party information in case briefing
 */
export interface CaseBriefingParty {
  role: string;
  name: string;
  isClient: boolean;
}

/**
 * Deadline information in case briefing
 */
export interface CaseBriefingDeadline {
  date: string;
  description: string;
}

/**
 * Recent event in case briefing
 */
export interface CaseBriefingEvent {
  date: string;
  type: string;
  description: string;
}

/**
 * Case briefing data stored in CaseBriefing.briefingData
 */
export interface CaseBriefingData {
  // Basic info
  caseNumber: string;
  title: string;
  status: string;
  court?: string;

  // Parties
  parties: CaseBriefingParty[];

  // Timeline
  nextDeadline?: CaseBriefingDeadline;
  recentEvents: CaseBriefingEvent[];

  // Counts
  documentCount: number;
  emailCount: number;
  unreadEmailCount: number;
  pendingTaskCount: number;

  // Optional breakdowns
  documentsByCategory?: Record<string, number>;
}

/**
 * Case briefing record
 */
export interface CaseBriefing {
  id: string;
  caseId: string;
  firmId: string;

  briefingText: string;
  briefingData: CaseBriefingData;

  lastComputedAt: Date;
  validUntil: Date;

  lastEmailAt?: Date;
  lastDocumentAt?: Date;
  lastTaskAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Service Input/Output Types
// ============================================================================

/**
 * Options for computing user daily context
 */
export interface ComputeUserContextOptions {
  userId: string;
  firmId: string;
  forceRefresh?: boolean;
}

/**
 * Options for computing case briefing
 */
export interface ComputeCaseBriefingOptions {
  caseId: string;
  firmId: string;
  forceRefresh?: boolean;
}

/**
 * Options for querying activity events
 */
export interface QueryActivityEventsOptions {
  userId: string;
  eventTypes?: ActivityEventType[];
  entityTypes?: ActivityEntityType[];
  importance?: EventImportance[];
  notified?: boolean;
  since?: Date;
  limit?: number;
}

/**
 * Notification for unread events
 */
export interface PendingNotification {
  event: UserActivityEvent;
  priority: number;
}

/**
 * Result of marking events as seen
 */
export interface MarkEventsSeenResult {
  count: number;
  lastEventId: string;
}
