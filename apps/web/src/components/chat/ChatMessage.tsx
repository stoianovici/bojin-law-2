'use client';

import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType } from '@/types/chat';

interface ChatMessageProps {
  message: ChatMessageType;
}

const avatarGradients: Record<string, string> = {
  ab: 'bg-gradient-to-br from-[#5E6AD2] to-[#8B5CF6]',
  mp: 'bg-gradient-to-br from-[#EC4899] to-[#F472B6]',
  ed: 'bg-gradient-to-br from-[#22C55E] to-[#4ADE80]',
  cv: 'bg-gradient-to-br from-[#3B82F6] to-[#60A5FA]',
  default: 'bg-gradient-to-br from-[#F59E0B] to-[#FBBF24]',
};

function getAvatarGradient(initials: string): string {
  const key = initials.toLowerCase();
  return avatarGradients[key] || avatarGradients.default;
}

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
  });

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

export function ChatMessage({ message }: ChatMessageProps) {
  const isOwn = message.isOwn;

  return (
    <div className={cn('flex gap-2 max-w-[85%]', isOwn ? 'ml-auto flex-row-reverse' : 'mr-auto')}>
      {/* Avatar - only for other messages */}
      {!isOwn && (
        <div
          className={cn(
            'w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center',
            'text-[11px] font-medium text-white',
            getAvatarGradient(message.userInitials)
          )}
        >
          {message.userInitials.toUpperCase()}
        </div>
      )}

      {/* Message content */}
      <div className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
        {/* Message bubble */}
        <div
          className={cn(
            'px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words',
            isOwn
              ? 'bg-[#3b82f6] text-white rounded-[16px_16px_4px_16px]'
              : 'bg-[#18181B] text-[#fafafa] rounded-[16px_16px_16px_4px]'
          )}
        >
          {message.content}
        </div>

        {/* Timestamp */}
        <span className="text-[11px] text-zinc-500 mt-1 px-1">
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
    </div>
  );
}
