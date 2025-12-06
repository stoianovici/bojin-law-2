'use client';

/**
 * Word Sync Status Component
 * Story 3.4: Word Integration with Live AI Assistance - Task 17
 *
 * Displays the synchronization status between platform and OneDrive.
 */

import React from 'react';
import { useQuery, useSubscription, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// GraphQL Operations
const GET_DOCUMENT_SYNC_STATUS = gql`
  query GetDocumentSyncStatus($documentId: UUID!) {
    documentSyncStatus(documentId: $documentId) {
      status
      lastSyncAt
      oneDriveId
      oneDrivePath
      errorMessage
    }
  }
`;

const SYNC_STATUS_CHANGED = gql`
  subscription OnDocumentSyncStatusChanged($documentId: UUID!) {
    documentSyncStatusChanged(documentId: $documentId) {
      status
      lastSyncAt
      oneDriveId
      oneDrivePath
      errorMessage
    }
  }
`;

const SYNC_FROM_ONEDRIVE = gql`
  mutation SyncDocumentFromOneDrive($documentId: UUID!) {
    syncDocumentFromOneDrive(documentId: $documentId) {
      updated
      newVersionNumber
      commentsCount
    }
  }
`;

interface WordSyncStatusProps {
  documentId: string;
  variant?: 'badge' | 'detailed' | 'compact';
  showSyncButton?: boolean;
  className?: string;
}

interface SyncStatusInfo {
  status: string;
  lastSyncAt?: string;
  oneDriveId?: string;
  oneDrivePath?: string;
  errorMessage?: string;
}

interface DocumentSyncStatusData {
  documentSyncStatus: SyncStatusInfo;
}

export function WordSyncStatus({
  documentId,
  variant = 'badge',
  showSyncButton = false,
  className,
}: WordSyncStatusProps) {
  // Query sync status
  const { data, loading, error, refetch } = useQuery<DocumentSyncStatusData>(GET_DOCUMENT_SYNC_STATUS, {
    variables: { documentId },
    pollInterval: 60000, // Poll every minute
  });

  // Subscribe to sync status changes
  useSubscription(SYNC_STATUS_CHANGED, {
    variables: { documentId },
    onData: () => {
      refetch();
    },
  });

  // Sync mutation
  const [syncFromOneDrive, { loading: syncing }] = useMutation(SYNC_FROM_ONEDRIVE, {
    variables: { documentId },
    onCompleted: () => {
      refetch();
    },
  });

  if (loading) {
    return (
      <Badge variant="outline" className={className}>
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Checking...
      </Badge>
    );
  }

  if (error) {
    return null;
  }

  const syncInfo = data?.documentSyncStatus;
  const { status, lastSyncAt, oneDriveId, oneDrivePath, errorMessage } = syncInfo || {};

  const statusConfig = {
    SYNCED: {
      icon: Check,
      label: 'Synced',
      color: 'text-green-600 border-green-200',
      bgColor: 'bg-green-50',
    },
    SYNCING: {
      icon: RefreshCw,
      label: 'Syncing...',
      color: 'text-blue-600 border-blue-200',
      bgColor: 'bg-blue-50',
    },
    PENDING_CHANGES: {
      icon: Cloud,
      label: 'Pending',
      color: 'text-amber-600 border-amber-200',
      bgColor: 'bg-amber-50',
    },
    ERROR: {
      icon: AlertCircle,
      label: 'Error',
      color: 'text-red-600 border-red-200',
      bgColor: 'bg-red-50',
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING_CHANGES;
  const StatusIcon = config.icon;
  const lastSyncTime = lastSyncAt ? formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true }) : 'Never';

  // Not connected to OneDrive
  if (!oneDriveId) {
    if (variant === 'compact') {
      return null;
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`text-gray-500 border-gray-200 ${className}`}>
              <CloudOff className="h-3 w-3 mr-1" />
              Not synced
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>This document is not connected to OneDrive</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`${config.color} ${className}`}>
              <StatusIcon className={`h-3 w-3 ${status === 'SYNCING' ? 'animate-spin' : ''}`} />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{config.label}</p>
            <p className="text-xs text-muted-foreground">Last synced {lastSyncTime}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'badge') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={config.color}>
                <StatusIcon className={`h-3 w-3 mr-1 ${status === 'SYNCING' ? 'animate-spin' : ''}`} />
                {config.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p>OneDrive: {oneDrivePath || 'Connected'}</p>
                <p className="text-xs text-muted-foreground">Last synced {lastSyncTime}</p>
                {errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {showSyncButton && status !== 'SYNCING' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => syncFromOneDrive()}
                  disabled={syncing}
                >
                  <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sync now</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  // Detailed variant
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${config.color} ${config.bgColor} ${className}`}>
      <div className="flex-shrink-0">
        <StatusIcon className={`h-5 w-5 ${status === 'SYNCING' ? 'animate-spin' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{config.label}</span>
        </div>
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mt-0.5">
          {oneDrivePath && <span className="truncate">{oneDrivePath}</span>}
          <span>Last synced {lastSyncTime}</span>
          {errorMessage && <span className="text-red-500">{errorMessage}</span>}
        </div>
      </div>
      {showSyncButton && status !== 'SYNCING' && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncFromOneDrive()}
          disabled={syncing}
        >
          {syncing ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          Sync
        </Button>
      )}
    </div>
  );
}

export default WordSyncStatus;
