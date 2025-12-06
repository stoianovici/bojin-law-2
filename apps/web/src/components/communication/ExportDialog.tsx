/**
 * Export Dialog Component
 * Story 5.5: Multi-Channel Communication Hub (AC: 5)
 *
 * Dialog for exporting communication history with format and filter options
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  useExportCommunications,
  useExportStatus,
  useExportFormats,
  formatExpiryTime,
  type ExportFormat,
  type CommunicationChannel,
} from '@/hooks/useCommunicationExport';
import {
  X,
  Download,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Filter,
  Paperclip,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ExportDialogProps {
  caseId: string;
  onClose?: () => void;
  onExportComplete?: (exportId: string, downloadUrl: string) => void;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const CHANNEL_OPTIONS: { value: CommunicationChannel; label: string }[] = [
  { value: 'Email', label: 'Email' },
  { value: 'InternalNote', label: 'Internal Notes' },
  { value: 'Phone', label: 'Phone Calls' },
  { value: 'Meeting', label: 'Meeting Notes' },
];

// ============================================================================
// Component
// ============================================================================

export function ExportDialog({
  caseId,
  onClose,
  onExportComplete,
  className = '',
}: ExportDialogProps) {
  // Form state
  const [format, setFormat] = useState<ExportFormat>('PDF');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [channelTypes, setChannelTypes] = useState<CommunicationChannel[]>([]);
  const [includeAttachments, setIncludeAttachments] = useState(false);

  // Export state
  const [exportId, setExportId] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'processing' | 'complete' | 'error'>('form');

  // Hooks
  const { requestExport, loading: requesting, error: requestError } = useExportCommunications();
  const { export: exportData, isPolling } = useExportStatus(exportId || '', {
    enabled: !!exportId && step === 'processing',
  });
  const { formats, getFormatIcon, getFormatDescription } = useExportFormats();

  // Watch export status
  useEffect(() => {
    if (!exportData) return;

    if (exportData.status === 'Completed') {
      setStep('complete');
      if (exportData.downloadUrl) {
        onExportComplete?.(exportData.id, exportData.downloadUrl);
      }
    } else if (exportData.status === 'Failed') {
      setStep('error');
    }
  }, [exportData, onExportComplete]);

  // Toggle channel type
  const handleChannelToggle = useCallback((channel: CommunicationChannel) => {
    setChannelTypes((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  }, []);

  // Submit export request
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      try {
        const result = await requestExport({
          caseId,
          format,
          dateRangeFrom: dateFrom || undefined,
          dateRangeTo: dateTo || undefined,
          channelTypes: channelTypes.length > 0 ? channelTypes : undefined,
          includeAttachments,
        });

        setExportId(result.id);
        setStep('processing');
      } catch (err) {
        // Error handled by hook
      }
    },
    [caseId, format, dateFrom, dateTo, channelTypes, includeAttachments, requestExport]
  );

  // Download handler
  const handleDownload = useCallback(() => {
    if (exportData?.downloadUrl) {
      window.open(exportData.downloadUrl, '_blank');
    }
  }, [exportData]);

  // Reset and try again
  const handleReset = useCallback(() => {
    setExportId(null);
    setStep('form');
  }, []);

  return (
    <div
      className={`flex flex-col ${className}`}
      role="dialog"
      aria-labelledby="export-title"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 id="export-title" className="text-lg font-semibold text-gray-900">
            Export Communications
          </h2>
          <p className="text-sm text-gray-500">Download case communication history</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-4">
        {/* Form Step */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Display */}
            {requestError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {requestError.message}
              </div>
            )}

            {/* Format Selection */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Export Format
              </label>
              <div className="grid grid-cols-2 gap-2">
                {formats.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFormat(f.value)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      format === f.value
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-2xl">{f.icon}</span>
                    <div>
                      <div
                        className={`text-sm font-medium ${
                          format === f.value ? 'text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        {f.label}
                      </div>
                      <div className="text-xs text-gray-500">{f.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <Calendar className="h-4 w-4" />
                Date Range (Optional)
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date-from" className="mb-1 block text-xs text-gray-500">
                    From
                  </label>
                  <input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="date-to" className="mb-1 block text-xs text-gray-500">
                    To
                  </label>
                  <input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Channel Types */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <Filter className="h-4 w-4" />
                Communication Types (Optional)
              </label>
              <p className="mb-2 text-xs text-gray-500">
                Leave empty to include all types
              </p>
              <div className="flex flex-wrap gap-2">
                {CHANNEL_OPTIONS.map((channel) => (
                  <button
                    key={channel.value}
                    type="button"
                    onClick={() => handleChannelToggle(channel.value)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      channelTypes.includes(channel.value)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {channel.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Include Attachments */}
            <div className="rounded-lg border border-gray-200 p-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeAttachments}
                  onChange={(e) => setIncludeAttachments(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Paperclip className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">Include attachments</span>
              </label>
              {includeAttachments && (
                <p className="ml-6 mt-1 text-xs text-gray-500">
                  Attachments will be bundled as a ZIP file with the export
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={requesting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {requesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Start Export
            </button>
          </form>
        )}

        {/* Processing Step */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Generating Export
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              This may take a few moments...
            </p>
            {exportData && (
              <p className="mt-4 text-sm text-gray-600">
                Processing {exportData.totalEntries} entries
              </p>
            )}
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && exportData && (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Export Ready
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {exportData.totalEntries} entries exported
            </p>

            {exportData.expiresAt && (
              <p className="mt-2 text-xs text-gray-400">
                Download expires: {formatExpiryTime(exportData.expiresAt)}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Download className="h-4 w-4" />
                Download {getFormatIcon(exportData.format)}
              </button>
              <button
                onClick={handleReset}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Export Another
              </button>
            </div>
          </div>
        )}

        {/* Error Step */}
        {step === 'error' && (
          <div className="flex flex-col items-center justify-center py-8">
            <XCircle className="h-12 w-12 text-red-500" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Export Failed
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {exportData?.errorMessage || 'An error occurred while generating the export'}
            </p>

            <button
              onClick={handleReset}
              className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      {step === 'form' && (
        <div className="border-t pt-4">
          <p className="text-xs text-gray-500">
            Exports are available for download for 7 days after generation.
          </p>
        </div>
      )}
    </div>
  );
}

export default ExportDialog;
