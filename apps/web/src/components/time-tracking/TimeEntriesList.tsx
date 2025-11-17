/**
 * TimeEntriesList Component
 * Displays time entries in table format with filtering support
 */

'use client';

import React from 'react';
import { useTimeTrackingStore, selectFilteredEntries } from '../../stores/time-tracking.store';

function formatMinutesToHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
}

function formatDate(date: Date): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

const taskTypeLabels: Record<string, string> = {
  Research: 'Cercetare',
  Drafting: 'Redactare',
  ClientMeeting: 'Întâlnire Client',
  CourtAppearance: 'Prezentare Instanță',
  Email: 'Email',
  PhoneCall: 'Apel Telefonic',
  Administrative: 'Administrativ',
  Other: 'Altele',
};

interface TimeEntriesListProps {
  className?: string;
}

export function TimeEntriesList({ className = '' }: TimeEntriesListProps) {
  const entries = useTimeTrackingStore(selectFilteredEntries);
  const deleteTimeEntry = useTimeTrackingStore((state) => state.deleteTimeEntry);

  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-8 ${className}`}>
        <div className="text-center text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-gray-400"
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
          <p className="text-lg font-medium">Nicio intrare găsită</p>
          <p className="text-sm mt-1">Adaugă prima ta intrare de pontaj</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Intrări Pontaj
          <span className="ml-2 text-sm font-normal text-gray-500">({entries.length})</span>
        </h2>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          Exportă CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dată
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dosar
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tip Activitate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Durată
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descriere
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Facturabil
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acțiuni
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entries.map((entry) => {
              const isExpanded = expandedId === entry.id;
              return (
                <tr
                  key={entry.id}
                  className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                    entry.isBillable ? 'bg-green-50/30' : 'bg-gray-50/30'
                  }`}
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(entry.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="font-medium truncate max-w-[200px]" title={entry.caseName}>
                      {entry.caseName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {taskTypeLabels[entry.taskType] || entry.taskType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatMinutesToHours(entry.duration)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <div className={`${isExpanded ? '' : 'truncate max-w-[300px]'}`}>
                      {entry.description || (
                        <span className="text-gray-400 italic">Fără descriere</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {entry.isBillable ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600">
                        ✓
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-400">
                        -
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Edit functionality (mockup)
                      }}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Editează
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Sigur doriți să ștergeți această intrare?')) {
                          deleteTimeEntry(entry.id);
                        }
                      }}
                      className="text-red-600 hover:text-red-900"
                    >
                      Șterge
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
