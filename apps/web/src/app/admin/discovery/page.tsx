/**
 * Discovery Admin Dashboard Page
 * Story 2.12.1 - Task 7: Admin Dashboard
 *
 * Provides overview and management tools for document type discovery
 */

'use client';

import React, { useState } from 'react';
import { DiscoveryStatusPanel } from '@/components/admin/DiscoveryStatusPanel';
import { ManualMappingInterface } from '@/components/admin/ManualMappingInterface';
import { ROICalculationsDisplay } from '@/components/admin/ROICalculationsDisplay';

export default function DiscoveryDashboardPage() {
  const [activeTab, setActiveTab] = useState<'status' | 'mapping' | 'roi'>('status');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tablou Descoperire</h1>
            <p className="mt-2 text-sm text-gray-600">
              Monitorizați și gestionați descoperirea tipurilor de documente și crearea șabloanelor
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('status')}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === 'status'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              Status Descoperire
            </button>
            <button
              onClick={() => setActiveTab('mapping')}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === 'mapping'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              Mapare Manuală
            </button>
            <button
              onClick={() => setActiveTab('roi')}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === 'roi'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              Analiză ROI
            </button>
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'status' && <DiscoveryStatusPanel />}
        {activeTab === 'mapping' && <ManualMappingInterface />}
        {activeTab === 'roi' && <ROICalculationsDisplay />}
      </div>
    </div>
  );
}
