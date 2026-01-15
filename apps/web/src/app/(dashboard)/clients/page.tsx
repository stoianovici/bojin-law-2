'use client';

import * as React from 'react';
import { useQuery } from '@apollo/client/react';
import { useClientsStore } from '@/store/clientsStore';
import { GET_CLIENTS } from '@/graphql/queries';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui';
import { ClientListPanel, ClientDetailPanel, type ClientListData } from '@/components/clients';

// ============================================================================
// Types
// ============================================================================

interface GetClientsResponse {
  clients: ClientListData[];
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function ListLoadingSkeleton() {
  return (
    <div className="w-[280px] xl:w-[400px] flex-shrink-0 border-r border-linear-border-subtle flex flex-col bg-linear-bg-secondary">
      {/* Header skeleton */}
      <div className="px-6 py-5 border-b border-linear-border-subtle">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-20 bg-linear-bg-tertiary rounded animate-pulse" />
          <div className="h-9 w-28 bg-linear-bg-tertiary rounded animate-pulse" />
        </div>
        <div className="h-10 bg-linear-bg-tertiary rounded animate-pulse" />
      </div>
      {/* Filter skeleton */}
      <div className="px-6 py-3 border-b border-linear-border-subtle space-y-2">
        <div className="flex gap-2">
          <div className="h-7 w-16 bg-linear-bg-tertiary rounded animate-pulse" />
          <div className="h-7 w-20 bg-linear-bg-tertiary rounded animate-pulse" />
          <div className="h-7 w-24 bg-linear-bg-tertiary rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-14 bg-linear-bg-tertiary rounded animate-pulse" />
          <div className="h-7 w-20 bg-linear-bg-tertiary rounded animate-pulse" />
          <div className="h-7 w-18 bg-linear-bg-tertiary rounded animate-pulse" />
        </div>
      </div>
      {/* List skeleton */}
      <div className="flex-1 p-2 space-y-1">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-3 rounded-md animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-linear-bg-tertiary" />
              <div className="flex-1">
                <div className="h-4 w-3/4 bg-linear-bg-tertiary rounded mb-1" />
                <div className="h-3 w-1/2 bg-linear-bg-tertiary rounded mb-1" />
                <div className="h-3 w-1/3 bg-linear-bg-tertiary rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ClientsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    selectedClientId,
    selectClient,
    isCreatingClient,
    startCreatingClient,
    stopCreatingClient,
  } = useClientsStore();

  // Skip query until auth is ready
  const shouldSkipQuery = authLoading || !isAuthenticated;

  // Fetch all clients
  const { data, loading, error, refetch } = useQuery<GetClientsResponse>(GET_CLIENTS, {
    skip: shouldSkipQuery,
    fetchPolicy: 'cache-and-network',
  });

  const clients = React.useMemo(() => data?.clients || [], [data?.clients]);

  // Handle new client - switch to create mode in right panel
  const handleNewClient = () => {
    startCreatingClient();
  };

  // Handle successful client creation
  const handleClientCreated = (clientId: string) => {
    stopCreatingClient();
    refetch();
    selectClient(clientId);
  };

  // Handle cancel create
  const handleCancelCreate = () => {
    stopCreatingClient();
  };

  // Error state
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          <p className="text-linear-error mb-2">Eroare la incarcarea clientilor</p>
          <p className="text-sm text-linear-text-secondary">{error.message}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Panel - Client List */}
      {authLoading || loading ? (
        <ListLoadingSkeleton />
      ) : (
        <ClientListPanel
          clients={clients}
          selectedClientId={selectedClientId}
          onSelectClient={selectClient}
          onNewClient={handleNewClient}
          loading={loading}
        />
      )}

      {/* Right Panel - Client Detail / Create */}
      <ClientDetailPanel
        clientId={selectedClientId}
        isCreating={isCreatingClient}
        onClientUpdated={() => refetch()}
        onClientDeleted={() => {
          selectClient(null);
          refetch();
        }}
        onClientCreated={handleClientCreated}
        onCancelCreate={handleCancelCreate}
      />
    </div>
  );
}
