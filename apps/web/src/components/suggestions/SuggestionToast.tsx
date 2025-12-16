/**
 * SuggestionToast - Toast notification for AI suggestions
 * Story 5.4: Proactive AI Suggestions System (Task 26)
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import type { AISuggestion, SuggestionType, SuggestionPriority } from '@legal-platform/types';

// Icons
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

const CloseIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
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
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

export interface SuggestionToastProps {
  suggestion: AISuggestion;
  onExpand?: () => void;
  onAccept?: (suggestion: AISuggestion) => void;
  onDismiss?: (suggestionId: string) => void;
  onClose?: () => void;
  autoCloseMs?: number; // 0 to disable auto-close
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const positionClasses = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
};

const urgencyStyles: Record<
  SuggestionPriority,
  {
    bg: string;
    border: string;
    icon: string;
    role: 'status' | 'alert';
    ariaLive: 'polite' | 'assertive';
  }
> = {
  Urgent: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    icon: 'text-red-600',
    role: 'alert',
    ariaLive: 'assertive',
  },
  High: {
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    icon: 'text-orange-600',
    role: 'alert',
    ariaLive: 'assertive',
  },
  Normal: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-600',
    role: 'status',
    ariaLive: 'polite',
  },
  Low: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    icon: 'text-gray-600',
    role: 'status',
    ariaLive: 'polite',
  },
};

/**
 * SuggestionToast displays a non-intrusive toast notification
 * for new AI suggestions.
 */
export function SuggestionToast({
  suggestion,
  onExpand,
  onAccept,
  onDismiss,
  onClose,
  autoCloseMs = 5000,
  position = 'bottom-right',
}: SuggestionToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  const urgency = urgencyStyles[suggestion.priority] || urgencyStyles.Normal;
  const isUrgent = suggestion.priority === 'Urgent' || suggestion.priority === 'High';

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300);
  }, [onClose]);

  const handleAccept = useCallback(() => {
    onAccept?.(suggestion);
    handleClose();
  }, [onAccept, suggestion, handleClose]);

  const handleDismiss = useCallback(() => {
    onDismiss?.(suggestion.id);
    handleClose();
  }, [onDismiss, suggestion.id, handleClose]);

  // Auto-close timer
  useEffect(() => {
    if (autoCloseMs <= 0) return;

    const timer = setTimeout(() => {
      handleClose();
    }, autoCloseMs);

    return () => clearTimeout(timer);
  }, [autoCloseMs, handleClose]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed ${positionClasses[position]} z-50 max-w-sm w-full transition-all duration-300 ${
        isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}
      role={urgency.role}
      aria-live={urgency.ariaLive}
      aria-atomic="true"
    >
      <div
        className={`${urgency.bg} ${urgency.border} border rounded-lg shadow-lg p-4 cursor-pointer hover:shadow-xl transition-shadow`}
        onClick={onExpand}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {isUrgent ? (
              <AlertIcon className={urgency.icon} />
            ) : (
              <SparklesIcon className={urgency.icon} />
            )}
            <span className={`text-sm font-medium ${urgency.icon}`}>
              {isUrgent ? 'Sugestie Urgentă' : 'Sugestie AI'}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Închide notificarea"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="mt-2">
          <p className="font-medium text-foreground line-clamp-1">{suggestion.title}</p>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {suggestion.description}
          </p>
        </div>

        {/* Quick actions */}
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleAccept();
            }}
          >
            Acceptă
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
          >
            Respinge
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onExpand?.();
              handleClose();
            }}
          >
            Detalii
          </Button>
        </div>

        {/* Progress bar for auto-close */}
        {autoCloseMs > 0 && (
          <div className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all ease-linear"
              style={{
                width: '100%',
                animation: `shrink ${autoCloseMs}ms linear forwards`,
              }}
            />
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}

SuggestionToast.displayName = 'SuggestionToast';

/**
 * Container component to manage multiple toast notifications
 */
export interface SuggestionToastContainerProps {
  suggestions: AISuggestion[];
  onExpand?: () => void;
  onAccept?: (suggestion: AISuggestion) => void;
  onDismiss?: (suggestionId: string) => void;
  maxToasts?: number;
  autoCloseMs?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export function SuggestionToastContainer({
  suggestions,
  onExpand,
  onAccept,
  onDismiss,
  maxToasts = 3,
  autoCloseMs = 5000,
  position = 'bottom-right',
}: SuggestionToastContainerProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleSuggestions = suggestions.filter((s) => !dismissedIds.has(s.id)).slice(0, maxToasts);

  const handleClose = useCallback((id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  }, []);

  // Get position offset based on index
  const getPositionOffset = (index: number) => {
    const offset = index * 140; // ~140px per toast
    if (position.includes('bottom')) {
      return { bottom: `${16 + offset}px` };
    }
    return { top: `${16 + offset}px` };
  };

  return (
    <>
      {visibleSuggestions.map((suggestion, index) => (
        <div
          key={suggestion.id}
          className={`fixed ${
            position.includes('right') ? 'right-4' : 'left-4'
          } z-50 max-w-sm w-full transition-all duration-300`}
          style={getPositionOffset(index)}
        >
          <SuggestionToastSingle
            suggestion={suggestion}
            onExpand={onExpand}
            onAccept={onAccept}
            onDismiss={(id) => {
              onDismiss?.(id);
              handleClose(id);
            }}
            onClose={() => handleClose(suggestion.id)}
            autoCloseMs={autoCloseMs}
          />
        </div>
      ))}
    </>
  );
}

SuggestionToastContainer.displayName = 'SuggestionToastContainer';

/**
 * Single toast without positioning (for use in container)
 */
function SuggestionToastSingle({
  suggestion,
  onExpand,
  onAccept,
  onDismiss,
  onClose,
  autoCloseMs = 5000,
}: Omit<SuggestionToastProps, 'position'>) {
  const [isExiting, setIsExiting] = useState(false);

  const urgency = urgencyStyles[suggestion.priority] || urgencyStyles.Normal;
  const isUrgent = suggestion.priority === 'Urgent' || suggestion.priority === 'High';

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onClose?.();
    }, 300);
  }, [onClose]);

  const handleAccept = useCallback(() => {
    onAccept?.(suggestion);
    handleClose();
  }, [onAccept, suggestion, handleClose]);

  const handleDismiss = useCallback(() => {
    onDismiss?.(suggestion.id);
    handleClose();
  }, [onDismiss, suggestion.id, handleClose]);

  useEffect(() => {
    if (autoCloseMs <= 0) return;

    const timer = setTimeout(() => {
      handleClose();
    }, autoCloseMs);

    return () => clearTimeout(timer);
  }, [autoCloseMs, handleClose]);

  return (
    <div
      className={`${urgency.bg} ${urgency.border} border rounded-lg shadow-lg p-4 cursor-pointer hover:shadow-xl transition-all duration-300 ${
        isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
      }`}
      onClick={onExpand}
      role={urgency.role}
      aria-live={urgency.ariaLive}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {isUrgent ? (
            <AlertIcon className={urgency.icon} />
          ) : (
            <SparklesIcon className={urgency.icon} />
          )}
          <span className={`text-sm font-medium ${urgency.icon}`}>
            {isUrgent ? 'Sugestie Urgentă' : 'Sugestie AI'}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Închide"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="mt-2">
        <p className="font-medium text-foreground line-clamp-1">{suggestion.title}</p>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{suggestion.description}</p>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleAccept();
          }}
        >
          Acceptă
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
        >
          Respinge
        </Button>
      </div>
    </div>
  );
}
