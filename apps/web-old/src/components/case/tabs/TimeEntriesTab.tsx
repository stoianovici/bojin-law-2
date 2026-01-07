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
    <div className={clsx('flex flex-col h-full bg-linear-bg-secondary relative', className)}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-linear-border-subtle">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-linear-text-primary">Înregistrări Timp</h2>
          <button className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-linear-accent hover:bg-linear-accent-hover focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-2 transition-colors">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <thead className="bg-linear-bg-tertiary border-b border-linear-border-subtle">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-secondary uppercase tracking-wider">
                Data
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-secondary uppercase tracking-wider">
                Utilizator
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-secondary uppercase tracking-wider">
                Activitate
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-secondary uppercase tracking-wider">
                Ore
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-secondary uppercase tracking-wider">
                Facturabil
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-secondary uppercase tracking-wider">
                Note
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linear-border-subtle">
            {[...Array(8)].map((_, i) => (
              <tr key={i} className="hover:bg-linear-bg-hover">
                <td className="px-4 py-3 text-linear-text-primary">
                  {new Date(2024, 10, i + 1).toLocaleDateString('ro-RO')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-linear-accent/15 flex-shrink-0" />
                    <span className="text-linear-text-primary">Avocat {i + 1}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-linear-text-primary">Cercetare juridică</td>
                <td className="px-4 py-3 text-linear-text-primary font-semibold">
                  {2 + (i % 3)}.5
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-linear-success/15 text-linear-success border border-linear-success/30">
                    Da
                  </span>
                </td>
                <td className="px-4 py-3 text-linear-text-tertiary">
                  Analiză precedente cazuri similare
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total Summary */}
      <div className="px-6 py-4 border-t border-linear-border-subtle bg-linear-bg-tertiary">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-linear-text-secondary">
            Total Ore Acest Caz:
          </span>
          <span className="text-lg font-bold text-linear-text-primary">24.5 ore</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-linear-text-tertiary">Ore Facturabile:</span>
          <span className="text-sm font-semibold text-linear-success">22.0 ore</span>
        </div>
      </div>

      {/* Overlay Message */}
      <div className="absolute inset-0 flex items-center justify-center bg-linear-bg-secondary/90 pointer-events-none">
        <div className="text-center p-8">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-linear-text-muted"
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
          <h3 className="text-lg font-semibold text-linear-text-primary mb-2">
            Înregistrări Timp - În Dezvoltare
          </h3>
          <p className="text-sm text-linear-text-tertiary max-w-md">
            Înregistrările de timp pentru acest caz vor apărea aici. Funcționalitatea completă va fi
            disponibilă în versiunile viitoare.
          </p>
        </div>
      </div>
    </div>
  );
}

TimeEntriesTab.displayName = 'TimeEntriesTab';
