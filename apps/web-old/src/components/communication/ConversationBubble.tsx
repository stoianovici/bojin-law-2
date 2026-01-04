'use client';

/**
 * ConversationBubble Component
 * OPS-121: Chat-style message bubble for conversation-first thread view
 *
 * Displays individual messages as chat bubbles with visual distinction
 * for sent vs received messages. Uses clean content when available.
 */

import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Paperclip, Download, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { CommunicationMessage } from '@legal-platform/types';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Strips HTML tags and decodes entities for plain text display.
 * Used when bodyClean is not available and content is HTML.
 * Properly converts block-level elements to line breaks.
 */
function stripHtmlForDisplay(html: string): string {
  if (!html) return '';

  // Use DOMParser for proper HTML handling (client-side only)
  if (typeof window !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Remove style and script elements
    doc.querySelectorAll('style, script').forEach((el) => el.remove());

    // Convert block-level elements to newlines BEFORE extracting text
    // This preserves paragraph structure that textContent would lose
    const blockElements = [
      'p',
      'div',
      'br',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'li',
      'tr',
      'blockquote',
      'hr',
    ];
    blockElements.forEach((tag) => {
      doc.querySelectorAll(tag).forEach((el) => {
        // Insert newline marker before closing tag content
        if (tag === 'br' || tag === 'hr') {
          el.replaceWith('\n');
        } else {
          // Add newline after block element content
          el.insertAdjacentText('afterend', '\n');
        }
      });
    });

    // Get text content (now with proper line breaks)
    const text = doc.body.textContent || '';

    // Clean up excessive whitespace while preserving paragraph breaks
    return text
      .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
      .replace(/[ \t]+/g, ' ') // Collapse horizontal whitespace
      .replace(/ ?\n ?/g, '\n') // Clean spaces around newlines
      .trim();
  }

  // SSR fallback - basic regex strip with block element handling
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newlines
    .replace(/<\/?(p|div|h[1-6]|li|tr|blockquote)[^>]*>/gi, '\n') // Block elements to newlines
    .replace(/<hr\s*\/?>/gi, '\n---\n') // Horizontal rules
    .replace(/<[^>]+>/g, '') // Strip remaining tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .trim();
}

// ============================================================================
// Types
// ============================================================================

interface Attachment {
  id: string;
  name?: string;
  filename?: string;
  size?: number;
  fileSize?: number;
  mimeType?: string;
  contentType?: string;
  url?: string;
  downloadUrl?: string;
}

export interface ConversationBubbleProps {
  message: CommunicationMessage & { bodyClean?: string; hasAttachments?: boolean };
  isSent: boolean;
  onAttachmentClick: (attachment: Attachment) => void;
  onDownloadAttachment?: (attachmentId: string, attachmentName: string) => Promise<void>;
  downloadingId?: string | null;
}

// ============================================================================
// Component
// ============================================================================

