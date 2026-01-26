'use client';

import Link from 'next/link';
import { Search as SearchIcon, X, Briefcase, User, ChevronRight } from 'lucide-react';
import { Header } from '@/components/layout';
import { Card, Avatar, Badge, EmptySearch, SkeletonListItem } from '@/components/ui';
import { useSearch } from '@/hooks/useSearch';
import { clsx } from 'clsx';

export default function SearchPage() {
  const { query, setQuery, results, loading, hasResults, showResults, clearSearch } = useSearch();

  return (
    <div className="min-h-screen">
      {/* Search Header */}
      <div
        className="sticky top-0 z-40 px-4 pt-4 pb-3 bg-bg-primary"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
      >
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Caută dosare, clienți..."
            className={clsx(
              'w-full h-12 pl-12 pr-12',
              'bg-bg-elevated rounded-xl',
              'text-text-primary placeholder:text-text-tertiary',
              'focus:outline-none focus:ring-2 focus:ring-accent'
            )}
            autoFocus
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full bg-bg-hover"
            >
              <X className="w-4 h-4 text-text-secondary" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="px-4 py-2">
        {!showResults ? (
          <div className="py-12 text-center">
            <SearchIcon className="w-12 h-12 mx-auto text-text-tertiary mb-4" />
            <p className="text-sm text-text-secondary">
              Introdu cel puțin 2 caractere pentru a căuta
            </p>
          </div>
        ) : loading ? (
          <div>
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </div>
        ) : !hasResults ? (
          <EmptySearch query={query} />
        ) : (
          <>
            {/* Cases Section */}
            {results.cases.length > 0 && (
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase className="w-4 h-4 text-text-secondary" />
                  <h2 className="text-sm font-semibold text-text-secondary">
                    Dosare ({results.cases.length})
                  </h2>
                </div>
                <div className="space-y-2">
                  {results.cases.map((caseItem) => (
                    <CaseResultCard key={caseItem.id} caseData={caseItem} />
                  ))}
                </div>
              </section>
            )}

            {/* Clients Section */}
            {results.clients.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-text-secondary" />
                  <h2 className="text-sm font-semibold text-text-secondary">
                    Clienți ({results.clients.length})
                  </h2>
                </div>
                <div className="space-y-2">
                  {results.clients.map((client) => (
                    <ClientResultCard key={client.id} client={client} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// Result Cards
// ============================================

interface CaseResultCardProps {
  caseData: {
    id: string;
    caseNumber: string;
    title: string;
    status: string;
    type: string;
    client: { id: string; name: string } | null;
  };
}

function CaseResultCard({ caseData }: CaseResultCardProps) {
  const statusVariant = {
    Active: 'primary',
    Pending: 'warning',
    Closed: 'default',
  }[caseData.status] as 'primary' | 'warning' | 'default';

  return (
    <Link href={`/cases/${caseData.id}`}>
      <Card interactive padding="sm">
        <div className="flex items-center gap-3">
          <Avatar name={caseData.client?.name || caseData.title} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-text-primary truncate">
                {caseData.caseNumber}
              </p>
              <Badge variant={statusVariant} size="sm">
                {caseData.status}
              </Badge>
            </div>
            <p className="text-xs text-text-secondary truncate">{caseData.title}</p>
            {caseData.client && (
              <p className="text-xs text-text-tertiary truncate mt-0.5">{caseData.client.name}</p>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
        </div>
      </Card>
    </Link>
  );
}

interface ClientResultCardProps {
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
}

function ClientResultCard({ client }: ClientResultCardProps) {
  return (
    <Card interactive padding="sm">
      <div className="flex items-center gap-3">
        <Avatar name={client.name} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{client.name}</p>
          {client.email && <p className="text-xs text-text-secondary truncate">{client.email}</p>}
        </div>
        <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
      </div>
    </Card>
  );
}
