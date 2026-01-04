'use client';

import { Paperclip, Download, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EmailMessage, Attachment } from '@/types/email';

interface MessageBubbleProps {
  message: EmailMessage;
  isSent: boolean;
  onAttachmentClick: (attachment: Attachment) => void;
  onDownloadAttachment?: (attachmentId: string, attachmentName: string) => Promise<void>;
  downloadingId?: string | null;
}

export function MessageBubble({
  message,
  isSent,
  onAttachmentClick,
  onDownloadAttachment,
  downloadingId,
}: MessageBubbleProps) {
  const formattedDate = formatMessageDate(message.sentDateTime);

  // Use cleaned body if available, otherwise strip HTML
  const displayBody = message.bodyContentClean || stripHtml(message.bodyContent);

  return (
    <div
      className={cn(
        'w-full rounded-xl px-4 py-3',
        'bg-linear-bg-tertiary text-linear-text-primary border border-linear-border-subtle'
      )}
    >
      {/* Sender Name */}
      <div className="text-xs font-medium mb-1 text-linear-text-secondary">
        {message.from.name || message.from.address}
      </div>

      {/* Message Body */}
      <div className="text-sm leading-relaxed whitespace-pre-wrap break-words text-linear-text-primary">
        {displayBody}
      </div>

      {/* Attachments */}
      {message.attachments && message.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {message.attachments.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              attachment={attachment}
              onPreview={() => onAttachmentClick(attachment)}
              onDownload={
                onDownloadAttachment
                  ? () =>
                      onDownloadAttachment(
                        attachment.id,
                        attachment.name || attachment.filename || 'file'
                      )
                  : undefined
              }
              isDownloading={downloadingId === attachment.id}
            />
          ))}
        </div>
      )}

      {/* Timestamp */}
      <div className="text-xs mt-2 text-linear-text-tertiary">{formattedDate}</div>
    </div>
  );
}

// Attachment Chip Component
interface AttachmentChipProps {
  attachment: Attachment;
  onPreview: () => void;
  onDownload?: () => void;
  isDownloading: boolean;
}

function AttachmentChip({ attachment, onPreview, onDownload, isDownloading }: AttachmentChipProps) {
  const name = attachment.name || attachment.filename || 'Atașament';
  const displayName = name.length > 25 ? `${name.slice(0, 22)}...` : name;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-linear-bg-hover text-linear-text-secondary">
      <Paperclip className="h-3 w-3 flex-shrink-0" />

      {/* Preview Button */}
      <button onClick={onPreview} className="hover:underline truncate max-w-[150px]" title={name}>
        {displayName}
      </button>

      {/* Action Buttons */}
      <div className="flex items-center gap-0.5 ml-1">
        {/* Preview Icon */}
        <button
          onClick={onPreview}
          className="p-0.5 rounded transition-colors hover:bg-linear-bg-tertiary"
          title="Previzualizare"
        >
          <ExternalLink className="h-3 w-3" />
        </button>

        {/* Download Icon */}
        {onDownload && (
          <button
            onClick={onDownload}
            disabled={isDownloading}
            className={cn(
              'p-0.5 rounded transition-colors hover:bg-linear-bg-tertiary',
              isDownloading && 'opacity-50 cursor-wait'
            )}
            title="Descarcă"
          >
            <Download className={cn('h-3 w-3', isDownloading && 'animate-pulse')} />
          </button>
        )}
      </div>
    </div>
  );
}

// Helper: Strip HTML tags and convert to plain text
function stripHtml(html: string): string {
  if (!html) return '';

  // Replace common block elements with line breaks
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Normalize whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

// Helper: Format message date
function formatMessageDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });

  if (diffDays === 0) {
    return `Azi, ${timeStr}`;
  } else if (diffDays === 1) {
    return `Ieri, ${timeStr}`;
  } else {
    const dateStr = date.toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
    return `${dateStr}, ${timeStr}`;
  }
}
