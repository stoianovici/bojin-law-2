/**
 * SnippetAutocomplete - Inline snippet picker for text editors
 * Story 5.6: AI Learning and Personalization (Task 28)
 * Provides autocomplete dropdown when "/" is typed
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { useSnippetAutocomplete, useSnippets, useRecordSnippetUsage } from '@/hooks/usePersonalSnippets';
import type { PersonalSnippet, SnippetCategory } from '@legal-platform/types';

// Category colors
const CATEGORY_COLORS: Record<SnippetCategory, string> = {
  Greeting: 'bg-green-100 text-green-800',
  Closing: 'bg-blue-100 text-blue-800',
  LegalPhrase: 'bg-purple-100 text-purple-800',
  ClientResponse: 'bg-orange-100 text-orange-800',
  InternalNote: 'bg-gray-100 text-gray-800',
  Custom: 'bg-yellow-100 text-yellow-800',
};

// Icons
const SnippetIcon = ({ className }: { className?: string }) => (
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
      d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
    />
  </svg>
);

export interface SnippetAutocompleteProps {
  text: string;
  cursorPosition: number;
  onInsert: (startPos: number, endPos: number, content: string) => void;
  className?: string;
  maxHeight?: number;
}

/**
 * Autocomplete dropdown positioned near cursor
 */
function AutocompleteDropdown({
  matches,
  selectedIndex,
  onSelect,
}: {
  matches: PersonalSnippet[];
  selectedIndex: number;
  onSelect: (snippet: PersonalSnippet) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (list) {
      const selectedItem = list.children[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (matches.length === 0) {
    return (
      <div className="p-3 text-sm text-muted-foreground text-center">
        Niciun snippet găsit
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Snippet suggestions"
      className="max-h-[200px] overflow-auto"
    >
      {matches.map((snippet, index) => (
        <button
          key={snippet.id}
          role="option"
          aria-selected={index === selectedIndex}
          onClick={() => onSelect(snippet)}
          className={`
            w-full flex items-start gap-3 p-3 text-left transition-colors
            ${index === selectedIndex ? 'bg-accent' : 'hover:bg-muted/50'}
          `}
        >
          <SnippetIcon className="shrink-0 mt-0.5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">
                {snippet.title}
              </span>
              <Badge
                className={`text-[10px] shrink-0 ${CATEGORY_COLORS[snippet.category]}`}
              >
                {snippet.category}
              </Badge>
            </div>
            <code className="text-xs text-muted-foreground">
              /{snippet.shortcut}
            </code>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {snippet.content.substring(0, 60)}
              {snippet.content.length > 60 ? '...' : ''}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

/**
 * SnippetAutocomplete monitors text input and shows snippet suggestions
 * when the user types "/" followed by characters.
 */
export function SnippetAutocomplete({
  text,
  cursorPosition,
  onInsert,
  className = '',
  maxHeight = 200,
}: SnippetAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { isActive, query, matches, insertSnippet } =
    useSnippetAutocomplete(text, cursorPosition);

  // Reset selection when matches change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback(
    (snippet: PersonalSnippet) => {
      const result = insertSnippet(snippet);
      onInsert(result.startPos, result.endPos, result.content);
    },
    [insertSnippet, onInsert]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, matches.length - 1)
          );
          return;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          return;
        case 'Enter':
        case 'Tab':
          if (matches.length > 0) {
            e.preventDefault();
            handleSelect(matches[selectedIndex]);
          }
          return;
        case 'Escape':
          e.preventDefault();
          // Let parent handle close
          return;
        default:
          return;
      }
    },
    [isActive, matches, selectedIndex, handleSelect]
  );

  // Attach keyboard listener
  useEffect(() => {
    if (isActive) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [isActive, handleKeyDown]);

  if (!isActive) {
    return null;
  }

  return (
    <div
      className={`
        absolute z-50 w-80 rounded-lg border bg-popover shadow-lg
        ${className}
      `}
      style={{ maxHeight }}
      role="dialog"
      aria-label="Snippet autocomplete"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground">
          Snippet-uri {query && `pentru "${query}"`}
        </span>
        <span className="text-xs text-muted-foreground">
          ↑↓ navighează · Enter selectează
        </span>
      </div>

      {/* List */}
      <AutocompleteDropdown
        matches={matches}
        selectedIndex={selectedIndex}
        onSelect={handleSelect}
      />
    </div>
  );
}

SnippetAutocomplete.displayName = 'SnippetAutocomplete';

/**
 * Hook-based wrapper that can be used with any textarea/input
 */
export function useSnippetAutocompleteIntegration(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (value: string) => void
) {
  const [cursorPosition, setCursorPosition] = useState(0);

  // Update cursor position on selection change
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleSelectionChange = () => {
      setCursorPosition(textarea.selectionStart);
    };

    textarea.addEventListener('select', handleSelectionChange);
    textarea.addEventListener('click', handleSelectionChange);
    textarea.addEventListener('keyup', handleSelectionChange);

    return () => {
      textarea.removeEventListener('select', handleSelectionChange);
      textarea.removeEventListener('click', handleSelectionChange);
      textarea.removeEventListener('keyup', handleSelectionChange);
    };
  }, [textareaRef]);

  // Handle snippet insertion
  const handleInsert = useCallback(
    (startPos: number, endPos: number, content: string) => {
      const newValue = value.substring(0, startPos) + content + value.substring(endPos);
      onChange(newValue);

      // Move cursor to end of inserted content
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          const newCursorPos = startPos + content.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          textarea.focus();
        }
      });
    },
    [textareaRef, value, onChange]
  );

  return {
    cursorPosition,
    handleInsert,
  };
}

