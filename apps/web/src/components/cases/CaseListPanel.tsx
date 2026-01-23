'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { Plus, Search, Filter, ChevronRight, Users, LayoutList, FolderTree } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { CaseListItem } from './CaseListItem';
import { type Case } from './index';

// ============================================================================
// Types
// ============================================================================

// Client group for cases (derived from cases)
interface ClientCaseGroup {
  id: string;
  name: string;
  cases: Case[];
}

// Client with nested cases (from API)
export interface ClientWithCases {
  id: string;
  name: string;
  caseCount: number;
  activeCaseCount: number;
  cases: Case[];
}

interface CaseListPanelProps {
  cases: Case[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  onNewClient?: () => void;
  onAddCase?: (clientId: string, clientName: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  isAdmin?: boolean;
  showAllCases?: boolean;
  onToggleShowAllCases?: () => void;
  onPendingModeChange?: (isPending: boolean) => void;
  // New props for two-level list with client selection
  clients?: ClientWithCases[];
  selectedClientId?: string | null;
  expandedClientIds?: string[];
  onSelectClient?: (clientId: string) => void;
  onToggleClientExpanded?: (clientId: string) => void;
}

type FilterType = 'active' | 'pending' | 'all' | 'archived';

export function CaseListPanel({
  cases,
  selectedCaseId,
  onSelectCase,
  onNewClient,
  onAddCase,
  searchQuery = '',
  onSearchChange,
  isAdmin = false,
  showAllCases = true,
  onToggleShowAllCases,
  onPendingModeChange,
  // New props for two-level list
  clients,
  selectedClientId,
  expandedClientIds,
  onSelectClient,
  onToggleClientExpanded,
}: CaseListPanelProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('active');
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [groupByClient, setGroupByClient] = useState(true);
  // Local expansion state (used when expandedClientIds prop is not provided)
  const [localExpandedClients, setLocalExpandedClients] = useState<string[]>([]);

  // Use prop-based expansion state if provided, otherwise use local state
  const effectiveExpandedClientIds = expandedClientIds ?? localExpandedClients;

  // Handle search change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    onSearchChange?.(value);
  };

  // Toggle client expansion
  const handleToggleClientExpanded = (clientId: string) => {
    if (onToggleClientExpanded) {
      onToggleClientExpanded(clientId);
    } else {
      setLocalExpandedClients((prev) =>
        prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]
      );
    }
  };

  // Handle client selection
  const handleSelectClient = (clientId: string) => {
    onSelectClient?.(clientId);
  };

