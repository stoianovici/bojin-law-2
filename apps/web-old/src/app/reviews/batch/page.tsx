/**
 * Batch Review Page
 * Story 3.6: Document Review and Approval Workflow - Task 12
 *
 * Batch review interface for processing multiple documents with a common decision
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAuthorization } from '@/hooks/useAuthorization';

interface BatchReviewDocument {
  id: string;
  reviewId: string;
  document: {
    id: string;
    fileName: string;
    fileType: string;
  };
  submittedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  submittedAt: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  status: string;
  hasUnresolvedComments: boolean;
  hasUnaddressedConcerns: boolean;
}

type Decision = 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';

const BATCH_REVIEWS_QUERY = `
  query BatchReviewDocuments($reviewIds: [ID!]!) {
    batchReviewDocuments(reviewIds: $reviewIds) {
      id
      reviewId
      document {
        id
        fileName
        fileType
      }
      submittedBy {
        id
        firstName
        lastName
      }
      submittedAt
      priority
      status
      hasUnresolvedComments
      hasUnaddressedConcerns
    }
  }
`;

const SUBMIT_BATCH_DECISION_MUTATION = `
  mutation SubmitBatchReviewDecision($input: BatchReviewInput!) {
    submitBatchReviewDecision(input: $input) {
      id
      status
      processedCount
      totalCount
    }
  }
`;

const priorityConfig = {
  URGENT: { label: 'Urgent', color: 'bg-red-500 text-white' },
  HIGH: { label: 'High', color: 'bg-orange-500 text-white' },
  NORMAL: { label: 'Normal', color: 'bg-blue-500 text-white' },
  LOW: { label: 'Low', color: 'bg-gray-500 text-white' },
};

const decisionOptions: Array<{
  value: Decision;
  label: string;
  description: string;
  icon: typeof CheckCircle;
  color: string;
  bgColor: string;
}> = [
  {
    value: 'APPROVED',
    label: 'Approve All',
    description: 'All selected documents meet requirements',
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
  },
  {
    value: 'REVISION_REQUESTED',
    label: 'Request Revisions',
    description: 'All selected documents need changes',
    icon: RotateCcw,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200',
  },
  {
    value: 'REJECTED',
    label: 'Reject All',
    description: 'All selected documents do not meet requirements',
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-red-50 border-red-200',
  },
];

export default function BatchReviewPage() {
  const router = useRouter();
  const { isPartner } = useAuthorization();

  const [reviewIds, setReviewIds] = useState<string[]>([]);
  const [documents, setDocuments] = useState<BatchReviewDocument[]>([]);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load review IDs from session storage
  useEffect(() => {
    const storedIds = sessionStorage.getItem('batchReviewIds');
    if (storedIds) {
      try {
        const ids = JSON.parse(storedIds);
        setReviewIds(ids);
      } catch {
        router.push('/reviews');
      }
    } else {
      router.push('/reviews');
    }
  }, [router]);

  // Fetch review documents
  const fetchDocuments = useCallback(async () => {
    if (reviewIds.length === 0) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: BATCH_REVIEWS_QUERY,
          variables: { reviewIds },
        }),
      });

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Failed to fetch documents');
      }

      setDocuments(result.data.batchReviewDocuments || []);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [reviewIds]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleSubmit = async () => {
    if (!selectedDecision || !feedback.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: SUBMIT_BATCH_DECISION_MUTATION,
          variables: {
            input: {
              reviewIds,
              decision: selectedDecision,
              commonFeedback: feedback,
            },
          },
        }),
      });

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Failed to submit decision');
      }

      // Clear session storage and redirect
      sessionStorage.removeItem('batchReviewIds');
      router.push('/reviews');
    } catch (err) {
      console.error('Error submitting decision:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Access control
  if (!isPartner) {
    return (
      <div className="p-8">
        <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Access Restricted</h3>
              <p className="mt-2 text-sm text-yellow-700">
                Batch review is only available to Partners.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
  if (error) {
    return (
      <div className="p-8">
        <Button variant="ghost" onClick={() => router.push('/reviews')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reviews
        </Button>
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading documents</h3>
              <p className="mt-2 text-sm text-red-700">{error.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const documentsWithIssues = documents.filter(
    (d) => d.hasUnresolvedComments || d.hasUnaddressedConcerns
  );
  const canApprove = documentsWithIssues.length === 0;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push('/reviews')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reviews
        </Button>

        <h1 className="text-3xl font-bold text-gray-900">Batch Review</h1>
        <p className="mt-2 text-sm text-gray-700">
          Review {documents.length} document{documents.length !== 1 ? 's' : ''} with a common
          decision and feedback.
        </p>
      </div>

      {/* Document List */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Selected Documents ({documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{doc.document.fileName}</span>
                    <Badge className={priorityConfig[doc.priority].color}>
                      {priorityConfig[doc.priority].label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    by {doc.submittedBy.firstName} {doc.submittedBy.lastName}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {doc.hasUnresolvedComments && (
                    <Badge variant="secondary" className="text-xs">
                      Unresolved comments
                    </Badge>
                  )}
                  {doc.hasUnaddressedConcerns && (
                    <Badge variant="destructive" className="text-xs">
                      AI concerns
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {documentsWithIssues.length > 0 && (
        <div className="mb-6 p-4 rounded-lg border border-yellow-200 bg-yellow-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800">Some documents have issues</h3>
              <p className="text-sm text-yellow-700 mt-1">
                {documentsWithIssues.length} document
                {documentsWithIssues.length !== 1 ? 's have' : ' has'} unresolved comments or AI
                concerns. You cannot approve these until issues are resolved. Consider reviewing
                them individually first.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Decision Selection */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Decision</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {decisionOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedDecision === option.value;
              const isDisabled = option.value === 'APPROVED' && !canApprove;

              return (
                <button
                  key={option.value}
                  onClick={() => !isDisabled && setSelectedDecision(option.value)}
                  disabled={isDisabled}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                    isSelected ? option.bgColor : 'bg-background hover:bg-muted/50'
                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Icon className={`h-5 w-5 mt-0.5 ${option.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{option.label}</span>
                      {isSelected && (
                        <Badge variant="secondary" className="text-xs">
                          Selected
                        </Badge>
                      )}
                      {isDisabled && (
                        <Badge variant="outline" className="text-xs">
                          Resolve issues first
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Feedback */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Common Feedback <span className="text-muted-foreground font-normal">(required)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={feedback}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFeedback(e.target.value)}
            placeholder={
              selectedDecision === 'APPROVED'
                ? 'Add approval notes that apply to all documents...'
                : selectedDecision === 'REJECTED'
                  ? 'Explain why all documents are rejected...'
                  : selectedDecision === 'REVISION_REQUESTED'
                    ? 'Describe what changes are needed for all documents...'
                    : 'Select a decision to add feedback...'
            }
            rows={4}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            This feedback will be applied to all {documents.length} selected documents.
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-4">
        <Button variant="outline" onClick={() => router.push('/reviews')} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!selectedDecision || !feedback.trim() || isSubmitting}
          variant={
            selectedDecision === 'REJECTED'
              ? 'destructive'
              : selectedDecision === 'REVISION_REQUESTED'
                ? 'secondary'
                : 'default'
          }
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              {selectedDecision === 'APPROVED' && (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve All ({documents.length})
                </>
              )}
              {selectedDecision === 'REJECTED' && (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject All ({documents.length})
                </>
              )}
              {selectedDecision === 'REVISION_REQUESTED' && (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Request Revisions ({documents.length})
                </>
              )}
              {!selectedDecision && `Submit Decision (${documents.length})`}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
