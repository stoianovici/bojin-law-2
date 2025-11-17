/**
 * TaskCreationBar Component
 * Natural language task creation interface with parsing demonstration (mock for prototype)
 * Romanian language support with example templates
 */

'use client';

import React, { useState, useMemo } from 'react';
import type { TaskType } from '@legal-platform/types';

/**
 * Task type keywords in Romanian
 */
const TASK_TYPE_KEYWORDS: Record<string, TaskType> = {
  cercetare: 'Research',
  cercetează: 'Research',
  analiză: 'Research',
  analizează: 'Research',
  redactare: 'DocumentCreation',
  redactează: 'DocumentCreation',
  pregătește: 'DocumentCreation',
  creează: 'DocumentCreation',
  întocmire: 'DocumentCreation',
  găsire: 'DocumentRetrieval',
  găsește: 'DocumentRetrieval',
  recuperare: 'DocumentRetrieval',
  recuperează: 'DocumentRetrieval',
  căutare: 'DocumentRetrieval',
  caută: 'DocumentRetrieval',
  termen: 'CourtDate',
  instanță: 'CourtDate',
  judecată: 'CourtDate',
  ședință: 'CourtDate',
  întâlnire: 'Meeting',
  meeting: 'Meeting',
  consultare: 'Meeting',
  consultă: 'Meeting',
  deplasare: 'BusinessTrip',
  călătorie: 'BusinessTrip',
  călătorește: 'BusinessTrip',
};

/**
 * Date pattern matching
 */
const DATE_PATTERNS = [
  /(\d{1,2})\s+(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)/i,
  /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
  /până\s+pe\s+(\d{1,2})\s+(\w+)/i,
];

/**
 * Task suggestion templates
 */
const TASK_SUGGESTIONS = [
  'Pregătește contract pentru client [Nume]',
  'Cercetare jurisprudență pentru cazul [Număr]',
  'Întâlnire cu client [Nume] pe data de [Dată]',
  'Redactare memoriu pentru dosar [Număr]',
];

/**
 * Entity type for parsed text
 */
interface ParsedEntity {
  type: 'taskType' | 'date' | 'priority' | 'person' | 'case';
  value: string;
  start: number;
  end: number;
  color: string;
}

/**
 * TaskCreationBar Props
 */
interface TaskCreationBarProps {
  onCreateTask: (parsedText: string) => void;
}

/**
 * TaskCreationBar Component
 */
