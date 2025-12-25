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
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* Header skeleton */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gray-200" />
            <div>
              <div className="h-8 bg-gray-200 rounded w-48 mb-2" />
              <div className="h-5 bg-gray-200 rounded w-32" />
            </div>
          </div>
        </div>
      </div>
      {/* Table skeleton */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="h-6 bg-gray-200 rounded w-24 mb-6" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Eroare la încărcare</h1>
        <p className="text-gray-600 mb-4">{message}</p>
        <Link
          href="/cases"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Înapoi la dosare
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Not Found State
// ============================================================================

function NotFoundState({ clientId }: { clientId: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Client negăsit</h1>
        <p className="text-gray-600 mb-4">
          Clientul cu ID {clientId} nu există sau nu aveți acces la acesta.
        </p>
        <Link
          href="/cases"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Înapoi la dosare
        </Link>
      </div>
    </div>
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
      <div className="min-h-screen bg-gray-50">
        {/* Back navigation */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <Link
              href="/cases"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Înapoi la dosare
            </Link>
          </div>
        </div>

        {/* Client Header */}
        <ClientHeader client={client} />

        {/* Cases Table */}
        <div className="max-w-7xl mx-auto px-6 py-6">
          <ClientCasesTable cases={client.cases} />
        </div>
      </div>
    </ErrorBoundary>
  );
}
