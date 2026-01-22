/**
 * Context Documents Types
 * Comprehensive context document system for AI agents
 */

// ============================================================================
// Client Context Document
// ============================================================================

/**
 * Identity information for a client
 */
export interface ClientIdentity {
  name: string;
  type: 'individual' | 'company';
  companyType?: string; // SRL, SA, PFA, etc.
  cui?: string;
  registrationNumber?: string;
  address?: string;
}

/**
 * Contact information for a client
 */
export interface ClientContact {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

/**
 * Relationship summary with the firm
 */
export interface ClientRelationship {
  startDate: string;
  activeCaseCount: number;
  closedCaseCount: number;
  totalEmailCount: number;
  lastActivityDate: string;
}

/**
 * Active case summary for client context (context documents specific)
 */
export interface ClientActiveCaseSummary {
  caseId: string;
  caseNumber: string;
  title: string;
  type: string;
  status: string;
  nextDeadline?: string;
  nextDeadlineDescription?: string;
}

/**
 * Warning types for context documents
 */
export type WarningType =
  | 'billing'
  | 'communication'
  | 'deadline'
  | 'risk'
  | 'relationship'
  | 'compliance';

/**
 * Warning entry for context documents
 */
export interface ContextWarning {
  type: WarningType;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  relatedEntityId?: string;
  relatedEntityType?: 'case' | 'task' | 'document' | 'email';
}

/**
 * Structured content for ClientContextDocument
 */
export interface ClientContextDocumentContent {
  identity: ClientIdentity;
  contacts: {
    primary?: ClientContact;
    administrators: ClientContact[];
    other: ClientContact[];
  };
  relationship: ClientRelationship;
  activeCasesSummary: ClientActiveCaseSummary[];
  warnings: ContextWarning[];
  customNotes?: string;
  generatedAt: string;
}

// ============================================================================
// Case Context Document
// ============================================================================

/**
 * Case identity information
 */
export interface CaseIdentity {
  caseNumber: string;
  title: string;
  type: string;
  status: string;
  court?: string;
  phase?: string;
  value?: number;
  openedDate: string;
  closedDate?: string;
}

/**
 * Condensed client info for case context
 */
export interface CaseClientInfo {
  clientId: string;
  name: string;
  type: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
}

/**
 * Case actor with communication context
 */
export interface CaseActorContext {
  id: string;
  role: string;
  customRoleCode?: string;
  name: string;
  organization?: string;
  email?: string;
  phone?: string;
  communicationNotes?: string;
  preferredTone?: string;
  isClient: boolean;
}

/**
 * Team member context for case context documents
 */
export interface CaseTeamMemberContext {
  userId: string;
  name: string;
  role: string;
  caseRole: string;
}

/**
 * Key document with summary or description
 */
export interface KeyDocumentContext {
  documentId: string;
  fileName: string;
  uploadedAt: string;
  isScan: boolean;
  aiSummary?: string;
  userDescription?: string;
  documentType?: string;
}

/**
 * Timeline phase information
 */
export interface TimelinePhase {
  phase: string;
  startDate: string;
  endDate?: string;
  description?: string;
  isCurrent: boolean;
}

/**
 * Deadline information for case context documents
 */
export interface CaseDeadlineInfo {
  id: string;
  title: string;
  dueDate: string;
  type: string;
  status: 'pending' | 'completed' | 'overdue';
}

/**
 * Recent activity entry
 */
export interface RecentActivity {
  date: string;
  type: 'email' | 'document' | 'task' | 'hearing' | 'note';
  description: string;
  actorName?: string;
}

/**
 * Communication thread summary
 */
export interface CommunicationThreadSummary {
  threadId: string;
  subject: string;
  participants: string[];
  lastMessageDate: string;
  messageCount: number;
  hasUnread: boolean;
}

/**
 * Pending action item
 */
export interface PendingAction {
  id: string;
  type: 'reply' | 'review' | 'sign' | 'submit' | 'other';
  description: string;
  dueDate?: string;
  relatedActorId?: string;
  relatedActorName?: string;
}

/**
 * Per-actor communication history
 */
export interface ActorCommunicationHistory {
  actorId: string;
  actorName: string;
  recentInteractions: {
    date: string;
    type: 'email_sent' | 'email_received' | 'call' | 'meeting';
    summary: string;
  }[];
  pendingResponses: boolean;
  lastContactDate: string;
}

/**
 * Structured content for CaseContextDocument
 */
export interface CaseContextDocumentContent {
  identity: CaseIdentity;
  client: CaseClientInfo;
  actors: CaseActorContext[];
  team: CaseTeamMemberContext[];
  keyDocuments: KeyDocumentContext[];
  timeline: {
    phases: TimelinePhase[];
    deadlines: CaseDeadlineInfo[];
    recentActivity: RecentActivity[];
  };
  communication: {
    threads: CommunicationThreadSummary[];
    pendingActions: PendingAction[];
    actorHistory: ActorCommunicationHistory[];
  };
  warnings: ContextWarning[];
  customNotes?: string;
  generatedAt: string;
}

// ============================================================================
// Agent Context Request
// ============================================================================

/**
 * Agent types that can request context
 */
export type AgentType =
  | 'email_reply'
  | 'email_categorize'
  | 'document_draft'
  | 'document_summarize'
  | 'case_analysis'
  | 'task_creation'
  | 'morning_briefing'
  | 'contract_review'
  | 'deadline_analysis'
  | 'word_addin'
  | 'assistant';

/**
 * Context tier levels
 */
export type ContextTier = 'full' | 'standard' | 'critical';

/**
 * Sections that can be included in context documents
 */
export type ContextDocumentSection =
  | 'identity'
  | 'client'
  | 'actors'
  | 'team'
  | 'documents'
  | 'timeline'
  | 'communication'
  | 'warnings'
  | 'customNotes';

/**
 * Request for agent context
 */
export interface AgentContextRequest {
  caseId: string;
  agentType: AgentType;
  tier: ContextTier;
  sections?: ContextDocumentSection[];
  targetActorId?: string; // For email reply - focus on specific actor
  threadId?: string; // For email reply - include thread context
  documentId?: string; // For document-related agents
}

/**
 * Response containing agent context
 */
export interface AgentContextResponse {
  caseId: string;
  clientId: string;
  agentType: AgentType;
  tier: ContextTier;
  contextMarkdown: string;
  tokenCount: number;
  version: number;
  generatedAt: string;
  validUntil: string;
  includedSections: ContextDocumentSection[];
}

// ============================================================================
// Agent Section Mapping
// ============================================================================

/**
 * Default section mapping for each agent type
 */
export const AGENT_SECTION_DEFAULTS: Record<
  AgentType,
  { tier: ContextTier; sections: ContextDocumentSection[] }
> = {
  email_reply: {
    tier: 'full',
    sections: ['identity', 'client', 'actors', 'communication', 'warnings'],
  },
  email_categorize: {
    tier: 'standard',
    sections: ['identity', 'actors'],
  },
  document_draft: {
    tier: 'full',
    sections: ['identity', 'client', 'actors', 'team', 'documents', 'timeline'],
  },
  document_summarize: {
    tier: 'critical',
    sections: ['identity'],
  },
  case_analysis: {
    tier: 'full',
    sections: [
      'identity',
      'client',
      'actors',
      'team',
      'documents',
      'timeline',
      'communication',
      'warnings',
      'customNotes',
    ],
  },
  task_creation: {
    tier: 'standard',
    sections: ['identity', 'team', 'timeline'],
  },
  morning_briefing: {
    tier: 'standard',
    sections: ['identity', 'timeline', 'warnings'],
  },
  contract_review: {
    tier: 'full',
    sections: ['identity', 'client', 'actors', 'documents', 'warnings'],
  },
  deadline_analysis: {
    tier: 'full',
    sections: ['identity', 'timeline', 'warnings'],
  },
  word_addin: {
    tier: 'full',
    sections: ['identity', 'client', 'actors', 'team', 'documents', 'timeline', 'warnings'],
  },
  assistant: {
    tier: 'full',
    sections: [
      'identity',
      'client',
      'actors',
      'team',
      'documents',
      'timeline',
      'communication',
      'warnings',
      'customNotes',
    ],
  },
};

// ============================================================================
// Invalidation Events
// ============================================================================

/**
 * Events that trigger context document invalidation
 */
export type InvalidationEvent =
  | 'client_updated'
  | 'case_updated'
  | 'actor_added'
  | 'actor_updated'
  | 'actor_removed'
  | 'document_uploaded'
  | 'document_description_added'
  | 'document_removed'
  | 'email_classified'
  | 'task_created'
  | 'task_completed'
  | 'deadline_added'
  | 'team_member_added'
  | 'team_member_removed'
  | 'case_status_changed'
  | 'manual_refresh';

/**
 * Invalidation request payload
 */
export interface ContextInvalidationPayload {
  event: InvalidationEvent;
  clientId?: string;
  caseId?: string;
  entityId?: string;
  entityType?: string;
  timestamp: string;
}

// ============================================================================
// Document Description
// ============================================================================

/**
 * Document description update request
 */
export interface SetDocumentDescriptionInput {
  documentId: string;
  description: string;
}

/**
 * Document description with metadata
 */
export interface DocumentDescription {
  documentId: string;
  description: string;
  describedBy: string;
  describedByName: string;
  describedAt: string;
}

// ============================================================================
// Context Document Database Models (for service layer)
// ============================================================================

/**
 * Client context document as stored in database
 */
export interface ClientContextDocumentRecord {
  id: string;
  clientId: string;
  firmId: string;
  content: ClientContextDocumentContent;
  contextFull: string;
  contextStandard: string | null;
  contextCritical: string | null;
  tokenCountFull: number;
  tokenCountStandard: number | null;
  tokenCountCritical: number | null;
  version: number;
  generatedAt: Date;
  validUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Case context document as stored in database
 */
export interface CaseContextDocumentRecord {
  id: string;
  caseId: string;
  firmId: string;
  content: CaseContextDocumentContent;
  contextFull: string;
  contextStandard: string | null;
  contextCritical: string | null;
  tokenCountFull: number;
  tokenCountStandard: number | null;
  tokenCountCritical: number | null;
  clientContextSnapshot: ClientContextDocumentContent | null;
  version: number;
  generatedAt: Date;
  validUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}
