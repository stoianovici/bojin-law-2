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
          <mark key={index} className="bg-yellow-200 text-gray-900 font-semibold">
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
          className="w-full px-4 py-2 pl-10 pr-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
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
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-96 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-3 text-sm text-gray-500">Se caută...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              Nu s-au găsit dosare pentru &quot;{query}&quot;
            </div>
          ) : (
            <ul>
              {results.map((caseItem) => (
                <li key={caseItem.id}>
                  <button
                    onClick={() => handleResultClick(caseItem.id)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {highlightMatch(caseItem.caseNumber, query)} -{' '}
                          {highlightMatch(caseItem.title, query)}
                        </div>
                        <div className="text-sm text-gray-500">
                          Client: {highlightMatch(caseItem.client.name, query)}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${
                            caseItem.status === 'Active'
                              ? 'bg-green-100 text-green-800'
                              : caseItem.status === 'OnHold'
                              ? 'bg-yellow-100 text-yellow-800'
                              : caseItem.status === 'Closed'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-slate-100 text-slate-800'
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
        <div className="absolute mt-1 text-xs text-gray-500">
          Introduceți cel puțin 3 caractere pentru căutare
        </div>
      )}
    </div>
  );
}
