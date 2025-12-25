'use client';

/**
 * ClientHeader Component
 * OPS-227: Client Profile Page + Case Links
 *
 * Displays client name, contact info, and case count badges
 */

import React from 'react';
import { clsx } from 'clsx';
import { User, Mail, Phone, MapPin, Briefcase } from 'lucide-react';
import type { ClientWithCases } from '../../hooks/useClient';

// ============================================================================
// Types
// ============================================================================

export interface ClientHeaderProps {
  client: ClientWithCases;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ClientHeader({ client, className }: ClientHeaderProps) {
  return (
    <div className={clsx('bg-white border-b border-gray-200', className)}>
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Title Row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-7 h-7 text-blue-600" />
            </div>

            {/* Name and badges */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  <Briefcase className="w-3.5 h-3.5" />
                  {client.activeCaseCount}{' '}
                  {client.activeCaseCount === 1 ? 'dosar activ' : 'dosare active'}
                </span>
                {client.caseCount > client.activeCaseCount && (
                  <span className="text-sm text-gray-500">({client.caseCount} total)</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Contact Info Row */}
        {(client.email || client.phone || client.address) && (
          <div className="flex flex-wrap items-center gap-6 mt-4 text-sm text-gray-600">
            {client.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <a href={`mailto:${client.email}`} className="hover:text-blue-600 hover:underline">
                  {client.email}
                </a>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <a href={`tel:${client.phone}`} className="hover:text-blue-600 hover:underline">
                  {client.phone}
                </a>
              </div>
            )}
            {client.address && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span>{client.address}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

ClientHeader.displayName = 'ClientHeader';
