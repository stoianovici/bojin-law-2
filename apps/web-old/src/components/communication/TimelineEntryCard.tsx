/**
 * Timeline Entry Card Component
 * Story 5.5: Multi-Channel Communication Hub (AC: 1, 4)
 *
 * Displays a single communication entry in the timeline
 */

'use client';

import React, { useState } from 'react';
import {
  useChannelMetadata,
  usePrivacyMetadata,
  type TimelineEntry,
  type CommunicationChannel,
} from '@/hooks/useCaseTimeline';
import {
  Mail,
  FileText,
  MessageCircle,
  Phone,
  Calendar,
  Smartphone,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCw,
  Paperclip,
  Lock,
  Briefcase,
  Crown,
  ChevronDown,
  ChevronUp,
  Reply,
  Forward,
  MoreHorizontal,
  Eye,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import DOMPurify from 'dompurify';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Sanitize email HTML and remove cid: image references that cause console errors.
 * CID (Content-ID) URLs are email-specific references to inline attachments
 * that browsers cannot load directly.
 */
function sanitizeEmailHtml(html: string): string {
  // Replace cid: src attributes with a transparent 1x1 GIF to prevent browser errors
  const sanitizedCid = html.replace(
    /src=["']cid:[^"']*["']/gi,
    'src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-cid-placeholder="true"'
  );
  return DOMPurify.sanitize(sanitizedCid);
}

// ============================================================================
// Types
// ============================================================================

interface TimelineEntryCardProps {
  entry: TimelineEntry;
  onClick?: () => void;
  isDisabled?: boolean;
  /** Hide action buttons (reply, forward, etc.) for read-only views */
  readOnly?: boolean;
  'aria-setsize'?: number;
  'aria-posinset'?: number;
}

export function TimelineEntryCard({
  entry,
  onClick,
  isDisabled = false,
  readOnly = false,
  'aria-setsize': setsize,
  'aria-posinset': posinset,
}: TimelineEntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const { getChannelColor, getChannelLabel } = useChannelMetadata();
  const { getPrivacyColor, getPrivacyLabel } = usePrivacyMetadata();

  const channelIcon = getChannelIcon(entry.channelType);
  const directionIcon = getDirectionIcon(entry.direction);
  const channelColor = getChannelColor(entry.channelType);
  const privacyColor = getPrivacyColor(entry.privacyLevel);

  const sentDate = new Date(entry.sentAt);
  const timeAgo = formatDistanceToNow(sentDate, { addSuffix: true });
  const fullDate = format(sentDate, 'PPpp');

  const bodyPreview = entry.bodyPreview || entry.body.substring(0, 200);
  const hasFullBody = entry.body.length > 200;

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <article
      role="article"
      aria-setsize={setsize}
      aria-posinset={posinset}
      className={`group rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-4 transition-shadow hover:shadow-md ${
        isDisabled ? 'opacity-60' : ''
      } ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Channel Icon */}
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-linear-bg-tertiary ${channelColor}`}
          aria-label={getChannelLabel(entry.channelType)}
        >
          {channelIcon}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Meta line */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {/* Direction */}
            <span
              className="flex items-center gap-1 text-linear-text-tertiary"
              title={entry.direction}
            >
              {directionIcon}
            </span>

            {/* Sender */}
            <span className="font-medium text-linear-text-primary">{entry.senderName}</span>

            {entry.senderEmail && (
              <span className="text-linear-text-tertiary">&lt;{entry.senderEmail}&gt;</span>
            )}

            {/* Timestamp */}
            <time dateTime={entry.sentAt} title={fullDate} className="text-linear-text-muted">
              {timeAgo}
            </time>

            {/* Privacy Badge */}
            {entry.privacyLevel !== 'Normal' && (
              <span
                className={`flex items-center gap-1 rounded-full bg-linear-bg-tertiary px-2 py-0.5 text-xs ${privacyColor}`}
                title={getPrivacyLabel(entry.privacyLevel)}
              >
                {getPrivacyIcon(entry.privacyLevel)}
                {entry.privacyLevel}
              </span>
            )}

            {/* Attachment Badge */}
            {entry.hasAttachments && (
              <span className="flex items-center gap-1 text-linear-text-tertiary">
                <Paperclip className="h-3 w-3" />
                {entry.attachments.length}
              </span>
            )}

            {/* Disabled indicator for future channels */}
            {isDisabled && (
              <span className="rounded-full bg-linear-bg-hover px-2 py-0.5 text-xs text-linear-text-tertiary">
                În curând
              </span>
            )}
          </div>

          {/* Subject */}
          {entry.subject && (
            <h3 className="mt-1 font-medium text-linear-text-primary">{entry.subject}</h3>
          )}

          {/* Recipients */}
          {entry.recipients.length > 0 && (
            <div className="mt-1 text-sm text-linear-text-tertiary">
              To:{' '}
              {entry.recipients
                .slice(0, 3)
                .map((r) => r.name || r.email)
                .join(', ')}
              {entry.recipients.length > 3 && <span> +{entry.recipients.length - 3} more</span>}
            </div>
          )}

          {/* Body */}
          <div className="mt-2">
            {entry.htmlBody ? (
              <div
                className={`prose prose-sm max-w-none text-linear-text-secondary ${
                  !isExpanded ? 'line-clamp-3 max-h-20 overflow-hidden' : ''
                }`}
                dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(entry.htmlBody) }}
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm text-linear-text-secondary">
                {isExpanded ? entry.body : bodyPreview}
                {!isExpanded && hasFullBody && '...'}
              </p>
            )}

            {/* Expand/Collapse */}
            {hasFullBody && (
              <button
                onClick={toggleExpand}
                className="mt-2 flex items-center gap-1 text-sm text-linear-accent hover:underline"
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Arată mai puțin
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Arată mai mult
                  </>
                )}
              </button>
            )}
          </div>

          {/* Attachments */}
          {isExpanded && entry.attachments.length > 0 && (
            <div className="mt-3 rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary p-3">
              <h4 className="mb-2 text-xs font-medium uppercase text-linear-text-tertiary">
                Atașamente
              </h4>
              <ul className="space-y-1">
                {entry.attachments.map((att) => (
                  <li key={att.id} className="flex items-center gap-2 text-sm">
                    <Paperclip className="h-3 w-3 text-linear-text-muted" />
                    <a
                      href={att.downloadUrl}
                      className="text-linear-accent hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {att.fileName}
                    </a>
                    <span className="text-linear-text-muted">({formatFileSize(att.fileSize)})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Thread indicator */}
          {entry.childCount > 0 && (
            <div className="mt-2 text-sm text-linear-text-tertiary">
              {entry.childCount} {entry.childCount === 1 ? 'răspuns' : 'răspunsuri'} în conversație
            </div>
          )}
        </div>

        {/* Actions - hidden in read-only mode */}
        {!readOnly && (
          <div
            className={`flex items-center gap-1 transition-opacity ${
              showActions ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {entry.channelType === 'Email' && (
              <>
                <button
                  className="rounded p-1 text-linear-text-muted hover:bg-linear-bg-tertiary hover:text-linear-text-secondary"
                  title="Reply"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Reply className="h-4 w-4" />
                </button>
                <button
                  className="rounded p-1 text-linear-text-muted hover:bg-linear-bg-tertiary hover:text-linear-text-secondary"
                  title="Forward"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Forward className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              className="rounded p-1 text-linear-text-muted hover:bg-linear-bg-tertiary hover:text-linear-text-secondary"
              title="More actions"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

// Helper functions

function getChannelIcon(channel: CommunicationChannel): React.ReactNode {
  const iconProps = { className: 'h-5 w-5' };

  switch (channel) {
    case 'Email':
      return <Mail {...iconProps} />;
    case 'InternalNote':
      return <FileText {...iconProps} />;
    case 'WhatsApp':
      return <MessageCircle {...iconProps} />;
    case 'Phone':
      return <Phone {...iconProps} />;
    case 'Meeting':
      return <Calendar {...iconProps} />;
    case 'SMS':
      return <Smartphone {...iconProps} />;
    default:
      return <Mail {...iconProps} />;
  }
}

function getDirectionIcon(direction: string): React.ReactNode {
  const iconProps = { className: 'h-4 w-4' };

  switch (direction) {
    case 'Inbound':
      return <ArrowDownLeft {...iconProps} className="h-4 w-4 text-linear-success" />;
    case 'Outbound':
      return <ArrowUpRight {...iconProps} className="h-4 w-4 text-linear-accent" />;
    case 'Internal':
      return <RotateCw {...iconProps} className="h-4 w-4 text-linear-text-muted" />;
    default:
      return null;
  }
}

function getPrivacyIcon(level: string): React.ReactNode {
  const iconProps = { className: 'h-3 w-3' };

  switch (level) {
    case 'Confidential':
      return <Lock {...iconProps} />;
    case 'AttorneyOnly':
      return <Briefcase {...iconProps} />;
    case 'PartnerOnly':
      return <Crown {...iconProps} />;
    default:
      return <Eye {...iconProps} />;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default TimelineEntryCard;
