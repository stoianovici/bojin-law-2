'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ChatInput({ onSend, disabled = false, className }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea up to max 4 lines
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';

    // Calculate line height (approx 24px per line)
    const lineHeight = 24;
    const maxLines = 4;
    const maxHeight = lineHeight * maxLines;

    // Set new height, capped at max
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, []);

  // Adjust height when message changes
  useEffect(() => {
    adjustHeight();
  }, [message, adjustHeight]);

  // Handle send
  const handleSend = useCallback(() => {
    if (!message.trim() || disabled) return;

    onSend(message.trim());
    setMessage('');

    // Reset textarea height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [message, disabled, onSend]);

  // Handle Enter to send (Shift+Enter for newline)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className={cn('p-4', 'bg-[#0a0a0a] border-t border-zinc-800', className)}>
      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Scrie un mesaj..."
        disabled={disabled}
        rows={1}
        className={cn(
          'w-full min-h-[40px] px-4 py-2.5',
          'bg-[#141414] border border-zinc-800 rounded-lg',
          'text-sm text-[#fafafa] placeholder:text-[#6b6b6b]',
          'resize-none outline-none',
          'focus:border-zinc-700',
          'transition-colors duration-150',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      />
    </div>
  );
}
