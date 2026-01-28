'use client';

import { useMemo, useCallback } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_CLIENTS_WITH_CASES } from '@/graphql/queries';
import { useInvoicesStore } from '@/store/invoicesStore';
import {
  ClientCaseSelectorPanel,
  type ClientWithCases,
} from '@/components/invoices/ClientCaseSelectorPanel';
import { InvoiceDetailPanel } from '@/components/invoices';

// ============================================================================
// Types
// ============================================================================

interface GetClientsWithCasesResponse {
  clients: ClientWithCases[];
}

// ============================================================================
// Component
// ============================================================================

export default function InvoicesPage() {
  const {
    isOverviewMode,
    selectedClientId,
    selectedCaseId,
    expandedClientIds,
    selectOverview,
    selectClient,
    selectCase,
    toggleClientExpanded,
    searchQuery,
    setSearchQuery,
  } = useInvoicesStore();

  // Fetch clients with cases
  const { data, loading } = useQuery<GetClientsWithCasesResponse>(GET_CLIENTS_WITH_CASES);
  const clients = data?.clients || [];

  // Get selected client and case data
  const selectedClient = useMemo(() => {
    const client = clients.find((c) => c.id === selectedClientId);
    return client ? { id: client.id, name: client.name } : null;
  }, [clients, selectedClientId]);

  const selectedCase = useMemo(() => {
    if (!selectedCaseId || !selectedClientId) return null;
    const client = clients.find((c) => c.id === selectedClientId);
    const caseData = client?.cases.find((c) => c.id === selectedCaseId);
    return caseData
      ? {
          id: caseData.id,
          caseNumber: caseData.caseNumber,
          title: caseData.title,
          billingType: caseData.billingType as 'Hourly' | 'Fixed' | 'Retainer' | undefined,
          fixedAmount: caseData.fixedAmount,
        }
      : null;
  }, [clients, selectedClientId, selectedCaseId]);

  // Handlers
  const handleInvoiceCreated = useCallback((invoiceId: string) => {
    // TODO: Show success notification or navigate
    console.log('Invoice created:', invoiceId);
  }, []);

  return (
    <div className="flex h-full flex-1 overflow-hidden">
      {/* Left Panel - Client/Case Selector */}
      <ClientCaseSelectorPanel
        clients={clients}
        loading={loading}
        isOverviewMode={isOverviewMode}
        selectedClientId={selectedClientId}
        selectedCaseId={selectedCaseId}
        expandedClientIds={expandedClientIds}
        onSelectOverview={selectOverview}
        onSelectClient={selectClient}
        onSelectCase={selectCase}
        onToggleClientExpanded={toggleClientExpanded}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Right Panel - Invoice Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <InvoiceDetailPanel
          isOverviewMode={isOverviewMode}
          selectedClient={selectedClient}
          selectedCase={selectedCase}
          onInvoiceCreated={handleInvoiceCreated}
          onSelectClient={selectClient}
          onSelectCase={selectCase}
        />
      </div>
    </div>
  );
}