export function TaskCreationBar({ onCreateTask }: TaskCreationBarProps) {
  const [inputValue, setInputValue] = useState('');

  /**
   * Parse input text to extract entities (mock parsing for prototype)
   */
  const parsedEntities = useMemo((): ParsedEntity[] => {
    if (!inputValue) return [];

    const entities: ParsedEntity[] = [];
    const lowerInput = inputValue.toLowerCase();

    // Find task type keywords
    Object.entries(TASK_TYPE_KEYWORDS).forEach(([keyword, taskType]) => {
      const index = lowerInput.indexOf(keyword);
      if (index !== -1) {
        entities.push({
          type: 'taskType',
          value: taskType,
          start: index,
          end: index + keyword.length,
          color: '#3B82F6', // Blue
        });
      }
    });

    // Find dates
    DATE_PATTERNS.forEach((pattern) => {
      const match = inputValue.match(pattern);
      if (match) {
        const index = inputValue.indexOf(match[0]);
        entities.push({
          type: 'date',
          value: match[0],
          start: index,
          end: index + match[0].length,
          color: '#10B981', // Green
        });
      }
    });

    // Find case/contract references (pattern: "dosar|contract|cazul + number")
    const casePattern = /(dosar|contract|cazul?)\s+[A-Z\d]+\/?\d*/gi;
    let caseMatch;
    while ((caseMatch = casePattern.exec(inputValue)) !== null) {
      entities.push({
        type: 'case',
        value: caseMatch[0],
        start: caseMatch.index,
        end: caseMatch.index + caseMatch[0].length,
        color: '#8B5CF6', // Purple
      });
    }

    // Find person names (pattern: capitalized words after "client|pentru")
    const personPattern = /(client|pentru)\s+([A-ZĂÂÎȘȚ][a-zăâîșț]+\s+[A-ZĂÂÎȘȚ][a-zăâîșț]+)/g;
    let personMatch;
    while ((personMatch = personPattern.exec(inputValue)) !== null) {
      const nameStart = personMatch.index + personMatch[1].length + 1;
      entities.push({
        type: 'person',
        value: personMatch[2],
        start: nameStart,
        end: nameStart + personMatch[2].length,
        color: '#F59E0B', // Yellow
      });
    }

    return entities;
  }, [inputValue]);

  /**
   * Highlight input text with parsed entities
   */
  const highlightedText = useMemo(() => {
    if (!inputValue || parsedEntities.length === 0) return inputValue;

    // Sort entities by start position
    const sortedEntities = [...parsedEntities].sort((a, b) => a.start - b.start);

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedEntities.forEach((entity, idx) => {
      // Add text before entity
      if (entity.start > lastIndex) {
        parts.push(
          <span key={`text-${idx}`} className="text-gray-700">
            {inputValue.substring(lastIndex, entity.start)}
          </span>
        );
      }

      // Add highlighted entity
      parts.push(
        <span
          key={`entity-${idx}`}
          className="font-semibold px-1 rounded"
          style={{ backgroundColor: `${entity.color}20`, color: entity.color }}
        >
          {inputValue.substring(entity.start, entity.end)}
        </span>
      );

      lastIndex = entity.end;
    });

    // Add remaining text
    if (lastIndex < inputValue.length) {
      parts.push(
        <span key="text-end" className="text-gray-700">
          {inputValue.substring(lastIndex)}
        </span>
      );
    }

    return parts;
  }, [inputValue, parsedEntities]);

  /**
   * Handle suggestion click
   */
  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  /**
   * Handle create task
   */
  const handleCreateTask = () => {
    if (inputValue.trim()) {
      onCreateTask(inputValue);
      setInputValue('');
    }
  };

  /**
   * Handle Enter key press
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreateTask();
    }
  };

  return (
    <div className="task-creation-bar bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
      <div className="flex items-start gap-4">
        {/* Input section */}
        <div className="flex-1">
          <label htmlFor="task-input" className="block text-sm font-semibold text-gray-700 mb-2">
            Creează o sarcină nouă
          </label>

          {/* Input field */}
          <div className="relative">
            <input
              id="task-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Creează o sarcină de cercetare pentru contractul X până pe 15 noiembrie"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />

            {/* Clear button */}
            {inputValue && (
              <button
                onClick={() => setInputValue('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Șterge text"
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
            )}
          </div>

          {/* Highlighted parsed text preview */}
          {inputValue && parsedEntities.length > 0 && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xs font-semibold text-gray-600 mb-2">Elemente detectate:</div>
              <div className="text-sm leading-relaxed">{highlightedText}</div>

              {/* Parsed entity badges */}
              <div className="flex flex-wrap gap-2 mt-3">
                {parsedEntities.map((entity, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: `${entity.color}20`, color: entity.color }}
                  >
                    <span className="capitalize">{entity.type}</span>
                    <span className="text-gray-600">•</span>
                    <span>{entity.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Task suggestions */}
          {!inputValue && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-600 mb-2">Sugestii:</div>
              <div className="flex flex-wrap gap-2">
                {TASK_SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-md transition-colors border border-gray-300"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Create button */}
        <button
          onClick={handleCreateTask}
          disabled={!inputValue.trim()}
          className="mt-8 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>Creează</span>
          </div>
        </button>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
          <span className="font-semibold">Elemente care pot fi detectate:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3B82F6' }} />
            <span>Tip sarcină</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10B981' }} />
            <span>Data</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8B5CF6' }} />
            <span>Dosar/Contract</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
            <span>Persoană</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskCreationBar;
