'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import {
  Search,
  ChevronRight,
  Users,
  Building2,
  User,
  Briefcase,
  LayoutDashboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/ScrollArea';

// ============================================================================
// Types
// ============================================================================

interface Case {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  billingType?: 'Hourly' | 'Fixed' | 'Retainer';
  fixedAmount?: number | null;
}

export interface ClientWithCases {
  id: string;
  name: string;
  clientType?: string;
  cases: Case[];
}

interface ClientCaseSelectorPanelProps {
  clients: ClientWithCases[];
  loading?: boolean;
  isOverviewMode?: boolean;
  selectedClientId: string | null;
  selectedCaseId: string | null;
  expandedClientIds: string[];
  onSelectOverview?: () => void;
  onSelectClient: (clientId: string) => void;
  onSelectCase: (caseId: string, clientId: string) => void;
  onToggleClientExpanded: (clientId: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function ClientCaseSelectorPanel({
  clients,
  loading,
  isOverviewMode = false,
  selectedClientId,
  selectedCaseId,
  expandedClientIds,
  onSelectOverview,
  onSelectClient,
  onSelectCase,
  onToggleClientExpanded,
  searchQuery = '',
  onSearchChange,
}: ClientCaseSelectorPanelProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Handle search change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    onSearchChange?.(value);
  };

  // Filter clients based on search
  const filteredClients = useMemo(() => {
    if (!localSearch) return clients;

    const query = localSearch.toLowerCase();
    return clients.filter((client) => {
      // Match client name
      if (client.name.toLowerCase().includes(query)) return true;
      // Match any case title or number
      return client.cases.some(
        (c) => c.title.toLowerCase().includes(query) || c.caseNumber.toLowerCase().includes(query)
      );
    });
  }, [clients, localSearch]);

  return (
    <div className="w-[280px] xl:w-[360px] flex-shrink-0 border-r border-linear-border-subtle flex flex-col bg-linear-bg-secondary">
      {/* Header */}
      <div className="px-6 py-5 border-b border-linear-border-subtle">
        <h1 className="text-base font-normal text-linear-text-primary mb-4">Facturare</h1>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-linear-text-muted" />
          <Input
            type="text"
            placeholder="Caută client sau dosar..."
            value={localSearch}
            onChange={handleSearchChange}
            className="pl-10 h-10 text-[13px] bg-linear-bg-primary border-linear-border-subtle focus:border-[#6366F1]"
          />
        </div>
      </div>

      {/* Overview option */}
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={onSelectOverview}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
            'hover:bg-linear-bg-hover',
            isOverviewMode
              ? 'bg-[rgba(99,102,241,0.08)] border border-[rgba(99,102,241,0.2)]'
              : 'border border-transparent'
          )}
        >
          <div
            className={cn(
              'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
              isOverviewMode ? 'bg-[rgba(99,102,241,0.15)]' : 'bg-linear-bg-tertiary'
            )}
          >
            <LayoutDashboard
              className={cn(
                'h-4 w-4',
                isOverviewMode ? 'text-[#6366F1]' : 'text-linear-text-tertiary'
              )}
            />
          </div>
          <span
            className={cn(
              'text-sm font-medium',
              isOverviewMode ? 'text-[#6366F1]' : 'text-linear-text-primary'
            )}
          >
            Sumar
          </span>
        </button>
      </div>

