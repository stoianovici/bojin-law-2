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
  documentId: string;
  selectedText: string;
  cursorContext: string;
  suggestionType: SuggestionType;
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
  documentId: string;
  selectedText: string;
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
  documentId: string;
  selectedText: string;
  improvementType: ImprovementType;
}

/**
 * Response with text improvement
 */
export interface WordImproveResponse {
  original: string;
  improved: string;
  explanation: string;
  processingTimeMs: number;
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
