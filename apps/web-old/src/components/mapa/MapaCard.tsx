/**
 * MapaCard Component
 * OPS-102: Mapa UI Components
 *
 * Summary card showing mapa status at a glance
 */

'use client';

import React from 'react';
import { clsx } from 'clsx';
import type { Mapa } from '../../hooks/useMapa';

export interface MapaCardProps {
  mapa: Mapa;
  onClick: () => void;
  className?: string;
}

/**
 * MapaCard - displays a mapa summary with completion status
 */
export function MapaCard({ mapa, onClick, className }: MapaCardProps) {
  const { completionStatus } = mapa;
  const percentComplete = completionStatus.percentComplete;
  const isComplete = completionStatus.isComplete;
  const missingCount = completionStatus.requiredSlots - completionStatus.filledRequiredSlots;

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left p-4 bg-white border border-gray-200 rounded-lg',
        'hover:border-blue-300 hover:shadow-sm transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{mapa.name}</h3>
          {mapa.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{mapa.description}</p>
          )}
        </div>
        {/* Status Badge */}
        {isComplete ? (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Complet
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            {missingCount} {missingCount === 1 ? 'document lipsă' : 'documente lipsă'}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>
            {completionStatus.filledSlots} / {completionStatus.totalSlots} poziții completate
          </span>
          <span>{Math.round(percentComplete)}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-300',
              isComplete ? 'bg-green-500' : 'bg-blue-500'
            )}
            style={{ width: `${percentComplete}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-1">
          {mapa.template && (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                />
              </svg>
              <span>{mapa.template.name}</span>
            </>
          )}
        </div>
        <span>
          {new Date(mapa.createdAt).toLocaleDateString('ro-RO', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      </div>
    </button>
  );
}

MapaCard.displayName = 'MapaCard';
