/**
 * Unified Context System Types
 * Single type system for both Client and Case contexts
 */

import type { UserCorrection } from './ai-context';
import type { ContextTier } from './context-documents';

// ============================================================================
// Entity Type
// ============================================================================

export type ContextEntityType = 'CLIENT' | 'CASE';
export type ContextRefType = 'DOCUMENT' | 'EMAIL' | 'THREAD';
export type ContextSectionId = 'identity' | 'people' | 'documents' | 'communications';

// ============================================================================
// Identity Sections
// ============================================================================

export interface ClientIdentitySection {
  /** Discriminant field for type narrowing */
  entityType: 'CLIENT';
  id: string;
  name: string;
  type: 'individual' | 'company';
  companyType?: string;
  cui?: string;
  registrationNumber?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface CaseIdentitySection {
  /** Discriminant field for type narrowing */
  entityType: 'CASE';
  id: string;
  caseNumber: string;
  title: string;
  type: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  court?: string;
  phase?: string;
  phaseLabel?: string;
  value?: number;
  openedDate: string;
  closedDate?: string;
  summary?: string;
  keywords?: string[];
}

/** Union type with discriminant for type-safe access */
export type IdentitySection = ClientIdentitySection | CaseIdentitySection;

// ============================================================================
// People Sections
// ============================================================================

export interface PersonEntry {
  id?: string;
  name: string;
  role: string;
  roleLabel?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

export interface ClientPeopleSection {
  /** Discriminant field for type narrowing */
  entityType: 'CLIENT';
  administrators: PersonEntry[];
  contacts: PersonEntry[];
  primaryContact?: PersonEntry;
}

export interface ActorEntry {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  organization?: string;
  email?: string;
  emailDomains?: string[];
  phone?: string;
  address?: string;
  communicationNotes?: string;
  preferredTone?: string;
  isClient: boolean;
}

export interface TeamMemberEntry {
  userId: string;
  name: string;
  userRole: string;
  caseRole: string;
  caseRoleLabel: string;
}

export interface CasePeopleSection {
  /** Discriminant field for type narrowing */
  entityType: 'CASE';
  actors: ActorEntry[];
  team: TeamMemberEntry[];
}

/** Union type with discriminant for type-safe access */
export type PeopleSection = ClientPeopleSection | CasePeopleSection;

// ============================================================================
// Documents Section (shared structure)
// ============================================================================

export interface DocumentRef {
  refId: string; // e.g., "DOC-abc12"
  sourceId: string; // Actual document ID
  fileName: string;
  uploadedAt: string;
  documentType?: string;
  summary?: string; // AI summary or user description
  isScan: boolean;
  source: 'uploaded' | 'generated' | 'received' | 'sharepoint';
}

export interface DocumentsSection {
  items: DocumentRef[];
  totalCount: number;
  hasMore: boolean;
}

// ============================================================================
// Communications Section (shared structure)
// ============================================================================

export interface ThreadRef {
  refId: string; // e.g., "THR-xyz89"
  sourceId: string; // Actual ThreadSummary ID for resolution
  conversationId: string;
  subject: string;
  participants: string[];
  lastMessageDate: string;
  messageCount: number;
  overview?: string;
  keyPoints?: string[];
  actionItems?: string[];
  sentiment?: string;
  isUrgent: boolean;
  hasUnread: boolean;
}

export interface EmailRef {
  refId: string; // e.g., "EMAIL-abc12"
  sourceId: string; // Actual email ID
  subject: string;
  from: string;
  receivedAt: string;
  bodyPreview?: string;
  hasAttachments: boolean;
  isImportant: boolean;
}

export interface PendingActionItem {
  id: string;
  type: 'reply' | 'review' | 'sign' | 'submit' | 'other';
  description: string;
  dueDate?: string;
  relatedRefId?: string;
  relatedActorName?: string;
}

export interface CommunicationsSection {
  overview: string; // AI-generated overview of all comms
  threads: ThreadRef[];
  emails: EmailRef[]; // Important individual emails
  totalThreads: number;
  unreadCount: number;
  urgentCount: number;
  pendingActions: PendingActionItem[];
}

// ============================================================================
// Full Context File Structure
// ============================================================================

export interface ContextFileSections {
  identity: IdentitySection;
  people: PeopleSection;
  documents: DocumentsSection;
  communications: CommunicationsSection;
}

export interface ContextFileRecord {
  id: string;
  firmId: string;
  entityType: ContextEntityType;
  clientId?: string;
  caseId?: string;

