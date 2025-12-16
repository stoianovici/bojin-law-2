/**
 * Communication Export React Hooks
 * Story 5.5: Multi-Channel Communication Hub (AC: 5)
 *
 * Provides hooks for exporting communication history
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback, useEffect, useState } from 'react';

// ============================================================================
// GraphQL Fragments
// ============================================================================

const COMMUNICATION_EXPORT_FRAGMENT = gql`
  fragment CommunicationExportFields on CommunicationExport {
    id
    caseId
    format
    totalEntries
    status
    downloadUrl
    expiresAt
    createdAt
    completedAt
    errorMessage
  }
`;

// ============================================================================
// Queries
// ============================================================================

const GET_CASE_EXPORTS = gql`
  ${COMMUNICATION_EXPORT_FRAGMENT}
  query GetCommunicationExports($caseId: ID!) {
    communicationExports(caseId: $caseId) {
      ...CommunicationExportFields
    }
  }
`;

const GET_EXPORT = gql`
  ${COMMUNICATION_EXPORT_FRAGMENT}
  query GetCommunicationExport($id: ID!) {
    communicationExport(id: $id) {
      ...CommunicationExportFields
    }
  }
`;

// ============================================================================
// Mutations
// ============================================================================

const EXPORT_COMMUNICATIONS = gql`
  ${COMMUNICATION_EXPORT_FRAGMENT}
  mutation ExportCommunications($input: ExportCommunicationsInput!) {
    exportCommunications(input: $input) {
      ...CommunicationExportFields
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export type ExportFormat = 'PDF' | 'CSV' | 'JSON' | 'DOCX';

export type ExportStatus = 'Processing' | 'Completed' | 'Failed' | 'Expired';

export type CommunicationChannel =
  | 'Email'
  | 'InternalNote'
  | 'WhatsApp'
  | 'Phone'
  | 'Meeting'
  | 'SMS';

export interface CommunicationExport {
  id: string;
  caseId: string;
  format: ExportFormat;
  totalEntries: number;
  status: ExportStatus;
  downloadUrl?: string;
  expiresAt?: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface ExportCommunicationsInput {
  caseId: string;
  format: ExportFormat;
  dateRangeFrom?: string;
  dateRangeTo?: string;
  channelTypes?: CommunicationChannel[];
  includeAttachments?: boolean;
}

// ============================================================================
// GraphQL Response Types
// ============================================================================

interface GetCaseExportsData {
  communicationExports: CommunicationExport[];
}

interface GetExportData {
  communicationExport: CommunicationExport | null;
}

interface ExportCommunicationsData {
  exportCommunications: CommunicationExport;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for listing exports for a case
 */
export function useCaseExports(caseId: string) {
  const { data, loading, error, refetch } = useQuery<GetCaseExportsData>(GET_CASE_EXPORTS, {
    variables: { caseId },
    skip: !caseId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    exports: data?.communicationExports || [],
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for requesting a new export
 */
export function useExportCommunications() {
  const [exportMutation, { loading, error }] =
    useMutation<ExportCommunicationsData>(EXPORT_COMMUNICATIONS);

  const requestExport = useCallback(
    async (input: ExportCommunicationsInput) => {
      const result = await exportMutation({
        variables: { input },
        refetchQueries: [
          {
            query: GET_CASE_EXPORTS,
            variables: { caseId: input.caseId },
          },
        ],
      });

      return result.data?.exportCommunications;
    },
    [exportMutation]
  );

  return {
    requestExport,
    loading,
    error,
  };
}

/**
 * Hook for polling export status until complete
 */
export function useExportStatus(
  exportId: string,
  options?: { pollingInterval?: number; enabled?: boolean }
) {
  const { pollingInterval = 2000, enabled = true } = options || {};
  const [isPolling, setIsPolling] = useState(false);

  const { data, loading, error, startPolling, stopPolling, refetch } = useQuery<GetExportData>(
    GET_EXPORT,
    {
      variables: { id: exportId },
      skip: !exportId || !enabled,
      fetchPolicy: 'network-only',
    }
  );

  const exportData = data?.communicationExport ?? undefined;

  // Start/stop polling based on status
  useEffect(() => {
    if (!exportId || !enabled) return;

    const isTerminal =
      exportData?.status === 'Completed' ||
      exportData?.status === 'Failed' ||
      exportData?.status === 'Expired';

    if (exportData && !isTerminal && !isPolling) {
      startPolling(pollingInterval);
      setIsPolling(true);
    } else if (exportData && isTerminal && isPolling) {
      stopPolling();
      setIsPolling(false);
    }

    return () => {
      if (isPolling) {
        stopPolling();
      }
    };
  }, [exportId, enabled, exportData, isPolling, pollingInterval, startPolling, stopPolling]);

  return {
    export: exportData,
    loading,
    error,
    isPolling,
    refetch,
  };
}

/**
 * Utility hook for export formats
 */
export function useExportFormats() {
  const formats: { value: ExportFormat; label: string; description: string; icon: string }[] = [
    {
      value: 'PDF',
      label: 'PDF Document',
      description: 'Formatted document with full styling',
      icon: '📄',
    },
    {
      value: 'CSV',
      label: 'CSV Spreadsheet',
      description: 'Comma-separated values for data analysis',
      icon: '📊',
    },
    {
      value: 'JSON',
      label: 'JSON Data',
      description: 'Machine-readable format for integration',
      icon: '🔧',
    },
    {
      value: 'DOCX',
      label: 'Word Document',
      description: 'Editable Microsoft Word document',
      icon: '📝',
    },
  ];

  const getFormatLabel = useCallback((format: ExportFormat) => {
    return formats.find((f) => f.value === format)?.label || format;
  }, []);

  const getFormatDescription = useCallback((format: ExportFormat) => {
    return formats.find((f) => f.value === format)?.description || '';
  }, []);

  const getFormatIcon = useCallback((format: ExportFormat) => {
    return formats.find((f) => f.value === format)?.icon || '📄';
  }, []);

  return {
    formats,
    getFormatLabel,
    getFormatDescription,
    getFormatIcon,
  };
}

/**
 * Utility hook for export statuses
 */
export function useExportStatuses() {
  const statuses: { value: ExportStatus; label: string; color: string }[] = [
    {
      value: 'Processing',
      label: 'Processing',
      color: 'bg-blue-100 text-blue-700',
    },
    {
      value: 'Completed',
      label: 'Completed',
      color: 'bg-green-100 text-green-700',
    },
    {
      value: 'Failed',
      label: 'Failed',
      color: 'bg-red-100 text-red-700',
    },
    {
      value: 'Expired',
      label: 'Expired',
      color: 'bg-gray-100 text-gray-700',
    },
  ];

  const getStatusLabel = useCallback((status: ExportStatus) => {
    return statuses.find((s) => s.value === status)?.label || status;
  }, []);

  const getStatusColor = useCallback((status: ExportStatus) => {
    return statuses.find((s) => s.value === status)?.color || 'bg-gray-100 text-gray-700';
  }, []);

  const isDownloadable = useCallback((status: ExportStatus) => {
    return status === 'Completed';
  }, []);

  return {
    statuses,
    getStatusLabel,
    getStatusColor,
    isDownloadable,
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format expiry time
 */
export function formatExpiryTime(expiresAt: string): string {
  const expiry = new Date(expiresAt);
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();

  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''} remaining`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''} remaining`;
  } else {
    return 'Expires soon';
  }
}
