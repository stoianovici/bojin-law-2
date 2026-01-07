'use client';

// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useCommunicationStore } from '../../stores/communication.store';
import { AnimatedListItem } from '../motion';
import { AnimatePresence } from 'framer-motion';
import type { CommunicationThread } from '@legal-platform/types';
import { format } from 'date-fns';
import { Paperclip } from 'lucide-react';

interface ThreadListProps {
  className?: string;
}

function ThreadItem({
  thread,
  isSelected,
  onClick,
}: {
  thread: CommunicationThread;
  isSelected: boolean;
  onClick: () => void;
}) {
  // Get case type color
  const getCaseTypeColor = (caseType: string) => {
    const colors = {
      Litigation: 'bg-linear-error',
      Contract: 'bg-linear-accent',
      Advisory: 'bg-linear-success',
      Criminal: 'bg-linear-accent',
      Other: 'bg-linear-text-tertiary',
    };
    return colors[caseType as keyof typeof colors] || colors.Other;
  };

  // Truncate text
  const truncate = (text: string, max: number) => {
    return text.length > max ? text.substring(0, max) + '...' : text;
  };

  // Strip HTML tags for plain text preview
  const stripHtml = (html: string) => {
    if (!html) return '';
    // Remove HTML tags and decode common entities
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const latestMessage = thread.messages[thread.messages.length - 1];
  const preview = stripHtml(latestMessage?.body || '');

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer border-b p-4 transition-all hover:bg-linear-bg-tertiary ${
        isSelected ? 'bg-linear-accent/10 border-l-4 border-l-linear-accent' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Subject with case badge */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-block w-2 h-2 rounded-full ${getCaseTypeColor(thread.caseType)}`}
            />
            <h3 className="font-semibold text-sm truncate">{truncate(thread.subject, 60)}</h3>
          </div>

          {/* Sender and preview */}
          <div className="text-xs text-linear-text-tertiary mb-1">
            {latestMessage?.senderName || 'Unknown Sender'}
          </div>
          <div className="text-xs text-linear-text-muted line-clamp-2">
            {truncate(preview, 100)}
          </div>
        </div>

        {/* Date and indicators */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-xs text-linear-text-tertiary whitespace-nowrap">
            {thread.lastMessageDate && !isNaN(new Date(thread.lastMessageDate).getTime())
              ? format(new Date(thread.lastMessageDate), 'dd.MM.yyyy')
              : '—'}
          </span>
          <div className="flex gap-1">
            {thread.isUnread && (
              <span className="inline-block w-2 h-2 rounded-full bg-linear-accent" title="Unread" />
            )}
            {thread.hasAttachments && <Paperclip className="h-3 w-3 text-linear-text-tertiary" />}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ThreadList({ className = '' }: ThreadListProps) {
  const { getFilteredThreads, selectedThreadId, selectThread } = useCommunicationStore();
  const threads = getFilteredThreads();

  if (threads.length === 0) {
    return (
      <div
        className={`flex items-center justify-center p-8 text-linear-text-tertiary ${className}`}
      >
        <p>Nicio comunicare găsită</p>
      </div>
    );
  }

  return (
    <div className={`overflow-y-auto ${className}`}>
      {/* Thread count badge */}
      <div className="px-4 py-2 bg-linear-bg-tertiary border-b text-sm text-linear-text-tertiary">
        {threads.length} conversații
      </div>

      {/* Thread list */}
      <AnimatePresence mode="popLayout">
        {threads.map((thread) => (
          <AnimatedListItem key={thread.id} layoutId={thread.id}>
            <ThreadItem
              thread={thread}
              isSelected={selectedThreadId === thread.id}
              onClick={() => selectThread(thread.id)}
            />
          </AnimatedListItem>
        ))}
      </AnimatePresence>
    </div>
  );
}
