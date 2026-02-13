/**
 * Notification Enrichment Types
 *
 * Types for the Flipboard-style notification enrichment service.
 */

// ============================================================================
// Priority Types
// ============================================================================

export type NotificationPriority = 'featured' | 'secondary';

// ============================================================================
// Enrichment Status
// ============================================================================

export type EnrichmentStatus = 'PENDING' | 'ENRICHED';

// ============================================================================
// Related Item Types
// ============================================================================

export interface RelatedItem {
  type: 'case' | 'client' | 'task' | 'email' | 'document';
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

// ============================================================================
// Suggested Action Types
// ============================================================================

export type ActionType =
  | 'navigate' // Navigate to a page
  | 'create_task' // Create a new task
  | 'add_note' // Add a note to a case
  | 'snooze' // Snooze the notification
  | 'complete' // Mark task as complete
  | 'view_email' // Open email thread
  | 'view_document' // Open document viewer
  | 'call_client' // Initiate client call
  | 'schedule'; // Schedule a meeting

export interface SuggestedAction {
  id: string;
  label: string;
  icon: string;
  type: ActionType;
  payload?: Record<string, unknown>;
  href?: string;
}

// ============================================================================
// Enriched Notification Types
// ============================================================================

export interface EnrichedNotificationData {
  headline: string;
  summary: string;
  imageUrl?: string;
  priority: NotificationPriority;
  relatedItems: RelatedItem[];
  suggestedActions: SuggestedAction[];
}

// ============================================================================
// Flipboard Page Types
// ============================================================================

export interface FlipboardNotification {
  id: string;
  notificationId: string;
  headline: string;
  summary: string;
  imageUrl?: string;
  priority: NotificationPriority;
  relatedItems: RelatedItem[];
  suggestedActions: SuggestedAction[];
  originalTitle: string;
  action?: {
    type: string;
    entityId?: string;
    caseId?: string;
  };
  createdAt: Date;
  read: boolean;
  enrichmentStatus: EnrichmentStatus;
}

export interface FlipboardPage {
  pageIndex: number;
  layoutVariant: number;
  notifications: FlipboardNotification[];
}

export interface FlipboardPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface FlipboardPagesConnection {
  pages: FlipboardPage[];
  pageInfo: FlipboardPageInfo;
  totalCount: number;
}

// ============================================================================
// AI Enrichment Response
// ============================================================================

export interface AIEnrichmentResponse {
  headline: string;
  summary: string;
  priority: 'featured' | 'secondary';
  suggestedActions: Array<{
    label: string;
    icon: string;
    type: ActionType;
    payload?: Record<string, unknown>;
  }>;
}