      {/* Client/Case list */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-linear-bg-tertiary" />
            ))}
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <Users className="h-10 w-10 text-linear-text-tertiary opacity-30 mb-3" />
            <p className="text-sm text-linear-text-secondary">
              {localSearch ? 'Niciun rezultat găsit' : 'Niciun client'}
            </p>
            <p className="text-xs text-linear-text-tertiary mt-1">
              {localSearch ? 'Încearcă altă căutare' : 'Adaugă clienți din pagina Dosare'}
            </p>
          </div>
        ) : (
          filteredClients.map((client) => (
            <ClientAccordion
              key={client.id}
              client={client}
              isExpanded={expandedClientIds.includes(client.id)}
              selectedClientId={selectedClientId}
              selectedCaseId={selectedCaseId}
              onToggleExpanded={() => onToggleClientExpanded(client.id)}
              onSelectClient={() => onSelectClient(client.id)}
              onSelectCase={(caseId) => onSelectCase(caseId, client.id)}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// Client Accordion Component
// ============================================================================

interface ClientAccordionProps {
  client: ClientWithCases;
  isExpanded: boolean;
  selectedClientId: string | null;
  selectedCaseId: string | null;
  onToggleExpanded: () => void;
  onSelectClient: () => void;
  onSelectCase: (caseId: string) => void;
}

function ClientAccordion({
  client,
  isExpanded,
  selectedClientId,
  selectedCaseId,
  onToggleExpanded,
  onSelectClient,
  onSelectCase,
}: ClientAccordionProps) {
  const isClientSelected = selectedClientId === client.id && !selectedCaseId;
  const hasSelectedCase = client.cases.some((c) => c.id === selectedCaseId);
  const isCompany = client.clientType === 'COMPANY';
  const activeCases = client.cases.filter((c) => c.status === 'Active');

  // Handle click on the client row
  const handleClientRowClick = () => {
    onSelectClient();
    // Also expand if not expanded
    if (!isExpanded && activeCases.length > 0) {
      onToggleExpanded();
    }
  };

  // Handle chevron click (only toggles expansion)
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
          'w-full flex items-center gap-3 px-6 py-3 text-left transition-colors cursor-pointer',
          'hover:bg-linear-bg-hover',
          isExpanded && 'bg-linear-bg-tertiary',
          hasSelectedCase && !isExpanded && 'bg-linear-bg-tertiary/50',
          isClientSelected && 'bg-[rgba(99,102,241,0.08)] border-l-2 border-l-[#6366F1] pl-[22px]'
        )}
      >
        {/* Chevron */}
        {activeCases.length > 0 ? (
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
        ) : (
          <div className="w-4" /> // Spacer when no cases
        )}

        {/* Client icon */}
        <div
          className={cn(
            'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
            isCompany ? 'bg-blue-500/10' : 'bg-purple-500/10'
          )}
        >
          {isCompany ? (
            <Building2 className="h-4 w-4 text-blue-500" />
          ) : (
            <User className="h-4 w-4 text-purple-500" />
          )}
        </div>

        {/* Client name */}
        <span
          className={cn(
            'flex-1 text-sm font-medium truncate',
            isClientSelected ? 'text-[#6366F1]' : 'text-linear-text-primary'
          )}
        >
          {client.name}
        </span>

        {/* Case count */}
        {activeCases.length > 0 && (
          <span className="text-xs text-linear-text-tertiary">
            {activeCases.length} {activeCases.length === 1 ? 'dosar' : 'dosare'}
          </span>
        )}
      </div>

      {/* Expanded: Cases list */}
      {isExpanded && activeCases.length > 0 && (
        <div className="bg-linear-bg-elevated">
          {activeCases.map((caseData) => (
            <CaseListItem
              key={caseData.id}
              caseData={caseData}
              isSelected={selectedCaseId === caseData.id}
              onClick={() => onSelectCase(caseData.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Case List Item Component
// ============================================================================

interface CaseListItemProps {
  caseData: Case;
  isSelected: boolean;
  onClick: () => void;
}

function CaseListItem({ caseData, isSelected, onClick }: CaseListItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'w-full flex items-center gap-3 pl-14 pr-6 py-2.5 text-left transition-colors cursor-pointer',
        'hover:bg-linear-bg-hover',
        isSelected && 'bg-[rgba(99,102,241,0.08)] border-l-2 border-l-[#6366F1] pl-[52px]'
      )}
    >
      <Briefcase className="h-3.5 w-3.5 text-linear-text-tertiary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm truncate',
            isSelected ? 'text-[#6366F1] font-medium' : 'text-linear-text-primary'
          )}
        >
          {caseData.title}
        </p>
        <p className="text-xs text-linear-text-tertiary truncate">{caseData.caseNumber}</p>
      </div>
    </div>
  );
}
