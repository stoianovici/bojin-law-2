/**
 * Email Types
 * Type definitions for the email/communications feature
 */

// ============================================================================
// Core Email Types
// ============================================================================

export interface EmailAddress {
  name: string | null;
  address: string;
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  isCurrentUser?: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  filename?: string;
  size: number;
  fileSize?: number;
  mimeType: string;
  contentType?: string;
  url?: string;
  downloadUrl?: string;
  /** Whether this attachment is private (Private-by-Default) */
  isPrivate?: boolean;
}

export interface EmailMessage {
  id: string;
  subject: string;
  bodyContent: string;
  bodyContentClean?: string;
  bodyContentType: 'html' | 'text';
  folderType: 'inbox' | 'sent';
  from: EmailAddress;
  toRecipients: EmailAddress[];
  sentDateTime: string;
  receivedDateTime: string;
  attachments: Attachment[];
  isRead: boolean;
  hasAttachments: boolean;
  /** Whether this email is private (Private-by-Default) */
  isPrivate?: boolean;
  /** When this email was made public (null if never made public) */
  markedPublicAt?: string | null;
}

export interface EmailThread {
  id: string;
  conversationId: string;
  subject: string;
  case: {
    id: string;
    title: string;
    caseNumber: string;
  } | null;
  participantCount: number;
  emails: EmailMessage[];
  lastMessageDate: string;
  hasUnread: boolean;
  hasAttachments: boolean;
  messageCount: number;
  /** Whether this thread is private (Private-by-Default) - derived from first email */
  isPrivate?: boolean;
  /** User ID of the thread owner (for checking ownership) */
  userId?: string;
}

// ============================================================================
// Case Organization Types
// ============================================================================

export interface CaseWithThreads {
  id: string;
  title: string;
  caseNumber: string;
  threads: ThreadPreview[];
  unreadCount: number;
  totalCount: number;
}

/**
 * Client with cases and email threads (Client Grouping)
 * Groups cases under their parent client for hierarchical navigation
 */
export interface ClientWithCases {
  id: string;
  name: string;
  /** Client-level inbox threads (emails attributed to client but not yet assigned to a case) */
  inboxThreads: ThreadPreview[];
  /** Unread count in client inbox */
  inboxUnreadCount: number;
  /** Total threads in client inbox */
  inboxTotalCount: number;
  /** Cases belonging to this client */
  cases: CaseWithThreads[];
  /** Total unread count across all cases (not including inbox) */
  totalUnreadCount: number;
  /** Total thread count across all cases (not including inbox) */
  totalCount: number;
}

export interface ThreadPreview {
  id: string;
  conversationId: string;
  subject: string;
  lastMessageDate: string;
  lastSenderName: string;
  lastSenderEmail: string;
  preview: string;
  isUnread: boolean;
  hasAttachments: boolean;
  messageCount: number;
  linkedCases?: LinkedCase[];
  isSuggestedAssignment?: boolean;
  isPersonal?: boolean;
  personalMarkedBy?: string | null;
  /** Whether this thread/email is private (Private-by-Default) */
  isPrivate?: boolean;
  /** User ID of the email owner (for checking ownership) */
  userId?: string;
}

export interface LinkedCase {
  id: string;
  title: string;
  caseNumber: string;
  isPrimary: boolean;
}

// ============================================================================
// Court Email Types (INSTANȚE)
// ============================================================================

/**
 * Full email from GET_EMAIL query - used when displaying court emails
 */
export interface Email {
  id: string;
  subject: string;
  bodyContent: string;
  bodyContentClean?: string;
  bodyContentType: 'html' | 'text';
  from: EmailAddress;
  toRecipients: EmailAddress[];
  ccRecipients?: EmailAddress[];
  sentDateTime: string;
  receivedDateTime: string;
  hasAttachments: boolean;
  attachments: Attachment[];
  isRead: boolean;
  classificationState?: string;
}

