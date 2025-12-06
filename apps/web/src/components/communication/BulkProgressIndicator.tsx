/**
 * Bulk Progress Indicator Component
 * Story 5.5: Multi-Channel Communication Hub (AC: 3)
 *
 * Displays real-time progress of bulk communication sending
 */

'use client';

import React, { useCallback } from 'react';
import {
  useBulkCommunicationProgress,
  useCancelBulkCommunication,
  useBulkCommunicationStatuses,
  formatEstimatedTime,
} from '@/hooks/useBulkCommunication';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Send,
  X,
  Users,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface BulkProgressIndicatorProps {
  id: string;
  onComplete?: () => void;
  onCancel?: () => void;
  showCancelButton?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function BulkProgressIndicator({
  id,
  onComplete,
  onCancel,
  showCancelButton = true,
  className = '',
}: BulkProgressIndicatorProps) {
  // Hooks
  const { progress, loading, error, isPolling } = useBulkCommunicationProgress(id);
  const { cancel, loading: cancelling } = useCancelBulkCommunication();
  const { getStatusColor } = useBulkCommunicationStatuses();

  // Handle cancel
  const handleCancel = useCallback(async () => {
    try {
      await cancel(id);
      onCancel?.();
    } catch (err) {
      // Error handled by hook
    }
  }, [id, cancel, onCancel]);

  // Check if complete
  const isComplete = progress?.percentComplete === 100;
  const hasFailed = (progress?.failedCount || 0) > 0;

  // Call onComplete when done
  React.useEffect(() => {
    if (isComplete && onComplete) {
      const timeout = setTimeout(onComplete, 2000);
      return () => clearTimeout(timeout);
    }
  }, [isComplete, onComplete]);

  // Loading state
  if (loading && !progress) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading progress...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 p-4 ${className}`}>
        <div className="flex items-center gap-2 text-red-700">
          <XCircle className="h-5 w-5" />
          <span className="font-medium">Failed to load progress</span>
        </div>
        <p className="mt-1 text-sm text-red-600">{error.message}</p>
      </div>
    );
  }

  if (!progress) {
    return null;
  }

  const { totalRecipients, sentCount, failedCount, pendingCount, percentComplete, estimatedTimeRemaining } = progress;

  return (
    <div
      className={`space-y-4 ${className}`}
      role="region"
      aria-label="Bulk communication progress"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isComplete ? (
            hasFailed ? (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          )}
          <span className="font-medium text-gray-900">
            {isComplete
              ? hasFailed
                ? 'Completed with errors'
                : 'All sent successfully'
              : 'Sending...'}
          </span>
        </div>
        {showCancelButton && !isComplete && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelling ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
            Cancel
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-gray-600">
            {sentCount} of {totalRecipients} sent
          </span>
          <span className="font-medium text-gray-900">{Math.round(percentComplete)}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full transition-all duration-500 ease-out ${
              isComplete
                ? hasFailed
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
                : 'bg-blue-500'
            }`}
            style={{ width: `${percentComplete}%` }}
            role="progressbar"
            aria-valuenow={percentComplete}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-green-50 p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-2xl font-bold">{sentCount}</span>
          </div>
          <div className="text-xs text-green-600">Sent</div>
        </div>
        <div className="rounded-lg bg-red-50 p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-red-600">
            <XCircle className="h-4 w-4" />
            <span className="text-2xl font-bold">{failedCount}</span>
          </div>
          <div className="text-xs text-red-600">Failed</div>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-gray-600">
            <Clock className="h-4 w-4" />
            <span className="text-2xl font-bold">{pendingCount}</span>
          </div>
          <div className="text-xs text-gray-600">Pending</div>
        </div>
      </div>

      {/* Estimated Time */}
      {!isComplete && estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <Clock className="h-4 w-4" />
          <span>Estimated time remaining: {formatEstimatedTime(estimatedTimeRemaining)}</span>
        </div>
      )}

      {/* Failed Recipients Warning */}
      {failedCount > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                {failedCount} message{failedCount !== 1 ? 's' : ''} failed to send
              </p>
              <p className="mt-1 text-xs text-yellow-700">
                Failed recipients may have invalid email addresses or temporary delivery issues.
                You can retry sending to failed recipients later.
              </p>
              {isComplete && (
                <button
                  className="mt-2 text-xs font-medium text-yellow-700 underline hover:text-yellow-800"
                  onClick={() => {
                    // TODO: Implement view failed recipients
                  }}
                >
                  View failed recipients
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {isComplete && !hasFailed && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
          <CheckCircle className="mx-auto h-8 w-8 text-green-500" />
          <p className="mt-2 font-medium text-green-800">
            All {totalRecipients} messages sent successfully!
          </p>
        </div>
      )}

      {/* Screen reader status */}
      <div className="sr-only" aria-live="polite">
        {isComplete
          ? `Bulk communication complete. ${sentCount} sent, ${failedCount} failed.`
          : `Sending in progress. ${sentCount} of ${totalRecipients} sent. ${Math.round(percentComplete)} percent complete.`}
      </div>
    </div>
  );
}

export default BulkProgressIndicator;
