'use client';

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ============================================================================
// Component
// ============================================================================

export function BillingOverviewPanel({
  onSelectClient,
  onSelectCase,
}: BillingOverviewPanelProps) {
  const { data, loading, error } = useQuery<{
    unbilledSummaryByClient: ClientUnbilledSummary[];
  }>(GET_UNBILLED_SUMMARY_BY_CLIENT);

  const clients = data?.unbilledSummaryByClient || [];

  // Calculate totals
  const totalAmount = clients.reduce((sum, c) => sum + c.totalAmount, 0);
  const totalHours = clients.reduce((sum, c) => sum + c.totalHours, 0);
  const totalEntries = clients.reduce((sum, c) => sum + c.entryCount, 0);

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
        <p className="mt-4 text-sm text-linear-text-secondary">
          Nu există pontaje nefacturate
        </p>
        <p className="mt-1 text-xs text-linear-text-muted">
          Toate pontajele au fost facturate
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      {/* Header with totals */}
      <div className="flex-shrink-0 border-b border-linear-border-subtle px-6 py-4">
        <h2 className="text-base font-medium text-linear-text-primary">
          Sumar Facturare
        </h2>
        <p className="mt-1 text-sm text-linear-text-tertiary">
          Total nefacturat din toate dosarele
        </p>

        {/* Total summary cards */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-linear-bg-tertiary p-3">
            <p className="text-xs text-linear-text-tertiary">Total de facturat</p>
            <p className="mt-1 text-lg font-semibold text-linear-accent">
              {formatAmount(totalAmount)} EUR
            </p>
          </div>
          <div className="rounded-lg bg-linear-bg-tertiary p-3">
            <p className="text-xs text-linear-text-tertiary">Ore totale</p>
            <p className="mt-1 text-lg font-semibold text-linear-text-primary">
              {totalHours.toFixed(1)}h
            </p>
          </div>
          <div className="rounded-lg bg-linear-bg-tertiary p-3">
            <p className="text-xs text-linear-text-tertiary">Pontaje</p>
            <p className="mt-1 text-lg font-semibold text-linear-text-primary">
              {totalEntries}
            </p>
          </div>
        </div>
      </div>

      {/* Client list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {clients.map((client) => (
            <ClientCard
              key={client.clientId}
              client={client}
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
// Client Card Component
// ============================================================================

interface ClientCardProps {
  client: ClientUnbilledSummary;
  onSelectClient: () => void;
  onSelectCase: (caseId: string) => void;
}

function ClientCard({ client, onSelectClient, onSelectCase }: ClientCardProps) {
  const isCompany = client.clientType === 'COMPANY';

  return (
    <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary overflow-hidden">
      {/* Client header - clickable */}
      <button
        onClick={onSelectClient}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-linear-bg-hover transition-colors group"
      >
        {/* Client icon */}
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
            isCompany ? 'bg-blue-500/10' : 'bg-purple-500/10'
          )}
        >
          {isCompany ? (
            <Building2 className="h-5 w-5 text-blue-500" />
          ) : (
            <User className="h-5 w-5 text-purple-500" />
          )}
        </div>

        {/* Client info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-linear-text-primary truncate">
            {client.clientName}
          </p>
          <p className="text-xs text-linear-text-tertiary">
            {client.entryCount} pontaje · {client.totalHours.toFixed(1)}h
            {client.oldestEntryDate && (
              <> · din {formatDate(client.oldestEntryDate)}</>
            )}
          </p>
        </div>

        {/* Amount */}
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold text-linear-accent">
            {formatAmount(client.totalAmount)} EUR
          </p>
        </div>

        <ChevronRight className="h-4 w-4 text-linear-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>

      {/* Cases breakdown */}
      {client.cases.length > 1 && (
        <div className="border-t border-linear-border-subtle bg-linear-bg-primary">
          {client.cases.map((caseData) => (
            <button
              key={caseData.caseId}
              onClick={() => onSelectCase(caseData.caseId)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-linear-bg-hover transition-colors group border-b border-linear-border-subtle last:border-b-0"
            >
              <div className="w-10" /> {/* Spacer to align with client icon */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-linear-text-secondary truncate">
                  {caseData.caseTitle}
                </p>
                <p className="text-xs text-linear-text-tertiary">
                  {caseData.caseNumber} · {caseData.entryCount} pontaje
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-medium text-linear-text-primary">
                  {formatAmount(caseData.totalAmount)} EUR
                </p>
              </div>
              <ChevronRight className="h-3 w-3 text-linear-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
