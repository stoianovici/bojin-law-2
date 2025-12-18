/**
 * SuggestionWidget - Floating widget for contextual AI suggestions
 * Story 5.4: Proactive AI Suggestions System (Task 24)
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SuggestionCard, SuggestionCardCompact } from './SuggestionCard';
import { useSuggestions, type SuggestionContextInput } from '@/hooks/useSuggestions';
import type { AISuggestion } from './SuggestionCard';

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

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
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
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

export interface SuggestionWidgetProps {
  context?: SuggestionContextInput;
  defaultExpanded?: boolean;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  onSuggestionAccept?: (suggestion: AISuggestion) => void;
  onSuggestionDismiss?: (suggestionId: string, reason?: string) => void;
  maxVisible?: number;
  compactMode?: boolean;
}

const positionClasses = {
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
};

/**
 * SuggestionWidget is a floating widget that displays contextual AI suggestions.
 * It can be expanded/collapsed and positioned in different corners of the screen.
 */
export function SuggestionWidget({
  context,
  defaultExpanded = false,
  position = 'bottom-right',
  onSuggestionAccept,
  onSuggestionDismiss,
  maxVisible = 5,
  compactMode = false,
}: SuggestionWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const widgetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const {
    suggestions,
    loading,
    error,
    acceptSuggestion,
    dismissSuggestion,
    refreshSuggestions,
    totalCount,
  } = useSuggestions(context);

  // Focus trap when expanded
  useEffect(() => {
    if (isExpanded && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isExpanded]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  // Click outside to collapse
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isExpanded && widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  const handleAccept = useCallback(
    async (suggestion: AISuggestion) => {
      await acceptSuggestion(suggestion.id);
      onSuggestionAccept?.(suggestion);
    },
    [acceptSuggestion, onSuggestionAccept]
  );

  const handleDismiss = useCallback(
    async (suggestionId: string, reason?: string) => {
      await dismissSuggestion(suggestionId, reason);
      onSuggestionDismiss?.(suggestionId, reason);
    },
    [dismissSuggestion, onSuggestionDismiss]
  );

  const visibleSuggestions = suggestions.slice(0, maxVisible);
  const hasUrgent = suggestions.some((s) => s.priority === 'Urgent');

  // Collapsed state - just the floating button
  if (!isExpanded) {
    return (
      <div
        ref={widgetRef}
        className={`fixed ${positionClasses[position]} z-50`}
        role="complementary"
        aria-label="Sugestii AI"
      >
        <button
          onClick={() => setIsExpanded(true)}
          className={`flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all duration-300 hover:scale-105 ${
            hasUrgent ? 'bg-red-600 text-white animate-pulse' : 'bg-primary text-primary-foreground'
          }`}
          aria-expanded={false}
          aria-label={`${totalCount} sugestii AI. Apasă pentru a deschide.`}
        >
          <SparklesIcon />
          {totalCount > 0 && (
            <Badge variant="secondary" className={`${hasUrgent ? 'bg-white text-red-600' : ''}`}>
              {totalCount}
            </Badge>
          )}
        </button>
      </div>
    );
  }

  // Expanded state - full widget
  return (
    <div
      ref={widgetRef}
      className={`fixed ${positionClasses[position]} z-50 w-96 max-w-[calc(100vw-2rem)]`}
      role="complementary"
      aria-label="Sugestii AI"
      aria-expanded={true}
    >
      <Card className="shadow-xl border-2">
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
          <div className="flex items-center gap-2">
            <SparklesIcon className="text-primary" />
            <CardTitle className="text-base">Sugestii AI</CardTitle>
            {totalCount > 0 && <Badge variant="secondary">{totalCount}</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => refreshSuggestions()}
              aria-label="Reîmprospătează sugestiile"
              disabled={loading}
            >
              <RefreshIcon className={loading ? 'animate-spin' : ''} />
            </Button>
            <Button
              ref={closeButtonRef}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => setIsExpanded(false)}
              aria-label="Închide widget-ul de sugestii"
            >
              <ChevronDownIcon />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              <p>Nu am putut încărca sugestiile.</p>
              <Button size="sm" variant="link" onClick={() => refreshSuggestions()}>
                Încearcă din nou
              </Button>
            </div>
          )}

          {!error && visibleSuggestions.length === 0 && !loading && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <SparklesIcon className="mx-auto mb-2 text-muted-foreground/50" />
              <p>Nu există sugestii pentru moment.</p>
              <p className="text-xs mt-1">Sugestiile vor apărea pe baza contextului tău.</p>
            </div>
          )}

          {loading && visibleSuggestions.length === 0 && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          )}

          {visibleSuggestions.length > 0 && (
            <div className="space-y-3">
              {compactMode
                ? visibleSuggestions.map((suggestion) => (
                    <SuggestionCardCompact
                      key={suggestion.id}
                      suggestion={suggestion}
                      onAccept={handleAccept}
                      onDismiss={handleDismiss}
                    />
                  ))
                : visibleSuggestions.map((suggestion) => (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      onAccept={handleAccept}
                      onDismiss={handleDismiss}
                      isUrgent={suggestion.priority === 'Urgent'}
                    />
                  ))}

              {totalCount > maxVisible && (
                <p className="text-center text-xs text-muted-foreground pt-2">
                  Încă {totalCount - maxVisible} sugestii disponibile
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

SuggestionWidget.displayName = 'SuggestionWidget';

/**
 * Inline version of the suggestion widget for embedding in pages
 * Not floating, sits within the normal document flow
 */
export function SuggestionWidgetInline({
  context,
  onSuggestionAccept,
  onSuggestionDismiss,
  maxVisible = 5,
  compactMode = true,
  title = 'Sugestii AI',
}: SuggestionWidgetProps & { title?: string }) {
  const {
    suggestions,
    loading,
    error,
    acceptSuggestion,
    dismissSuggestion,
    refreshSuggestions,
    totalCount,
  } = useSuggestions(context);

  const handleAccept = useCallback(
    async (suggestion: AISuggestion) => {
      await acceptSuggestion(suggestion.id);
      onSuggestionAccept?.(suggestion);
    },
    [acceptSuggestion, onSuggestionAccept]
  );

  const handleDismiss = useCallback(
    async (suggestionId: string, reason?: string) => {
      await dismissSuggestion(suggestionId, reason);
      onSuggestionDismiss?.(suggestionId, reason);
    },
    [dismissSuggestion, onSuggestionDismiss]
  );

  const visibleSuggestions = suggestions.slice(0, maxVisible);

  if (visibleSuggestions.length === 0 && !loading) {
    return null;
  }

  return (
    <Card role="complementary" aria-label={title}>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <div className="flex items-center gap-2">
          <SparklesIcon className="text-primary" />
          <CardTitle className="text-base">{title}</CardTitle>
          {totalCount > 0 && <Badge variant="secondary">{totalCount}</Badge>}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => refreshSuggestions()}
          aria-label="Reîmprospătează sugestiile"
          disabled={loading}
        >
          <RefreshIcon className={loading ? 'animate-spin' : ''} />
        </Button>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        {error && <p className="text-sm text-muted-foreground">Nu am putut încărca sugestiile.</p>}

        {loading && visibleSuggestions.length === 0 && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        )}

        {visibleSuggestions.length > 0 && (
          <div className="space-y-2">
            {visibleSuggestions.map((suggestion) =>
              compactMode ? (
                <SuggestionCardCompact
                  key={suggestion.id}
                  suggestion={suggestion}
                  onAccept={handleAccept}
                  onDismiss={handleDismiss}
                />
              ) : (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onAccept={handleAccept}
                  onDismiss={handleDismiss}
                />
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

SuggestionWidgetInline.displayName = 'SuggestionWidgetInline';
