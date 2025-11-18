/**
 * Document Sort Menu Component
 * Dropdown menu for sorting documents by various fields
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useDocumentsStore, type SortField } from '../../stores/documents.store';

interface SortOption {
  label: string;
  field: SortField;
}

const SORT_OPTIONS: SortOption[] = [
  { label: 'Data Încărcării (Cele mai noi)', field: 'uploadedDate' },
  { label: 'Data Încărcării (Cele mai vechi)', field: 'uploadedDate' },
  { label: 'Nume (A-Z)', field: 'title' },
  { label: 'Nume (Z-A)', field: 'title' },
  { label: 'Tip Fișier', field: 'type' },
  { label: 'Dimensiune (Cele mai mari)', field: 'fileSizeBytes' },
  { label: 'Dimensiune (Cele mai mici)', field: 'fileSizeBytes' },
  { label: 'Nume Caz (A-Z)', field: 'caseName' },
  { label: 'Nume Caz (Z-A)', field: 'caseName' },
  { label: 'Ultima Modificare (Cele mai noi)', field: 'lastModifiedDate' },
  { label: 'Ultima Modificare (Cele mai vechi)', field: 'lastModifiedDate' },
];

export function DocumentSortMenu() {
  const { sortBy, sortOrder, setSorting } = useDocumentsStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSort = (option: SortOption) => {
    const { field, label } = option;

    // Determine order based on label
    let order: 'asc' | 'desc' = 'asc';
    if (
      label.includes('mai noi') ||
      label.includes('Z-A') ||
      label.includes('mai mari')
    ) {
      order = 'desc';
    }

    setSorting(field, order);
    setIsOpen(false);
  };

  // Get current sort label
  const currentSortLabel = SORT_OPTIONS.find(
    (opt) => {
      const matchesField = opt.field === sortBy;
      const matchesOrder =
        (sortOrder === 'desc' && (opt.label.includes('mai noi') || opt.label.includes('Z-A') || opt.label.includes('mai mari'))) ||
        (sortOrder === 'asc' && (opt.label.includes('mai vechi') || opt.label.includes('A-Z') || opt.label.includes('mai mici')));

      return matchesField && (matchesOrder || (opt.field === 'type' && sortOrder === 'asc'));
    }
  )?.label || 'Data Încărcării (Cele mai noi)';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        aria-label="Sort documents"
        aria-expanded={isOpen}
      >
        <svg
          className="mr-2 h-5 w-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
          />
        </svg>
        Sortează: {currentSortLabel}
        <svg
          className="ml-2 -mr-1 h-5 w-5 text-gray-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1" role="menu">
            {SORT_OPTIONS.map((option) => (
              <button
                key={`${option.field}-${option.label}`}
                onClick={() => handleSort(option)}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                role="menuitem"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
