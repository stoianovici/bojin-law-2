/**
 * Case Search Bar Component
 * Story 2.8: Case CRUD Operations UI - Task 5
 *
 * Real-time case search with debouncing
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCaseSearch } from '../../hooks/useCaseSearch';

/**
 * Highlights matching text in a string
 */
function highlightMatch(text: string, query: string): JSX.Element {
  if (!query) return <>{text}</>;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={index} className="bg-linear-warning/30 text-linear-text-primary font-semibold">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

export function CaseSearchBar() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { search, results, loading } = useCaseSearch();
  const router = useRouter();

  // Debounced search (300ms)
  useEffect(() => {
    if (query.length < 3) {
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      search(query);
      setIsOpen(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, search]);

  const handleResultClick = (caseId: string) => {
    setQuery('');
    setIsOpen(false);
    router.push(`/cases/${caseId}`);
  };

  const handleInputChange = (value: string) => {
    // Validate: max 200 characters
    const trimmedValue = value.slice(0, 200);
    setQuery(trimmedValue);
    if (trimmedValue.length < 3) {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full max-w-md">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Căutare dosare (min 3 caractere)..."
          className="w-full px-4 py-2 pl-10 pr-4 bg-linear-bg-secondary border border-linear-border rounded-md text-linear-text-primary placeholder-linear-text-muted focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent"
        />
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-linear-text-muted"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
      </div>

      {/* Search Results Dropdown */}
      {isOpen && query.length >= 3 && (
        <div className="absolute z-10 mt-1 w-full bg-linear-bg-elevated border border-linear-border-subtle rounded-md shadow-lg max-h-96 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-3 text-sm text-linear-text-tertiary">Se caută...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-linear-text-tertiary">
              Nu s-au găsit dosare pentru &quot;{query}&quot;
            </div>
          ) : (
            <ul>
              {results.map((caseItem) => (
                <li key={caseItem.id}>
                  <button
                    onClick={() => handleResultClick(caseItem.id)}
                    className="w-full px-4 py-3 text-left hover:bg-linear-bg-hover focus:bg-linear-bg-hover focus:outline-none transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-linear-text-primary">
                          {highlightMatch(caseItem.caseNumber, query)} -{' '}
                          {highlightMatch(caseItem.title, query)}
                        </div>
                        <div className="text-sm text-linear-text-tertiary">
                          Client: {highlightMatch(caseItem.client.name, query)}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${
                            caseItem.status === 'Active'
                              ? 'bg-linear-success/15 text-linear-success'
                              : caseItem.status === 'OnHold'
                                ? 'bg-linear-warning/15 text-linear-warning'
                                : caseItem.status === 'Closed'
                                  ? 'bg-linear-bg-tertiary text-linear-text-primary'
                                  : 'bg-linear-bg-tertiary text-linear-text-muted'
                          }`}
                      >
                        {caseItem.status}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Hint text */}
      {query.length > 0 && query.length < 3 && (
        <div className="absolute mt-1 text-xs text-linear-text-tertiary">
          Introduceți cel puțin 3 caractere pentru căutare
        </div>
      )}
    </div>
  );
}
