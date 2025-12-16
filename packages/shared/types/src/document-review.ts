/**
 * Document Review Types
 * Story 3.6: Document Review and Approval Workflow
 */

// Review status lifecycle
export type ReviewStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';

// Review priority levels
export type ReviewPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

// AI concern type classification
export type ConcernType =
  | 'LEGAL_INCONSISTENCY'
  | 'AMBIGUOUS_LANGUAGE'
  | 'MISSING_CLAUSE'
  | 'OUTDATED_REFERENCE'
  | 'COMPLIANCE_ISSUE'
  | 'STYLE_VIOLATION'
  | 'HIGH_RISK_CLAUSE';

// AI concern severity levels
export type ConcernSeverity = 'INFO' | 'WARNING' | 'ERROR';

// Review action types for history tracking
export type ReviewAction =
  | 'SUBMITTED'
  | 'ASSIGNED'
  | 'COMMENT_ADDED'
  | 'COMMENT_RESOLVED'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVISION_REQUESTED'
  | 'RESUBMITTED';

// Batch review status
export type BatchReviewStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

// Document review entity
export interface DocumentReview {
  id: string;
  documentId: string;
  documentVersionId: string;
  firmId: string;
  submittedBy: string;
  submittedAt: Date;
  assignedTo?: string;
  status: ReviewStatus;
  reviewedAt?: Date;
  feedback?: string;
  priority: ReviewPriority;
  dueDate?: Date;
  revisionNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

// Review comment entity
export interface ReviewComment {
  id: string;
  reviewId: string;
  authorId: string;
  content: string;
  anchorText?: string;
  anchorStart?: number;
  anchorEnd?: number;
  sectionPath?: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  suggestionText?: string;
  isAISuggestion: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Review comment reply entity
export interface ReviewCommentReply {
  id: string;
  commentId: string;
  authorId: string;
  content: string;
  createdAt: Date;
}

// AI review concern entity
export interface AIReviewConcern {
  id: string;
  reviewId: string;
  concernType: ConcernType;
  severity: ConcernSeverity;
  description: string;
  anchorText: string;
  anchorStart: number;
  anchorEnd: number;
  sectionPath?: string;
  suggestedFix?: string;
  aiConfidence: number;
  dismissed: boolean;
  dismissedBy?: string;
  dismissedAt?: Date;
  createdAt: Date;
}

// Review history entity
export interface ReviewHistory {
  id: string;
  reviewId: string;
  action: ReviewAction;
  actorId: string;
  previousStatus?: ReviewStatus;
  newStatus?: ReviewStatus;
  feedback?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

// Batch review entity
export interface BatchReview {
  id: string;
  firmId: string;
  createdBy: string;
  reviewIds: string[];
  status: BatchReviewStatus;
  processedCount: number;
  totalCount: number;
  commonFeedback?: string;
  createdAt: Date;
  completedAt?: Date;
}

// Notification context for document review events
export interface DocumentReviewContext {
  reviewId: string;
  documentId: string;
  documentTitle: string;
  actorName: string;
  revisionNumber?: number;
  feedback?: string;
}

// Comment context for notifications
export interface CommentContext {
  reviewId: string;
  commentId: string;
  documentTitle: string;
  authorName: string;
  commentPreview: string;
}

// Mention context for notifications
export interface MentionContext {
  reviewId: string;
  commentId: string;
  documentTitle: string;
  mentionedBy: string;
  commentContent: string;
}

// Input types for GraphQL mutations
export interface SubmitReviewInput {
  documentId: string;
  versionId: string;
  assignedTo?: string;
  priority?: ReviewPriority;
  dueDate?: Date;
  message?: string;
}

export interface AddCommentInput {
  reviewId: string;
  content: string;
  anchorText?: string;
  anchorStart?: number;
  anchorEnd?: number;
  sectionPath?: string;
  suggestionText?: string;
}

export interface ReviewDecisionInput {
  reviewId: string;
  decision: ReviewStatus;
  feedback: string;
}

export interface BatchReviewInput {
  reviewIds: string[];
  decision: ReviewStatus;
  commonFeedback: string;
}

// AI document analysis context for review
export interface ReviewDocumentContext {
  documentType: string;
  language: string;
  firmId?: string;
  caseType?: string;
  firmStyleGuide?: string;
}

// AI concern detection result
export interface AIAnalysisConcern {
  concernType: ConcernType;
  severity: ConcernSeverity;
  description: string;
  anchorText: string;
  anchorStart: number;
  anchorEnd: number;
  sectionPath?: string;
  suggestedFix?: string;
  confidence: number;
}

// AI document analysis result
export interface DocumentAnalysisResult {
  concerns: AIAnalysisConcern[];
  processingTimeMs: number;
  tokensUsed: number;
  modelUsed: string;
}

// Review with expanded relations (for GraphQL responses)
export interface DocumentReviewWithRelations extends DocumentReview {
  document?: {
    id: string;
    fileName: string;
    fileType: string;
  };
  documentVersion?: {
    id: string;
    versionNumber: number;
    changesSummary?: string;
  };
  submitter?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  reviewer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  comments?: ReviewComment[];
  aiConcerns?: AIReviewConcern[];
  history?: ReviewHistory[];
}

// Review statistics for dashboard
export interface ReviewStatistics {
  totalPending: number;
  totalInReview: number;
  totalApproved: number;
  totalRejected: number;
  averageReviewTimeHours: number;
  reviewsByPriority: Record<ReviewPriority, number>;
}
