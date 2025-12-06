/**
 * Pending Reviews Dashboard Page
 * Story 3.6: Document Review and Approval Workflow - Task 13
 *
 * Dashboard showing pending document reviews with filtering and batch operations
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PendingReviewsDashboard } from '@/components/documents/PendingReviewsDashboard';
import { useAuthorization } from '@/hooks/useAuthorization';

// Mock data for development - replace with actual GraphQL query
interface PendingReview {
  id: string;
  document: {
    id: string;
    fileName: string;
    fileType: string;
  };
  documentVersion: {
    id: string;
    versionNumber: number;
  };
  submittedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  submittedAt: string;
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  status: 'PENDING' | 'IN_REVIEW';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueDate?: string;
  revisionNumber: number;
}

interface ReviewStatistics {
  totalPending: number;
  totalInReview: number;
  totalApproved: number;
  totalRejected: number;
  averageReviewTimeHours: number;
  reviewsByPriority: {
    low: number;
    normal: number;
    high: number;
    urgent: number;
  };
}

// GraphQL query for pending reviews
const PENDING_REVIEWS_QUERY = `
  query PendingDocumentReviews($priority: ReviewPriority, $limit: Int, $offset: Int) {
    pendingDocumentReviews(priority: $priority, limit: $limit, offset: $offset) {
      id
      documentId
      document {
        id
        fileName
        fileType
      }
      documentVersion {
        id
        versionNumber
      }
      submittedBy {
        id
        firstName
        lastName
      }
      submittedAt
      assignedTo {
        id
        firstName
        lastName
      }
      status
      priority
      dueDate
      revisionNumber
    }
    reviewStatistics {
      totalPending
      totalInReview
      totalApproved
      totalRejected
      averageReviewTimeHours
      reviewsByPriority {
        low
        normal
        high
        urgent
      }
    }
  }
`;

export default function ReviewsPage() {
  const router = useRouter();
  const { isPartner, isAssociate, user, loading: authLoading } = useAuthorization();
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [statistics, setStatistics] = useState<ReviewStatistics | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: PENDING_REVIEWS_QUERY,
          variables: {
            limit: 50,
            offset: 0,
          },
        }),
      });

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Failed to fetch reviews');
      }

      setReviews(result.data.pendingDocumentReviews || []);
      setStatistics(result.data.reviewStatistics);
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      fetchReviews();
    }
  }, [authLoading, user, fetchReviews]);

  const handleSelectReview = (reviewId: string) => {
    router.push(`/reviews/${reviewId}`);
  };

  const handleBatchReview = (reviewIds: string[]) => {
    // Store selected IDs in session storage for batch review page
    sessionStorage.setItem('batchReviewIds', JSON.stringify(reviewIds));
    router.push('/reviews/batch');
  };

  // Loading state
  if (authLoading || loading) {
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
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading reviews
              </h3>
              <p className="mt-2 text-sm text-red-700">{error.message}</p>
              <button
                onClick={fetchReviews}
                className="mt-3 text-sm font-medium text-red-800 hover:text-red-600"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Document Reviews</h1>
            <p className="mt-2 text-sm text-gray-700">
              {isPartner
                ? 'Review and approve documents submitted by your team. Select multiple documents for batch review.'
                : 'View documents assigned to you for review.'}
            </p>
          </div>
        </div>
      </div>

      <PendingReviewsDashboard
        reviews={reviews}
        statistics={statistics}
        onSelectReview={handleSelectReview}
        onBatchReview={handleBatchReview}
        isPartner={isPartner}
      />
    </div>
  );
}
