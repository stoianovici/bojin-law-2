/**
 * AI Document Editor Component
 * Story 3.3: Intelligent Document Drafting
 *
 * Rich text editor with AI-powered clause suggestions
 * Features: inline suggestions, Tab to accept, Escape to dismiss
 */

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import { clsx } from 'clsx';
import { gql } from '@apollo/client';
import { useLazyQuery } from '@apollo/client/react';
import type { ClauseSuggestion, DocumentType, ClauseSource } from '@legal-platform/types';

// GraphQL query for clause suggestions
const CLAUSE_SUGGESTIONS_QUERY = gql`
  query ClauseSuggestions(
    $currentText: String!
    $documentType: DocumentType!
    $cursorPosition: Int!
  ) {
    clauseSuggestions(
      currentText: $currentText
      documentType: $documentType
      cursorPosition: $cursorPosition
    ) {
      id
      text
      source
      confidence
      category
    }
  }
`;

interface ClauseSuggestionsData {
  clauseSuggestions: ClauseSuggestion[];
}

export interface AIDocumentEditorProps {
  /** Initial content for the editor */
  initialContent?: string;
  /** Document type for suggestions context */
  documentType: DocumentType;
  /** Document ID (reserved for future SSE suggestions) */
  documentId?: string;
  /** Callback when content changes */
  onContentChange?: (content: string) => void;
  /** Callback when text is selected (for explain feature) */
  onTextSelect?: (selectedText: string, selection: Selection) => void;
  /** Whether the editor is in read-only mode */
  readOnly?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Enable AI suggestions */
  enableSuggestions?: boolean;
}

interface SuggestionState {
  suggestions: ClauseSuggestion[];
  isVisible: boolean;
  position: { top: number; left: number };
  selectedIndex: number;
}

const DEBOUNCE_MS = 300;

/**
 * AI Document Editor with inline suggestions
 */
