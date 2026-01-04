/**
 * Document Review Page
 * Story 3.6: Document Review and Approval Workflow - Task 7
 *
 * Full review interface with document viewer, AI concerns, comments, and decision controls
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Clock, User, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AIConcernsPanel } from '@/components/documents/AIConcernsPanel';
import { ReviewCommentsPanel } from '@/components/documents/ReviewCommentsPanel';
import { ReviewDecisionDialog } from '@/components/documents/ReviewDecisionDialog';
import { ReviewHistoryTimeline } from '@/components/documents/ReviewHistoryTimeline';
import { useAuthorization } from '@/hooks/useAuthorization';
import { useAuth } from '@/contexts/AuthContext';

interface DocumentReview {
  id: string;
  documentId: string;
  document: {
    id: string;
    fileName: string;
    fileType: string;
    fileUrl?: string;
    content?: string;
  };
  documentVersion: {
    id: string;
    versionNumber: number;
    changesSummary?: string;
  };
  submittedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  submittedAt: string;
  reviewedAt?: string;
  feedback?: string;
  dueDate?: string;
  revisionNumber: number;
  comments: Array<{
    id: string;
    author: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    content: string;
    anchorText?: string;
    anchorStart?: number;
    anchorEnd?: number;
    sectionPath?: string;
    resolved: boolean;
    resolvedBy?: {
      id: string;
      firstName: string;
      lastName: string;
    };
    resolvedAt?: string;
    suggestionText?: string;
    isAISuggestion: boolean;
    replies: Array<{
      id: string;
      author: {
        id: string;
        firstName: string;
        lastName: string;
      };
      content: string;
      createdAt: string;
    }>;
    createdAt: string;
  }>;
  aiConcerns: Array<{
    id: string;
    concernType: string;
    severity: 'INFO' | 'WARNING' | 'ERROR';
    description: string;
    anchorText: string;
    anchorStart: number;
    anchorEnd: number;
    sectionPath?: string;
    suggestedFix?: string;
    aiConfidence: number;
    dismissed: boolean;
  }>;
  history: Array<{
    id: string;
    action: string;
    actor: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    previousStatus?: string;
    newStatus?: string;
    feedback?: string;
    timestamp: string;
  }>;
}

const DOCUMENT_REVIEW_QUERY = `
  query DocumentReview($reviewId: ID!) {
    documentReview(reviewId: $reviewId) {
      id
      documentId
      document {
        id
        fileName
        fileType
        fileUrl
        content
      }
      documentVersion {
        id
        versionNumber
        changesSummary
      }
      submittedBy {
        id
        firstName
        lastName
        email
      }
      assignedTo {
        id
        firstName
        lastName
        email
      }
      status
      priority
      submittedAt
      reviewedAt
      feedback
      dueDate
      revisionNumber
      comments {
        id
        author {
          id
          firstName
          lastName
          email
        }
        content
        anchorText
        anchorStart
        anchorEnd
        sectionPath
        resolved
        resolvedBy {
          id
          firstName
          lastName
        }
        resolvedAt
        suggestionText
        isAISuggestion
        replies {
          id
          author {
            id
            firstName
            lastName
          }
          content
          createdAt
        }
        createdAt
      }
      aiConcerns {
        id
        concernType
        severity
        description
        anchorText
        anchorStart
        anchorEnd
        sectionPath
        suggestedFix
        aiConfidence
        dismissed
      }
      history {
        id
        action
        actor {
          id
          firstName
          lastName
          email
        }
        previousStatus
        newStatus
        feedback
        timestamp
      }
    }
  }
`;

const ADD_COMMENT_MUTATION = `
  mutation AddReviewComment($input: AddReviewCommentInput!) {
    addReviewComment(input: $input) {
      id
      content
      createdAt
    }
  }
`;

const REPLY_COMMENT_MUTATION = `
  mutation ReplyToComment($commentId: ID!, $content: String!) {
    replyToReviewComment(commentId: $commentId, content: $content) {
      id
      content
      createdAt
    }
  }
`;

const RESOLVE_COMMENT_MUTATION = `
  mutation ResolveComment($commentId: ID!) {
    resolveReviewComment(commentId: $commentId) {
      id
      resolved
      resolvedAt
    }
  }
`;

const DISMISS_CONCERN_MUTATION = `
  mutation DismissConcern($concernId: ID!) {
    dismissAIConcern(concernId: $concernId) {
      id
      dismissed
    }
  }
`;

const SUBMIT_DECISION_MUTATION = `
  mutation SubmitReviewDecision($input: ReviewDecisionInput!) {
    submitReviewDecision(input: $input) {
      id
      status
      reviewedAt
      feedback
    }
  }
`;

const REGENERATE_AI_ANALYSIS_MUTATION = `
  mutation RegenerateAIAnalysis($reviewId: ID!) {
    regenerateDocumentAnalysis(reviewId: $reviewId) {
      concerns {
        id
        concernType
        severity
        description
        anchorText
        anchorStart
        anchorEnd
        sectionPath
        suggestedFix
        aiConfidence
        dismissed
      }
    }
  }
`;

const priorityConfig = {
  URGENT: { label: 'Urgent', color: 'bg-red-500 text-white' },
  HIGH: { label: 'High', color: 'bg-orange-500 text-white' },
  NORMAL: { label: 'Normal', color: 'bg-blue-500 text-white' },
  LOW: { label: 'Low', color: 'bg-gray-500 text-white' },
};

const statusConfig = {
  PENDING: { label: 'Pending', variant: 'secondary' as const },
  IN_REVIEW: { label: 'In Review', variant: 'default' as const },
  APPROVED: { label: 'Approved', variant: 'outline' as const },
  REJECTED: { label: 'Rejected', variant: 'destructive' as const },
  REVISION_REQUESTED: { label: 'Revision Requested', variant: 'secondary' as const },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const reviewId = params.reviewId as string;
  const { isPartner } = useAuthorization();
  const { user } = useAuth();

  const [review, setReview] = useState<DocumentReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showDecisionDialog, setShowDecisionDialog] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedText, setSelectedText] = useState<
    | {
        text: string;
        start: number;
        end: number;
      }
    | undefined
  >();

  const fetchReview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: DOCUMENT_REVIEW_QUERY,
          variables: { reviewId },
        }),
      });

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Failed to fetch review');
      }

      setReview(result.data.documentReview);
    } catch (err) {
      console.error('Error fetching review:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [reviewId]);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  const handleAddComment = async (data: {
    content: string;
    anchorText?: string;
    anchorStart?: number;
    anchorEnd?: number;
    suggestionText?: string;
  }) => {
    const response = await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: ADD_COMMENT_MUTATION,
        variables: {
          input: {
            reviewId,
            ...data,
          },
        },
      }),
    });

    const result = await response.json();
    if (result.errors) {
      throw new Error(result.errors[0]?.message);
    }

    // Refresh review data
    await fetchReview();
  };

  const handleReplyComment = async (commentId: string, content: string) => {
    const response = await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: REPLY_COMMENT_MUTATION,
        variables: { commentId, content },
      }),
    });

    const result = await response.json();
    if (result.errors) {
      throw new Error(result.errors[0]?.message);
    }

    await fetchReview();
  };

  const handleResolveComment = async (commentId: string) => {
    const response = await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: RESOLVE_COMMENT_MUTATION,
        variables: { commentId },
      }),
    });

    const result = await response.json();
    if (result.errors) {
      throw new Error(result.errors[0]?.message);
    }

    await fetchReview();
  };

  const handleDismissConcern = async (concernId: string) => {
    const response = await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: DISMISS_CONCERN_MUTATION,
        variables: { concernId },
      }),
    });

    const result = await response.json();
    if (result.errors) {
      throw new Error(result.errors[0]?.message);
    }

    await fetchReview();
  };

  const handleRegenerateAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: REGENERATE_AI_ANALYSIS_MUTATION,
          variables: { reviewId },
        }),
      });

      const result = await response.json();
      if (result.errors) {
        throw new Error(result.errors[0]?.message);
      }

      await fetchReview();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDecision = async (data: {
    decision: 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';
    feedback: string;
  }) => {
    const response = await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: SUBMIT_DECISION_MUTATION,
        variables: {
          input: {
            reviewId,
            decision: data.decision,
            feedback: data.feedback,
          },
        },
      }),
    });

    const result = await response.json();
    if (result.errors) {
      throw new Error(result.errors[0]?.message);
    }

    // Redirect back to reviews list
    router.push('/reviews');
  };

  const handleNavigateToPosition = (start: number, end: number) => {
    // Scroll document viewer to position and highlight
    // Implementation depends on document viewer component
    console.log('Navigate to position:', start, end);
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !review) {
    return (
      <div className="p-8">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading review</h3>
              <p className="mt-2 text-sm text-red-700">{error?.message || 'Review not found'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasUnresolvedComments = review.comments.some((c) => !c.resolved);
  const hasUnaddressedConcerns = review.aiConcerns.some(
    (c) => !c.dismissed && c.severity === 'ERROR'
  );
  const canMakeDecision =
    isPartner && (review.status === 'PENDING' || review.status === 'IN_REVIEW');

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push('/reviews')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Reviews
            </Button>

            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">{review.document.fileName}</h1>
              <Badge className={priorityConfig[review.priority].color}>
                {priorityConfig[review.priority].label}
              </Badge>
              <Badge variant={statusConfig[review.status].variant}>
                {statusConfig[review.status].label}
              </Badge>
              {review.revisionNumber > 0 && (
                <Badge variant="outline">Revision #{review.revisionNumber}</Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {review.document.fileUrl && (
              <Button variant="outline" asChild>
                <a href={review.document.fileUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Document
                </a>
              </Button>
            )}

            {canMakeDecision && (
              <Button onClick={() => setShowDecisionDialog(true)}>Make Decision</Button>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className="mt-3 flex items-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-4 w-4" />
            Submitted by {review.submittedBy.firstName} {review.submittedBy.lastName}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {formatDate(review.submittedAt)}
          </span>
          {review.assignedTo && (
            <span>
              Assigned to {review.assignedTo.firstName} {review.assignedTo.lastName}
            </span>
          )}
          {review.dueDate && (
            <span className="text-orange-600">Due: {formatDate(review.dueDate)}</span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        {/* Document Preview (Main Column) */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Document Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {review.document.content ? (
                <div
                  className="prose prose-sm max-w-none whitespace-pre-wrap bg-muted/30 p-4 rounded-lg max-h-[600px] overflow-y-auto"
                  onMouseUp={() => {
                    const selection = window.getSelection();
                    if (selection && selection.toString().trim()) {
                      setSelectedText({
                        text: selection.toString(),
                        start: 0, // Would need proper offset calculation
                        end: selection.toString().length,
                      });
                    }
                  }}
                >
                  {review.document.content}
                </div>
              ) : review.document.fileUrl ? (
                <div className="text-center py-12 bg-muted/30 rounded-lg">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Document preview not available for this file type.
                  </p>
                  <Button variant="outline" asChild>
                    <a href={review.document.fileUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open in New Tab
                    </a>
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No document content available.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Version Info */}
          {review.documentVersion.changesSummary && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Version {review.documentVersion.versionNumber} Changes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {review.documentVersion.changesSummary}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* AI Concerns Panel */}
          <AIConcernsPanel
            concerns={review.aiConcerns}
            onDismiss={handleDismissConcern}
            onRegenerate={handleRegenerateAnalysis}
            onNavigateToConcern={handleNavigateToPosition}
            isLoading={isAnalyzing}
          />

          {/* Comments Panel */}
          <ReviewCommentsPanel
            comments={review.comments}
            currentUserId={user?.id || ''}
            onAddComment={handleAddComment}
            onReply={handleReplyComment}
            onResolve={handleResolveComment}
            selectedText={selectedText}
            onNavigateToComment={handleNavigateToPosition}
          />

          {/* Review History */}
          <ReviewHistoryTimeline history={review.history} />
        </div>
      </div>

      {/* Decision Dialog */}
      <ReviewDecisionDialog
        open={showDecisionDialog}
        onOpenChange={setShowDecisionDialog}
        documentName={review.document.fileName}
        hasUnresolvedComments={hasUnresolvedComments}
        hasUnaddressedConcerns={hasUnaddressedConcerns}
        onDecision={handleDecision}
      />
    </div>
  );
}
