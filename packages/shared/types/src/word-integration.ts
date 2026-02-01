/**
 * Word Integration Types
 * Story 3.4: Word Integration with Live AI Assistance
 *
 * Type definitions for Word integration, document locking, and sync operations.
 */

// ============================================================================
// Document Lock Types
// ============================================================================

/**
 * Session type for document locks
 */
export type DocumentLockSessionType = 'word_desktop' | 'word_online' | 'platform';

/**
 * Document lock data stored in Redis
 */
export interface DocumentLockRedisData {
  userId: string;
  lockToken: string;
  expiresAt: string; // ISO timestamp
  sessionType: DocumentLockSessionType;
  lockedAt: string; // ISO timestamp
}

/**
 * Document lock from database
 */
export interface DocumentLock {
  id: string;
  documentId: string;
  userId: string;
  lockToken: string;
  lockedAt: Date;
  expiresAt: Date;
  sessionType: DocumentLockSessionType;
}

/**
 * Document lock with user details
 */
export interface DocumentLockWithUser extends DocumentLock {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

// ============================================================================
// Word Edit Session Types
// ============================================================================

/**
 * Word edit session returned when opening a document in Word
 * OPS-181: Updated to support SharePoint-first flow
 */
export interface WordEditSession {
  documentId: string;
  wordUrl: string | null; // ms-word:ofe|u| protocol URL for desktop Word
  webUrl?: string | null; // Word Online URL (fallback if desktop Word not installed)
  lockToken: string;
  expiresAt: Date;
  oneDriveId: string | null; // For legacy documents, null for SharePoint-first
  sharePointItemId: string | null; // For SharePoint-first flow, null for legacy OneDrive
}

/**
 * Parameters for opening a document in Word
 */
export interface OpenInWordParams {
  documentId: string;
  userId: string;
  accessToken: string;
}

/**
 * Result of closing a Word session
 */
export interface CloseWordSessionResult {
  success: boolean;
  synced: boolean;
  newVersionNumber?: number;
}

// ============================================================================
// Document Comment Types
// ============================================================================

/**
 * Document comment from database
 */
export interface DocumentComment {
  id: string;
  documentId: string;
  versionId?: string;
  authorId: string;
  content: string;
  anchorText?: string;
  anchorStart?: number;
  anchorEnd?: number;
  wordCommentId?: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Document comment with author details
 */
export interface DocumentCommentWithAuthor extends DocumentComment {
  author: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  resolvedByUser?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

/**
 * Parameters for creating a document comment
 */
export interface CreateCommentParams {
  documentId: string;
  authorId: string;
  content: string;
  anchorText?: string;
  anchorStart?: number;
  anchorEnd?: number;
  wordCommentId?: string;
}

// ============================================================================
// Track Changes Types
// ============================================================================

/**
 * Types of changes tracked in Word documents
 */
export type TrackChangeType = 'INSERTION' | 'DELETION' | 'MODIFICATION' | 'FORMAT_CHANGE';

/**
 * Track change extracted from Word document
 */
export interface TrackChange {
  id: string;
  type: TrackChangeType;
  authorId?: string;
  authorName: string;
  content: string;
  originalContent?: string;
  timestamp: Date;
  paragraphIndex?: number;
}

/**
 * Track changes summary for a document version
 */
export interface TrackChangesSummary {
  totalChanges: number;
  insertions: number;
  deletions: number;
  modifications: number;
  formatChanges: number;
  authors: string[];
  summary: string;
}

// ============================================================================
// Sync Types
// ============================================================================

/**
 * Sync status for document-OneDrive synchronization
 */
export type DocumentSyncStatus = 'synced' | 'syncing' | 'pending_changes' | 'error';

/**
 * Sync result from OneDrive
 */
export interface DocumentSyncResult {
  updated: boolean;
  newVersionNumber?: number;
  trackChanges?: TrackChange[];
  comments?: DocumentComment[];
  error?: string;
}

/**
 * OneDrive file change notification
 */
export interface DriveItemNotification {
  subscriptionId: string;
  clientState: string;
  changeType: 'created' | 'updated' | 'deleted';
  resource: string;
  resourceData?: {
    id: string;
    '@odata.type': string;
    '@odata.id': string;
  };
}

// ============================================================================
// Word Add-in API Types
// ============================================================================

/**
 * Suggestion types for Word add-in
 */
export type SuggestionType = 'completion' | 'alternative' | 'precedent';

/**
 * Improvement types for text improvement suggestions
 */
export type ImprovementType = 'clarity' | 'formality' | 'brevity' | 'legal_precision';

/**
 * AI suggestion for Word add-in
 */
export interface WordAISuggestion {
  id: string;
  type: SuggestionType;
  content: string;
  confidence: number;
  source?: string; // Template or precedent ID
  reasoning?: string;
}

/**
 * Request for AI suggestions
 */
export interface WordSuggestionRequest {
  documentId?: string;
  selectedText: string;
  cursorContext: string;
  suggestionType: SuggestionType;
  caseId?: string;
  customInstructions?: string;
}

/**
 * Response with AI suggestions
 */
export interface WordSuggestionResponse {
  suggestions: WordAISuggestion[];
  processingTimeMs: number;
}

/**
 * Request for text explanation
 */
export interface WordExplainRequest {
  documentId?: string;
  selectedText: string;
  caseId?: string;
  customInstructions?: string;
}

/**
 * Response with text explanation
 */
export interface WordExplainResponse {
  explanation: string;
  legalBasis?: string;
  sourceReferences?: string[];
  processingTimeMs: number;
}

/**
 * Request for text improvement
 */
export interface WordImproveRequest {
  documentId?: string;
  selectedText: string;
  improvementType: ImprovementType;
  caseId?: string;
  customInstructions?: string;
}

/**
 * Response with text improvement
 */
export interface WordImproveResponse {
  original: string;
  improved: string;
  /** OOXML fragment for style-aware insertion via Word's insertOoxml() API */
  ooxmlContent?: string;
  explanation: string;
  processingTimeMs: number;
}

/**
 * Context type for Word AI drafting
 */
export type WordDraftContextType = 'case' | 'client' | 'internal';

/**
 * Source types available for research documents
 */
export type ResearchSourceType = 'legislation' | 'jurisprudence' | 'doctrine' | 'comparative';

/**
 * Research depth options
 * - quick: ~1500 words, fast (10 search rounds)
 * - standard: ~3000 words, balanced (20 search rounds)
 * - deep: ~6000 words, thorough (30 search rounds)
 */
export type ResearchDepth = 'quick' | 'standard' | 'deep';

/**
 * Court filing form category (A = complex, B = response, C = simple)
 */
export type CourtFilingFormCategory = 'A' | 'B' | 'C';

/**
 * Template metadata for court filing documents.
 * Passed from frontend to backend to guide AI generation.
 */
export interface CourtFilingTemplateMetadata {
  /** Template name (e.g., "Cerere de chemare în judecată") */
  name: string;
  /** CPC article references (e.g., ["Art. 194", "Art. 195"]) */
  cpcArticles: string[];
  /** Party role labels for this template type */
  partyLabels: {
    party1: string;
    party2: string;
    party3?: string;
  };
  /** Required sections that must appear in the document */
  requiredSections: string[];
  /** Form category: A = complex pleadings, B = responses, C = simple motions */
  formCategory: CourtFilingFormCategory;
  /** Template category for grouping */
  category?: string;
  /** Template description for context */
  description?: string;
}

/**
 * Word AI draft request (freeform, no template)
 */
export interface WordDraftRequest {
  contextType: WordDraftContextType;
  caseId?: string; // Required when contextType is 'case'
  clientId?: string; // Required when contextType is 'client'
  documentName: string;
  prompt: string;
  existingContent?: string; // Current document content for context
  /** Explicit toggle to enable web search for research documents */
  enableWebSearch?: boolean;
  /** Use two-phase research architecture (research agent → writing agent) for better academic quality */
  useTwoPhaseResearch?: boolean;
  /** Use multi-agent research (4-phase: research → outline → section writers → assembly) for guaranteed footnote consistency */
  useMultiAgent?: boolean;
  /** Include OOXML in response (for non-streaming requests) */
  includeOoxml?: boolean;
  /** Source types for research: determines breadth (more sources = more sections) */
  sourceTypes?: ResearchSourceType[];
  /** Research depth: 'quick' for superficial, 'deep' for thorough analysis */
  researchDepth?: ResearchDepth;
  /** Template ID for court filing documents (e.g., "CF-01") */
  templateId?: string;
  /** Template metadata for court filing documents - guides AI generation */
  templateMetadata?: CourtFilingTemplateMetadata;
}

/**
 * Validation result for court filing documents.
 * Returned after generation to warn about missing sections.
 */
export interface CourtFilingValidationResult {
  /** Whether the document contains all required sections */
  valid: boolean;
  /** List of required sections that are missing from the generated content */
  missingSections: string[];
  /** List of sections that were found in the document */
  foundSections: string[];
  /** Validation warnings (non-blocking issues) */
  warnings?: string[];
}

/**
 * Word AI draft response
 */
export interface WordDraftResponse {
  content: string;
  /** OOXML fragment for style-aware insertion via Word's insertOoxml() API */
  ooxmlContent?: string;
  title: string;
  tokensUsed: number;
  processingTimeMs: number;
  /** Validation result for court filing documents */
  validation?: CourtFilingValidationResult;
}

/**
 * Word AI draft from template request
 */
export interface WordDraftFromTemplateRequest {
  templateId: string;
  caseId: string;
  customInstructions?: string;
  placeholderValues?: Record<string, string>;
}

/**
 * Word AI draft from template response
 */
export interface WordDraftFromTemplateResponse {
  content: string;
  /** OOXML fragment for style-aware insertion via Word's insertOoxml() API */
  ooxmlContent?: string;
  title: string;
  templateUsed: {
    id: string;
    name: string;
  };
  tokensUsed: number;
  processingTimeMs: number;
}

/**
 * Word content template
 */
export interface WordContentTemplate {
  id: string;
  firmId: string;
  name: string;
  description?: string;
  caseType?: string;
  documentType: string;
  category?: string;
  tags: string[];
  usageCount: number;
  isActive: boolean;
}

// ============================================================================
// Streaming Progress Event Types (Epic 6.8)
// ============================================================================

/**
 * Progress event type for streaming updates
 */
export type WordProgressEventType =
  | 'phase_start'
  | 'phase_complete'
  | 'search'
  | 'thinking'
  | 'writing'
  | 'formatting'
  | 'error';

/**
 * Phase identifier for progress tracking
 */
export type WordProgressPhase = 'research' | 'writing' | 'formatting';

/**
 * Detailed progress event for streaming updates to the UI.
 * Epic 6.8: Enhanced streaming progress
 *
 * Progress percentage breakdown:
 * - Research phase: 0-40%
 * - Thinking phase: 40-50%
 * - Writing phase: 50-90%
 * - Formatting phase: 90-100%
 */
export interface WordProgressEvent {
  /** Event type for UI handling */
  type: WordProgressEventType;
  /** Current phase of the pipeline */
  phase?: WordProgressPhase;
  /** Human-readable status message (Romanian) */
  text: string;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Search query for 'search' events */
  query?: string;
  /** Partial content for 'writing' events */
  partialContent?: string;
  /** Tool name for 'tool_use' events */
  tool?: string;
  /** Tool input for debugging */
  input?: Record<string, unknown>;
  /** Whether this is a retry attempt (for error events) */
  retrying?: boolean;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Word integration configuration
 */
export interface WordIntegrationConfig {
  lockTtlSeconds: number;
  syncIntervalSeconds: number;
  webhookSecret: string;
  addInUrl: string;
}

/**
 * Redis key patterns for document locks
 */
export const DOCUMENT_LOCK_REDIS_KEY = (documentId: string) => `doc:lock:${documentId}`;

/**
 * Default lock TTL in seconds (30 minutes)
 */
export const DEFAULT_LOCK_TTL_SECONDS = 30 * 60;

/**
 * Default sync interval in seconds (30 seconds)
 */
export const DEFAULT_SYNC_INTERVAL_SECONDS = 30;