/**
 * Snippet picker button component for toolbar integration
 */
export function SnippetPickerButton({
  onSelect,
  className = '',
}: {
  onSelect: (content: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { snippets, mostUsed } = useSnippets();
  const { recordUsage } = useRecordSnippetUsage();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const filteredSnippets = searchQuery
    ? snippets.filter(
        (s: PersonalSnippet) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.shortcut.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : mostUsed.length > 0
      ? mostUsed
      : snippets.slice(0, 5);

  const handleSelect = (snippet: PersonalSnippet) => {
    recordUsage(snippet.id);
    onSelect(snippet.content);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-1.5 rounded-md border border-gray-300
          px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50
          dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800
          ${className}
        `}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title="Inserează snippet"
      >
        <SnippetIcon className="h-4 w-4" />
        Snippets
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown */}
          <div
            className="absolute left-0 top-full mt-1 z-50 w-80 rounded-lg border bg-popover shadow-lg"
            role="dialog"
            aria-label="Snippet picker"
          >
            {/* Search */}
            <div className="p-2 border-b">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Caută snippets..."
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
            </div>

            {/* List */}
            <div className="max-h-[250px] overflow-auto">
              {filteredSnippets.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  {searchQuery
                    ? 'Niciun snippet găsit'
                    : 'Niciun snippet salvat'}
                </div>
              ) : (
                <>
                  {!searchQuery && mostUsed.length > 0 && (
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30">
                      Cele mai folosite
                    </div>
                  )}
                  {filteredSnippets.map((snippet: PersonalSnippet) => (
                    <button
                      key={snippet.id}
                      onClick={() => handleSelect(snippet)}
                      className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
                    >
                      <SnippetIcon className="shrink-0 mt-0.5 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {snippet.title}
                          </span>
                        </div>
                        <code className="text-xs text-muted-foreground">
                          /{snippet.shortcut}
                        </code>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t text-center">
              <span className="text-xs text-muted-foreground">
                Tastează / în editor pentru autocomplete
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

SnippetPickerButton.displayName = 'SnippetPickerButton';
