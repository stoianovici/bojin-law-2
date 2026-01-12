'use client';

import { Paperclip, Download, ExternalLink, Globe, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import type { EmailMessage, Attachment } from '@/types/email';

interface MessageBubbleProps {
  message: EmailMessage;
  isSent: boolean;
  onAttachmentClick: (attachment: Attachment) => void;
  onDownloadAttachment?: (attachmentId: string, attachmentName: string) => Promise<void>;
  downloadingId?: string | null;
  /** Whether current user can toggle this email's privacy */
  canTogglePrivacy?: boolean;
  /** Handler for toggling email privacy (true = make public, false = make private) */
  onTogglePrivacy?: (emailId: string, makePublic: boolean) => void;
  /** Whether a privacy toggle action is loading */
  togglingPrivacyId?: string | null;
}

export function MessageBubble({
  message,
  isSent,
  onAttachmentClick,
  onDownloadAttachment,
  downloadingId,
  canTogglePrivacy,
  onTogglePrivacy,
  togglingPrivacyId,
}: MessageBubbleProps) {
  const formattedDate = formatMessageDate(message.sentDateTime);

  // Use cleaned body if available, otherwise strip HTML
  const displayBody = message.bodyContentClean || stripHtml(message.bodyContent);

  return (
    <div
      className={cn(
        'flex w-full',
        isSent ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3',
          isSent
            ? 'bg-blue-500 text-white'
            : 'bg-linear-bg-tertiary text-linear-text-primary border border-linear-border-subtle'
        )}
      >
        {/* Sender -> Recipient */}
        <div className={cn(
          'text-xs font-medium mb-1',
          isSent ? 'text-blue-100' : 'text-linear-text-secondary'
        )}>
          {message.from.name || message.from.address}
          {message.toRecipients?.[0] && (
            <span className={isSent ? 'text-blue-200' : 'text-linear-text-tertiary'}>
              {' → '}
              {message.toRecipients[0].name || message.toRecipients[0].address}
              {message.toRecipients.length > 1 && ` +${message.toRecipients.length - 1}`}
            </span>
          )}
        </div>

        {/* Message Body */}
        <div className={cn(
          'text-sm leading-relaxed whitespace-pre-wrap break-words',
          isSent ? 'text-white' : 'text-linear-text-primary'
        )}>
          {displayBody}
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {message.attachments.map((attachment) => (
              <AttachmentChip
                key={attachment.id}
                attachment={attachment}
                isSent={isSent}
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

        {/* Footer: Timestamp and Privacy Controls */}
        <div className="flex items-center justify-between mt-2">
          <div className={cn(
            'text-xs',
            isSent ? 'text-blue-200' : 'text-linear-text-tertiary'
          )}>{formattedDate}</div>

          {/* Privacy toggle */}
          {canTogglePrivacy && onTogglePrivacy ? (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex items-center gap-1 text-xs transition-colors',
                  message.isPrivate
                    ? 'text-orange-500'
                    : isSent ? 'text-blue-200' : 'text-linear-text-tertiary'
                )}
              >
                <Lock className="w-3 h-3" />
                Privat
              </span>
              <Switch
                checked={!message.isPrivate}
                onCheckedChange={(checked) => onTogglePrivacy(message.id, checked)}
                disabled={togglingPrivacyId === message.id}
                className={cn(
                  togglingPrivacyId === message.id && 'opacity-50 cursor-wait',
                  // Custom colors: orange when private (unchecked), green when public (checked)
                  'data-[state=unchecked]:bg-orange-500/30 data-[state=checked]:bg-green-500'
                )}
                title={message.isPrivate ? 'Fă public pentru echipă' : 'Fă privat'}
              />
              <span
                className={cn(
                  'flex items-center gap-1 text-xs transition-colors',
                  !message.isPrivate ? 'text-green-500' : isSent ? 'text-blue-200' : 'text-linear-text-tertiary'
                )}
              >
                <Globe className="w-3 h-3" />
                Public
              </span>
            </div>
          ) : (
            // Read-only privacy indicator for non-owners
            <div className="flex items-center gap-1">
              {message.isPrivate ? (
                <span className="flex items-center gap-1 text-xs text-orange-500">
                  <Lock className="w-3 h-3" />
                  Privat
                </span>
              ) : message.markedPublicAt ? (
                <span className="flex items-center gap-1 text-xs text-green-500">
                  <Globe className="w-3 h-3" />
                  Public
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Attachment Chip Component
interface AttachmentChipProps {
  attachment: Attachment;
  isSent?: boolean;
  onPreview: () => void;
  onDownload?: () => void;
  isDownloading: boolean;
}

function AttachmentChip({ attachment, isSent, onPreview, onDownload, isDownloading }: AttachmentChipProps) {
  const name = attachment.name || attachment.filename || 'Atașament';
  const displayName = name.length > 25 ? `${name.slice(0, 22)}...` : name;

  return (
    <div className={cn(
      'flex items-center gap-1.5 px-2 py-1 rounded text-xs',
      isSent
        ? 'bg-blue-400/30 text-blue-100'
        : 'bg-linear-bg-hover text-linear-text-secondary'
    )}>
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
          className={cn(
            'p-0.5 rounded transition-colors',
            isSent ? 'hover:bg-blue-400/30' : 'hover:bg-linear-bg-tertiary'
          )}
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
              'p-0.5 rounded transition-colors',
              isSent ? 'hover:bg-blue-400/30' : 'hover:bg-linear-bg-tertiary',
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
