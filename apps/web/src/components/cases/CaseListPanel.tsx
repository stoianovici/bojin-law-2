'use client';

import * as React from 'react';
import { useState } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { CaseListItem } from './CaseListItem';
import { type Case } from './index';

interface CaseListPanelProps {
  cases: Case[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  onNewCase?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  isAdmin?: boolean;
  showAllCases?: boolean;
  onToggleShowAllCases?: () => void;
}

type FilterType = 'active' | 'all' | 'archived';

export function CaseListPanel({
  cases,
  selectedCaseId,
  onSelectCase,
  onNewCase,
  searchQuery = '',
  onSearchChange,
  isAdmin = false,
  showAllCases = true,
  onToggleShowAllCases,
}: CaseListPanelProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('active');
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Handle search change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    onSearchChange?.(value);
  };

  // Filter cases based on active filter
  const filteredCases = React.useMemo(() => {
    let filtered = cases;

    switch (activeFilter) {
      case 'active':
        filtered = filtered.filter(
          (c) => c.status === 'Active' || c.status === 'PendingApproval' || c.status === 'OnHold'
        );
        break;
      case 'archived':
        filtered = filtered.filter((c) => c.status === 'Archived');
        break;
      case 'all':
      default:
        break;
    }

    return filtered;
  }, [cases, activeFilter]);

  const filterButtons: { value: FilterType; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'all', label: 'Toate' },
    { value: 'archived', label: 'Arhivate' },
  ];

  return (
    <div className="w-[400px] flex-shrink-0 border-r border-linear-border-subtle flex flex-col bg-linear-bg-secondary">
      {/* Header */}
      <div className="px-6 py-5 border-b border-linear-border-subtle">
        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-base font-normal text-linear-text-primary">Cazuri</h1>
          <div className="flex items-center gap-2">
            {isAdmin && onToggleShowAllCases && (
              <button
                onClick={onToggleShowAllCases}
                className={cn(
                  'px-3 py-2 text-[13px] font-light rounded-lg transition-colors border',
                  showAllCases
                    ? 'bg-[rgba(99,102,241,0.15)] border-[#6366F1] text-[#6366F1]'
                    : 'bg-transparent border-linear-border-subtle text-linear-text-secondary hover:border-linear-border-default hover:text-linear-text-primary'
                )}
              >
                {showAllCases ? 'Toate dosarele' : 'Dosarele mele'}
              </button>
            )}
            <button
              onClick={onNewCase}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#6366F1] hover:bg-[#5558E3] text-white text-[13px] font-light rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Caz nou
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-linear-text-muted" />
          <Input
            type="text"
            placeholder="Cauta cazuri..."
            value={localSearch}
            onChange={handleSearchChange}
            className="pl-10 h-10 text-[13px] bg-linear-bg-primary border-linear-border-subtle focus:border-[#6366F1]"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-6 py-3 border-b border-linear-border-subtle">
        {filterButtons.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setActiveFilter(filter.value)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-light rounded-md border transition-colors',
              activeFilter === filter.value
                ? 'bg-[rgba(99,102,241,0.15)] border-[#6366F1] text-[#6366F1]'
                : 'bg-transparent border-linear-border-subtle text-linear-text-secondary hover:border-linear-border-default hover:text-linear-text-primary'
            )}
          >
            {filter.value === 'active' && <Filter className="h-3.5 w-3.5" />}
            {filter.label}
          </button>
        ))}
      </div>

      {/* Case list */}
      <ScrollArea className="flex-1">
        {filteredCases.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-linear-text-tertiary">
            Nu s-au gasit cazuri
          </div>
        ) : (
          filteredCases.map((caseData) => (
            <CaseListItem
              key={caseData.id}
              caseData={caseData}
              isSelected={selectedCaseId === caseData.id}
              onClick={() => onSelectCase(caseData.id)}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}

export default CaseListPanel;
