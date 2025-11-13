/**
 * TimeEntriesTab - Placeholder for time tracking entries
 * Shows mockup table for billable hours and time entries
 */

'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface TimeEntriesTabProps {
  className?: string;
}

/**
 * TimeEntriesTab Component
 *
 * Placeholder tab showing mockup layout for future time tracking feature
 */
export function TimeEntriesTab({ className }: TimeEntriesTabProps) {
  return (
    <div className={clsx('flex flex-col h-full bg-white relative', className)}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Înregistrări Timp
          </h2>
          <button className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Înregistrare Nouă
          </button>
        </div>
      </div>

      {/* Mockup Table */}
      <div className="flex-1 overflow-auto p-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Data
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Utilizator
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Activitate
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Ore
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Facturabil
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Note
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {[...Array(8)].map((_, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">
                  {new Date(2024, 10, i + 1).toLocaleDateString('ro-RO')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex-shrink-0" />
                    <span className="text-gray-900">Avocat {i + 1}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-900">
                  Cercetare juridică
                </td>
                <td className="px-4 py-3 text-gray-900 font-semibold">
                  {2 + (i % 3)}.5
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                    Da
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  Analiză precedente cazuri similare
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total Summary */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Total Ore Acest Caz:
          </span>
          <span className="text-lg font-bold text-gray-900">24.5 ore</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-600">Ore Facturabile:</span>
          <span className="text-sm font-semibold text-green-700">22.0 ore</span>
        </div>
      </div>

      {/* Overlay Message */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/90 pointer-events-none">
        <div className="text-center p-8">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Înregistrări Timp - În Dezvoltare
          </h3>
          <p className="text-sm text-gray-600 max-w-md">
            Înregistrările de timp pentru acest caz vor apărea aici. Funcționalitatea
            completă va fi disponibilă în versiunile viitoare.
          </p>
        </div>
      </div>
    </div>
  );
}

TimeEntriesTab.displayName = 'TimeEntriesTab';
