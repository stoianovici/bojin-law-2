'use client';

import Link from 'next/link';
import { Search, ChevronRight, Building2, User } from 'lucide-react';
import { LargeHeader } from '@/components/layout';
import {
  Card,
  Avatar,
  Badge,
  EmptyList,
  SkeletonList,
  PullToRefresh,
  ListItemTransition,
} from '@/components/ui';
import { useClients, type Client } from '@/hooks/useClients';
import { clsx } from 'clsx';

// ============================================
// Page Component
// ============================================

export default function ClientsPage() {
  const { clients, loading, searchQuery, setSearchQuery, refetch } = useClients();

  const handleRefresh = async () => {
    await refetch();
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <LargeHeader title="Clienți" subtitle={`${clients.length} clienți`} />

      {/* Search Bar */}
      <div className="px-6 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Caută clienți..."
            className={clsx(
              'w-full h-10 pl-10 pr-4',
              'bg-bg-elevated rounded-lg',
              'text-sm text-text-primary placeholder:text-text-tertiary',
              'focus:outline-none focus:ring-1 focus:ring-accent'
            )}
          />
        </div>
      </div>

      {/* Clients List */}
      <PullToRefresh onRefresh={handleRefresh} disabled={loading} className="px-6 py-2">
        {loading ? (
          <SkeletonList count={5} />
        ) : clients.length === 0 ? (
          <EmptyList itemName="client" />
        ) : (
          <div className="space-y-2">
            {clients.map((client, index) => (
              <ListItemTransition key={client.id} index={index}>
                <ClientCard client={client} />
              </ListItemTransition>
            ))}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}

// ============================================
// Client Card Component
// ============================================

interface ClientCardProps {
  client: Client;
}

function ClientCard({ client }: ClientCardProps) {
  const isCompany = client.clientType === 'company';
  const TypeIcon = isCompany ? Building2 : User;

  return (
    <Link href={`/clients/${client.id}`}>
      <Card interactive padding="md">
        <div className="flex items-center gap-3">
          <Avatar name={client.name} size="lg" />

          <div className="flex-1 min-w-0">
            {/* Name & Type */}
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-medium text-text-primary truncate">{client.name}</span>
              <TypeIcon className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
            </div>

            {/* Contact Info */}
            {(client.email || client.phone) && (
              <p className="text-xs text-text-tertiary truncate">{client.email || client.phone}</p>
            )}

            {/* Case Count */}
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="default" size="sm">
                {client.activeCaseCount} dosare active
              </Badge>
              {client.caseCount > client.activeCaseCount && (
                <span className="text-xs text-text-tertiary">({client.caseCount} total)</span>
              )}
            </div>
          </div>

          <ChevronRight className="w-5 h-5 text-text-tertiary shrink-0" />
        </div>
      </Card>
    </Link>
  );
}
