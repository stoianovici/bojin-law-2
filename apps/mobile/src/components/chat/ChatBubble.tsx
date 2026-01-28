'use client';

import { clsx } from 'clsx';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { ChatMessage } from '@/store/realtime';

// ============================================================================
// Types
// ============================================================================

interface ChatBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ChatBubble({ message, isOwn }: ChatBubbleProps) {
  const authorName = `${message.author.firstName} ${message.author.lastName}`;
  const time = format(new Date(message.createdAt), 'HH:mm', { locale: ro });

  return (
    <div
      className={clsx(
        'flex flex-col gap-1 max-w-[80%]',
        isOwn ? 'items-end ml-auto' : 'items-start'
      )}
    >
      {/* Author name (only for others) */}
      {!isOwn && <span className="text-xs text-text-tertiary px-3">{authorName}</span>}

      {/* Bubble */}
      <div
        className={clsx(
          'px-4 py-2.5 rounded-2xl',
          isOwn
            ? 'bg-accent text-white rounded-br-md'
            : 'bg-bg-card text-text-primary rounded-bl-md'
        )}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
      </div>

      {/* Time */}
      <span className={clsx('text-[10px] text-text-tertiary px-3', isOwn && 'text-right')}>
        {time}
      </span>
    </div>
  );
}
