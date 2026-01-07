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
  cases: CaseWithThreads[];
  unassignedCase: CaseWithThreads | null;
  courtEmails: CourtEmail[];
  courtEmailsCount: number;
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
