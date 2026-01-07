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
    billingType === 'Hourly'
      ? 'bg-linear-accent/15 text-linear-accent'
      : 'bg-linear-success/15 text-linear-success';

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
      <div className="bg-linear-bg-secondary rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-linear-text-primary">Billing Information</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowHistoryModal(true)}
              className="px-3 py-1.5 text-sm font-medium text-linear-text-secondary bg-linear-bg-tertiary rounded-md hover:bg-linear-bg-hover focus:outline-none focus:ring-2 focus:ring-linear-accent transition-colors"
            >
              View History
            </button>
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-3 py-1.5 text-sm font-medium text-linear-accent bg-linear-accent/10 rounded-md hover:bg-linear-accent/15 focus:outline-none focus:ring-2 focus:ring-linear-accent transition-colors"
              >
                Edit Rates
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Billing Type */}
          <div>
            <dt className="text-sm font-medium text-linear-text-tertiary mb-1">Billing Type</dt>
            <dd>
              <BillingTypeBadge billingType={billingType} />
            </dd>
          </div>

          {/* Fixed Amount (if Fixed billing) */}
          {billingType === 'Fixed' && fixedAmount != null && (
            <div>
              <dt className="text-sm font-medium text-linear-text-tertiary mb-1">Fixed Amount</dt>
              <dd className="text-2xl font-bold text-linear-text-primary">
                ${centsToDollars(fixedAmount)}
              </dd>
            </div>
          )}

          {/* Hourly Rates */}
          {billingType === 'Hourly' && (
            <div>
              <dt className="text-sm font-medium text-linear-text-tertiary mb-2">Hourly Rates</dt>
              <dd className="space-y-2">
                <div className="flex justify-between items-center py-2 px-3 bg-linear-bg-tertiary rounded">
                  <span className="text-sm text-linear-text-secondary">Partner</span>
                  <span className="text-sm font-semibold text-linear-text-primary">
                    {customRates?.partnerRate != null ? (
                      `$${centsToDollars(customRates.partnerRate)}/hr`
                    ) : (
                      <span className="text-linear-text-muted italic">Default rate</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-linear-bg-tertiary rounded">
                  <span className="text-sm text-linear-text-secondary">Associate</span>
                  <span className="text-sm font-semibold text-linear-text-primary">
                    {customRates?.associateRate != null ? (
                      `$${centsToDollars(customRates.associateRate)}/hr`
                    ) : (
                      <span className="text-linear-text-muted italic">Default rate</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-linear-bg-tertiary rounded">
                  <span className="text-sm text-linear-text-secondary">Paralegal</span>
                  <span className="text-sm font-semibold text-linear-text-primary">
                    {customRates?.paralegalRate != null ? (
                      `$${centsToDollars(customRates.paralegalRate)}/hr`
                    ) : (
                      <span className="text-linear-text-muted italic">Default rate</span>
                    )}
                  </span>
                </div>
              </dd>
            </div>
          )}

          {/* Rate Source Info */}
          {billingType === 'Hourly' && customRates != null && (
            <div className="pt-3 border-t border-linear-border-subtle">
              <p className="text-xs text-linear-text-muted">
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
