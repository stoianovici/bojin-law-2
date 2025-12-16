/**
 * CommandPaletteInput Component
 * Story 4.1: Natural Language Task Parser - Task 12
 *
 * Command palette style input for natural language task creation.
 * Shows autocomplete suggestions and real-time entity highlighting.
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { TaskPatternSuggestion, ParsedEntity } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

export interface CommandPaletteInputProps {
  /** Current input value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Callback when Enter is pressed */
  onSubmit: () => void;
  /** Autocomplete suggestions */
  suggestions?: TaskPatternSuggestion[];
  /** Parsed entities for highlighting */
  entities?: ParsedEntity[];
  /** Loading state */
  isLoading?: boolean;
  /** Whether the input is focused */
  autoFocus?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Language for labels */
  language?: 'ro' | 'en';
  /** Disabled state */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Entity Colors
// ============================================================================

const ENTITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  taskType: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  date: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  time: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
  priority: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  person: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300' },
  case: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  location: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  duration: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-300' },
};

// ============================================================================
// Labels
// ============================================================================

const LABELS = {
  ro: {
    placeholder: 'Descrie sarcina ta în limbaj natural...',
    suggestions: 'Sugestii',
    loading: 'Se procesează...',
    pressEnter: 'Apasă Enter pentru a continua',
    noSuggestions: 'Nicio sugestie',
    recentPatterns: 'Șabloane recente',
    taskTypes: {
      Research: 'Cercetare',
      DocumentCreation: 'Document',
      DocumentRetrieval: 'Recuperare',
      CourtDate: 'Instanță',
      Meeting: 'Întâlnire',
      BusinessTrip: 'Deplasare',
    },
  },
  en: {
    placeholder: 'Describe your task in natural language...',
    suggestions: 'Suggestions',
    loading: 'Processing...',
    pressEnter: 'Press Enter to continue',
    noSuggestions: 'No suggestions',
    recentPatterns: 'Recent patterns',
    taskTypes: {
      Research: 'Research',
      DocumentCreation: 'Document',
      DocumentRetrieval: 'Retrieval',
      CourtDate: 'Court',
      Meeting: 'Meeting',
      BusinessTrip: 'Trip',
    },
  },
};

// ============================================================================
// Task Type Icons
// ============================================================================

function TaskTypeIcon({ type }: { type: string }) {
  const iconClass = 'w-4 h-4';

  switch (type) {
    case 'Research':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      );
    case 'DocumentCreation':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
    case 'DocumentRetrieval':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
      );
    case 'CourtDate':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
          />
        </svg>
      );
    case 'Meeting':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      );
    case 'BusinessTrip':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      );
  }
}

// ============================================================================
// Suggestion Item Component
// ============================================================================

interface SuggestionItemProps {
  suggestion: TaskPatternSuggestion;
  isSelected: boolean;
  onClick: () => void;
  language: 'ro' | 'en';
}

function SuggestionItem({ suggestion, isSelected, onClick, language }: SuggestionItemProps) {
  const labels = LABELS[language];
  const taskTypeLabel =
    labels.taskTypes[suggestion.taskType as keyof typeof labels.taskTypes] || suggestion.taskType;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors',
        'hover:bg-gray-100',
        isSelected && 'bg-blue-50'
      )}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
        <TaskTypeIcon type={suggestion.taskType} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">{suggestion.pattern}</div>
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{taskTypeLabel}</span>
          <span>•</span>
          <span>{suggestion.frequency}x</span>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Entity Highlight Component
// ============================================================================

