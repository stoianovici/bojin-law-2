/**
 * AssistantChat Component
 * OPS-071: AssistantPill Components
 *
 * Chat interface for the AI assistant with message list, suggested follow-ups,
 * and input area.
 */

'use client';

import React, { useRef, useEffect } from 'react';
import { useAssistant } from '@/hooks/useAssistant';
import { MessageBubble } from './MessageBubble';
import { ActionConfirmCard } from './ActionConfirmCard';
import { AssistantInput } from './AssistantInput';

// ============================================================================
// Component
// ============================================================================

/**
 * Chat interface with messages and input
 */
export function AssistantChat() {
  const {
    messages,
    pendingAction,
    isLoading,
    error,
    suggestedFollowUps,
    sendMessage,
    confirmAction,
    clearError,
  } = useAssistant();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-[520px]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>Bună! Cu ce vă pot ajuta?</p>
            <p className="text-sm mt-2">
              Puteți să-mi cereți să creez sarcini, să caut documente, sau să rezum emailuri.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              role={message.role}
              content={message.content}
              createdAt={message.createdAt}
            />
          ))
        )}

        {/* Pending action confirmation */}
        {pendingAction && (
          <ActionConfirmCard
            action={pendingAction}
            onConfirm={() => confirmAction(true)}
            onReject={() => confirmAction(false)}
            isLoading={isLoading}
          />
        )}

        {/* Loading indicator */}
        {isLoading && !pendingAction && (
          <div
            data-testid="assistant-loading"
            className="flex items-center gap-2 text-gray-500 text-sm"
          >
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <span>Se procesează...</span>
          </div>
        )}

        {/* Error display with dismiss button */}
        {error && (
          <div
            data-testid="assistant-error"
            className="mx-0 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={clearError}
                className="flex-shrink-0 text-red-500 hover:text-red-700 transition-colors"
                aria-label="Închide eroarea"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <button
              onClick={clearError}
              className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
            >
              Închide
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested follow-ups */}
      {suggestedFollowUps.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {suggestedFollowUps.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => sendMessage(suggestion)}
              className="text-xs px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <AssistantInput onSend={sendMessage} isLoading={isLoading} />
    </div>
  );
}

AssistantChat.displayName = 'AssistantChat';
