/**
 * Billing Information Section Component
 * Story 2.8.1: Billing & Rate Management - Task 12
 *
 * Displays billing type, rates, and fixed amount for a case.
 * Partners only - wrapped in FinancialData for access control.
 */

'use client';

import { useState } from 'react';
import type { BillingType, CustomRates } from '@legal-platform/types';
import { FinancialData } from '../auth/FinancialData';
import { RateHistoryModal } from './RateHistoryModal';

interface BillingInfoSectionProps {
  caseId: string;
  billingType: BillingType;
  fixedAmount: number | null;
  customRates: CustomRates | null;
  onEdit?: () => void;
}

/**
 * Converts cents to dollars for display
 */
function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Billing Type Badge
 */
function BillingTypeBadge({ billingType }: { billingType: BillingType }) {
  const badgeColor =
    billingType === 'Hourly' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badgeColor}`}
    >
      {billingType === 'Hourly' ? 'Hourly Billing' : 'Fixed Fee'}
    </span>
  );
}

export function BillingInfoSection({
  caseId,
  billingType,
  fixedAmount,
  customRates,
  onEdit,
}: BillingInfoSectionProps) {
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  return (
    <FinancialData>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Billing Information</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowHistoryModal(true)}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
            >
              View History
            </button>
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Edit Rates
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Billing Type */}
          <div>
            <dt className="text-sm font-medium text-gray-500 mb-1">Billing Type</dt>
            <dd>
              <BillingTypeBadge billingType={billingType} />
            </dd>
          </div>

          {/* Fixed Amount (if Fixed billing) */}
          {billingType === 'Fixed' && fixedAmount != null && (
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">Fixed Amount</dt>
              <dd className="text-2xl font-bold text-gray-900">${centsToDollars(fixedAmount)}</dd>
            </div>
          )}

          {/* Hourly Rates */}
          {billingType === 'Hourly' && (
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-2">Hourly Rates</dt>
              <dd className="space-y-2">
                <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-700">Partner</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {customRates?.partnerRate != null ? (
                      `$${centsToDollars(customRates.partnerRate)}/hr`
                    ) : (
                      <span className="text-gray-500 italic">Default rate</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-700">Associate</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {customRates?.associateRate != null ? (
                      `$${centsToDollars(customRates.associateRate)}/hr`
                    ) : (
                      <span className="text-gray-500 italic">Default rate</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-700">Paralegal</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {customRates?.paralegalRate != null ? (
                      `$${centsToDollars(customRates.paralegalRate)}/hr`
                    ) : (
                      <span className="text-gray-500 italic">Default rate</span>
                    )}
                  </span>
                </div>
              </dd>
            </div>
          )}

          {/* Rate Source Info */}
          {billingType === 'Hourly' && customRates != null && (
            <div className="pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                {customRates.partnerRate != null ||
                customRates.associateRate != null ||
                customRates.paralegalRate != null
                  ? '✓ Using custom rates for this case'
                  : 'Using firm default rates'}
              </p>
            </div>
          )}
        </div>

        {/* Rate History Modal */}
        <RateHistoryModal
          caseId={caseId}
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
        />
      </div>
    </FinancialData>
  );
}
