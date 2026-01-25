'use client';

import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { Building2, User, Loader2, Clock, ChevronRight } from 'lucide-react';
import { GET_UNBILLED_SUMMARY_BY_CLIENT } from '@/graphql/queries';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/ScrollArea';

// ============================================================================
// Types
// ============================================================================

interface CaseUnbilledSummary {
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  totalHours: number;
  totalAmount: number;
  entryCount: number;
}

interface ClientUnbilledSummary {
  clientId: string;
  clientName: string;
  clientType: string | null;
  totalHours: number;
  totalAmount: number;
  entryCount: number;
  oldestEntryDate: string | null;
  cases: CaseUnbilledSummary[];
}

interface BillingOverviewPanelProps {
  onSelectClient: (clientId: string) => void;
  onSelectCase: (caseId: string, clientId: string) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatHours(hours: number): string {
  return hours.toFixed(1);
}

// ============================================================================
// Grid Layout Constants
// ============================================================================

const GRID_COLUMNS = '1fr 80px 140px 60px';

// ============================================================================
// Component
// ============================================================================

export function BillingOverviewPanel({ onSelectClient, onSelectCase }: BillingOverviewPanelProps) {
  const { data, loading, error } = useQuery<{
    unbilledSummaryByClient: ClientUnbilledSummary[];
  }>(GET_UNBILLED_SUMMARY_BY_CLIENT);

  // Track expanded clients
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const clients = data?.unbilledSummaryByClient || [];

  // Calculate totals
  const totalAmount = clients.reduce((sum, c) => sum + c.totalAmount, 0);
  const totalHours = clients.reduce((sum, c) => sum + c.totalHours, 0);
  const totalEntries = clients.reduce((sum, c) => sum + c.entryCount, 0);

  // Toggle client expansion
  const toggleClient = (clientId: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-linear-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <p className="text-sm text-red-400">Eroare la încărcarea datelor</p>
        <p className="mt-1 text-xs text-linear-text-tertiary">{error.message}</p>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <Clock className="h-16 w-16 text-linear-text-tertiary opacity-30" />
        <p className="mt-4 text-sm text-linear-text-secondary">Nu există pontaje nefacturate</p>
        <p className="mt-1 text-xs text-linear-text-muted">Toate pontajele au fost facturate</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-linear-border-subtle px-6 py-4">
        <h2 className="text-base font-medium text-linear-text-primary">Sumar Facturare</h2>
        <p className="mt-1 text-sm text-linear-text-tertiary">
          Total nefacturat din toate dosarele
        </p>
      </div>

      {/* Column Headers */}
      <div
        className="grid gap-4 px-6 py-2 border-b border-linear-border-subtle bg-linear-bg-tertiary text-xs font-medium text-linear-text-tertiary uppercase tracking-wide"
        style={{ gridTemplateColumns: GRID_COLUMNS }}
      >
        <div className="pl-8">Client / Dosar</div>
        <div className="text-right">Ore</div>
        <div className="text-right">Sumă</div>
        <div className="text-right">Nr.</div>
      </div>

      {/* Grand Total Row */}
      <div
        className="grid gap-4 px-6 py-3 border-b-2 border-linear-border bg-linear-accent/10 items-center"
        style={{ gridTemplateColumns: GRID_COLUMNS }}
      >
        <div className="pl-8 text-sm font-bold text-linear-text-primary">TOTAL</div>
        <div className="text-sm font-bold text-linear-text-primary text-right tabular-nums">
          {formatHours(totalHours)}h
        </div>
        <div className="text-sm font-bold text-linear-accent text-right tabular-nums">
          {formatAmount(totalAmount)} EUR
        </div>
        <div className="text-sm font-bold text-linear-text-primary text-right tabular-nums">
          {totalEntries}
        </div>
      </div>

      {/* Client/Case Tree */}
      <ScrollArea className="flex-1">
        <div>
          {clients.map((client) => (
            <ClientRow
              key={client.clientId}
              client={client}
              isExpanded={expandedClients.has(client.clientId)}
              onToggle={() => toggleClient(client.clientId)}
              onSelectClient={() => onSelectClient(client.clientId)}
              onSelectCase={(caseId) => onSelectCase(caseId, client.clientId)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// Client Row Component
// ============================================================================

interface ClientRowProps {
  client: ClientUnbilledSummary;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectClient: () => void;
  onSelectCase: (caseId: string) => void;
}

function ClientRow({ client, isExpanded, onToggle, onSelectClient, onSelectCase }: ClientRowProps) {
  const isCompany = client.clientType === 'COMPANY';
  const hasMultipleCases = client.cases.length > 1;

  // Handle row click - expand if multiple cases, otherwise navigate
  const handleRowClick = () => {
    if (hasMultipleCases) {
      onToggle();
    } else {
      onSelectClient();
    }
  };

  // Handle chevron click - only toggle expand
  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
  };

  // Handle navigate click (arrow on the right)
  const handleNavigateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectClient();
  };

  return (
    <div className="border-b border-linear-border-subtle">
      {/* Client Row */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleRowClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRowClick();
          }
        }}
        className={cn(
          'grid gap-4 px-6 py-2 items-center cursor-pointer transition-colors',
          'hover:bg-linear-bg-hover',
          isExpanded && 'bg-linear-bg-tertiary'
        )}
        style={{ gridTemplateColumns: GRID_COLUMNS }}
      >
        {/* Client Name with Icon */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Expand/Collapse Chevron */}
          {hasMultipleCases ? (
            <button
              type="button"
              onClick={handleChevronClick}
              className="p-0.5 -m-0.5 rounded hover:bg-linear-bg-elevated transition-colors flex-shrink-0"
              aria-label={isExpanded ? 'Restrânge' : 'Extinde'}
            >
              <ChevronRight
                className={cn(
                  'h-4 w-4 text-linear-text-tertiary transition-transform',
                  isExpanded && 'rotate-90'
                )}
              />
            </button>
          ) : (
            <div className="w-5" />
          )}

          {/* Client Icon */}
          <div
            className={cn(
              'w-6 h-6 rounded flex items-center justify-center flex-shrink-0',
              isCompany ? 'bg-blue-500/10' : 'bg-purple-500/10'
            )}
          >
            {isCompany ? (
              <Building2 className="h-3.5 w-3.5 text-blue-500" />
            ) : (
              <User className="h-3.5 w-3.5 text-purple-500" />
            )}
          </div>

          {/* Client Name */}
          <span className="text-[13px] font-medium text-linear-text-primary truncate">
            {client.clientName}
          </span>

          {/* Navigate Arrow */}
          <button
            type="button"
            onClick={handleNavigateClick}
            className="p-1 -m-1 rounded opacity-0 group-hover:opacity-100 hover:bg-linear-bg-elevated transition-all ml-auto flex-shrink-0"
            aria-label="Selectează client"
          >
            <ChevronRight className="h-3.5 w-3.5 text-linear-text-tertiary" />
          </button>
        </div>

        {/* Hours */}
        <div className="text-[13px] text-linear-text-primary text-right tabular-nums">
          {formatHours(client.totalHours)}h
        </div>

        {/* Amount */}
        <div className="text-[13px] font-medium text-linear-accent text-right tabular-nums">
          {formatAmount(client.totalAmount)}
        </div>

        {/* Entry Count */}
        <div className="text-[13px] text-linear-text-secondary text-right tabular-nums">
          {client.entryCount}
        </div>
      </div>

      {/* Expanded Cases */}
      {isExpanded && client.cases.length > 0 && (
        <div className="bg-linear-bg-elevated">
          {client.cases.map((caseData, index) => (
            <CaseRow
              key={caseData.caseId}
              caseData={caseData}
              isLast={index === client.cases.length - 1}
              onSelect={() => onSelectCase(caseData.caseId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Case Row Component
// ============================================================================

interface CaseRowProps {
  caseData: CaseUnbilledSummary;
  isLast: boolean;
  onSelect: () => void;
}

function CaseRow({ caseData, isLast, onSelect }: CaseRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'grid gap-4 px-6 py-2 items-center cursor-pointer transition-colors',
        'hover:bg-linear-bg-hover',
        !isLast && 'border-b border-linear-border-subtle'
      )}
      style={{ gridTemplateColumns: GRID_COLUMNS }}
    >
      {/* Case Name with Tree Connector */}
      <div className="flex items-center gap-2 min-w-0 pl-5">
        {/* Tree connector */}
        <span className="text-linear-text-muted flex-shrink-0 w-4 text-center">
          {isLast ? '└' : '├'}
        </span>

        {/* Case Title */}
        <div className="min-w-0 flex-1">
          <span className="text-[13px] text-linear-text-secondary truncate block">
            {caseData.caseTitle}
          </span>
          <span className="text-[11px] text-linear-text-muted">{caseData.caseNumber}</span>
        </div>

        <ChevronRight className="h-3 w-3 text-linear-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>

      {/* Hours */}
      <div className="text-[13px] text-linear-text-secondary text-right tabular-nums">
        {formatHours(caseData.totalHours)}h
      </div>

      {/* Amount */}
      <div className="text-[13px] text-linear-text-secondary text-right tabular-nums">
        {formatAmount(caseData.totalAmount)}
      </div>

      {/* Entry Count */}
      <div className="text-[13px] text-linear-text-tertiary text-right tabular-nums">
        {caseData.entryCount}
      </div>
    </div>
  );
}
