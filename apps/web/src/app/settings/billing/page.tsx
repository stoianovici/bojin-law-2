/**
 * Billing Settings Page
 * Story 2.8.1: Billing & Rate Management - Task 9
 *
 * Page for Partners to configure default billing rates for their firm.
 * Only accessible by Partners (enforced via FinancialData wrapper).
 */

'use client';

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { FinancialData } from '@/components/auth/FinancialData';
import { DefaultRatesForm } from '@/components/settings/DefaultRatesForm';

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

export default function BillingSettingsPage() {
  const { data, loading, error } = useQuery<GetDefaultRatesQueryResult>(GET_DEFAULT_RATES);

  return (
    <FinancialData
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don&apos;t have permission to access billing settings.</p>
          </div>
        </div>
      }
    >
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing Settings</h1>
            <p className="text-gray-600">
              Configure default hourly rates for your firm. These rates will be applied to new cases automatically.
            </p>
          </div>

          {/* Default Rates Section */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Default Billing Rates</h2>
              <p className="text-sm text-gray-600">
                Set hourly rates for each role. New cases will inherit these rates unless custom rates are specified.
              </p>
            </div>

            {loading && (
              <div className="py-8 text-center text-gray-500">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                <p className="mt-2">Loading rates...</p>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">Error loading rates</p>
                    <p className="mt-1 text-sm text-red-700">{error.message}</p>
                  </div>
                </div>
              </div>
            )}

            {!loading && !error && (
              <DefaultRatesForm
                initialRates={data?.defaultRates || null}
              />
            )}
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-blue-800">About Default Rates</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Rates are in USD per hour</li>
                    <li>New cases automatically inherit these rates</li>
                    <li>You can override rates on individual cases</li>
                    <li>Rate changes are tracked in case history</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FinancialData>
  );
}
