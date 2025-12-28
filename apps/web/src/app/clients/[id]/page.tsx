/**
 * Client Profile Page
 * OPS-227: Client Profile Page + Case Links
 *
 * Displays client information and their case portfolio
 * Route: /clients/[id]
 */

'use client';

import React, { use, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ClientHeader, ClientCasesTable } from '../../../components/client';
import { useClient } from '../../../hooks/useClient';
import { ErrorBoundary } from '../../../components/errors/ErrorBoundary';
import { PageLayout, PageContent } from '../../../components/linear/PageLayout';

// ============================================================================
// Types
// ============================================================================

interface ClientProfilePageProps {
  params: Promise<{
    id: string;
  }>;
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <PageLayout className="animate-pulse p-0">
      {/* Header skeleton */}
      <div className="border-b border-linear-border-subtle bg-linear-bg-secondary">
        <PageContent className="px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-linear-bg-tertiary" />
            <div>
              <div className="mb-2 h-8 w-48 rounded bg-linear-bg-tertiary" />
              <div className="h-5 w-32 rounded bg-linear-bg-tertiary" />
            </div>
          </div>
        </PageContent>
      </div>
      {/* Table skeleton */}
      <PageContent className="px-6 py-6">
        <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-6">
          <div className="mb-6 h-6 w-24 rounded bg-linear-bg-tertiary" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded bg-linear-bg-tertiary" />
            ))}
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
}

// ============================================================================
// Error State
// ============================================================================

function ErrorState({ message }: { message: string }) {
  return (
    <PageLayout className="flex items-center justify-center">
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold text-linear-text-primary">Eroare la încărcare</h1>
        <p className="mb-4 text-linear-text-secondary">{message}</p>
        <Link
          href="/cases"
          className="inline-flex items-center gap-2 text-linear-accent hover:text-linear-accent-hover"
        >
          <ArrowLeft className="h-4 w-4" />
          Înapoi la dosare
        </Link>
      </div>
    </PageLayout>
  );
}

// ============================================================================
// Not Found State
// ============================================================================

function NotFoundState({ clientId }: { clientId: string }) {
  return (
    <PageLayout className="flex items-center justify-center">
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold text-linear-text-primary">Client negăsit</h1>
        <p className="mb-4 text-linear-text-secondary">
          Clientul cu ID {clientId} nu există sau nu aveți acces la acesta.
        </p>
        <Link
          href="/cases"
          className="inline-flex items-center gap-2 text-linear-accent hover:text-linear-accent-hover"
        >
          <ArrowLeft className="h-4 w-4" />
          Înapoi la dosare
        </Link>
      </div>
    </PageLayout>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ClientProfilePage({ params }: ClientProfilePageProps) {
  const { id: clientId } = use(params);
  const { client, loading, error } = useClient(clientId);

  // Set page title
  useEffect(() => {
    if (client) {
      document.title = `${client.name} - Portofoliu Client`;
    }
  }, [client]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  if (!client) {
    return <NotFoundState clientId={clientId} />;
  }

  return (
    <ErrorBoundary>
      <PageLayout className="p-0">
        {/* Back navigation */}
        <div className="border-b border-linear-border-subtle bg-linear-bg-secondary">
          <PageContent className="px-6 py-3">
            <Link
              href="/cases"
              className="inline-flex items-center gap-2 text-sm text-linear-text-secondary hover:text-linear-text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Înapoi la dosare
            </Link>
          </PageContent>
        </div>

        {/* Client Header */}
        <ClientHeader client={client} />

        {/* Cases Table */}
        <PageContent className="px-6 py-6">
          <ClientCasesTable cases={client.cases} />
        </PageContent>
      </PageLayout>
    </ErrorBoundary>
  );
}
