'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface SearchResult {
  eventId: string;
  chapterId: string;
  chapterTitle: string;
  eventTitle: string;
  eventSummary: string;
  occurredAt: string;
  matchSnippet?: string;
}

export interface CaseHistorySearchBarProps {
  caseId: string;
  onResultClick?: (result: SearchResult) => void;
  autoFocus?: boolean;
  className?: string;
}

interface SearchCaseHistoryData {
  searchCaseHistory: {
    results: Array<{
      eventId: string;
      chapterId: string;
      chapterTitle: string;
      eventTitle: string;
      eventSummary: string;
      occurredAt: string;
      matchSnippet: string;
    }>;
    totalCount: number;
  };
}

// ============================================================================
// GraphQL Query
// ============================================================================

const SEARCH_CASE_HISTORY = gql`
  query SearchCaseHistory($caseId: UUID!, $query: String!) {
    searchCaseHistory(caseId: $caseId, query: $query) {
      results {
        eventId
        chapterId
        chapterTitle
        eventTitle
        eventSummary
        occurredAt
        matchSnippet
      }
      totalCount
    }
  }
`;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Highlights search terms in text by wrapping them in a span with background color
 */
function highlightSearchTerms(text: string, query: string): React.ReactNode {
  if (!query.trim() || !text) return text;

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return text;

  // Create regex pattern for all terms
  const pattern = new RegExp(
    `(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi'
  );
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    const isMatch = terms.some((term) => part.toLowerCase() === term);
    if (isMatch) {
      return (
        <span key={index} className="bg-yellow-500/20 rounded-sm px-0.5">
          {part}
        </span>
      );
    }
    return part;
  });
}

/**
 * Groups search results by chapter
 */
function groupResultsByChapter(results: SearchResult[]): Map<string, SearchResult[]> {
  const grouped = new Map<string, SearchResult[]>();

  for (const result of results) {
    const existing = grouped.get(result.chapterId) || [];
    existing.push(result);
    grouped.set(result.chapterId, existing);
  }

  return grouped;
}

// ============================================================================
// Component
// ============================================================================

export function CaseHistorySearchBar({
  caseId,
  onResultClick,
  autoFocus = false,
  className,
}: CaseHistorySearchBarProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [searchCaseHistory, { data, loading }] = useLazyQuery<SearchCaseHistoryData>(
    SEARCH_CASE_HISTORY,
    { fetchPolicy: 'network-only' }
  );

  // ========================================
  // Debounce search query
  // ========================================
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // ========================================
  // Execute search when debounced query changes
  // ========================================
  useEffect(() => {
    if (debouncedQuery.trim().length > 2) {
      searchCaseHistory({
        variables: {
          caseId,
          query: debouncedQuery,
        },
      });
      setIsDropdownOpen(true);
    } else {
      setIsDropdownOpen(false);
    }
  }, [debouncedQuery, caseId, searchCaseHistory]);

  // ========================================
  // Auto-focus on mount
  // ========================================
  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  // ========================================
  // Close dropdown on click outside
  // ========================================
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ========================================
  // Handlers
  // ========================================
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  const handleClear = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setIsDropdownOpen(false);
    inputRef.current?.focus();
  }, []);

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      onResultClick?.(result);
      setIsDropdownOpen(false);
      setQuery('');
      setDebouncedQuery('');
    },
    [onResultClick]
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      inputRef.current?.blur();
    }
  }, []);

  // ========================================
  // Derived state
  // ========================================
  const results = data?.searchCaseHistory?.results ?? [];
  const groupedResults = groupResultsByChapter(results);
  const showDropdown = isDropdownOpen && query.trim().length > 2;
  const hasResults = results.length > 0;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Search Input */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border bg-linear-bg-elevated px-3 py-2',
          'border-linear-border-subtle transition-colors duration-150',
          'focus-within:border-transparent focus-within:ring-2 focus-within:ring-linear-accent'
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-linear-text-muted" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Cauta in istoric..."
          className={cn(
            'flex-1 bg-transparent text-sm outline-none',
            'text-linear-text-primary placeholder:text-linear-text-muted'
          )}
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-linear-text-muted" />}
        {query && !loading && (
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              'rounded p-0.5 text-linear-text-muted transition-colors',
              'hover:bg-linear-bg-tertiary hover:text-linear-text-primary'
            )}
            aria-label="Sterge cautarea"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showDropdown && (
        <div
          className={cn(
            'absolute left-0 right-0 top-full z-50 mt-1',
            'max-h-80 overflow-y-auto rounded-lg border shadow-lg',
            'bg-linear-bg-elevated border-linear-border-subtle'
          )}
        >
          {loading && !hasResults ? (
            <div className="flex items-center justify-center py-6 text-sm text-linear-text-muted">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Se cauta...
            </div>
          ) : !hasResults ? (
            <div className="py-6 text-center text-sm text-linear-text-muted">
              Nu am gasit rezultate pentru &bdquo;{query}&rdquo;
            </div>
          ) : (
            <div className="py-1">
              {Array.from(groupedResults.entries()).map(([chapterId, chapterResults]) => {
                const chapterTitle = chapterResults[0]?.chapterTitle ?? 'Capitol';

                return (
                  <div key={chapterId}>
                    {/* Chapter Header */}
                    <div className="sticky top-0 bg-linear-bg-tertiary px-3 py-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide text-linear-text-muted">
                        {chapterTitle}
                      </span>
                    </div>

                    {/* Chapter Results */}
                    {chapterResults.map((result) => (
                      <button
                        key={result.eventId}
                        type="button"
                        onClick={() => handleResultClick(result)}
                        className={cn(
                          'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left',
                          'transition-colors hover:bg-linear-bg-tertiary'
                        )}
                      >
                        <span className="text-sm font-medium text-linear-text-primary">
                          {highlightSearchTerms(result.eventTitle, query)}
                        </span>
                        <span className="line-clamp-2 text-xs text-linear-text-secondary">
                          {result.matchSnippet
                            ? highlightSearchTerms(result.matchSnippet, query)
                            : highlightSearchTerms(result.eventSummary, query)}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
