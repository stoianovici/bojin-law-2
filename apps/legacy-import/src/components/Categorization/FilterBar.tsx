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

  const statusLabels: Record<FilterType, string> = {
    all: 'Tot',
    uncategorized: 'Noi',
    categorized: 'Cat',
    skipped: 'Săr',
    sent: 'Tri',
    received: 'Pri',
  };

  const FilterButton = ({ filter }: { filter: FilterOption }) => (
    <button
      onClick={() => setActiveFilter(filter.value)}
      title={filter.label}
      className={`
        px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors whitespace-nowrap
        ${
          activeFilter === filter.value
            ? 'bg-blue-600 text-white'
            : 'text-gray-500 hover:bg-gray-200'
        }
      `}
    >
      {statusLabels[filter.value] || filter.label}
      {filter.count !== undefined && filter.count > 0 && (
        <span
          className={`ml-0.5 ${activeFilter === filter.value ? 'text-blue-200' : 'text-gray-400'}`}
        >
          {filter.count}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex-shrink-0 flex items-center gap-1">
      {/* Status Filters */}
      <div className="flex items-center bg-gray-100 rounded p-0.5">
        {statusFilters.map((filter) => (
          <FilterButton key={filter.value} filter={filter} />
        ))}
      </div>

      {/* Direction Filters */}
      <div className="flex items-center bg-gray-100 rounded p-0.5">
        {directionFilters.map((filter) => (
          <FilterButton key={filter.value} filter={filter} />
        ))}
      </div>
    </div>
  );
}
