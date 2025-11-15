/**
 * Command Bar Component
 * Natural language command interface for document operations
 */

'use client';

import React from 'react';

export interface CommandBarProps {
  onCommandSubmit?: (command: string) => void;
  isLoading?: boolean;
  resultMessage?: string;
}

const SUGGESTED_COMMANDS = [
  'Adaugă clauză de confidențialitate',
  'Verifică pentru erori',
  'Generează rezumat',
  'Traduce în engleză',
];

export function CommandBar({
  onCommandSubmit,
  isLoading = false,
  resultMessage,
}: CommandBarProps) {
  const [command, setCommand] = React.useState('');
  const [isFocused, setIsFocused] = React.useState(false);
  const [showResult, setShowResult] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim() && !isLoading) {
      onCommandSubmit?.(command);
      setCommand('');
      setShowResult(true);
      setIsFocused(false);

      // Auto-hide result after 5 seconds
      setTimeout(() => {
        setShowResult(false);
      }, 5000);
    }
  };

  const handleSuggestedCommand = (suggestion: string) => {
    setCommand(suggestion);
    inputRef.current?.focus();
  };

  // Listen for Ctrl+/ keyboard shortcut
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20">
      {/* Result Message */}
      {showResult && resultMessage && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg shadow-lg max-w-md animate-slide-up">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">Comandă executată</p>
              <p className="text-sm text-green-700 mt-1">{resultMessage}</p>
            </div>
            <button
              onClick={() => setShowResult(false)}
              className="text-green-600 hover:text-green-800"
              aria-label="Închide"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Suggested Commands (shown when focused) */}
      {isFocused && !isLoading && (
        <div className="absolute bottom-full left-0 right-0 pb-2">
          <div className="max-w-4xl mx-auto px-4">
            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Comenzi sugerate
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_COMMANDS.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestedCommand(suggestion)}
                    className="px-3 py-1.5 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-full hover:bg-gray-100 hover:border-gray-300 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Command Bar */}
      <div className="bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            {/* Input */}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                placeholder="Scrie o comandă... (ex: 'Adaugă clauză de confidențialitate', 'Verifică pentru erori')"
                className="w-full px-4 py-3 pr-12 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
                aria-label="Comandă document"
              />

              {/* Loading Spinner */}
              {isLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <svg
                    className="animate-spin h-5 w-5 text-blue-600"
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
                </div>
              )}

              {/* Keyboard Shortcut Hint */}
              {!isFocused && !command && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-xs text-gray-400">
                  <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
                    Ctrl
                  </kbd>
                  <span>+</span>
                  <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
                    /
                  </kbd>
                </div>
              )}
            </div>

            {/* Voice Input Button */}
            <button
              type="button"
              className="p-3 text-gray-600 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
              aria-label="Comandă vocală"
              title="Comandă vocală"
              onClick={() => {
                // Mock voice input functionality
                console.log('Voice input clicked');
              }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* Submit Button */}
            <button
              type="submit"
              className="p-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!command.trim() || isLoading}
              aria-label="Trimite comandă"
              title="Trimite comandă"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </form>

          {/* Helper Text */}
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <p>Folosește limbaj natural pentru a comanda AI-ul să modifice documentul</p>
            <p className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <span>AI va executa comanda și va modifica documentul automat</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
