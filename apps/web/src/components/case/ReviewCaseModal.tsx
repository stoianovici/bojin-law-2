/**
 * Review Case Modal Component
 * Story 2.8.2: Case Approval Workflow - Task 16
 *
 * Modal for Partners to review and approve/reject cases submitted by Associates
 */

'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { PendingCaseWithRelations } from '../../hooks/usePendingCases';

// Format date helper
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

interface ReviewCaseModalProps {
  case: PendingCaseWithRelations;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (caseId: string) => Promise<void>;
  onReject: (caseId: string, reason: string) => Promise<void>;
  loading?: boolean;
}

export function ReviewCaseModal({
  case: caseData,
  isOpen,
  onClose,
  onApprove,
  onReject,
  loading = false,
}: ReviewCaseModalProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleApprove = async () => {
    await onApprove(caseData.id);
  };

  const handleReject = async () => {
    if (rejectionReason.trim().length < 10) {
      return; // Validation: minimum 10 characters
    }
    await onReject(caseData.id, rejectionReason);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto z-50">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <Dialog.Title className="text-xl font-semibold text-gray-900">
                Review Case
              </Dialog.Title>
              <p className="text-sm text-gray-500 mt-1">
                Review case details and approve or reject
              </p>
            </div>
            <Dialog.Close className="text-gray-400 hover:text-gray-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Dialog.Close>
          </div>

          {/* Approval Metadata */}
          <div className="bg-blue-50 border-b border-blue-100 px-6 py-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Approval Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700 font-medium">Submitted by:</span>{' '}
                <span className="text-blue-900">
                  {caseData.approval?.submittedBy
                    ? `${caseData.approval.submittedBy.firstName} ${caseData.approval.submittedBy.lastName}`
                    : 'Unknown'}
                </span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Submitted on:</span>{' '}
                <span className="text-blue-900">
                  {caseData.approval?.submittedAt ? formatDate(caseData.approval.submittedAt) : 'N/A'}
                </span>
              </div>
              {caseData.approval?.revisionCount !== undefined && caseData.approval.revisionCount > 0 && (
                <div className="col-span-2">
                  <span className="text-blue-700 font-medium">Revision:</span>{' '}
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 border border-amber-200">
                    Revision #{caseData.approval.revisionCount}
                  </span>
                </div>
              )}
              {caseData.approval?.status === 'Rejected' && caseData.approval?.rejectionReason && (
                <div className="col-span-2">
                  <span className="text-blue-700 font-medium">Previous rejection reason:</span>
                  <div className="mt-1 text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200">
                    {caseData.approval.rejectionReason}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Edit Mode Toggle */}
          <div className="border-b border-gray-200 px-6 py-3 bg-gray-50">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isEditMode}
                onChange={(e) => setIsEditMode(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Enable editing (make changes before approval)
              </span>
            </label>
          </div>

          {/* Case Details */}
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Case Title</label>
              <div className="text-base text-gray-900">{caseData.title}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Case Number</label>
                <div className="text-base text-gray-900">{caseData.caseNumber}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <div className="text-base text-gray-900">{caseData.type}</div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <div className="text-base text-gray-900">{caseData.client?.name || 'N/A'}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <div className="text-base text-gray-900 whitespace-pre-wrap">{caseData.description}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <div>
                  <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800">
                    {caseData.status}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opened Date</label>
                <div className="text-base text-gray-900">
                  {formatDate(caseData.openedDate)}
                </div>
              </div>
            </div>

            {isEditMode && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Inline editing is not yet implemented. This will be added in a future update.
                </p>
              </div>
            )}
          </div>

          {/* Rejection Form */}
          {showRejectForm && (
            <div className="border-t border-gray-200 bg-red-50 px-6 py-4">
              <h3 className="text-sm font-medium text-red-900 mb-2">Provide Rejection Reason</h3>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain what needs to be changed... (minimum 10 characters)"
                className="w-full border border-red-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                rows={4}
              />
              {rejectionReason.length > 0 && rejectionReason.length < 10 && (
                <p className="text-xs text-red-600 mt-1">
                  Reason must be at least 10 characters (current: {rejectionReason.length})
                </p>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>

            <div className="flex items-center space-x-3">
              {showRejectForm ? (
                <>
                  <button
                    onClick={() => {
                      setShowRejectForm(false);
                      setRejectionReason('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={rejectionReason.trim().length < 10 || loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Rejecting...' : 'Submit Rejection'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reject Case
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Approving...' : 'Approve Case'}
                  </button>
                </>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
