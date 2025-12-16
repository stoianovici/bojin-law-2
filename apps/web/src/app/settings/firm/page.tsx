/**
 * Firm Settings Page
 * OPS-028: Classification Metadata UI
 *
 * Page for Partners to configure firm-level settings including
 * global email sources for AI classification.
 */

'use client';

import { FinancialData } from '@/components/auth/FinancialData';
import { GlobalEmailSourcesPanel } from '@/components/settings/GlobalEmailSourcesPanel';

export default function FirmSettingsPage() {
  return (
    <FinancialData
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Acces Respins</h1>
            <p className="text-gray-600">Nu aveți permisiunea de a accesa setările firmei.</p>
          </div>
        </div>
      }
    >
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Setări Firmă</h1>
            <p className="text-gray-600">
              Configurați setările la nivel de firmă pentru clasificarea automată a emailurilor.
            </p>
          </div>

          {/* Global Email Sources Section */}
          <div className="space-y-8">
            <GlobalEmailSourcesPanel />
          </div>

          {/* Future sections can be added here */}
          {/*
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Alte Setări</h2>
            ...
          </div>
          */}
        </div>
      </div>
    </FinancialData>
  );
}
