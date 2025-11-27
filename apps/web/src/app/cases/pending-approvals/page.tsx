/**
 * Pending Approvals Queue Page
 * Story 2.8.2: Case Approval Workflow - Task 15
 *
 * Partners-only view to review and approve cases submitted by Associates
 */

'use client';

import { usePendingCases, type PendingCaseWithRelations } from '../../../hooks/usePendingCases';
import { useAuthorization } from '../../../hooks/useAuthorization';
import { useCaseApprove, useCaseReject } from '../../../hooks/useCaseApproval';
import { useNotificationStore } from '../../../stores/notificationStore';
import { ReviewCaseModal } from '../../../components/case/ReviewCaseModal';
import { useState } from 'react';

// Revision count badge
function RevisionBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 border border-amber-200">
      Revision #{count}
    </span>
  );
}

// Format date helper
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

// Calculate time since submission for FIFO urgency indicator
function getTimeSinceSubmission(submittedAt: Date | string): string {
  const now = new Date();
  const submitted = new Date(submittedAt);
  const diffMs = now.getTime() - submitted.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }
  return 'Just now';
}

export default function PendingApprovalsPage() {
  const { isPartner } = useAuthorization();
  const { cases, loading, error, refetch } = usePendingCases();
  const { approveCase, loading: approveLoading } = useCaseApprove();
  const { rejectCase, loading: rejectLoading } = useCaseReject();
  const { addNotification } = useNotificationStore();
  const [selectedCase, setSelectedCase] = useState<PendingCaseWithRelations | null>(null);

  /**
   * Handle case approval
   * Story 2.8.2 Task 17: Implement Approval Action
   */
  const handleApprove = async (caseId: string) => {
    try {
      // Check if case has team members assigned (Task 17 requirement)
      const caseToApprove = cases.find((c) => c.id === caseId);
      if (caseToApprove && caseToApprove.teamMembers && caseToApprove.teamMembers.length === 0) {
        const confirmed = window.confirm(
          'This case has no team members assigned. Do you want to approve it anyway?'
        );
        if (!confirmed) {
          return;
        }
      }

      await approveCase(caseId);

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Case approved',
        message: 'The case is now active and the Associate has been notified.',
      });

      // Close modal and refresh list
      setSelectedCase(null);
      await refetch();
    } catch (err) {
      // Handle errors
      const error = err as Error;
      let errorMessage = 'An error occurred while approving the case.';

      if (error.message.includes('FORBIDDEN')) {
        errorMessage = 'Only Partners can approve cases.';
      } else if (error.message.includes('BAD_USER_INPUT')) {
        errorMessage = 'Case is not in pending status.';
      }

      addNotification({
        type: 'error',
        title: 'Approval failed',
        message: errorMessage,
      });
    }
  };

  /**
   * Handle case rejection
   * Story 2.8.2 Task 18: Implement Rejection Action
   */
  const handleReject = async (caseId: string, reason: string) => {
    try {
      await rejectCase(caseId, reason);

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Case rejected',
        message: 'The case has been rejected and the Associate has been notified.',
      });

      // Close modal and refresh list
      setSelectedCase(null);
      await refetch();
    } catch (err) {
      // Handle errors
      const error = err as Error;
      let errorMessage = 'An error occurred while rejecting the case.';

      if (error.message.includes('FORBIDDEN')) {
        errorMessage = 'Only Partners can reject cases.';
      } else if (error.message.includes('BAD_USER_INPUT')) {
        errorMessage = 'Case is not in pending status or reason is invalid.';
      } else if (error.message.includes('at least 10 characters')) {
        errorMessage = 'Rejection reason must be at least 10 characters.';
      }

      addNotification({
        type: 'error',
        title: 'Rejection failed',
        message: errorMessage,
      });
    }
  };

  // Story 2.8.2 AC 10: Restrict page to Partners only
  if (!isPartner) {
    return (
      <div className="p-8">
        <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Access Restricted</h3>
              <p className="mt-2 text-sm text-yellow-700">
                This page is only accessible to Partners. Associates can view their submitted cases in the "My Cases" section.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

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
              <h3 className="text-sm font-medium text-red-800">Error loading pending cases</h3>
              <p className="mt-2 text-sm text-red-700">{error.message}</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Pending Approvals</h1>
            <p className="mt-2 text-sm text-gray-700">
              Review and approve cases submitted by Associates. Cases are sorted by submission time (oldest first).
            </p>
          </div>
          {cases.length > 0 && (
            <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-semibold">
              {cases.length} Pending
            </div>
          )}
        </div>
      </div>

      {/* Story 2.8.2 AC 3: Empty state */}
      {cases.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No cases pending approval</h3>
          <p className="mt-1 text-sm text-gray-500">
            All submitted cases have been reviewed. New submissions will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Case Title
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Client Name
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Submitted By
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Submitted Date
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Revision
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Story 2.8.2 AC 3: Sort by submitted date (oldest first) - FIFO queue */}
              {cases.map((caseItem: PendingCaseWithRelations) => (
                <tr key={caseItem.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">{caseItem.title}</div>
                      <div className="text-sm text-gray-500">{caseItem.caseNumber}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{caseItem.client?.name || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">
                        {caseItem.approval?.submittedBy
                          ? `${caseItem.approval.submittedBy.firstName} ${caseItem.approval.submittedBy.lastName}`
                          : 'Unknown'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="text-sm text-gray-900">
                        {caseItem.approval?.submittedAt
                          ? formatDate(caseItem.approval.submittedAt)
                          : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {caseItem.approval?.submittedAt
                          ? getTimeSinceSubmission(caseItem.approval.submittedAt)
                          : ''}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {caseItem.approval?.revisionCount !== undefined && (
                      <RevisionBadge count={caseItem.approval.revisionCount} />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setSelectedCase(caseItem)}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Story 2.8.2 Task 16: Review Case Modal */}
      {selectedCase && (
        <ReviewCaseModal
          case={selectedCase}
          isOpen={!!selectedCase}
          onClose={() => setSelectedCase(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          loading={approveLoading || rejectLoading}
        />
      )}
    </div>
  );
}
