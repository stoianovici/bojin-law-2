/**
 * useThreadAttachments Hook
 * OPS-122: Inline Attachment Preview Panel
 *
 * Aggregates all attachments from all messages in a thread
 * with source message info for easy navigation.
 */

import { useMemo } from 'react';
import type { CommunicationThread } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

export interface ThreadAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  messageId: string;
  messageSender: string;
  messageSenderEmail: string;
  messageDate: Date;
  downloadUrl?: string;
  previewUrl?: string;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Extracts and aggregates all attachments from a thread's messages
 * @param thread - The communication thread to extract attachments from
 * @returns Array of attachments with source message metadata
 */
export function useThreadAttachments(thread: CommunicationThread | null): ThreadAttachment[] {
  return useMemo(() => {
    if (!thread) return [];

    const attachments: ThreadAttachment[] = [];

    for (const message of thread.messages) {
      if (!message.attachments || message.attachments.length === 0) continue;

      for (const att of message.attachments) {
        // Handle both Attachment type (filename, fileSize, mimeType) and runtime data (name, size, contentType)
        const attAny = att as any;
        attachments.push({
          id: att.id,
          name: attAny.name || att.filename || 'Attachment',
          contentType: attAny.contentType || att.mimeType || 'application/octet-stream',
          size: attAny.size || att.fileSize || 0,
          messageId: message.id,
          messageSender: message.senderName,
          messageSenderEmail: message.senderEmail,
          messageDate:
            message.sentDate instanceof Date ? message.sentDate : new Date(message.sentDate),
          downloadUrl: attAny.url || att.downloadUrl,
          previewUrl: attAny.previewUrl,
        });
      }
    }

    // Sort by message date (newest first)
    return attachments.sort((a, b) => b.messageDate.getTime() - a.messageDate.getTime());
  }, [thread]);
}

/**
 * Get attachment by ID from the list
 */
export function findAttachmentById(
  attachments: ThreadAttachment[],
  attachmentId: string
): ThreadAttachment | undefined {
  return attachments.find((att) => att.id === attachmentId);
}

/**
 * Get attachments from a specific message
 */
export function getAttachmentsByMessageId(
  attachments: ThreadAttachment[],
  messageId: string
): ThreadAttachment[] {
  return attachments.filter((att) => att.messageId === messageId);
}

/**
 * Get previous/next attachment in the list
 */
export function getAdjacentAttachments(
  attachments: ThreadAttachment[],
  currentId: string
): { prev: ThreadAttachment | null; next: ThreadAttachment | null } {
  const currentIndex = attachments.findIndex((att) => att.id === currentId);

  if (currentIndex === -1) {
    return { prev: null, next: null };
  }

  return {
    prev: currentIndex > 0 ? attachments[currentIndex - 1] : null,
    next: currentIndex < attachments.length - 1 ? attachments[currentIndex + 1] : null,
  };
}