export function AIDocumentEditor({
  initialContent = '',
  documentType,
  documentId: _documentId,
  onContentChange,
  onTextSelect,
  readOnly = false,
  placeholder = 'Începeți să scrieți documentul...',
  showLineNumbers = true,
  enableSuggestions = true,
}: AIDocumentEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // Editor state - content is tracked but NOT rendered (to avoid cursor issues)
  const [content, setContent] = useState(initialContent);
  const [_cursorPosition, setCursorPosition] = useState(0);

  // Derive lines and isEmpty from content (no state sync needed)
  const lines = useMemo(() => content.split('\n'), [content]);
  const isEmpty = useMemo(() => !content.trim(), [content]);

  // Suggestion state
  const [suggestion, setSuggestion] = useState<SuggestionState>({
    suggestions: [],
    isVisible: false,
    position: { top: 0, left: 0 },
    selectedIndex: 0,
  });

  // Hide suggestion popup
  const hideSuggestion = useCallback(() => {
    setSuggestion((prev) => ({
      ...prev,
      isVisible: false,
      suggestions: [],
    }));
  }, []);

  // Show suggestion popup
  const showSuggestion = useCallback((suggestions: ClauseSuggestion[]) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const editorRect = editorRef.current?.getBoundingClientRect();

    if (!editorRect) return;

    setSuggestion({
      suggestions,
      isVisible: true,
      position: {
        top: rect.bottom - editorRect.top + 4,
        left: rect.left - editorRect.left,
      },
      selectedIndex: 0,
    });
  }, []);

  // GraphQL query for clause suggestions
  const [fetchSuggestionsQuery, { loading: suggestionsLoading }] =
    useLazyQuery<ClauseSuggestionsData>(CLAUSE_SUGGESTIONS_QUERY, {
      fetchPolicy: 'network-only',
    });

  // Fetch suggestions from GraphQL API
  const fetchSuggestions = useCallback(
    async (text: string, position: number) => {
      // Only fetch if there's enough text context
      if (text.length < 10 || !enableSuggestions) {
        hideSuggestion();
        return;
      }

      // Use GraphQL query to fetch suggestions
      try {
        const { data } = await fetchSuggestionsQuery({
          variables: {
            currentText: text,
            documentType,
            cursorPosition: position,
          },
        });
        if (data?.clauseSuggestions && data.clauseSuggestions.length > 0) {
          showSuggestion(data.clauseSuggestions);
        } else {
          hideSuggestion();
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        hideSuggestion();
      }
    },
    [documentType, enableSuggestions, fetchSuggestionsQuery, hideSuggestion, showSuggestion]
  );

  // Initialize editor DOM content only once (use useLayoutEffect to sync before paint)
  // Note: content state is already initialized from initialContent prop
  useLayoutEffect(() => {
    if (editorRef.current && !isInitializedRef.current && initialContent) {
      editorRef.current.innerText = initialContent;
      isInitializedRef.current = true;
    }
  }, [initialContent]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Handle content changes
  const handleInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      const newContent = e.currentTarget.innerText || '';
      setContent(newContent);
      onContentChange?.(newContent);

      // Update cursor position
      let newCursorPosition = 0;
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(e.currentTarget);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        newCursorPosition = preCaretRange.toString().length;
        setCursorPosition(newCursorPosition);
      }

      // Debounce suggestion requests
      if (enableSuggestions && !readOnly) {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
          fetchSuggestions(newContent, newCursorPosition);
        }, DEBOUNCE_MS);
      }
    },
    [onContentChange, enableSuggestions, readOnly, fetchSuggestions]
  );

  // Accept the selected suggestion
  const acceptSuggestion = useCallback(() => {
    if (!suggestion.isVisible || suggestion.suggestions.length === 0) return;

    const selectedSuggestion = suggestion.suggestions[suggestion.selectedIndex];
    if (!selectedSuggestion) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    // Insert suggestion text at cursor
    const textNode = document.createTextNode(selectedSuggestion.text);
    range.insertNode(textNode);

    // Move cursor to end of inserted text
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);

    // Update content
    const newContent = editorRef.current?.innerText || '';
    setContent(newContent);
    onContentChange?.(newContent);

    hideSuggestion();
  }, [suggestion, onContentChange]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!suggestion.isVisible) return;

      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          acceptSuggestion();
          break;

        case 'Escape':
          e.preventDefault();
          hideSuggestion();
          break;

        case 'ArrowUp':
          if (suggestion.suggestions.length > 1) {
            e.preventDefault();
            setSuggestion((prev) => ({
              ...prev,
              selectedIndex: Math.max(0, prev.selectedIndex - 1),
            }));
          }
          break;

        case 'ArrowDown':
          if (suggestion.suggestions.length > 1) {
            e.preventDefault();
            setSuggestion((prev) => ({
              ...prev,
              selectedIndex: Math.min(prev.suggestions.length - 1, prev.selectedIndex + 1),
            }));
          }
          break;

        default:
          break;
      }
    },
    [suggestion, acceptSuggestion]
  );

  // Handle text selection for explain feature
  const handleSelect = useCallback(() => {
    if (!onTextSelect) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (selectedText.length > 0) {
      onTextSelect(selectedText, selection);
    }
  }, [onTextSelect]);

  // Get source badge color
  const getSourceColor = (source: ClauseSource): string => {
    switch (source) {
      case 'FIRM_PATTERN':
        return 'bg-green-100 text-green-800';
      case 'TEMPLATE':
        return 'bg-blue-100 text-blue-800';
      case 'AI_GENERATED':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get source label
  const getSourceLabel = (source: ClauseSource): string => {
    switch (source) {
      case 'FIRM_PATTERN':
        return 'Șablon firmă';
      case 'TEMPLATE':
        return 'Template';
      case 'AI_GENERATED':
        return 'AI';
      default:
        return source;
    }
  };

  return (
    <div className="relative flex h-full bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Line Numbers Gutter */}
      {showLineNumbers && (
        <div className="flex-shrink-0 w-12 bg-gray-50 border-r border-gray-200 py-4 px-2 overflow-hidden">
          <div className="text-right text-xs font-mono text-gray-400 leading-6">
            {lines.map((_, index) => (
              <div key={index} className="h-6 select-none">
                {index + 1}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-auto relative">
        <div
          ref={editorRef}
          className={clsx(
            'min-h-full p-6 outline-none',
            'text-base leading-6 font-sans',
            'focus:ring-2 focus:ring-inset focus:ring-blue-200',
            readOnly && 'cursor-default'
          )}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          role="textbox"
          aria-label="Document editor"
          aria-multiline="true"
          aria-readonly={readOnly}
          spellCheck={false}
          style={{
            fontSize: '16px',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
        />
        {/* Placeholder overlay when empty */}
        {isEmpty && (
          <div
            className="absolute top-6 left-6 text-gray-400 pointer-events-none select-none"
            aria-hidden="true"
          >
            {placeholder}
          </div>
        )}

        {/* Suggestion Popup */}
        {/* Loading indicator for suggestions */}
        {suggestionsLoading && (
          <div className="absolute bottom-4 right-4 flex items-center gap-2 text-xs text-gray-500 bg-white/90 px-2 py-1 rounded shadow">
            <div className="h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Se caută sugestii...
          </div>
        )}

        {/* Suggestion Popup */}
        {suggestion.isVisible && suggestion.suggestions.length > 0 && (
          <div
            className={clsx(
              'absolute z-50',
              'bg-white rounded-lg shadow-lg border border-gray-200',
              'max-w-md overflow-hidden'
            )}
            style={{
              top: suggestion.position.top,
              left: Math.min(suggestion.position.left, 200),
            }}
          >
            {/* Header */}
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
              <p className="text-xs text-gray-500">
                Apăsați <kbd className="px-1 bg-gray-200 rounded text-xs">Tab</kbd> pentru a
                accepta, <kbd className="px-1 bg-gray-200 rounded text-xs">Esc</kbd> pentru a
                închide
              </p>
            </div>

            {/* Suggestions List */}
            <ul className="max-h-48 overflow-y-auto">
              {suggestion.suggestions.map((s, index) => (
                <li
                  key={s.id}
                  className={clsx(
                    'px-3 py-2 cursor-pointer transition-colors',
                    'flex items-start gap-2',
                    index === suggestion.selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                  )}
                  onClick={() => {
                    setSuggestion((prev) => ({
                      ...prev,
                      selectedIndex: index,
                    }));
                    acceptSuggestion();
                  }}
                >
                  <span className="flex-1 text-sm text-gray-700">{s.text}</span>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className={clsx('text-xs px-1.5 py-0.5 rounded', getSourceColor(s.source))}
                    >
                      {getSourceLabel(s.source)}
                    </span>
                    <span className="text-xs text-gray-400">{Math.round(s.confidence * 100)}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default AIDocumentEditor;
