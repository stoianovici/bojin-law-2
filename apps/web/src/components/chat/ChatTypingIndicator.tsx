'use client';

import { TypingState } from '@/types/chat';

interface ChatTypingIndicatorProps {
  typingUsers: TypingState[];
}

export function ChatTypingIndicator({ typingUsers }: ChatTypingIndicatorProps) {
  if (typingUsers.length === 0) {
    return null;
  }

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].userName} scrie...`;
    }

    const names = typingUsers.map((user) => user.userName);
    const lastUser = names.pop();
    return `${names.join(', ')} și ${lastUser} scriu...`;
  };

  return (
    <div className="flex items-center gap-2 text-zinc-500 text-[12px]">
      <div className="flex gap-0.5">
        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" />
        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
      <span>{getTypingText()}</span>
    </div>
  );
}
