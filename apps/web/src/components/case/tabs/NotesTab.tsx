/**
 * NotesTab - Placeholder for case notes and annotations
 * Shows mockup layout for note cards
 */

'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface NotesTabProps {
  className?: string;
}

/**
 * NotesTab Component
 *
 * Placeholder tab showing mockup layout for future notes feature
 */
export function NotesTab({ className }: NotesTabProps) {
  return (
    <div className={clsx('flex flex-col h-full bg-gray-50 relative', className)}>
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Notițe Caz
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
            Notiță Nouă
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              {/* Note Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    Notiță {i + 1}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex-shrink-0" />
                    <span>Creat de Avocat</span>
                  </div>
                </div>
                <button
                  className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  aria-label="Opțiuni notiță"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </button>
              </div>

              {/* Note Content Preview */}
              <p className="text-sm text-gray-700 mb-3 line-clamp-4">
                Aceasta este o notiță de exemplu pentru cazul curent. Notițele pot
                conține observații importante, detalii ale întâlnirilor, sau alte
                informații relevante pentru caz.
              </p>

              {/* Note Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">
                  Actualizat acum {i + 1} zi
                </span>
                <div className="flex items-center gap-1">
                  <svg
                    className="w-4 h-4 text-yellow-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                  <span className="text-xs text-gray-600">Important</span>
                </div>
              </div>
            </div>
          ))}
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
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Notițe Caz - În Dezvoltare
          </h3>
          <p className="text-sm text-gray-600 max-w-md">
            Notițele și adnotările pentru caz vor apărea aici. Funcționalitatea
            completă va fi disponibilă în versiunile viitoare.
          </p>
        </div>
      </div>
    </div>
  );
}

NotesTab.displayName = 'NotesTab';
