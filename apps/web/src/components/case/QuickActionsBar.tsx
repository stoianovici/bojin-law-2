/**
 * QuickActionsBar - Global floating AI assistant pill
 * Context-aware: adapts suggestions based on current section
 * Floating pill design, collapsed by default, expands on click
 */

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { clsx } from 'clsx';
import { useCaseWorkspaceStore } from '../../stores/case-workspace.store';
import { useAIAssistant, type CommandIntent } from '../../contexts/AIAssistantContext';
import {
  useNaturalLanguageCommand,
  type NaturalLanguageCommandResult,
} from '../../hooks/useNaturalLanguageCommand';

// ============================================================================
// Types
// ============================================================================

export interface QuickActionsBarProps {
  onSubmit?: (input: string) => void;
  onSuggestionClick?: (suggestion: string) => void;
  onActionComplete?: (result: NaturalLanguageCommandResult) => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * QuickActionsBar Component
 *
 * Global floating pill design for AI-powered quick actions.
 * Collapsed by default, expands on click with smooth animation.
 * Context-aware: shows different suggestions based on current section.
 */
export function QuickActionsBar({
  onSubmit,
  onSuggestionClick,
  onActionComplete,
  className,
}: QuickActionsBarProps) {
  const { quickActionsVisible, toggleQuickActions } = useCaseWorkspaceStore();
  const { context, suggestions, placeholder } = useAIAssistant();
  const [input, setInput] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get caseId from context if we're on a case page
  const caseId = context.section === 'case' ? context.entityId : undefined;

  const { executeCommand, executeQuickAction, loading, result, clearResult } =
    useNaturalLanguageCommand(caseId, context.section);

  // Focus input when expanded
  useEffect(() => {
    if (quickActionsVisible && inputRef.current) {
      const timeout = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [quickActionsVisible]);

  // Derive feedback message from result (avoids setState in effect)
  const feedbackMessage = useMemo(() => {
    if (!result || !showFeedback) return null;
    if (result.success || result.status === 'PARTIAL') {
      return {
        type: (result.status === 'SUCCESS' ? 'success' : 'info') as 'success' | 'info',
        text: result.message,
      };
    }
    return {
      type: 'error' as const,
      text: result.message,
    };
  }, [result, showFeedback]);

  // Handle click outside to collapse
  useEffect(() => {
    if (!quickActionsVisible) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (!loading && !feedbackMessage) {
          toggleQuickActions();
        }
      }
    };

    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [quickActionsVisible, toggleQuickActions, loading, feedbackMessage]);

  // Handle result changes - show feedback and auto-dismiss
  useEffect(() => {
    if (result) {
      setShowFeedback(true);
      onActionComplete?.(result);

      const timeout = setTimeout(() => {
        setShowFeedback(false);
        clearResult();
        if (result.success) {
          toggleQuickActions();
        }
      }, 3000);

      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [result, onActionComplete, clearResult, toggleQuickActions]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (input.trim() && !loading) {
        onSubmit?.(input.trim());
        await executeCommand(input.trim());
        setInput('');
      }
    },
    [input, loading, onSubmit, executeCommand]
  );

  const handleSuggestionClick = useCallback(
    async (suggestion: { label: string; intent: CommandIntent }) => {
      if (loading) return;

      onSuggestionClick?.(suggestion.label);
      setInput(suggestion.label);

      await executeQuickAction(suggestion.intent, suggestion.label);
      setInput('');
    },
    [loading, onSuggestionClick, executeQuickAction]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        toggleQuickActions();
      }
    },
    [loading, toggleQuickActions]
  );

  // Get context label for display
  const contextLabel = context.entityName
    ? `${context.entityName}`
    : context.section === 'case'
      ? 'Dosar'
      : null;

  // Collapsed State - Small floating pill
  if (!quickActionsVisible) {
    return (
      <button
        onClick={toggleQuickActions}
        className={clsx(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
          'flex items-center gap-2 px-5 py-3',
          'bg-gradient-to-r from-purple-600 to-indigo-600',
          'text-white text-sm font-medium',
          'rounded-full shadow-lg shadow-purple-500/25',
          'hover:shadow-xl hover:shadow-purple-500/30 hover:scale-105',
          'active:scale-95',
          'transition-all duration-200',
          className
        )}
        aria-label="Deschide Asistent AI"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        <span>Asistent AI</span>
      </button>
    );
  }

  // Expanded State - Full floating pill
  return (
    <div
      ref={containerRef}
      className={clsx(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'w-full max-w-xl px-4',
        'animate-in fade-in slide-in-from-bottom-4 duration-200',
        className
      )}
      onKeyDown={handleKeyDown}
    >
      <div
        className={clsx(
          'bg-white/95 backdrop-blur-xl',
          'border border-gray-200/50',
          'rounded-2xl shadow-2xl shadow-gray-900/10',
          'overflow-hidden',
          'transition-all duration-200'
        )}
      >
        {/* Context Badge */}
        {contextLabel && (
          <div className="px-4 py-2 bg-purple-50 border-b border-purple-100">
            <div className="flex items-center gap-2 text-xs text-purple-700">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-medium">Context: {contextLabel}</span>
            </div>
          </div>
        )}

        {/* Feedback Message */}
        {feedbackMessage && (
          <div
            className={clsx(
              'px-4 py-2.5 flex items-center gap-2',
              feedbackMessage.type === 'success' && 'bg-green-50 text-green-800',
              feedbackMessage.type === 'error' && 'bg-red-50 text-red-800',
              feedbackMessage.type === 'info' && 'bg-blue-50 text-blue-800'
            )}
          >
            {feedbackMessage.type === 'success' && (
              <svg
                className="w-4 h-4 text-green-600 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
            {feedbackMessage.type === 'error' && (
              <svg
                className="w-4 h-4 text-red-600 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
            {feedbackMessage.type === 'info' && (
              <svg
                className="w-4 h-4 text-blue-600 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
            <span className="text-sm">{feedbackMessage.text}</span>
          </div>
        )}

        {/* Input Section */}
        <div className="p-3">
          <form onSubmit={handleSubmit} className="relative" autoComplete="off">
            {/* AI Icon / Loading Spinner */}
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              {loading ? (
                <svg
                  className="w-5 h-5 text-purple-600 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              )}
            </div>

            {/* Input Field */}
            <input
              ref={inputRef}
              type="text"
              name="ai-command"
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              value={input}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setInput(e.target.value);
                }
              }}
              disabled={loading}
              placeholder={loading ? 'Procesez...' : placeholder}
              maxLength={500}
              className={clsx(
                'w-full pl-11 pr-12 py-3',
                'text-sm text-gray-900 placeholder-gray-400',
                'bg-gray-50/50 border border-gray-200',
                'rounded-xl',
                'focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400',
                'transition-all duration-150',
                loading && 'bg-gray-100 cursor-not-allowed'
              )}
            />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className={clsx(
                'absolute right-2 top-1/2 -translate-y-1/2',
                'p-2 rounded-lg',
                'transition-all duration-150',
                input.trim() && !loading
                  ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
              aria-label="Trimite"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </button>
          </form>

          {/* Quick Suggestions - Context Aware */}
          {!loading && !feedbackMessage && suggestions.length > 0 && (
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.label}
                  onClick={() => handleSuggestionClick(suggestion)}
                  disabled={loading}
                  className={clsx(
                    'inline-flex items-center gap-1.5',
                    'px-2.5 py-1.5 rounded-lg',
                    'text-xs font-medium',
                    'text-gray-600 bg-gray-100',
                    'hover:bg-purple-100 hover:text-purple-700',
                    'transition-colors duration-150',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {suggestion.icon}
                  {suggestion.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 bg-gray-50/50 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            Apasă{' '}
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-500 font-mono text-[10px]">
              Esc
            </kbd>{' '}
            pentru a închide
          </p>
        </div>
      </div>
    </div>
  );
}

QuickActionsBar.displayName = 'QuickActionsBar';
