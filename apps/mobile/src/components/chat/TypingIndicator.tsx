'use client';

import { TypingUser } from '@/store/realtime';

// ============================================================================
// Types
// ============================================================================

interface TypingIndicatorProps {
  users: TypingUser[];
}

// ============================================================================
// Component
// ============================================================================

export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const text =
    users.length === 1
      ? `${users[0].userName} scrie...`
      : users.length === 2
        ? `${users[0].userName} și ${users[1].userName} scriu...`
        : `${users[0].userName} și alții scriu...`;

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      {/* Animated dots */}
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce" />
      </div>
      <span className="text-xs text-text-tertiary">{text}</span>
    </div>
  );
}