  // Sections
  identity: IdentitySection;
  people: PeopleSection;
  documents: DocumentsSection;
  communications: CommunicationsSection;

  // Corrections
  userCorrections: UserCorrection[];
  lastCorrectedBy?: string;
  correctionsAppliedAt?: string;

  // Rendered tiers
  contentCritical: string;
  contentStandard: string;
  contentFull: string;
  tokensCritical: number;
  tokensStandard: number;
  tokensFull: number;

  // Parent context (for CASE only)
  parentContextSnapshot?: ClientIdentitySection & { people: ClientPeopleSection };

  // Metadata
  version: number;
  schemaVersion: number;
  generatedAt: string;
  validUntil: string;
}

// ============================================================================
// Reference Types
// ============================================================================

export interface ContextReferenceRecord {
  id: string;
  contextFileId: string;
  refId: string;
  refType: ContextRefType;
  sourceId: string;
  sourceType: 'Document' | 'Email' | 'ThreadSummary';
  title: string;
  summary?: string;
  sourceDate?: string;
  metadata?: Record<string, unknown>;
}

export interface ResolvedReference {
  refId: string;
  refType: ContextRefType;
  sourceId: string;
  title: string;
  summary?: string;
  entityDetails: {
    clientId?: string;
    caseId?: string;
    // For documents
    fileName?: string;
    storagePath?: string;
    graphDriveItemId?: string;
    // For emails
    graphMessageId?: string;
    subject?: string;
    from?: string;
    // For threads
    conversationId?: string;
    messageCount?: number;
  };
}

// ============================================================================
// Service Response Types
// ============================================================================

/**
 * A displayable section of the context file
 */
export interface ContextDisplaySection {
  id: string; // e.g., 'identity', 'people', 'documents', 'communications', 'termene'
  title: string; // Romanian display title
  content: string; // Markdown content
  tokenCount: number;
}

export interface ContextResult {
  entityType: ContextEntityType;
  entityId: string;
  tier: ContextTier;
  content: string; // Markdown for requested tier
  tokenCount: number;
  sections: ContextDisplaySection[]; // Display sections for UI tabs
  references: ContextReferenceInfo[];
  corrections: UserCorrection[];
  version: number;
  generatedAt: string;
  validUntil: string;
}

export interface ContextReferenceInfo {
  refId: string;
  refType: ContextRefType;
  title: string;
  summary?: string;
}

export interface WordAddinContextResult {
  caseId: string;
  clientId: string;
  contextMarkdown: string; // Combined client + case
  clientContext: string; // Separate for flexibility
  caseContext: string;
  references: ContextReferenceInfo[];
  tokenCount: number;
}

export interface EmailReplyContextOptions {
  conversationId?: string;
  targetActorId?: string;
  includeFullThread?: boolean;
}

export interface EmailReplyContextResult {
  caseId: string;
  clientId: string;
  caseContext: string;
  clientContext: string;
  threadContext?: string;
  actorContext?: string;
  references: ContextReferenceInfo[];
  tokenCount: number;
}

// ============================================================================
// Correction Types (reuse existing)
// ============================================================================

export interface AddCorrectionInput {
  entityType: ContextEntityType;
  entityId: string;
  sectionId: string;
  fieldPath?: string;
  correctionType: 'override' | 'append' | 'remove' | 'note';
  originalValue?: string;
  correctedValue: string;
  reason?: string;
}

export interface UpdateCorrectionInput {
  correctionId: string;
  correctedValue?: string;
  reason?: string;
  isActive?: boolean;
}
