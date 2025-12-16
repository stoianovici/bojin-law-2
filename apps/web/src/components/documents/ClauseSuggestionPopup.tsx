/**
 * Clause Suggestion Popup Component
 * Story 3.3: Intelligent Document Drafting
 *
 * Displays inline clause suggestions with keyboard navigation
 * Features: SSE connection, Tab to accept, Escape to dismiss, source indicators
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { clsx } from 'clsx';
import type { ClauseSuggestion, ClauseSource, DocumentType } from '@legal-platform/types';

export interface ClauseSuggestionPopupProps {
  /** Whether the popup is visible */
  isVisible: boolean;
  /** List of suggestions to display */
  suggestions: ClauseSuggestion[];
  /** Position relative to parent */
  position: { top: number; left: number };
  /** Currently selected suggestion index */
  selectedIndex?: number;
  /** Callback when a suggestion is accepted */
  onAccept: (suggestion: ClauseSuggestion) => void;
  /** Callback when popup is dismissed */
  onDismiss: () => void;
  /** Callback when selection changes */
  onSelectionChange?: (index: number) => void;
  /** Whether to show suggestion history */
  showHistory?: boolean;
  /** Max height for the suggestion list */
  maxHeight?: number;
}

/**
 * Popup component for displaying clause suggestions
 */
