/**
 * CommunicationsTab - Placeholder for communications view
 * Shows mockup layout for email threads and messages
 */

'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface CommunicationsTabProps {
  className?: string;
}

/**
 * CommunicationsTab Component
 *
 * Placeholder tab showing mockup layout for future communications feature
 */
export function CommunicationsTab({ className }: CommunicationsTabProps) {
  return (
    <div className={clsx('flex h-full bg-white', className)}>
      {/* Left Side: Thread List (Mockup) */}
      <div className="w-1/3 border-r border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Fire de Discuții
        </h3>

        {/* Mockup Thread Items */}
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    Subiect Email {i}
                  </p>
                  <p className="text-xs text-gray-600 truncate">
                    Fragment de preview al mesajului...
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Acum 2 ore</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Side: Message View (Mockup) */}
      <div className="flex-1 flex flex-col">
        {/* Message Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Subiect Conversație
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-8 h-8 rounded-full bg-blue-100" />
            <span>De la: Contact Client</span>
            <span className="text-gray-400">•</span>
            <span>Către: Tine</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-3xl space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex-shrink-0" />
                <div className="flex-1">
                  <div className="bg-gray-100 rounded-lg p-3">
                    <p className="text-sm text-gray-900">
                      Acesta este un mesaj de exemplu în cadrul firului de
                      conversație. Funcționalitatea completă va fi implementată în
                      versiunile viitoare.
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Acum {i} ore</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compose Button */}
        <div className="p-4 border-t border-gray-200">
          <button className="w-full inline-flex items-center justify-center px-4 py-3 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Compune Email
          </button>
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
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Vizualizare Comunicații - În Dezvoltare
          </h3>
          <p className="text-sm text-gray-600 max-w-md">
            Firele de conversație email și mesajele vor apărea aici. Funcționalitatea
            completă va fi disponibilă în versiunile viitoare.
          </p>
        </div>
      </div>
    </div>
  );
}

CommunicationsTab.displayName = 'CommunicationsTab';
