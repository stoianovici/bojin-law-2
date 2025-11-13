/**
 * QuickActionsBar - Natural language input bar for quick actions
 * Fixed at bottom of workspace with suggestion chips
 */

'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { useCaseWorkspaceStore } from '../../stores/case-workspace.store';

export interface QuickActionsBarProps {
  onSubmit?: (input: string) => void;
  onSuggestionClick?: (suggestion: string) => void;
  className?: string;
}

const QUICK_SUGGESTIONS = [
  'Adaugă document',
  'Creează sarcină',
  'Programează termen',
  'Email client',
  'Înregistrează timp',
];

/**
 * QuickActionsBar Component
 *
 * Fixed bottom bar with natural language input and suggestion chips
 */
export function QuickActionsBar({
  onSubmit,
  onSuggestionClick,
  className,
}: QuickActionsBarProps) {
  const { quickActionsVisible, toggleQuickActions, aiPanelCollapsed } = useCaseWorkspaceStore();
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit?.(input.trim());
      setInput('');
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onSuggestionClick?.(suggestion);
    setInput(suggestion);
  };

  if (!quickActionsVisible) {
    return (
      <button
        onClick={toggleQuickActions}
        className={clsx(
          'fixed bottom-4 z-50 p-4 rounded-full bg-purple-600 text-white shadow-lg hover:bg-purple-700 hover:shadow-xl transition-all',
          // Position button to avoid AI panel when expanded
          aiPanelCollapsed ? 'right-4' : 'right-[21rem]' // 21rem = 336px (320px panel + 16px spacing)
        )}
        aria-label="Deschide Acțiuni Rapide"
      >
        <svg
          className="w-6 h-6"
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
      </button>
    );
  }

  return (
    <div
      className={clsx(
        'fixed bottom-0 left-0 z-50',
        'transition-all duration-300',
        // Adjust right position based on AI panel state
        aiPanelCollapsed ? 'right-0' : 'right-80', // 80 = w-80 (320px) when AI panel expanded
        className
      )}
    >
      {/* Suggestion Chips */}
      {!isFocused && !input && (
        <div className="px-6 py-2 bg-white/95 backdrop-blur-sm border-t border-gray-200">
          <div className="max-w-5xl mx-auto flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
              Încercați:
            </span>
            {QUICK_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 whitespace-nowrap transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Input Bar */}
      <div className="px-6 py-4 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-5xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            {/* AI Sparkles Icon */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
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
            </div>

            {/* Input Field */}
            <input
              type="text"
              value={input}
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= 500) {
                  setInput(value);
                }
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ce doriți să faceți? (de ex., 'Creează sarcină pentru revizuire document până vineri')"
              maxLength={500}
              className={clsx(
                'w-full pl-12 pr-32 py-4 text-sm border-2 rounded-lg transition-colors focus:outline-none',
                isFocused
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-300 bg-white',
              )}
            />

            {/* Character Count */}
            <div className="absolute right-24 top-1/2 -translate-y-1/2 text-xs text-gray-500">
              {input.length}/500
            </div>

            {/* Microphone Icon (Visual Only) */}
            <button
              type="button"
              className="absolute right-14 top-1/2 -translate-y-1/2 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Intrare vocală (în dezvoltare)"
              title="Intrare vocală - în dezvoltare"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </button>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!input.trim()}
              className={clsx(
                'absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all',
                input.trim()
                  ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed',
              )}
              aria-label="Trimite"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </button>
          </form>

          {/* Note Banner */}
          <div className="mt-3 flex items-start gap-2 text-xs text-purple-800 bg-purple-50 px-3 py-2 rounded">
            <svg
              className="w-4 h-4 flex-shrink-0 mt-0.5"
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
            <p>
              <strong>Prototip vizual:</strong> Procesarea limbajului natural este doar o
              demonstrație vizuală. Funcționalitatea completă va fi implementată când
              backend-ul este disponibil.
            </p>
          </div>

          {/* Toggle Button */}
          <div className="mt-3 flex justify-end">
            <button
              onClick={toggleQuickActions}
              className="text-xs text-gray-600 hover:text-gray-900 font-medium"
            >
              Ascunde Acțiuni Rapide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

QuickActionsBar.displayName = 'QuickActionsBar';
