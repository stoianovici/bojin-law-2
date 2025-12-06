/**
 * Task Collaboration Types
 * Story 4.6: Task Collaboration and Updates
 */

import type { User, Task } from './entities';

// ============================================================================
// Task Comment Types (AC: 1)
// ============================================================================

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  parentId?: string;
  mentions: string[];
  createdAt: Date;
  updatedAt: Date;
  editedAt?: Date;
  // Relations
  author?: User;
  replies?: TaskComment[];
}

export interface CreateTaskCommentInput {
  taskId: string;
  content: string;
  parentId?: string; // For threaded replies
}

export interface UpdateTaskCommentInput {
  content: string;
}

// ============================================================================
// Task History Types (AC: 5)
// ============================================================================

export type TaskHistoryAction =
  | 'Created'
  | 'Updated'
  | 'StatusChanged'
  | 'AssigneeChanged'
  | 'PriorityChanged'
  | 'DueDateChanged'
  | 'CommentAdded'
  | 'CommentEdited'
  | 'CommentDeleted'
  | 'AttachmentAdded'
  | 'AttachmentRemoved'
  | 'SubtaskCreated'
  | 'SubtaskCompleted'
  | 'DependencyAdded'
  | 'DependencyRemoved'
  | 'Delegated';

export interface TaskHistoryEntry {
  id: string;
  taskId: string;
  actorId: string;
  action: TaskHistoryAction;
  field?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  // Relations
  actor?: User;
}

export interface HistoryDetails {
  field?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
}

export interface HistoryOptions {
  limit?: number;
  actions?: TaskHistoryAction[];
  since?: Date;
  until?: Date;
}

// ============================================================================
// Case Activity Feed Types (AC: 2)
// ============================================================================

export type CaseActivityType =
  | 'TaskCreated'
  | 'TaskStatusChanged'
  | 'TaskCompleted'
  | 'TaskAssigned'
  | 'TaskCommented'
  | 'DocumentUploaded'
  | 'DocumentVersioned'
  | 'CommunicationReceived'
  | 'CommunicationSent'
  | 'DeadlineApproaching'
  | 'MilestoneReached';

export type EntityType = 'Task' | 'Document' | 'Communication';

export interface CaseActivityEntry {
  id: string;
  caseId: string;
  actorId: string;
  activityType: CaseActivityType;
  entityType: EntityType;
  entityId: string;
  title: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  // Relations
  actor?: User;
}

export interface CaseActivityFeedResponse {
  entries: CaseActivityEntry[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface FeedOptions {
  limit?: number;
  cursor?: string;
  activityTypes?: CaseActivityType[];
  since?: Date;
  until?: Date;
}

// ============================================================================
// Task Attachment Types (AC: 3)
// ============================================================================

export interface TaskAttachment {
  id: string;
  taskId: string;
  documentId?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageUrl: string;
  uploadedBy: string;
  version: number;
  previousVersionId?: string;
  createdAt: Date;
  // Relations
  uploader?: User;
  document?: {
    id: string;
    fileName: string;
    fileType: string;
  };
}

// Frontend input type (browser context)
export interface UploadTaskAttachmentInput {
  taskId: string;
  file: File; // Browser File API
  linkToDocumentId?: string; // Optional document ID to link
}

// Backend input type (Node.js context) - used by GraphQL resolver
export interface UploadTaskAttachmentServerInput {
  taskId: string;
  filename: string;
  buffer: Buffer;
  mimeType: string;
  fileSize: number;
  linkToDocumentId?: string;
}

export interface TaskAttachmentVersion {
  version: number;
  attachment: TaskAttachment;
  uploadedAt: Date;
  uploadedBy: User;
}

// File validation constants
export const MAX_ATTACHMENT_SIZE_MB = 50;
export const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
];

// ============================================================================
// Subtask Types (AC: 4)
// ============================================================================

export interface CreateSubtaskInput {
  parentTaskId: string;
  title: string;
  description?: string;
  assignedTo?: string;
  dueDate?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  estimatedHours?: number;
}

export interface ParentTaskContext {
  id: string;
  title: string;
  caseId: string;
  caseTitle: string;
  type: string;
}

export interface SubtaskWithContext {
  subtask: Task;
  parentTask: ParentTaskContext;
}

// ============================================================================
// Case Subscription Types (AC: 6)
// ============================================================================

export interface CaseSubscription {
  id: string;
  caseId: string;
  userId: string;
  digestEnabled: boolean;
  notifyOnTask: boolean;
  notifyOnDocument: boolean;
  notifyOnComment: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateSubscriptionInput {
  digestEnabled?: boolean;
  notifyOnTask?: boolean;
  notifyOnDocument?: boolean;
  notifyOnComment?: boolean;
}

export interface SubscriptionOptions {
  digestEnabled?: boolean;
  notifyOnTask?: boolean;
  notifyOnDocument?: boolean;
  notifyOnComment?: boolean;
}

export interface DailyDigest {
  userId: string;
  date: Date;
  cases: DigestCaseSummary[];
}

export interface DigestCaseSummary {
  caseId: string;
  caseTitle: string;
  caseNumber: string;
  taskUpdates: DigestTaskUpdate[];
  newComments: number;
  newAttachments: number;
}

export interface DigestTaskUpdate {
  taskId: string;
  taskTitle: string;
  updateType: 'created' | 'completed' | 'statusChanged' | 'assigned' | 'commented';
  summary: string;
  actor: string;
  timestamp: Date;
}

// ============================================================================
// Notification Context Types (AC: 1, 4)
// ============================================================================

export interface TaskCommentContext {
  taskId: string;
  taskTitle: string;
  caseId: string;
  caseTitle: string;
  commentId: string;
  commentContent: string;
  authorId: string;
  authorName: string;
}

export interface SubtaskContext {
  parentTaskId: string;
  parentTaskTitle: string;
  subtaskId: string;
  subtaskTitle: string;
  caseId: string;
  caseTitle: string;
  creatorId: string;
  creatorName: string;
}

export interface AttachmentContext {
  taskId: string;
  taskTitle: string;
  caseId: string;
  caseTitle: string;
  attachmentId: string;
  fileName: string;
  uploaderId: string;
  uploaderName: string;
}

// ============================================================================
// Factory Override Types for Testing
// ============================================================================

export type TaskCommentOverrides = Partial<TaskComment>;
export type TaskHistoryEntryOverrides = Partial<TaskHistoryEntry>;
export type CaseActivityEntryOverrides = Partial<CaseActivityEntry>;
export type TaskAttachmentOverrides = Partial<TaskAttachment>;
export type CaseSubscriptionOverrides = Partial<CaseSubscription>;
