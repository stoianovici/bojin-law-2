/**
 * MapaList Component
 * OPS-102: Mapa UI Components
 *
 * Displays all mape for a case with summary cards
 */

'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { useCaseMape } from '../../hooks/useMapa';
import { MapaCard } from './MapaCard';
import { MapaDetail } from './MapaDetail';
import { MapaCreateModal } from './MapaCreateModal';

export interface MapaListProps {
  caseId: string;
  caseName?: string;
  caseNumber?: string;
  className?: string;
}

/**
 * MapaList - grid of mape for a case
 */
export function MapaList({ caseId, caseName, caseNumber, className }: MapaListProps) {
  const { mape, loading, error, refetch } = useCaseMape(caseId);
  const [selectedMapaId, setSelectedMapaId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Loading state
  if (loading && mape.length === 0) {
    return (
      <div className={clsx('p-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={clsx('p-6', className)}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Eroare la încărcarea mapelor: {error.message}</span>
          </div>
        </div>
      </div>
    );
  }

  // If a mapa is selected, show detail view
  if (selectedMapaId) {
    return (
      <MapaDetail
        mapaId={selectedMapaId}
        caseId={caseId}
        caseName={caseName}
        caseNumber={caseNumber}
        onBack={() => setSelectedMapaId(null)}
        onDeleted={() => {
          setSelectedMapaId(null);
          refetch();
        }}
        className={className}
      />
    );
  }

  return (
    <div className={clsx('p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Mape documente</h2>
        <button
          onClick={() => setCreateModalOpen(true)}
          className={clsx(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
            'bg-blue-600 text-white text-sm font-medium',
            'hover:bg-blue-700 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          )}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Crează mapă
        </button>
      </div>

      {/* Empty state */}
      {mape.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <svg
            className="w-12 h-12 mx-auto text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <h3 className="text-sm font-medium text-gray-900 mb-1">
            Nu există mape pentru acest dosar
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Creează o mapă pentru a organiza documentele dosarului.
          </p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className={clsx(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
              'bg-blue-600 text-white text-sm font-medium',
              'hover:bg-blue-700 transition-colors'
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Crează prima mapă
          </button>
        </div>
      ) : (
        /* Mapa Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mape.map((mapa) => (
            <MapaCard key={mapa.id} mapa={mapa} onClick={() => setSelectedMapaId(mapa.id)} />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <MapaCreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        caseId={caseId}
        onCreated={(mapa) => {
          setCreateModalOpen(false);
          setSelectedMapaId(mapa.id);
          refetch();
        }}
      />
    </div>
  );
}

MapaList.displayName = 'MapaList';
