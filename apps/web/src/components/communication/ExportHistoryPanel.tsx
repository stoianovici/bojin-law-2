/**
 * Export History Panel Component
 * Story 5.5: Multi-Channel Communication Hub (AC: 5)
 *
 * Displays list of past exports with status and download options
 */

'use client';

import React, { useCallback } from 'react';
import {
  useCaseExports,
  useExportFormats,
  useExportStatuses,
  formatExpiryTime,
  type CommunicationExport,
} from '@/hooks/useCommunicationExport';
import {
  Download,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ExportHistoryPanelProps {
  caseId: string;
  onNewExport?: () => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ExportHistoryPanel({
  caseId,
  onNewExport,
  className = '',
}: ExportHistoryPanelProps) {
  // Hooks
  const { exports, loading, error, refetch } = useCaseExports(caseId);
  const { getFormatLabel, getFormatIcon } = useExportFormats();
  const { getStatusLabel, getStatusColor, isDownloadable } = useExportStatuses();

  // Download handler
  const handleDownload = useCallback((exportItem: CommunicationExport) => {
    if (exportItem.downloadUrl) {
      window.open(exportItem.downloadUrl, '_blank');
    }
  }, []);

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status icon
  const getStatusIcon = (status: CommunicationExport['status']) => {
    switch (status) {
      case 'Processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'Completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'Failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'Expired':
        return <Clock className="h-4 w-4 text-gray-400" />;
      default:
        return <FileText className="h-4 w-4 text-gray-400" />;
    }
  };

  // Loading state
  if (loading && exports.length === 0) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading exports...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 p-4 ${className}`}>
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Failed to load exports</span>
        </div>
        <p className="mt-1 text-sm text-red-600">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-2 flex items-center gap-1 text-sm text-red-700 underline"
        >
          <RefreshCw className="h-3 w-3" />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Export History</h3>
          <p className="text-xs text-gray-500">
            {exports.length} export{exports.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {onNewExport && (
            <button
              onClick={onNewExport}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              New Export
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {exports.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <FileText className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">No exports yet</p>
          {onNewExport && (
            <button
              onClick={onNewExport}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create First Export
            </button>
          )}
        </div>
      )}

      {/* Export List */}
      {exports.length > 0 && (
        <div
          className="overflow-hidden rounded-lg border border-gray-200"
          role="table"
          aria-label="Export history"
        >
          {/* Table Header */}
          <div
            className="grid grid-cols-12 gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-medium uppercase text-gray-500"
            role="row"
          >
            <div className="col-span-3" role="columnheader">
              Format
            </div>
            <div className="col-span-2" role="columnheader">
              Entries
            </div>
            <div className="col-span-2" role="columnheader">
              Status
            </div>
            <div className="col-span-3" role="columnheader">
              Created
            </div>
            <div className="col-span-2 text-right" role="columnheader">
              Actions
            </div>
          </div>

          {/* Table Body */}
          <div role="rowgroup">
            {exports.map((exportItem) => (
              <div
                key={exportItem.id}
                className="grid grid-cols-12 gap-4 border-b border-gray-100 px-4 py-3 last:border-b-0 hover:bg-gray-50"
                role="row"
              >
                {/* Format */}
                <div className="col-span-3 flex items-center gap-2" role="cell">
                  <span className="text-lg">{getFormatIcon(exportItem.format)}</span>
                  <span className="text-sm font-medium text-gray-900">
                    {getFormatLabel(exportItem.format)}
                  </span>
                </div>

                {/* Entries */}
                <div className="col-span-2 flex items-center" role="cell">
                  <span className="text-sm text-gray-600">{exportItem.totalEntries}</span>
                </div>

                {/* Status */}
                <div className="col-span-2 flex items-center gap-2" role="cell">
                  {getStatusIcon(exportItem.status)}
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(
                      exportItem.status
                    )}`}
                  >
                    {getStatusLabel(exportItem.status)}
                  </span>
                </div>

                {/* Created */}
                <div className="col-span-3 flex flex-col justify-center" role="cell">
                  <span className="text-sm text-gray-900">{formatDate(exportItem.createdAt)}</span>
                  {exportItem.status === 'Completed' && exportItem.expiresAt && (
                    <span className="text-xs text-gray-500">
                      {formatExpiryTime(exportItem.expiresAt)}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end gap-2" role="cell">
                  {isDownloadable(exportItem.status) && exportItem.downloadUrl && (
                    <button
                      onClick={() => handleDownload(exportItem)}
                      className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      title="Download"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </button>
                  )}
                  {exportItem.status === 'Processing' && (
                    <span className="text-xs text-gray-400">Processing...</span>
                  )}
                  {exportItem.status === 'Expired' && (
                    <span className="text-xs text-gray-400">Expired</span>
                  )}
                  {exportItem.status === 'Failed' && (
                    <span className="text-xs text-red-500">Failed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Footer */}
      <p className="mt-3 text-xs text-gray-500">Exports are automatically deleted after 7 days</p>
    </div>
  );
}

export default ExportHistoryPanel;
