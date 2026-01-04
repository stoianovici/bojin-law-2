/**
 * AISuggestionWidget - AI-Powered Suggestions Panel
 * Displays role-specific AI suggestions with dismiss functionality
 */

'use client';

import React, { useState } from 'react';
import { WidgetContainer } from '../WidgetContainer';
import type { AISuggestionWidget as AISuggestionWidgetType } from '@legal-platform/types';
import { clsx } from 'clsx';

export interface AISuggestionWidgetProps {
  widget: AISuggestionWidgetType;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
}

/**
 * Suggestion Item Component
 */
function SuggestionItem({
  suggestion,
  onDismiss,
  onViewDetails,
}: {
  suggestion: {
    id: string;
    text: string;
    timestamp: string;
    type: 'insight' | 'alert' | 'recommendation';
    actionLink?: string;
    dismissed?: boolean;
  };
  onDismiss: (id: string) => void;
  onViewDetails?: (id: string) => void;
}) {
  const [isDismissing, setIsDismissing] = useState(false);

  const handleDismiss = () => {
    setIsDismissing(true);
    setTimeout(() => {
      onDismiss(suggestion.id);
    }, 200);
  };

  // Icon based on suggestion type
  const typeIcon = {
    insight: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    ),
    alert: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
    recommendation: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
  };

  const typeColorClass = {
    insight: 'text-blue-600 bg-blue-50',
    alert: 'text-orange-600 bg-orange-50',
    recommendation: 'text-purple-600 bg-purple-50',
  };

  if (suggestion.dismissed) {
    return null;
  }

  return (
    <div
      className={clsx(
        'border-l-4 border-blue-500 bg-white rounded-r-lg p-4 transition-all duration-200',
        isDismissing && 'opacity-0 scale-95'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={clsx('flex-shrink-0 p-2 rounded-lg', typeColorClass[suggestion.type])}>
          {typeIcon[suggestion.type]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 mb-2">{suggestion.text}</p>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500">{suggestion.timestamp}</span>

            <div className="flex items-center gap-2">
              {suggestion.actionLink && (
                <button
                  onClick={() => onViewDetails?.(suggestion.id)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
                >
                  Vezi detalii
                </button>
              )}

              <button
                onClick={handleDismiss}
                className="text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                aria-label="Închide sugestia"
              >
                Închide
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * AISuggestionWidget - Displays AI-powered suggestions
 *
 * Shows role-specific AI suggestions with actionable insights, alerts, and recommendations.
 * Users can dismiss suggestions or view more details.
 */
export function AISuggestionWidget({
  widget,
  isLoading,
  onRefresh,
  onConfigure,
  onRemove,
}: AISuggestionWidgetProps) {
  const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleDismiss = (suggestionId: string) => {
    setDismissedSuggestions((prev) => [...prev, suggestionId]);
  };

  const handleViewDetails = (suggestionId: string) => {
    console.log('View details for suggestion:', suggestionId);
    // Future: Navigate to detailed view or open modal
  };

  const handleToggleExpand = () => {
    setIsExpanded((prev) => !prev);
  };

  // Filter out dismissed suggestions
  const visibleSuggestions = widget.suggestions.filter(
    (s) => !dismissedSuggestions.includes(s.id) && !s.dismissed
  );

  // Icon for widget header
  const icon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  );

  return (
    <WidgetContainer
      id={widget.id}
      title={widget.title}
      icon={icon}
      isLoading={isLoading}
      onRefresh={onRefresh}
      onConfigure={onConfigure}
      onRemove={onRemove}
      collapsed={widget.collapsed}
      onToggleCollapse={handleToggleExpand}
    >
      <div
        className={clsx(
          'space-y-3 transition-all duration-200 ease-in-out',
          !isExpanded && 'opacity-0 h-0 overflow-hidden'
        )}
      >
        {visibleSuggestions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm">Nu există sugestii noi</p>
          </div>
        ) : (
          visibleSuggestions.map((suggestion) => (
            <SuggestionItem
              key={suggestion.id}
              suggestion={suggestion}
              onDismiss={handleDismiss}
              onViewDetails={handleViewDetails}
            />
          ))
        )}
      </div>
    </WidgetContainer>
  );
}

AISuggestionWidget.displayName = 'AISuggestionWidget';
