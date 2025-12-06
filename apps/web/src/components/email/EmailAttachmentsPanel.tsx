/**
 * Email Attachments Panel Component
 * Story 5.1: Email Integration and Synchronization
 *
 * Displays and manages email attachments (AC: 4)
 */

'use client';

import React, { useState } from 'react';
import { gql, useMutation } from '@apollo/client';
import { Spinner } from '@/components/ui/Spinner';

const SYNC_EMAIL_ATTACHMENTS = gql`
  mutation SyncEmailAttachments($emailId: ID!) {
    syncEmailAttachments(emailId: $emailId) {
      id
      name
      contentType
      size
      downloadUrl
    }
  }
`;

interface Attachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  downloadUrl?: string;
}

interface EmailAttachmentsPanelProps {
  attachments: Attachment[];
  emailId: string;
}

export function EmailAttachmentsPanel({
  attachments,
  emailId,
}: EmailAttachmentsPanelProps) {
  const [syncAttachments, { loading }] = useMutation(SYNC_EMAIL_ATTACHMENTS);
  const [syncedAttachments, setSyncedAttachments] = useState<Attachment[]>(attachments);

  const handleSync = async () => {
    try {
      const result = await syncAttachments({ variables: { emailId } });
      if (result.data?.syncEmailAttachments) {
        setSyncedAttachments(result.data.syncEmailAttachments);
      }
    } catch (error) {
      console.error('Failed to sync attachments:', error);
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    if (attachment.downloadUrl) {
      window.open(attachment.downloadUrl, '_blank');
    } else {
      // Trigger sync to get download URL
      const result = await syncAttachments({ variables: { emailId } });
      const synced = result.data?.syncEmailAttachments?.find(
        (a: Attachment) => a.id === attachment.id
      );
      if (synced?.downloadUrl) {
        window.open(synced.downloadUrl, '_blank');
      }
    }
  };

  const displayAttachments = syncedAttachments.length > 0 ? syncedAttachments : attachments;

  return (
    <div className="border-t border-gray-200 p-4 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
          Attachments ({displayAttachments.length})
        </h4>
        {!displayAttachments.some((a) => a.downloadUrl) && (
          <button
            onClick={handleSync}
            disabled={loading}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            {loading ? <Spinner size="xs" /> : <SyncIcon />}
            Sync
          </button>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {displayAttachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700"
          >
            <div className="flex items-center gap-3">
              <FileIcon contentType={attachment.contentType} />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {attachment.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatFileSize(attachment.size)}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleDownload(attachment)}
              className="rounded-md p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-600 dark:hover:text-gray-200"
              title="Download"
            >
              <DownloadIcon />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileIcon({ contentType }: { contentType: string }) {
  const getIconColor = () => {
    if (contentType.includes('pdf')) return 'text-red-500';
    if (contentType.includes('word') || contentType.includes('document'))
      return 'text-blue-500';
    if (contentType.includes('sheet') || contentType.includes('excel'))
      return 'text-green-500';
    if (contentType.includes('image')) return 'text-purple-500';
    return 'text-gray-500';
  };

  return (
    <div className={`rounded-lg bg-white p-2 dark:bg-gray-600 ${getIconColor()}`}>
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function SyncIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}
