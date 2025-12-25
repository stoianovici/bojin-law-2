/**
 * Unified Settings Page
 * Combines Billing, Firm, AI Personalization, and Personal Contacts settings
 *
 * Story 2.8.1: Billing & Rate Management - Task 9
 * OPS-028: Firm Settings
 * Story 5.6: AI Personalization
 * OPS-193: Personal Contacts Profile Page
 */

'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { FinancialData } from '@/components/auth/FinancialData';
import { DefaultRatesForm } from '@/components/settings/DefaultRatesForm';
import { GlobalEmailSourcesPanel } from '@/components/settings/GlobalEmailSourcesPanel';
import { PersonalContactsSection } from '@/components/settings/PersonalContactsSection';
import { SettingsTabBar, type SettingsTab } from '@/components/settings/SettingsTabBar';

// Lazy load the heavy AI Personalization components
import dynamic from 'next/dynamic';

const AIPersonalizationContent = dynamic(
  () => import('@/components/settings/AIPersonalizationContent'),
  {
    loading: () => (
      <div className="py-8 text-center text-gray-500">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p className="mt-2">Se încarcă...</p>
      </div>
    ),
  }
);

// Query to fetch current default rates
const GET_DEFAULT_RATES = gql`
  query GetDefaultRates {
    defaultRates {
      partnerRate
      associateRate
      paralegalRate
    }
  }
`;

interface DefaultRates {
  partnerRate: number;
  associateRate: number;
  paralegalRate: number;
}

interface GetDefaultRatesQueryResult {
  defaultRates: DefaultRates | null;
}

function BillingContent() {
  const { data, loading, error } = useQuery<GetDefaultRatesQueryResult>(GET_DEFAULT_RATES);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Default Rates Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Tarife Implicite</h2>
          <p className="text-sm text-gray-600">
            Setați tarifele orare pentru fiecare rol. Dosarele noi vor moșteni aceste tarife.
          </p>
        </div>

        {loading && (
          <div className="py-8 text-center text-gray-500">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-2">Se încarcă tarifele...</p>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">Eroare la încărcarea tarifelor</p>
                <p className="mt-1 text-sm text-red-700">{error.message}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && <DefaultRatesForm initialRates={data?.defaultRates || null} />}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-blue-800">Despre Tarife Implicite</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Tarifele sunt în USD pe oră</li>
                <li>Dosarele noi moștenesc automat aceste tarife</li>
                <li>Puteți suprascrie tarifele pentru fiecare dosar</li>
                <li>Modificările de tarif sunt urmărite în istoricul dosarului</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FirmContent() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <GlobalEmailSourcesPanel />
    </div>
  );
}

function ContactsContent() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PersonalContactsSection />
    </div>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: SettingsTab =
    tabParam === 'firm'
      ? 'firm'
      : tabParam === 'ai'
        ? 'ai'
        : tabParam === 'contacts'
          ? 'contacts'
          : 'billing';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tab navigation */}
      <SettingsTabBar activeTab={activeTab} />

      {/* Tab content */}
      {activeTab === 'billing' && <BillingContent />}
      {activeTab === 'firm' && <FirmContent />}
      {activeTab === 'ai' && <AIPersonalizationContent />}
      {activeTab === 'contacts' && <ContactsContent />}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <FinancialData
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Acces Respins</h1>
            <p className="text-gray-600">Nu aveți permisiunea de a accesa setările.</p>
          </div>
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-2 text-gray-500">Se încarcă...</p>
            </div>
          </div>
        }
      >
        <SettingsContent />
      </Suspense>
    </FinancialData>
  );
}
