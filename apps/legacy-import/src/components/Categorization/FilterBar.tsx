'use client';

import { useDocumentStore } from '@/stores/documentStore';
import type { FilterType, DocumentState, DocumentMetadata } from '@/stores/documentStore';

interface FilterOption {
  value: FilterType;
  label: string;
  count?: number;
}

export function FilterBar() {
  const documents = useDocumentStore((s: DocumentState) => s.documents);
  const activeFilter = useDocumentStore((s: DocumentState) => s.activeFilter);
  const setActiveFilter = useDocumentStore((s: DocumentState) => s.setActiveFilter);

  // Calculate counts for each filter
  const counts = {
    all: documents.length,
    categorized: documents.filter((d: DocumentMetadata) => d.status === 'Categorized').length,
    uncategorized: documents.filter((d: DocumentMetadata) => d.status === 'Uncategorized').length,
    skipped: documents.filter((d: DocumentMetadata) => d.status === 'Skipped').length,
    sent: documents.filter((d: DocumentMetadata) => d.isSent).length,
    received: documents.filter((d: DocumentMetadata) => !d.isSent).length,
  };

  const statusFilters: FilterOption[] = [
    { value: 'all', label: 'Toate', count: counts.all },
    { value: 'uncategorized', label: 'Necategorizate', count: counts.uncategorized },
    { value: 'categorized', label: 'Categorizate', count: counts.categorized },
    { value: 'skipped', label: 'Sărite', count: counts.skipped },
  ];

  const directionFilters: FilterOption[] = [
    { value: 'sent', label: 'Doar trimise', count: counts.sent },
    { value: 'received', label: 'Doar primite', count: counts.received },
  ];

  const FilterButton = ({ filter }: { filter: FilterOption }) => (
    <button
      onClick={() => setActiveFilter(filter.value)}
      className={`
        px-3 py-1.5 rounded-md text-sm font-medium transition-colors
        ${
          activeFilter === filter.value
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }
      `}
    >
      {filter.label}
      {filter.count !== undefined && (
        <span
          className={`ml-1.5 ${activeFilter === filter.value ? 'text-blue-200' : 'text-gray-400'}`}
        >
          ({filter.count})
        </span>
      )}
    </button>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex flex-wrap items-center gap-4">
        {/* Status Filters */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Stare:</span>
          <div className="flex items-center gap-1">
            {statusFilters.map((filter) => (
              <FilterButton key={filter.value} filter={filter} />
            ))}
          </div>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-gray-200" />

        {/* Direction Filters */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Direcție:
          </span>
          <div className="flex items-center gap-1">
            {directionFilters.map((filter) => (
              <FilterButton key={filter.value} filter={filter} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
