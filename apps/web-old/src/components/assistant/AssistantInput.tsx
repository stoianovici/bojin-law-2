/**
 * AssistantInput Component
 * OPS-071: AssistantPill Components
 *
 * Text input with send button for the AI assistant chat.
 * Supports Enter to send and Shift+Enter for new line.
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { PaperPlaneIcon } from '@radix-ui/react-icons';

// ============================================================================
// Types
// ============================================================================

export interface AssistantInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Text input with send button for the assistant chat
 */
export function AssistantInput({ onSend, isLoading }: AssistantInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Scrieți un mesaj..."
          rows={1}
          data-testid="assistant-input"
          className={clsx(
            'flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            'placeholder:text-gray-400 text-sm',
            'max-h-32'
          )}
          aria-label="Mesaj pentru asistent"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          data-testid="assistant-send"
          className={clsx(
            'p-2 rounded-lg transition-colors',
            input.trim() && !isLoading
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          )}
          aria-label="Trimite mesaj"
        >
          <PaperPlaneIcon className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}

AssistantInput.displayName = 'AssistantInput';
