/**
 * AI Document Editor Component
 * Story 3.3: Intelligent Document Drafting
 *
 * Rich text editor with AI-powered clause suggestions
 * Features: inline suggestions, Tab to accept, Escape to dismiss
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { clsx } from 'clsx';
import type { ClauseSuggestion, DocumentType, ClauseSource } from '@legal-platform/types';

export interface AIDocumentEditorProps {
  /** Initial content for the editor */
  initialContent?: string;
  /** Document type for suggestions context */
  documentType: DocumentType;
  /** Document ID (required for SSE suggestions) */
  documentId: string;
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
  documentType: _documentType,
  documentId,
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
  const [lines, setLines] = useState<string[]>([]);
  const [isEmpty, setIsEmpty] = useState(!initialContent);

  // Suggestion state
  const [suggestion, setSuggestion] = useState<SuggestionState>({
    suggestions: [],
    isVisible: false,
    position: { top: 0, left: 0 },
    selectedIndex: 0,
  });

  // SSE connection for real-time suggestions
  const sseRef = useRef<EventSource | null>(null);

  // Initialize editor content only once
  useEffect(() => {
    if (editorRef.current && !isInitializedRef.current && initialContent) {
      editorRef.current.innerText = initialContent;
      isInitializedRef.current = true;
      setIsEmpty(false);
      // Also update content state so line numbers are correct
      setContent(initialContent);
    }
  }, [initialContent]);

  // Update lines when content changes
  useEffect(() => {
    const contentLines = content.split('\n');
    setLines(contentLines);
  }, [content]);

  // Initialize SSE connection for suggestions
  useEffect(() => {
    if (!enableSuggestions || !documentId) return;

    // TODO: Connect to SSE endpoint when backend is ready
    // const eventSource = new EventSource(
    //   `/api/ai/suggestions/stream?documentId=${documentId}&userId=${userId}&firmId=${firmId}`
    // );
    // eventSource.onmessage = handleSSEMessage;
    // sseRef.current = eventSource;

    return () => {
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, [documentId, enableSuggestions]);

  // Handle content changes
  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.innerText || '';
    setContent(newContent);
    setIsEmpty(!newContent.trim());
    onContentChange?.(newContent);

    // Update cursor position
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(e.currentTarget);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      setCursorPosition(preCaretRange.toString().length);
    }

    // Debounce suggestion requests
    if (enableSuggestions && !readOnly) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        fetchSuggestions(newContent);
      }, DEBOUNCE_MS);
    }
  }, [onContentChange, enableSuggestions, readOnly]);

  // Fetch suggestions from API
  const fetchSuggestions = async (text: string) => {
    // Only fetch if there's enough text context
    if (text.length < 10) {
      hideSuggestion();
      return;
    }

    try {
      // TODO: Replace with actual GraphQL query
      // const { data } = await client.query({
      //   query: CLAUSE_SUGGESTIONS_QUERY,
      //   variables: {
      //     currentText: text,
      //     documentType,
      //     cursorPosition,
      //   },
      // });

      // Mock suggestions for demo
      const mockSuggestions: ClauseSuggestion[] = [
        {
          id: '1',
          text: ' în conformitate cu prevederile legale în vigoare',
          source: 'FIRM_PATTERN' as ClauseSource,
          confidence: 0.9,
          category: 'Contract',
        },
        {
          id: '2',
          text: ', sub sancțiunea nulității absolute',
          source: 'AI_GENERATED' as ClauseSource,
          confidence: 0.75,
          category: 'Contract',
        },
      ];

      if (mockSuggestions.length > 0) {
        showSuggestion(mockSuggestions);
      } else {
        hideSuggestion();
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      hideSuggestion();
    }
  };

  // Show suggestion popup
  const showSuggestion = (suggestions: ClauseSuggestion[]) => {
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
  };

  // Hide suggestion popup
  const hideSuggestion = () => {
    setSuggestion((prev) => ({
      ...prev,
      isVisible: false,
      suggestions: [],
    }));
  };

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
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
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
            selectedIndex: Math.min(
              prev.suggestions.length - 1,
              prev.selectedIndex + 1
            ),
          }));
        }
        break;

      default:
        break;
    }
  }, [suggestion, acceptSuggestion]);

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
                Apăsați <kbd className="px-1 bg-gray-200 rounded text-xs">Tab</kbd> pentru a accepta, <kbd className="px-1 bg-gray-200 rounded text-xs">Esc</kbd> pentru a închide
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
                    index === suggestion.selectedIndex
                      ? 'bg-blue-50'
                      : 'hover:bg-gray-50'
                  )}
                  onClick={() => {
                    setSuggestion((prev) => ({
                      ...prev,
                      selectedIndex: index,
                    }));
                    acceptSuggestion();
                  }}
                >
                  <span className="flex-1 text-sm text-gray-700">
                    {s.text}
                  </span>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className={clsx(
                        'text-xs px-1.5 py-0.5 rounded',
                        getSourceColor(s.source)
                      )}
                    >
                      {getSourceLabel(s.source)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {Math.round(s.confidence * 100)}%
                    </span>
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
