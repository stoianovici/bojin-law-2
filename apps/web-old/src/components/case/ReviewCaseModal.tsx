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
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-linear-bg-elevated rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto z-50">
          {/* Header */}
          <div className="sticky top-0 bg-linear-bg-elevated border-b border-linear-border-subtle px-6 py-4 flex items-center justify-between">
            <div>
              <Dialog.Title className="text-xl font-semibold text-linear-text-primary">
                Review Case
              </Dialog.Title>
              <p className="text-sm text-linear-text-tertiary mt-1">
                Review case details and approve or reject
              </p>
            </div>
            <Dialog.Close className="text-linear-text-muted hover:text-linear-text-tertiary">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Dialog.Close>
          </div>

          {/* Approval Metadata */}
          <div className="bg-linear-accent/10 border-b border-linear-accent/20 px-6 py-4">
            <h3 className="text-sm font-medium text-linear-accent mb-2">Approval Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-linear-accent font-medium">Submitted by:</span>{' '}
                <span className="text-linear-text-primary">
                  {caseData.approval?.submittedBy
                    ? `${caseData.approval.submittedBy.firstName} ${caseData.approval.submittedBy.lastName}`
                    : 'Unknown'}
                </span>
              </div>
              <div>
                <span className="text-linear-accent font-medium">Submitted on:</span>{' '}
                <span className="text-linear-text-primary">
                  {caseData.approval?.submittedAt
                    ? formatDate(caseData.approval.submittedAt)
                    : 'N/A'}
                </span>
              </div>
              {caseData.approval?.revisionCount !== undefined &&
                caseData.approval.revisionCount > 0 && (
                  <div className="col-span-2">
                    <span className="text-linear-accent font-medium">Revision:</span>{' '}
                    <span className="inline-flex items-center rounded-full bg-linear-warning/15 px-2.5 py-0.5 text-xs font-medium text-linear-warning border border-linear-warning/30">
                      Revision #{caseData.approval.revisionCount}
                    </span>
                  </div>
                )}
              {caseData.approval?.status === 'Rejected' && caseData.approval?.rejectionReason && (
                <div className="col-span-2">
                  <span className="text-linear-accent font-medium">Previous rejection reason:</span>
                  <div className="mt-1 text-xs text-linear-error bg-linear-error/10 p-2 rounded border border-linear-error/30">
                    {caseData.approval.rejectionReason}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Edit Mode Toggle */}
          <div className="border-b border-linear-border-subtle px-6 py-3 bg-linear-bg-tertiary">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isEditMode}
                onChange={(e) => setIsEditMode(e.target.checked)}
                className="h-4 w-4 text-linear-accent border-linear-border rounded focus:ring-linear-accent"
              />
              <span className="text-sm font-medium text-linear-text-secondary">
                Enable editing (make changes before approval)
              </span>
            </label>
          </div>

          {/* Case Details */}
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-linear-text-secondary mb-1">
                Case Title
              </label>
              <div className="text-base text-linear-text-primary">{caseData.title}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-linear-text-secondary mb-1">
                  Case Number
                </label>
                <div className="text-base text-linear-text-primary">{caseData.caseNumber}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-linear-text-secondary mb-1">
                  Type
                </label>
                <div className="text-base text-linear-text-primary">{caseData.type}</div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-linear-text-secondary mb-1">
                Client
              </label>
              <div className="text-base text-linear-text-primary">
                {caseData.client?.name || 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-linear-text-secondary mb-1">
                Description
              </label>
              <div className="text-base text-linear-text-primary whitespace-pre-wrap">
                {caseData.description}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-linear-text-secondary mb-1">
                  Status
                </label>
                <div>
                  <span className="inline-flex items-center rounded-full bg-linear-warning/15 px-3 py-1 text-xs font-medium text-linear-warning">
                    {caseData.status}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-linear-text-secondary mb-1">
                  Opened Date
                </label>
                <div className="text-base text-linear-text-primary">
                  {formatDate(caseData.openedDate)}
                </div>
              </div>
            </div>

            {isEditMode && (
              <div className="bg-linear-warning/10 border border-linear-warning/30 rounded-md p-3 mt-4">
                <p className="text-sm text-linear-warning">
                  <strong>Note:</strong> Inline editing is not yet implemented. This will be added
                  in a future update.
                </p>
              </div>
            )}
          </div>

          {/* Rejection Form */}
          {showRejectForm && (
            <div className="border-t border-linear-border-subtle bg-linear-error/10 px-6 py-4">
              <h3 className="text-sm font-medium text-linear-error mb-2">
                Provide Rejection Reason
              </h3>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain what needs to be changed... (minimum 10 characters)"
                className="w-full bg-linear-bg-secondary border border-linear-error/50 rounded-md px-3 py-2 text-sm text-linear-text-primary focus:outline-none focus:ring-2 focus:ring-linear-error focus:border-transparent"
                rows={4}
              />
              {rejectionReason.length > 0 && rejectionReason.length < 10 && (
                <p className="text-xs text-linear-error mt-1">
                  Reason must be at least 10 characters (current: {rejectionReason.length})
                </p>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="sticky bottom-0 bg-linear-bg-tertiary border-t border-linear-border-subtle px-6 py-4 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-linear-text-secondary bg-linear-bg-secondary border border-linear-border rounded-md hover:bg-linear-bg-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-linear-accent"
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
                    className="px-4 py-2 text-sm font-medium text-linear-text-secondary bg-linear-bg-secondary border border-linear-border rounded-md hover:bg-linear-bg-hover"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={rejectionReason.trim().length < 10 || loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-linear-error rounded-md hover:bg-linear-error/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-linear-error disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Rejecting...' : 'Submit Rejection'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-linear-error rounded-md hover:bg-linear-error/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-linear-error disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reject Case
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-linear-success rounded-md hover:bg-linear-success/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-linear-success disabled:opacity-50 disabled:cursor-not-allowed"
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