export interface CourtEmail {
  id: string;
  subject: string;
  from: EmailAddress;
  bodyPreview: string;
  receivedDateTime: string;
  hasAttachments: boolean;
  courtName?: string;
  extractedCaseNumbers?: string[];
}

/**
 * Court email group - emails grouped by their GlobalEmailSource (court)
 * Used for displaying court subfolders in INSTANȚE section
 */
export interface CourtEmailGroup {
  /** The GlobalEmailSource ID (court) */
  id: string;
  /** Court name from GlobalEmailSource */
  name: string;
  /** Emails from this court */
  emails: CourtEmail[];
  /** Total count of emails from this court */
  count: number;
}

// ============================================================================
// Uncertain Email Types (NECLAR)
// ============================================================================

export interface CaseSuggestion {
  id: string;
  title: string;
  caseNumber: string;
  confidence: number; // 0.0 - 1.0
}

export interface UncertainEmail {
  id: string;
  conversationId?: string;
  subject: string;
  from: EmailAddress;
  bodyPreview: string;
  receivedDateTime: string;
  hasAttachments: boolean;
  suggestedCases: CaseSuggestion[];
}

// ============================================================================
// Client Inbox Types
// ============================================================================

export interface ClientActiveCase {
  id: string;
  title: string;
  caseNumber: string;
}

// ============================================================================
// Email Sync Types
// ============================================================================

export interface EmailSyncStatus {
  status: string; // 'idle' | 'syncing' | 'error'
  lastSyncAt: string | null;
  emailCount: number;
  pendingCategorization: number;
}

// ============================================================================
// AI Draft Types
// ============================================================================

export type EmailTone = 'Formal' | 'Professional' | 'Brief' | 'Detailed';

export interface AiDraftRequest {
  threadId: string;
  tone?: EmailTone;
  prompt?: string;
  isQuickReply?: boolean;
}

export interface AiDraftResponse {
  id: string;
  body: string;
  subject?: string;
  tone: EmailTone;
  confidence: number;
}

// ============================================================================
// Compose Types
// ============================================================================

export interface ComposeDraft {
  to: string;
  cc: string;
  subject: string;
  body: string;
  attachments: File[];
  caseId?: string;
  replyToThreadId?: string;
  savedAt: string;
}

export interface SendEmailInput {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  attachments?: AttachmentInput[];
  caseId?: string;
}

export interface ReplyEmailInput {
  threadId: string;
  body: string;
  attachments?: AttachmentInput[];
}

export interface AttachmentInput {
  name: string;
  contentType: string;
  content: string; // base64
}

// ============================================================================
// Classification Types
// ============================================================================

export type ClassificationAction =
  | { type: 'assign'; caseId: string }
  | { type: 'ignore' }
  | { type: 'personal' };

export interface ClassificationResult {
  email: {
    id: string;
    classificationState: string;
  };
  case?: {
    id: string;
    title: string;
    caseNumber: string;
  };
  wasIgnored: boolean;
}

// ============================================================================
// View State Types
// ============================================================================

export type EmailViewMode = 'thread' | 'court-email' | 'uncertain-email' | 'none';

export type ThreadViewMode = 'conversation' | 'cards';

export interface EmailViewState {
  mode: EmailViewMode;
  threadId: string | null;
  emailId: string | null;
  caseId: string | null;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface EmailsByCase {
  /** Clients with their cases and email threads (Client Grouping) */
  clients: ClientWithCases[];
  /** Cases with their email threads (flat list, deprecated - use clients instead) */
  cases: CaseWithThreads[];
  unassignedCase: CaseWithThreads | null;
  /** Court emails awaiting case assignment (flat list, deprecated - use courtEmailGroups) */
  courtEmails: CourtEmail[];
  courtEmailsCount: number;
  /** Court emails grouped by source (court name) for INSTANȚE subfolders */
  courtEmailGroups: CourtEmailGroup[];
  uncertainEmails: UncertainEmail[];
  uncertainEmailsCount: number;
}

export interface EmailThreadResponse {
  thread: EmailThread;
}

export interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}