  // Filter cases based on active filter
  const filteredCases = React.useMemo(() => {
    // Always exclude deleted cases from all views
    let filtered = cases.filter((c) => c.status !== 'Deleted');

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
        // Already filtered out Deleted above
        break;
    }

    return filtered;
  }, [cases, activeFilter]);

  // Group cases by client - use clients prop if available, otherwise derive from cases
  const clientGroups = useMemo<(ClientCaseGroup | ClientWithCases)[]>(() => {
    // If clients prop is provided, filter their cases and return
    if (clients) {
      return clients
        .map((client) => {
          // Filter the client's cases based on active filter
          let clientCases = client.cases.filter((c) => c.status !== 'Deleted');

          switch (activeFilter) {
            case 'active':
              clientCases = clientCases.filter(
                (c) =>
                  c.status === 'Active' || c.status === 'PendingApproval' || c.status === 'OnHold'
              );
              break;
            case 'pending':
              clientCases = clientCases.filter((c) => c.status === 'PendingApproval');
              break;
            case 'archived':
              clientCases = clientCases.filter((c) => c.status === 'Archived');
              break;
            case 'all':
            default:
              break;
          }

          return {
            ...client,
            cases: clientCases,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
    }

    // Fall back to deriving from cases (only for cases that have client data)
    const clientMap = new Map<string, ClientCaseGroup>();

    for (const caseData of filteredCases) {
      if (!caseData.client) continue; // Skip cases without client (shouldn't happen in fallback mode)
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
  }, [clients, filteredCases, activeFilter]);

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
              onClick={onNewClient}
              data-tutorial="btn-client-nou"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#6366F1] hover:bg-[#5558E3] text-white text-[13px] font-light rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Client nou
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
          {groupByClient ? <LayoutList className="h-4 w-4" /> : <FolderTree className="h-4 w-4" />}
        </button>
      </div>

      {/* Case list */}
      <ScrollArea className="flex-1">
        {groupByClient ? (
          /* Grouped by client view - show clients even if they have no cases */
          clientGroups.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-linear-text-tertiary">
              Nu s-au gasit clienti
            </div>
          ) : (
            clientGroups.map((clientGroup) => (
              <ClientCaseAccordion
                key={clientGroup.id}
                client={clientGroup}
                isExpanded={effectiveExpandedClientIds.includes(clientGroup.id)}
                selectedCaseId={selectedCaseId}
                selectedClientId={selectedClientId ?? null}
                onToggleExpanded={() => handleToggleClientExpanded(clientGroup.id)}
                onSelectClient={
                  onSelectClient ? () => handleSelectClient(clientGroup.id) : undefined
                }
                onSelectCase={onSelectCase}
                onAddCase={onAddCase}
              />
            ))
          )
        ) : filteredCases.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-linear-text-tertiary">
            Nu s-au gasit cazuri
          </div>
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

// ============================================================================
// Client Case Accordion Component
// ============================================================================

interface ClientCaseAccordionProps {
  client: ClientCaseGroup | ClientWithCases;
  isExpanded: boolean;
  selectedCaseId: string | null;
  selectedClientId: string | null;
  onToggleExpanded: () => void;
  onSelectClient?: () => void;
  onSelectCase: (caseId: string) => void;
  onAddCase?: (clientId: string, clientName: string) => void;
}

function ClientCaseAccordion({
  client,
  isExpanded,
  selectedCaseId,
  selectedClientId,
  onToggleExpanded,
  onSelectClient,
  onSelectCase,
  onAddCase,
}: ClientCaseAccordionProps) {
  // Check if any case in this client is selected
  const hasSelectedCase = client.cases.some((c) => c.id === selectedCaseId);
  const isClientSelected = selectedClientId === client.id;

  // Handle click on the client row (not the chevron)
  const handleClientRowClick = () => {
    // If onSelectClient is provided, clicking the row selects the client
    if (onSelectClient) {
      onSelectClient();
    } else {
      // Fall back to toggling expansion if no selection handler
      onToggleExpanded();
    }
  };

  // Handle chevron click (always toggles expansion)
  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpanded();
  };

  return (
    <div className="border-b border-linear-border-subtle">
      {/* Client Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleClientRowClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClientRowClick();
          }
        }}
        className={cn(
          'w-full flex items-center gap-2 px-6 py-3 text-left transition-colors cursor-pointer',
          'hover:bg-linear-bg-hover',
          isExpanded && 'bg-linear-bg-tertiary',
          hasSelectedCase && !isExpanded && 'bg-linear-bg-tertiary/50',
          // Client selection styling - left border accent similar to case selection
          isClientSelected && 'bg-[rgba(99,102,241,0.08)] border-l-2 border-l-[#6366F1] pl-[22px]'
        )}
      >
        {/* Chevron - separate click target for expansion */}
        <button
          type="button"
          onClick={handleChevronClick}
          className="p-0.5 -m-0.5 rounded hover:bg-linear-bg-elevated transition-colors"
          aria-label={isExpanded ? 'Restrânge' : 'Extinde'}
        >
          <ChevronRight
            className={cn(
              'h-4 w-4 text-linear-text-tertiary transition-transform flex-shrink-0',
              isExpanded && 'rotate-90'
            )}
          />
        </button>
        <Users className="h-4 w-4 text-linear-text-tertiary flex-shrink-0" />
        <span
          className={cn(
            'flex-1 text-sm font-medium truncate',
            isClientSelected ? 'text-[#6366F1]' : 'text-linear-text-primary'
          )}
        >
          {client.name}
        </span>
        <span className="text-xs text-linear-text-tertiary">
          {client.cases.length} {client.cases.length === 1 ? 'caz' : 'cazuri'}
        </span>
      </div>

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
          {/* Add Case button - mimics "Adaugă mapă" UX from /documents */}
          <AddCaseButton clientId={client.id} clientName={client.name} onAddCase={onAddCase} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Add Case Button Component
// ============================================================================

interface AddCaseButtonProps {
  clientId: string;
  clientName: string;
  onAddCase?: (clientId: string, clientName: string) => void;
}

function AddCaseButton({ clientId, clientName, onAddCase }: AddCaseButtonProps) {
  return (
    <button
      className="w-full flex items-center gap-2 px-6 py-2 text-xs text-linear-text-tertiary hover:text-linear-text-secondary hover:bg-linear-bg-hover transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        if (onAddCase) {
          onAddCase(clientId, clientName);
        }
      }}
    >
      <Plus className="w-3.5 h-3.5 ml-4" />
      <span>Adaugă dosar</span>
    </button>
  );
}

export default CaseListPanel;
