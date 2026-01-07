/**
 * Task Attachments React Hooks
 * Story 4.6: Task Collaboration and Updates (AC: 3)
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';

// Types
interface User {
  id: string;
  firstName: string;
  lastName: string;
}

interface TaskAttachment {
  id: string;
  taskId: string;
  documentId?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageUrl: string;
  uploadedBy: string;
  uploader: User;
  version: number;
  previousVersionId?: string;
  createdAt: string;
}

// GraphQL Fragments
const ATTACHMENT_FRAGMENT = gql`
  fragment AttachmentFields on TaskAttachment {
    id
    taskId
    documentId
    fileName
    fileSize
    mimeType
    storageUrl
    uploadedBy
    uploader {
      id
      firstName
      lastName
    }
    version
    previousVersionId
    createdAt
  }
`;

// Queries
const GET_TASK_ATTACHMENTS = gql`
  ${ATTACHMENT_FRAGMENT}
  query GetTaskAttachments($taskId: ID!) {
    taskAttachments(taskId: $taskId) {
      ...AttachmentFields
    }
  }
`;

const GET_ATTACHMENT_VERSIONS = gql`
  ${ATTACHMENT_FRAGMENT}
  query GetAttachmentVersions($attachmentId: ID!) {
    attachmentVersionHistory(attachmentId: $attachmentId) {
      ...AttachmentFields
    }
  }
`;

// Mutations
const DELETE_TASK_ATTACHMENT = gql`
  mutation DeleteTaskAttachment($attachmentId: ID!) {
    deleteTaskAttachment(attachmentId: $attachmentId)
  }
`;

// Custom Hooks

/**
 * Hook to get all attachments for a task
 */
export function useTaskAttachments(taskId: string) {
  return useQuery<{ taskAttachments: TaskAttachment[] }>(GET_TASK_ATTACHMENTS, {
    variables: { taskId },
    skip: !taskId,
  });
}

/**
 * Hook to get version history for an attachment
 */
export function useAttachmentVersions(attachmentId: string) {
  return useQuery<{ attachmentVersionHistory: TaskAttachment[] }>(GET_ATTACHMENT_VERSIONS, {
    variables: { attachmentId },
    skip: !attachmentId,
  });
}

/**
 * Hook to delete an attachment
 */
export function useDeleteTaskAttachment() {
  return useMutation<{ deleteTaskAttachment: boolean }, { attachmentId: string }>(
    DELETE_TASK_ATTACHMENT,
    {
      refetchQueries: ['GetTaskAttachments'],
    }
  );
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get icon for file type
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📽️';
  if (mimeType.startsWith('text/')) return '📃';
  return '📎';
}

/**
 * Check if file type is allowed
 */
export function isAllowedFileType(mimeType: string): boolean {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
  ];
  return allowedTypes.includes(mimeType);
}

/**
 * Maximum file size in bytes (50MB)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export type { TaskAttachment };