export function ConversationBubble({
  message,
  isSent,
  onAttachmentClick,
  onDownloadAttachment,
  downloadingId,
}: ConversationBubbleProps) {
  // Use clean content if available, fall back to body
  // Strip HTML if body is HTML and no clean version available
  const content = (() => {
    if (message.bodyClean) return message.bodyClean;
    if (message.body?.trim().startsWith('<')) {
      return stripHtmlForDisplay(message.body);
    }
    return message.body;
  })();

  // Format the date - show relative for recent, full for older
  const formatMessageDate = (date: Date | string): string => {
    const messageDate = date instanceof Date ? date : new Date(date);
    if (isNaN(messageDate.getTime())) return '—';

    const now = new Date();
    const diffDays = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Today - show time only
      return format(messageDate, 'HH:mm', { locale: ro });
    } else if (diffDays === 1) {
      // Yesterday
      return `Ieri, ${format(messageDate, 'HH:mm', { locale: ro })}`;
    } else if (diffDays < 7) {
      // This week - show day name and time
      return format(messageDate, 'EEEE, HH:mm', { locale: ro });
    } else {
      // Older - show date and time
      return format(messageDate, 'd MMM, HH:mm', { locale: ro });
    }
  };

  // Get sender display name
  const senderDisplay = isSent ? 'Dvs.' : message.senderName || message.senderEmail || 'Necunoscut';

  // Get attachments - handle both naming conventions
  const attachments = message.attachments || [];
  const hasVisibleAttachments = attachments.length > 0;

  const handleAttachmentClick = (e: React.MouseEvent, attachment: Attachment) => {
    e.preventDefault();
    e.stopPropagation();
    onAttachmentClick(attachment);
  };

  const handleDownloadClick = async (e: React.MouseEvent, attachment: Attachment) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDownloadAttachment) {
      await onDownloadAttachment(
        attachment.id,
        attachment.name || attachment.filename || 'attachment'
      );
    }
  };

  return (
    <div className={clsx('max-w-[80%] group', isSent ? 'ml-auto' : 'mr-auto')}>
      {/* Sender name + time header */}
      <div
        className={clsx(
          'flex items-center gap-2 text-xs text-linear-text-tertiary mb-1',
          isSent ? 'justify-end' : 'justify-start'
        )}
      >
        {!isSent && (
          <>
            {/* Avatar for received messages */}
            <div className="w-6 h-6 rounded-full bg-linear-bg-hover flex items-center justify-center text-xs font-medium text-linear-text-secondary">
              {(message.senderName || message.senderEmail || 'U').charAt(0).toUpperCase()}
            </div>
            <span className="font-medium text-linear-text-secondary">{senderDisplay}</span>
          </>
        )}
        {isSent && <span className="font-medium text-linear-accent">{senderDisplay}</span>}
        <span className="text-linear-text-muted">•</span>
        <span>{formatMessageDate(message.sentDate)}</span>
      </div>

      {/* Message bubble */}
      <div
        className={clsx(
          'rounded-2xl px-4 py-3 shadow-sm',
          isSent
            ? 'bg-linear-accent text-white rounded-tr-sm'
            : 'bg-linear-bg-secondary border border-linear-border-subtle text-linear-text-primary rounded-tl-sm'
        )}
      >
        {/* Message content */}
        <div
          className={clsx(
            'text-sm whitespace-pre-wrap break-words',
            isSent ? 'text-white' : 'text-linear-text-primary'
          )}
        >
          {content || (
            <span
              className={clsx(
                'italic',
                isSent ? 'text-linear-accent/60' : 'text-linear-text-muted'
              )}
            >
              (Fără conținut)
            </span>
          )}
        </div>

        {/* Attachments - inline chips */}
        {hasVisibleAttachments && (
          <div
            className={clsx(
              'mt-2 pt-2 flex flex-wrap gap-1.5',
              isSent
                ? 'border-t border-linear-accent/40'
                : 'border-t border-linear-border-subtle/50'
            )}
          >
            {attachments.map((att: Attachment) => (
              <div key={att.id} className="flex items-center gap-0.5">
                {/* Preview button */}
                <button
                  onClick={(e) => handleAttachmentClick(e, att)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full transition-colors',
                    isSent
                      ? 'bg-linear-accent/40 hover:bg-linear-accent/60 text-white'
                      : 'bg-linear-bg-tertiary hover:bg-linear-bg-hover text-linear-text-secondary'
                  )}
                  title="Previzualizează"
                >
                  <Paperclip className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate max-w-[120px]">
                    {att.name || att.filename || 'Atașament'}
                  </span>
                </button>
                {/* Download button */}
                {onDownloadAttachment && (
                  <button
                    onClick={(e) => handleDownloadClick(e, att)}
                    disabled={downloadingId === att.id}
                    className={clsx(
                      'p-1 rounded-full transition-colors',
                      isSent
                        ? 'hover:bg-linear-accent/40 text-white'
                        : 'hover:bg-linear-bg-hover text-linear-text-tertiary'
                    )}
                    title="Descarcă"
                  >
                    {downloadingId === att.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

ConversationBubble.displayName = 'ConversationBubble';