function HighlightedText({ text, entities }: { text: string; entities: ParsedEntity[] }) {
  if (!entities || entities.length === 0) {
    return <span className="text-gray-900">{text}</span>;
  }

  // Sort entities by start position
  const sortedEntities = [...entities].sort((a, b) => a.startIndex - b.startIndex);

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  sortedEntities.forEach((entity, idx) => {
    // Add text before entity
    if (entity.startIndex > lastIndex) {
      parts.push(
        <span key={`text-${idx}`} className="text-gray-900">
          {text.substring(lastIndex, entity.startIndex)}
        </span>
      );
    }

    // Add highlighted entity
    const colors = ENTITY_COLORS[entity.type] || {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      border: 'border-gray-300',
    };
    parts.push(
      <span
        key={`entity-${idx}`}
        className={cn('px-1 py-0.5 rounded border', colors.bg, colors.text, colors.border)}
        title={`${entity.type}: ${entity.normalizedValue || entity.value}`}
      >
        {text.substring(entity.startIndex, entity.endIndex)}
      </span>
    );

    lastIndex = entity.endIndex;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(
      <span key="text-end" className="text-gray-900">
        {text.substring(lastIndex)}
      </span>
    );
  }

  return <>{parts}</>;
}

// ============================================================================
// Main Component
// ============================================================================

export function CommandPaletteInput({
  value,
  onChange,
  onSubmit,
  suggestions = [],
  entities = [],
  isLoading = false,
  autoFocus = false,
  placeholder,
  language = 'ro',
  disabled = false,
  className,
}: CommandPaletteInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const labels = LABELS[language];
  const displayPlaceholder = placeholder || labels.placeholder;

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  // Show suggestions when there are any
  useEffect(() => {
    setShowSuggestions(suggestions.length > 0 && value.length > 0 && value.length < 20);
  }, [suggestions, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showSuggestions && suggestions.length > 0) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % suggestions.length);
            break;
          case 'ArrowUp':
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
            break;
          case 'Tab':
          case 'Enter':
            if (suggestions[selectedIndex]) {
              e.preventDefault();
              onChange(suggestions[selectedIndex].completedText);
              setShowSuggestions(false);
            }
            break;
          case 'Escape':
            setShowSuggestions(false);
            break;
        }
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    },
    [showSuggestions, suggestions, selectedIndex, onChange, onSubmit]
  );

  const handleSuggestionClick = (suggestion: TaskPatternSuggestion) => {
    onChange(suggestion.completedText);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <div className={cn('relative', className)}>
      {/* Input container */}
      <div
        className={cn(
          'relative rounded-lg border bg-white shadow-sm transition-all',
          'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500',
          disabled && 'opacity-50 cursor-not-allowed',
          value && entities.length > 0 ? 'border-blue-300' : 'border-gray-300'
        )}
      >
        {/* Command icon */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </div>

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && value.length > 0 && setShowSuggestions(true)}
          placeholder={displayPlaceholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cn(
            'w-full pl-10 pr-10 py-3 text-sm bg-transparent',
            'placeholder:text-gray-400',
            'focus:outline-none',
            'disabled:cursor-not-allowed'
          )}
        />

        {/* Loading / Status indicator */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
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
          ) : value ? (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-gray-400 hover:text-gray-600"
              title="Clear"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          ) : (
            <span className="text-xs text-gray-400">⌘K</span>
          )}
        </div>
      </div>

      {/* Entity highlight preview */}
      {value && entities.length > 0 && (
        <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-xs font-medium text-gray-500 mb-1">
            {language === 'ro' ? 'Elemente detectate:' : 'Detected elements:'}
          </div>
          <div className="text-sm">
            <HighlightedText text={value} entities={entities} />
          </div>
        </div>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500">{labels.recentPatterns}</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {suggestions.map((suggestion, idx) => (
              <SuggestionItem
                key={suggestion.id}
                suggestion={suggestion}
                isSelected={idx === selectedIndex}
                onClick={() => handleSuggestionClick(suggestion)}
                language={language}
              />
            ))}
          </div>
          <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">
              {language === 'ro'
                ? 'Folosește ↑↓ pentru navigare, Tab pentru selectare'
                : 'Use ↑↓ to navigate, Tab to select'}
            </span>
          </div>
        </div>
      )}

      {/* Hint text */}
      {value.length > 0 && !isLoading && !showSuggestions && (
        <div className="mt-1 text-xs text-gray-500 text-right">{labels.pressEnter}</div>
      )}
    </div>
  );
}

export default CommandPaletteInput;
