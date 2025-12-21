/**
 * AssistantPill Component
 * OPS-071: AssistantPill Components
 * OPS-076: Proactive Briefings Integration
 *
 * Main floating container for the AI assistant.
 * Toggles between collapsed pill button and expanded chat interface.
 * Shows morning briefing on first open of the day.
 */

'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { Cross2Icon } from '@radix-ui/react-icons';
import { useAssistant } from '@/hooks/useAssistant';
import { AssistantChat } from './AssistantChat';

// ============================================================================
// Constants
// ============================================================================

const BRIEFING_SHOWN_KEY = 'assistantBriefingShownDate';

// ============================================================================
// Icons
// ============================================================================

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="20"
    height="20"
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

const ChatIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
    />
  </svg>
);

// ============================================================================
// Component
// ============================================================================

/**
 * Check if the briefing has been shown today
 */
function hasShownBriefingToday(): boolean {
  if (typeof window === 'undefined') return true;
  const lastShown = localStorage.getItem(BRIEFING_SHOWN_KEY);
  if (!lastShown) return false;

  const today = new Date().toDateString();
  return lastShown === today;
}

/**
 * Mark the briefing as shown for today
 */
function markBriefingShown(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BRIEFING_SHOWN_KEY, new Date().toDateString());
}

/**
 * Floating AI assistant pill with collapsed/expanded states
 */
export function AssistantPill() {
  const { isOpen, isLoading, toggleOpen, unreadCount, requestBriefing, messages } = useAssistant();

  const pillRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const hasRequestedBriefing = useRef(false);

  // Check if we should show the morning briefing
  const shouldShowBriefing = useCallback(() => {
    // Only show if: opened, no messages yet, briefing not shown today, and haven't requested yet
    return (
      isOpen && messages.length === 0 && !hasShownBriefingToday() && !hasRequestedBriefing.current
    );
  }, [isOpen, messages.length]);

  // Request morning briefing on first open of the day
  useEffect(() => {
    if (shouldShowBriefing()) {
      hasRequestedBriefing.current = true;
      markBriefingShown();
      requestBriefing();
    }
  }, [shouldShowBriefing, requestBriefing]);

  // Focus management - focus close button when opened
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard handling - Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        toggleOpen();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggleOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && pillRef.current && !pillRef.current.contains(e.target as Node)) {
        toggleOpen();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, toggleOpen]);

  return (
    <div
      ref={pillRef}
      className={clsx(
        'fixed bottom-6 right-6 z-50 transition-all duration-300',
        isOpen ? 'w-[480px]' : 'w-auto'
      )}
    >
      {!isOpen ? (
        // Collapsed: Floating pill button
        <button
          onClick={toggleOpen}
          data-testid="assistant-pill"
          className={clsx(
            'relative flex items-center justify-center p-4 rounded-full shadow-lg',
            'bg-primary text-primary-foreground',
            'hover:bg-primary/90 transition-all duration-200 hover:scale-105',
            isLoading && 'animate-pulse'
          )}
          aria-label="Deschide asistentul AI"
        >
          <ChatIcon className="h-7 w-7" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </button>
      ) : (
        // Expanded: Chat interface
        <div
          data-testid="assistant-chat"
          className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5" />
              <span className="font-semibold">Asistent AI</span>
            </div>
            <button
              ref={closeButtonRef}
              onClick={toggleOpen}
              data-testid="assistant-close"
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Închide asistentul"
            >
              <Cross2Icon className="h-5 w-5" />
            </button>
          </div>

          {/* Chat content */}
          <AssistantChat />
        </div>
      )}
    </div>
  );
}

AssistantPill.displayName = 'AssistantPill';
