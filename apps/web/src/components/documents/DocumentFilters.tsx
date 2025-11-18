/**
 * Document Filters Component
 * Sidebar with filter controls for documents
 */

'use client';

import React from 'react';
import { useDocumentsStore } from '../../stores/documents.store';
import type { DocumentType, FileType } from '@legal-platform/types';

// Mock data for filter options - will be replaced with API data
const MOCK_CASES = [
  { id: 'case-001', name: 'Smith vs. Johnson' },
  { id: 'case-002', name: 'Contract Dispute - ABC Corp' },
  { id: 'case-003', name: 'M&A Advisory - Tech Partners' },
  { id: 'case-004', name: 'Divorce - Popa Family' },
  { id: 'case-005', name: 'Real Estate - Commercial Property' },
  { id: 'case-006', name: 'Criminal Defense - Fraud Case' },
];

const MOCK_ATTORNEYS = [
  { id: 'atty-1', name: 'Ion Popescu' },
  { id: 'atty-2', name: 'Maria Ionescu' },
  { id: 'atty-3', name: 'Andrei Georgescu' },
  { id: 'atty-4', name: 'Elena Dumitrescu' },
  { id: 'atty-5', name: 'Victor Popa' },
];

const DOCUMENT_TYPES: DocumentType[] = ['Contract', 'Motion', 'Letter', 'Memo', 'Pleading', 'Other'];
const FILE_TYPES: FileType[] = ['PDF', 'DOCX', 'XLSX', 'TXT', 'Other'];

export function DocumentFilters() {
  const { filters, setFilters, clearFilters } = useDocumentsStore();

  const toggleArrayFilter = <T,>(key: keyof typeof filters, value: T) => {
    const currentArray = filters[key] as T[];
    const newArray = currentArray.includes(value)
      ? currentArray.filter((item) => item !== value)
      : [...currentArray, value];

    setFilters({ [key]: newArray });
  };

  const hasActiveFilters =
    filters.cases.length > 0 ||
    filters.types.length > 0 ||
    filters.fileTypes.length > 0 ||
    filters.uploadedBy.length > 0 ||
    filters.dateRange !== null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Filtre</h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Șterge Toate
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Case Filter */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">După Caz</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {MOCK_CASES.map((caseItem) => (
              <label key={caseItem.id} className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={filters.cases.includes(caseItem.id)}
                  onChange={() => toggleArrayFilter('cases', caseItem.id)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-gray-700">{caseItem.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Document Type Filter */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Tip Document</h4>
          <div className="space-y-2">
            {DOCUMENT_TYPES.map((type) => (
              <label key={type} className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={filters.types.includes(type)}
                  onChange={() => toggleArrayFilter('types', type)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-gray-700">{type}</span>
              </label>
            ))}
          </div>
        </div>

        {/* File Type Filter */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Tip Fișier</h4>
          <div className="space-y-2">
            {FILE_TYPES.map((fileType) => (
              <label key={fileType} className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={filters.fileTypes.includes(fileType)}
                  onChange={() => toggleArrayFilter('fileTypes', fileType)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-gray-700">{fileType}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Uploaded By Filter */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Încărcat De</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {MOCK_ATTORNEYS.map((attorney) => (
              <label key={attorney.id} className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={filters.uploadedBy.includes(attorney.id)}
                  onChange={() => toggleArrayFilter('uploadedBy', attorney.id)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-gray-700">{attorney.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Perioada Încărcare</h4>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">De la</label>
              <input
                type="date"
                value={filters.dateRange?.start.toISOString().split('T')[0] || ''}
                onChange={(e) => {
                  const start = e.target.value ? new Date(e.target.value) : null;
                  const end = filters.dateRange?.end || new Date();
                  if (start) {
                    setFilters({ dateRange: { start, end } });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Până la</label>
              <input
                type="date"
                value={filters.dateRange?.end.toISOString().split('T')[0] || ''}
                onChange={(e) => {
                  const end = e.target.value ? new Date(e.target.value) : null;
                  const start = filters.dateRange?.start || new Date(0);
                  if (end) {
                    setFilters({ dateRange: { start, end } });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {filters.dateRange && (
              <button
                onClick={() => setFilters({ dateRange: null })}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Șterge datele
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
