/**
 * MessageBubble Component
 * OPS-071: AssistantPill Components
 *
 * Displays individual messages in the AI assistant chat.
 * Supports User and Assistant roles with different styling.
 */

'use client';

import React from 'react';
import { clsx } from 'clsx';
import { PersonIcon } from '@radix-ui/react-icons';

// ============================================================================
// Icons
// ============================================================================

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
    />
  </svg>
);

// ============================================================================
// Types
// ============================================================================

export interface MessageBubbleProps {
  role: 'User' | 'Assistant' | 'System';
  content: string;
  createdAt: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Individual message bubble in the chat
 */
export function MessageBubble({ role, content, createdAt }: MessageBubbleProps) {
  const isUser = role === 'User';
  const isSystem = role === 'System';

  // System messages are styled differently
  if (isSystem) {
    return (
      <div className="flex justify-center mb-4">
        <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">{content}</div>
      </div>
    );
  }

  return (
    <div
      data-testid={isUser ? 'message-user' : 'message-assistant'}
      className={clsx('flex gap-2 mb-4', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div
        className={clsx(
          'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-gray-200' : 'bg-primary/10'
        )}
      >
        {isUser ? (
          <PersonIcon className="h-4 w-4 text-gray-600" />
        ) : (
          <SparklesIcon className="h-4 w-4 text-primary" />
        )}
      </div>

      {/* Message */}
      <div
        className={clsx(
          'max-w-[80%] rounded-2xl px-4 py-2',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-gray-100 text-gray-900 rounded-bl-sm'
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{content}</p>
        <p
          className={clsx('text-xs mt-1', isUser ? 'text-primary-foreground/70' : 'text-gray-500')}
        >
          {new Date(createdAt).toLocaleTimeString('ro-RO', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

MessageBubble.displayName = 'MessageBubble';
