'use client';

import { FileText } from 'lucide-react';
import { InvoiceCreateForm } from './InvoiceCreateForm';
import { BillingOverviewPanel } from './BillingOverviewPanel';

// ============================================================================
// Types
// ============================================================================

interface SelectedClient {
  id: string;
  name: string;
}

interface SelectedCase {
  id: string;
  caseNumber: string;
  title: string;
}

interface InvoiceDetailPanelProps {
  isOverviewMode?: boolean;
  selectedClient: SelectedClient | null;
  selectedCase: SelectedCase | null;
  onInvoiceCreated: (invoiceId: string) => void;
  onSelectClient?: (clientId: string) => void;
  onSelectCase?: (caseId: string, clientId: string) => void;
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <FileText className="h-16 w-16 text-linear-text-tertiary opacity-30" />
      <p className="mt-4 text-sm text-linear-text-secondary">
        Selectează un client din stânga
      </p>
      <p className="mt-1 text-xs text-linear-text-muted">
        Pentru a vedea pontajele nefacturate
      </p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function InvoiceDetailPanel({
  isOverviewMode = false,
  selectedClient,
  selectedCase,
  onInvoiceCreated,
  onSelectClient,
  onSelectCase,
}: InvoiceDetailPanelProps) {
  // Overview mode - show billing summary
  if (isOverviewMode && onSelectClient && onSelectCase) {
    return (
      <BillingOverviewPanel
        onSelectClient={onSelectClient}
        onSelectCase={onSelectCase}
      />
    );
  }

  // Client selected - show invoice form directly
  if (selectedClient) {
    return (
      <InvoiceCreateForm
        onSuccess={onInvoiceCreated}
        clientId={selectedClient.id}
        clientName={selectedClient.name}
        caseId={selectedCase?.id}
        caseName={selectedCase?.title}
      />
    );
  }

  // Nothing selected - empty state
  return <EmptyState />;
}
