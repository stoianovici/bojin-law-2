/**
 * Global Search Bar Component
 * Story 2.10: Basic AI Search Implementation - Task 19
 *
 * Unified search input for cases, documents, clients, and tasks.
 * Uses Cmd/Ctrl+K to focus and supports debounced input.
 */

'use client';

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'next/navigation';
import {
  useRecentSearches,
} from '@/hooks/useSearch';

export interface GlobalSearchBarRef {
  focus: () => void;
  open: () => void;
}

interface GlobalSearchBarProps {
  className?: string;
  placeholder?: string;
  onSearch?: (query: string) => void;
}

export const GlobalSearchBar = forwardRef<GlobalSearchBarRef, GlobalSearchBarProps>(function GlobalSearchBar({
  className = '',
  placeholder = 'Search cases, documents, clients, tasks...',
  onSearch,
}, ref) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const { recentSearches, loading: recentLoading } = useRecentSearches(5);

  // Expose focus method to parent components
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
      setIsOpen(true);
    },
    open: () => {
      inputRef.current?.focus();
      setIsOpen(true);
    },
  }));

  // Handle keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }

      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-search-container]')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search submission
  const handleSubmit = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) return;

      setIsOpen(false);

      if (onSearch) {
        onSearch(searchQuery);
      } else {
        router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
      }
    },
    [router, onSearch]
  );

  // Handle keyboard navigation in dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || recentSearches.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < recentSearches.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : recentSearches.length - 1
        );
        break;
      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault();
          handleSubmit(recentSearches[selectedIndex].query);
        } else if (query.trim()) {
          handleSubmit(query);
        }
        break;
    }
  };

  return (
    <div className={`relative ${className}`} data-search-container>
      {/* Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full h-10 pl-10 pr-12 text-sm bg-gray-100 dark:bg-gray-800 border border-transparent rounded-lg focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 focus:outline-none transition-colors"
          aria-label="Search"
          aria-expanded={isOpen}
          aria-controls="search-suggestions"
          role="combobox"
        />

        {/* Search Icon */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        {/* Keyboard Shortcut Hint */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-xs text-gray-400">
          <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
            {typeof window !== 'undefined' && navigator.platform.includes('Mac')
              ? '⌘'
              : 'Ctrl'}
          </kbd>
          <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
            K
          </kbd>
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && (
        <div
          id="search-suggestions"
          className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-50"
          role="listbox"
        >
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="py-2">
              <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase">
                Recent Searches
              </div>
              {recentSearches.map((search: typeof recentSearches[number], index: number) => (
                <button
                  key={search.id}
                  onClick={() => handleSubmit(search.query)}
                  className={`w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    index === selectedIndex
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : ''
                  }`}
                  role="option"
                  aria-selected={index === selectedIndex}
                >
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="flex-1 truncate text-sm">{search.query}</span>
                  <span className="text-xs text-gray-400">
                    {search.resultCount} results
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div className="border-t border-gray-200 dark:border-gray-700 py-2">
            <button
              onClick={() => handleSubmit(query || '')}
              disabled={!query.trim()}
              className="w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span className="flex-1 text-sm">
                {query.trim() ? `Search for "${query}"` : 'Type to search...'}
              </span>
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                Enter
              </kbd>
            </button>
          </div>

          {/* Loading State */}
          {recentLoading && (
            <div className="px-3 py-2 text-sm text-gray-500 text-center">
              Loading...
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default GlobalSearchBar;
