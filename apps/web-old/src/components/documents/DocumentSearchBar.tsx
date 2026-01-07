/**
 * Document Search Bar Component
 * Search input with debouncing for filtering documents
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useDocumentsStore } from '../../stores/documents.store';

interface DocumentSearchBarProps {
  placeholder?: string;
  debounceMs?: number;
}

export function DocumentSearchBar({
  placeholder = 'Caută documente...',
  debounceMs = 300,
}: DocumentSearchBarProps) {
  const { filters, setSearchQuery } = useDocumentsStore();
  const [localQuery, setLocalQuery] = useState(filters.searchQuery);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localQuery);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localQuery, debounceMs, setSearchQuery]);

  // Sync with store when filters are cleared externally
  useEffect(() => {
    setLocalQuery(filters.searchQuery);
  }, [filters.searchQuery]);

  const handleClear = useCallback(() => {
    setLocalQuery('');
    setSearchQuery('');
  }, [setSearchQuery]);

  return (
    <div className="relative">
      {/* Search Icon */}
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg
          className="h-5 w-5 text-gray-400"
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
      </div>

      {/* Search Input */}
      <input
        type="text"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        placeholder={placeholder}
        className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        aria-label="Search documents"
      />

      {/* Clear Button */}
      {localQuery && (
        <button
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          aria-label="Clear search"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