export function ClauseSuggestionPopup({
  isVisible,
  suggestions,
  position,
  selectedIndex = 0,
  onAccept,
  onDismiss,
  onSelectionChange,
  showHistory = false,
  maxHeight = 200,
}: ClauseSuggestionPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<ClauseSuggestion[]>([]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            handleAccept(suggestions[selectedIndex]);
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            handleAccept(suggestions[selectedIndex]);
          }
          break;

        case 'Escape':
          e.preventDefault();
          onDismiss();
          break;

        case 'ArrowUp':
          e.preventDefault();
          onSelectionChange?.(Math.max(0, selectedIndex - 1));
          break;

        case 'ArrowDown':
          e.preventDefault();
          onSelectionChange?.(Math.min(suggestions.length - 1, selectedIndex + 1));
          break;

        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, suggestions, selectedIndex, onDismiss, onSelectionChange]);

  // Click outside to dismiss
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVisible, onDismiss]);

  // Accept suggestion and add to history
  const handleAccept = useCallback(
    (suggestion: ClauseSuggestion) => {
      setHistory((prev) => [suggestion, ...prev.slice(0, 9)]);
      onAccept(suggestion);
    },
    [onAccept]
  );

  // Get source badge styling
  const getSourceBadge = (source: ClauseSource) => {
    const styles: Record<ClauseSource, { bg: string; text: string; label: string }> = {
      FIRM_PATTERN: { bg: 'bg-green-100', text: 'text-green-700', label: 'Șablon firmă' },
      TEMPLATE: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Template' },
      AI_GENERATED: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'AI' },
    };

    const style = styles[source] || { bg: 'bg-gray-100', text: 'text-gray-700', label: source };

    return (
      <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium', style.bg, style.text)}>
        {style.label}
      </span>
    );
  };

  // Get confidence indicator
  const getConfidenceIndicator = (confidence: number) => {
    const percentage = Math.round(confidence * 100);
    let colorClass = 'text-gray-400';

    if (confidence >= 0.8) colorClass = 'text-green-600';
    else if (confidence >= 0.6) colorClass = 'text-yellow-600';

    return (
      <span className={clsx('text-xs', colorClass)} title={`Încredere: ${percentage}%`}>
        {percentage}%
      </span>
    );
  };

  if (!isVisible || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      ref={popupRef}
      className={clsx(
        'absolute z-50',
        'bg-white rounded-lg shadow-xl',
        'border border-gray-200',
        'min-w-[300px] max-w-[500px]',
        'overflow-hidden'
      )}
      style={{
        top: position.top,
        left: Math.max(0, Math.min(position.left, window.innerWidth - 520)),
      }}
      role="listbox"
      aria-label="Sugestii clauze"
    >
      {/* Header */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">Sugestii ({suggestions.length})</span>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-gray-200 rounded text-[10px] font-mono">Tab</kbd>
            <span>Acceptă</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-gray-200 rounded text-[10px] font-mono">Esc</kbd>
            <span>Închide</span>
          </span>
        </div>
      </div>

      {/* Suggestions List */}
      <ul className="overflow-y-auto" style={{ maxHeight }} role="listbox">
        {suggestions.map((suggestion, index) => (
          <li
            key={suggestion.id}
            className={clsx(
              'px-3 py-2.5 cursor-pointer transition-colors',
              'border-b border-gray-100 last:border-b-0',
              index === selectedIndex
                ? 'bg-blue-50 border-l-2 border-l-blue-500'
                : 'hover:bg-gray-50'
            )}
            onClick={() => handleAccept(suggestion)}
            onMouseEnter={() => onSelectionChange?.(index)}
            role="option"
            aria-selected={index === selectedIndex}
          >
            {/* Suggestion Text */}
            <div className="text-sm text-gray-800 mb-1.5 line-clamp-2">{suggestion.text}</div>

            {/* Metadata Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {getSourceBadge(suggestion.source)}
                <span className="text-xs text-gray-400">{suggestion.category}</span>
              </div>
              {getConfidenceIndicator(suggestion.confidence)}
            </div>
          </li>
        ))}
      </ul>

      {/* History Section */}
      {showHistory && history.length > 0 && (
        <>
          <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200">
            <span className="text-xs font-medium text-gray-500">Istoric recent</span>
          </div>
          <ul className="max-h-24 overflow-y-auto">
            {history.slice(0, 3).map((item, index) => (
              <li
                key={`history-${item.id}-${index}`}
                className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 cursor-pointer truncate"
                onClick={() => handleAccept(item)}
              >
                {item.text}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Footer */}
      <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 text-center">
          Folosiți <kbd className="px-0.5 bg-gray-200 rounded">↑</kbd>{' '}
          <kbd className="px-0.5 bg-gray-200 rounded">↓</kbd> pentru navigare
        </p>
      </div>
    </div>
  );
}

/**
 * Hook for managing clause suggestion state
 */
export function useClauseSuggestions(documentId: string, documentType: DocumentType) {
  const [suggestions, setSuggestions] = useState<ClauseSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Connect to SSE stream
  const connect = useCallback(
    (userId: string, firmId: string) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      try {
        const url = new URL('/api/ai/suggestions/stream', window.location.origin);
        url.searchParams.set('documentId', documentId);
        url.searchParams.set('userId', userId);
        url.searchParams.set('firmId', firmId);

        const eventSource = new EventSource(url.toString());

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'suggestion' && data.data) {
              setSuggestions((prev) => [...prev, data.data]);
            }
          } catch (e) {
            console.error('Failed to parse SSE message:', e);
          }
        };

        eventSource.onerror = () => {
          setError('Conexiune pierdută. Reconectare...');
          // Auto-reconnect handled by EventSource
        };

        eventSourceRef.current = eventSource;
      } catch (e) {
        setError('Nu s-a putut conecta la serviciul de sugestii');
      }
    },
    [documentId]
  );

  // Disconnect from SSE stream
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Request suggestions for current text
  const requestSuggestions = useCallback(
    async (currentText: string, cursorPosition: number, userId: string, firmId: string) => {
      setIsLoading(true);
      setError(null);
      setSuggestions([]);

      try {
        const response = await fetch('/api/ai/suggestions/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentId,
            documentType,
            currentText,
            cursorPosition,
            userId,
            firmId,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to request suggestions');
        }

        const data = await response.json();
        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
      } catch (e) {
        setError('Nu s-au putut obține sugestii');
      } finally {
        setIsLoading(false);
      }
    },
    [documentId, documentType]
  );

  // Clear suggestions
  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    suggestions,
    isLoading,
    error,
    connect,
    disconnect,
    requestSuggestions,
    clearSuggestions,
  };
}

export default ClauseSuggestionPopup;
