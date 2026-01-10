'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { Plus, Search, Filter, ChevronRight, Users, LayoutList, FolderTree } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { CaseListItem } from './CaseListItem';
import { type Case } from './index';

// Client group for cases
interface ClientCaseGroup {
  id: string;
  name: string;
  cases: Case[];
}

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
  onPendingModeChange?: (isPending: boolean) => void;
}

type FilterType = 'active' | 'pending' | 'all' | 'archived';

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
  onPendingModeChange,
}: CaseListPanelProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('active');
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [groupByClient, setGroupByClient] = useState(true);
  const [expandedClients, setExpandedClients] = useState<string[]>([]);

  // Handle search change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    onSearchChange?.(value);
  };

  // Toggle client expansion
  const toggleClientExpanded = (clientId: string) => {
    setExpandedClients((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]
    );
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
      case 'pending':
        filtered = filtered.filter((c) => c.status === 'PendingApproval');
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

  // Group cases by client
  const clientGroups = useMemo<ClientCaseGroup[]>(() => {
    const clientMap = new Map<string, ClientCaseGroup>();

    for (const caseData of filteredCases) {
      const clientId = caseData.client.id;
      const clientName = caseData.client.name;

      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          id: clientId,
          name: clientName,
          cases: [],
        });
      }

      clientMap.get(clientId)!.cases.push(caseData);
    }

    // Sort clients by name
    return Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  }, [filteredCases]);

  // Handle filter change and notify parent about pending mode
  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    onPendingModeChange?.(filter === 'pending');
  };

  const filterButtons: { value: FilterType; label: string }[] = [
    { value: 'active', label: 'Active' },
    ...(isAdmin ? [{ value: 'pending' as FilterType, label: 'In asteptare' }] : []),
    { value: 'all', label: 'Toate' },
    { value: 'archived', label: 'Arhivate' },
  ];

  return (
    <div className="w-[280px] xl:w-[400px] flex-shrink-0 border-r border-linear-border-subtle flex flex-col bg-linear-bg-secondary">
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
      <div className="flex items-center gap-2 px-6 py-3 border-b border-linear-border-subtle">
        <div className="flex gap-2 flex-1">
          {filterButtons.map((filter) => (
            <button
              key={filter.value}
              onClick={() => handleFilterChange(filter.value)}
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
        {/* View toggle */}
        <button
          onClick={() => setGroupByClient(!groupByClient)}
          className={cn(
            'p-1.5 rounded-md border transition-colors',
            'border-linear-border-subtle text-linear-text-tertiary hover:text-linear-text-secondary hover:border-linear-border-default'
          )}
          title={groupByClient ? 'Vizualizare listă' : 'Grupare după client'}
        >
          {groupByClient ? (
            <LayoutList className="h-4 w-4" />
          ) : (
            <FolderTree className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Case list */}
      <ScrollArea className="flex-1">
        {filteredCases.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-linear-text-tertiary">
            Nu s-au gasit cazuri
          </div>
        ) : groupByClient ? (
          /* Grouped by client view */
          clientGroups.map((clientGroup) => (
            <ClientCaseAccordion
              key={clientGroup.id}
              client={clientGroup}
              isExpanded={expandedClients.includes(clientGroup.id)}
              selectedCaseId={selectedCaseId}
              onToggle={() => toggleClientExpanded(clientGroup.id)}
              onSelectCase={onSelectCase}
            />
          ))
        ) : (
          /* Flat list view */
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

// Client Case Accordion Component
interface ClientCaseAccordionProps {
  client: ClientCaseGroup;
  isExpanded: boolean;
  selectedCaseId: string | null;
  onToggle: () => void;
  onSelectCase: (caseId: string) => void;
}

function ClientCaseAccordion({
  client,
  isExpanded,
  selectedCaseId,
  onToggle,
  onSelectCase,
}: ClientCaseAccordionProps) {
  // Check if any case in this client is selected
  const hasSelectedCase = client.cases.some((c) => c.id === selectedCaseId);

  return (
    <div className="border-b border-linear-border-subtle">
      {/* Client Header */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2 px-6 py-3 text-left transition-colors',
          'hover:bg-linear-bg-hover',
          isExpanded && 'bg-linear-bg-tertiary',
          hasSelectedCase && !isExpanded && 'bg-linear-bg-tertiary/50'
        )}
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 text-linear-text-tertiary transition-transform flex-shrink-0',
            isExpanded && 'rotate-90'
          )}
        />
        <Users className="h-4 w-4 text-linear-text-tertiary flex-shrink-0" />
        <span className="flex-1 text-sm font-medium text-linear-text-primary truncate">
          {client.name}
        </span>
        <span className="text-xs text-linear-text-tertiary">
          {client.cases.length} {client.cases.length === 1 ? 'caz' : 'cazuri'}
        </span>
      </button>

      {/* Expanded: Cases list */}
      {isExpanded && (
        <div className="bg-linear-bg-elevated">
          {client.cases.map((caseData) => (
            <CaseListItem
              key={caseData.id}
              caseData={caseData}
              isSelected={selectedCaseId === caseData.id}
              onClick={() => onSelectCase(caseData.id)}
              indented
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CaseListPanel;
