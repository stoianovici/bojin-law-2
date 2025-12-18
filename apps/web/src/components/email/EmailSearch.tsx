/**
 * Email Search Component
 * Story 5.1: Email Integration and Synchronization
 *
 * Full-featured email search with filters and suggestions (AC: 5)
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useEmails, useEmailSearchSuggestions } from '@/hooks/useEmailSync';
import { Spinner } from '@/components/ui/spinner';
import { format } from 'date-fns';
import debounce from 'lodash/debounce';

interface EmailSearchProps {
  onSelectEmail: (emailId: string) => void;
  caseId?: string;
}

export function EmailSearch({ onSelectEmail, caseId }: EmailSearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filters, setFilters] = useState<{
    hasAttachments?: boolean;
    isUnread?: boolean;
    uncategorizedOnly?: boolean;
  }>({});

  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  const debouncedSetQuery = useCallback(
    debounce((q: string) => {
      setDebouncedQuery(q);
    }, 300),
    []
  );

  useEffect(() => {
    debouncedSetQuery(query);
  }, [query, debouncedSetQuery]);

  const { suggestions } = useEmailSearchSuggestions(query);

  const { emails, totalCount, loading, hasMore, fetchMore } = useEmails(
    {
      ...filters,
      search: debouncedQuery,
      caseId,
    },
    20
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setDebouncedQuery(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Search form */}
      <form onSubmit={handleSearch} className="border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search emails by subject, sender, or content..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-12 pr-4 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
          />
          <SearchIcon className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-4 top-3 rounded-full p-0.5 text-gray-400 hover:text-gray-500"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          )}

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <ul className="py-1">
                {suggestions.map((suggestion: string, i: number) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      <SearchIcon className="h-4 w-4 text-gray-400" />
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap gap-2">
          <FilterChip
            label="Unread"
            active={filters.isUnread === true}
            onClick={() =>
              setFilters({
                ...filters,
                isUnread: filters.isUnread ? undefined : true,
              })
            }
          />
          <FilterChip
            label="Has Attachments"
            active={filters.hasAttachments === true}
            onClick={() =>
              setFilters({
                ...filters,
                hasAttachments: filters.hasAttachments ? undefined : true,
              })
            }
          />
          <FilterChip
            label="Uncategorized"
            active={filters.uncategorizedOnly === true}
            onClick={() =>
              setFilters({
                ...filters,
                uncategorizedOnly: filters.uncategorizedOnly ? undefined : true,
              })
            }
          />
        </div>
      </form>

      {/* Results count */}
      {debouncedQuery && (
        <div className="border-b border-gray-200 px-4 py-2 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {totalCount} result{totalCount !== 1 ? 's' : ''} found
        </div>
      )}

      {/* Results list */}
      <div className="flex-1 overflow-y-auto">
        {loading && emails.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <Spinner />
          </div>
        ) : emails.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {debouncedQuery ? 'No emails match your search' : 'Start typing to search'}
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {emails.map((email: any) => (
              <li key={email.id}>
                <button
                  onClick={() => onSelectEmail(email.id)}
                  className="w-full p-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {!email.isRead && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {email.from.name || email.from.address}
                        </span>
                      </div>
                      <h3 className="mt-1 truncate text-sm text-gray-700 dark:text-gray-300">
                        {email.highlightedSubject ? (
                          <span
                            dangerouslySetInnerHTML={{
                              __html: email.highlightedSubject,
                            }}
                          />
                        ) : (
                          email.subject
                        )}
                      </h3>
                      <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                        {email.highlightedBody ? (
                          <span
                            dangerouslySetInnerHTML={{
                              __html: email.highlightedBody,
                            }}
                          />
                        ) : (
                          email.bodyPreview
                        )}
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0 text-xs text-gray-500">
                      {format(new Date(email.receivedDateTime), 'MMM d')}
                    </div>
                  </div>
                  {email.case && (
                    <div className="mt-2">
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        {email.case.caseNumber}
                      </span>
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="p-4 text-center">
            <button
              onClick={() => fetchMore()}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {loading ? <Spinner size="sm" /> : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
      }`}
    >
      {label}
    </button>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
