'use client';

import { Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThreadPreview } from '@/types/email';

interface ThreadItemProps {
  thread: ThreadPreview;
  isSelected: boolean;
  onClick: () => void;
}

export function ThreadItem({ thread, isSelected, onClick }: ThreadItemProps) {
  const formattedDate = formatRelativeDate(thread.lastMessageDate);

  return (
    <div
      className={cn(
        'px-4 py-3 cursor-pointer transition-colors border-b border-linear-border-subtle',
        'hover:bg-linear-bg-hover',
        isSelected && 'bg-linear-accent/10 border-l-2 border-l-linear-accent',
        !isSelected && thread.isUnread && 'border-l-2 border-l-linear-accent/50'
      )}
      onClick={onClick}
    >
      {/* Header: Sender + Date */}
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm',
              thread.isUnread
                ? 'font-semibold text-linear-text-primary'
                : 'font-medium text-linear-text-primary'
            )}
          >
            {thread.lastSenderName || thread.lastSenderEmail}
          </span>
          {thread.isSuggestedAssignment && (
            <span className="px-1.5 py-0.5 text-xs bg-linear-warning/20 text-linear-warning rounded">
              Sugerat
            </span>
          )}
          {thread.isUnread && <span className="w-1.5 h-1.5 rounded-full bg-linear-accent" />}
        </span>
        <span className="text-xs text-linear-text-tertiary">{formattedDate}</span>
      </div>

      {/* Subject */}
      <div
        className={cn(
          'text-sm mb-1 line-clamp-1',
          thread.isUnread ? 'font-medium text-linear-text-primary' : 'text-linear-text-secondary'
        )}
      >
        {thread.subject || '(Fără subiect)'}
      </div>

      {/* Preview */}
      <div className="text-xs text-linear-text-tertiary line-clamp-1">{thread.preview}</div>

      {/* Footer: Attachments + Message Count */}
      {(thread.hasAttachments || thread.messageCount > 1) && (
        <div className="flex items-center gap-3 mt-2">
          {thread.hasAttachments && (
            <span className="flex items-center gap-1 text-xs text-linear-text-tertiary">
              <Paperclip className="h-3 w-3" />
            </span>
          )}
          {thread.messageCount > 1 && (
            <span className="text-xs text-linear-text-tertiary">{thread.messageCount} mesaje</span>
          )}
        </div>
      )}

      {/* Linked Cases (if multi-case) */}
      {thread.linkedCases && thread.linkedCases.length > 1 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {thread.linkedCases.slice(0, 2).map((c) => (
            <span
              key={c.id}
              className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                c.isPrimary
                  ? 'bg-linear-accent/15 text-linear-accent'
                  : 'bg-linear-bg-tertiary text-linear-text-tertiary'
              )}
            >
              {c.title.length > 20 ? `${c.title.slice(0, 20)}...` : c.title}
            </span>
          ))}
          {thread.linkedCases.length > 2 && (
            <span className="text-xs text-linear-text-tertiary">
              +{thread.linkedCases.length - 2}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Helper function for relative dates
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Today - show time
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'ieri';
  } else if (diffDays < 7) {
    return `${diffDays} zile`;
  } else {
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
  }
}
