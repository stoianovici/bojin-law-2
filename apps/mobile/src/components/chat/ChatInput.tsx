'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Send } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ChatInputProps {
  onSend: (message: string) => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ChatInput({
  onSend,
  onTyping,
  disabled = false,
  placeholder = 'Scrie un mesaj...',
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingRef = useRef(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setValue(newValue);

      // Notify typing status
      if (onTyping) {
        const isTyping = newValue.length > 0;
        if (isTyping !== typingRef.current) {
          typingRef.current = isTyping;
          onTyping(isTyping);
        }
      }
    },
    [onTyping]
  );

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setValue('');

    // Reset typing indicator
    if (onTyping) {
      typingRef.current = false;
      onTyping(false);
    }

    // Focus input after send
    inputRef.current?.focus();
  }, [value, disabled, onSend, onTyping]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Send on Enter (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="flex items-end gap-2 p-4 border-t border-border bg-bg-elevated">
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={clsx(
          'flex-1 resize-none',
          'px-4 py-2.5 rounded-2xl',
          'bg-bg-card text-text-primary placeholder:text-text-tertiary',
          'text-sm leading-snug',
          'focus:outline-none focus:ring-1 focus:ring-accent/50',
          'disabled:opacity-50'
        )}
        style={{ maxHeight: 120 }}
      />

      <button
        onClick={handleSend}
        disabled={!canSend}
        className={clsx(
          'shrink-0 w-10 h-10 rounded-full',
          'flex items-center justify-center',
          'transition-all duration-150',
          canSend ? 'bg-accent text-white active:scale-95' : 'bg-bg-card text-text-tertiary'
        )}
        aria-label="Trimite mesaj"
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
}
