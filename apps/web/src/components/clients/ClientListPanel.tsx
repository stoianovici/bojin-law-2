'use client';

import * as React from 'react';
import { useMemo } from 'react';
import { Plus, Search, Building2, User, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { ClientListItem } from './ClientListItem';
import {
  useClientsStore,
  type ClientFilterType,
  type ClientTypeFilter,
} from '@/store/clientsStore';

export interface ClientListData {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  clientType?: string | null;
  companyType?: string | null;
  caseCount: number;
  activeCaseCount: number;
}

interface ClientListPanelProps {
  clients: ClientListData[];
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
  onNewClient?: () => void;
  loading?: boolean;
}

export function ClientListPanel({
  clients,
  selectedClientId,
  onSelectClient,
  onNewClient,
  loading = false,
}: ClientListPanelProps) {
  const { searchQuery, setSearchQuery, filterType, setFilterType, clientType, setClientType } =
    useClientsStore();

  // Filter clients based on all active filters
  const filteredClients = useMemo(() => {
    let filtered = clients;

    // Filter by case status
    if (filterType === 'withCases') {
      filtered = filtered.filter((c) => c.caseCount > 0);
    } else if (filterType === 'noCases') {
      filtered = filtered.filter((c) => c.caseCount === 0);
    }

    // Filter by client type
    if (clientType === 'company') {
      filtered = filtered.filter((c) => c.clientType === 'company');
    } else if (clientType === 'individual') {
      filtered = filtered.filter((c) => c.clientType === 'individual');
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query) ||
          c.phone?.includes(query)
      );
    }

    return filtered;
  }, [clients, filterType, clientType, searchQuery]);

  const caseFilterButtons: { value: ClientFilterType; label: string }[] = [
    { value: 'all', label: 'Toate' },
    { value: 'withCases', label: 'Cu dosare' },
    { value: 'noCases', label: 'Fara dosare' },
  ];

  const typeFilterButtons: { value: ClientTypeFilter; label: string; icon: typeof Building2 }[] = [
    { value: 'all', label: 'Toti', icon: Filter },
    { value: 'company', label: 'Companii', icon: Building2 },
    { value: 'individual', label: 'Persoane', icon: User },
  ];

  return (
    <div className="w-[280px] xl:w-[400px] flex-shrink-0 border-r border-linear-border-subtle flex flex-col bg-linear-bg-secondary">
      {/* Header */}
      <div className="px-6 py-5 border-b border-linear-border-subtle">
        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-base font-normal text-linear-text-primary">Clienți</h1>
          <button
            onClick={onNewClient}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#6366F1] hover:bg-[#5558E3] text-white text-[13px] font-light rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Client nou
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-linear-text-muted" />
          <Input
            type="text"
            placeholder="Cauta clienti..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 text-[13px] bg-linear-bg-primary border-linear-border-subtle focus:border-[#6366F1]"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-linear-border-subtle space-y-2">
        {/* Case status filter row */}
        <div className="flex gap-2">
          {caseFilterButtons.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setFilterType(filter.value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-light rounded-md border transition-colors',
                filterType === filter.value
                  ? 'bg-[rgba(99,102,241,0.15)] border-[#6366F1] text-[#6366F1]'
                  : 'bg-transparent border-linear-border-subtle text-linear-text-secondary hover:border-linear-border-default hover:text-linear-text-primary'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Client type filter row */}
        <div className="flex gap-2">
          {typeFilterButtons.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setClientType(filter.value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-light rounded-md border transition-colors',
                clientType === filter.value
                  ? 'bg-[rgba(99,102,241,0.15)] border-[#6366F1] text-[#6366F1]'
                  : 'bg-transparent border-linear-border-subtle text-linear-text-secondary hover:border-linear-border-default hover:text-linear-text-primary'
              )}
            >
              <filter.icon className="h-3.5 w-3.5" />
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Client list */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-linear-text-tertiary">
            Se incarca...
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-linear-text-tertiary">
            {clients.length === 0 ? 'Nu exista clienti' : 'Nu s-au gasit clienti'}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredClients.map((client) => (
              <ClientListItem
                key={client.id}
                client={client}
                isSelected={selectedClientId === client.id}
                onClick={() => onSelectClient(client.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default ClientListPanel;
