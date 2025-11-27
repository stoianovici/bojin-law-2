/**
 * Edit Rates Modal Component
 * Story 2.8.1: Billing & Rate Management - Task 13
 *
 * Modal for editing billing type, fixed amount, and hourly rates.
 * Partners only - wrapped in FinancialData for access control.
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { BillingType, CustomRates } from '@legal-platform/types';
import { useCaseUpdate } from '@/hooks/useCaseUpdate';
import { useDefaultRates } from '@/hooks/useDefaultRates';
import { useNotificationStore } from '@/stores/notificationStore';

interface EditRatesModalProps {
  caseId: string;
  isOpen: boolean;
  onClose: () => void;
  currentBillingType: BillingType;
  currentFixedAmount: number | null;
  currentCustomRates: CustomRates | null;
}

/**
 * Form validation schema
 */
const editRatesSchema = z
  .object({
    billingType: z.enum(['Hourly', 'Fixed'] as const),
    fixedAmount: z.string().optional(),
    useCustomRates: z.boolean(),
    partnerRate: z.string().optional(),
    associateRate: z.string().optional(),
    paralegalRate: z.string().optional(),
  })
  .refine(
    (data) => {
      // If Fixed billing, fixedAmount is required
      if (data.billingType === 'Fixed') {
        return data.fixedAmount && data.fixedAmount.trim() !== '';
      }
      return true;
    },
    {
      message: 'Fixed amount is required when billing type is Fixed',
      path: ['fixedAmount'],
    }
  )
  .refine(
    (data) => {
      // If custom rates enabled, at least one rate must be provided
      if (data.useCustomRates) {
        return (
          (data.partnerRate && data.partnerRate.trim() !== '') ||
          (data.associateRate && data.associateRate.trim() !== '') ||
          (data.paralegalRate && data.paralegalRate.trim() !== '')
        );
      }
      return true;
    },
    {
      message: 'At least one custom rate must be provided',
      path: ['partnerRate'],
    }
  );

type EditRatesFormData = z.infer<typeof editRatesSchema>;

/**
 * Converts cents to dollars for display
 */
function centsToDollars(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}

/**
 * Converts dollars to cents for API
 */
function dollarsToCents(dollars: string): number | null {
  const trimmed = dollars.trim();
  if (!trimmed) return null;
  const parsed = parseFloat(trimmed);
  if (isNaN(parsed)) return null;
  return Math.round(parsed * 100);
}

/**
 * Confirmation Dialog for Billing Type Change
 */
function ConfirmationDialog({
  isOpen,
  onConfirm,
  onCancel,
  fromType,
  toType,
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  fromType: BillingType;
  toType: BillingType;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Billing Type Change</h3>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to change billing type from <strong>{fromType}</strong> to{' '}
          <strong>{toType}</strong>? This will affect how revenue is calculated for this case.
        </p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Confirm Change
          </button>
        </div>
      </div>
    </div>
  );
}

export function EditRatesModal({
  caseId,
  isOpen,
  onClose,
  currentBillingType,
  currentFixedAmount,
  currentCustomRates,
}: EditRatesModalProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingBillingType, setPendingBillingType] = useState<BillingType | null>(null);

  const { updateCase, loading: updateLoading } = useCaseUpdate();
  const { rates: defaultRates, loading: defaultRatesLoading } = useDefaultRates();
  const { addNotification } = useNotificationStore();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditRatesFormData>({
    resolver: zodResolver(editRatesSchema),
    defaultValues: {
      billingType: currentBillingType,
      fixedAmount: centsToDollars(currentFixedAmount),
      useCustomRates: currentCustomRates != null,
      partnerRate: centsToDollars(currentCustomRates?.partnerRate),
      associateRate: centsToDollars(currentCustomRates?.associateRate),
      paralegalRate: centsToDollars(currentCustomRates?.paralegalRate),
    },
  });

  const billingType = watch('billingType');
  const useCustomRates = watch('useCustomRates');

  // Reset form when modal opens/closes or current values change
  useEffect(() => {
    if (isOpen) {
      reset({
        billingType: currentBillingType,
        fixedAmount: centsToDollars(currentFixedAmount),
        useCustomRates: currentCustomRates != null,
        partnerRate: centsToDollars(currentCustomRates?.partnerRate),
        associateRate: centsToDollars(currentCustomRates?.associateRate),
        paralegalRate: centsToDollars(currentCustomRates?.paralegalRate),
      });
    }
  }, [isOpen, currentBillingType, currentFixedAmount, currentCustomRates, reset]);

  /**
   * Handle billing type change with confirmation
   */
  const handleBillingTypeChange = (newType: BillingType) => {
    if (newType !== currentBillingType) {
      setPendingBillingType(newType);
      setShowConfirmation(true);
    } else {
      setValue('billingType', newType);
    }
  };

  /**
   * Confirm billing type change
   */
  const confirmBillingTypeChange = () => {
    if (pendingBillingType) {
      setValue('billingType', pendingBillingType, { shouldDirty: true });
      setPendingBillingType(null);
    }
    setShowConfirmation(false);
  };

  /**
   * Cancel billing type change
   */
  const cancelBillingTypeChange = () => {
    setPendingBillingType(null);
    setShowConfirmation(false);
  };

  /**
   * Revert to default rates
   */
  const revertToDefaults = () => {
    setValue('useCustomRates', false, { shouldDirty: true });
    setValue('partnerRate', '');
    setValue('associateRate', '');
    setValue('paralegalRate', '');
  };

  /**
   * Submit form
   */
  const onSubmit = async (data: EditRatesFormData) => {
    try {
      // Build custom rates object (null if not using custom rates)
      const customRates: CustomRates | null = data.useCustomRates
        ? {
            partnerRate: dollarsToCents(data.partnerRate || '') ?? undefined,
            associateRate: dollarsToCents(data.associateRate || '') ?? undefined,
            paralegalRate: dollarsToCents(data.paralegalRate || '') ?? undefined,
          }
        : null;

      // Update case
      await updateCase(caseId, {
        billingType: data.billingType,
        fixedAmount: dollarsToCents(data.fixedAmount || ''),
        customRates,
      });

      addNotification({
        type: 'success',
        title: 'Rates Updated',
        message: 'Billing information has been successfully updated.',
      });

      onClose();
    } catch (error: any) {
      console.error('Error updating rates:', error);
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: error.message || 'Failed to update rates. Please try again.',
      });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40" onClick={onClose}>
        {/* Modal Content */}
        <div
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Edit Billing Rates</h2>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4 space-y-6">
            {/* Billing Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Billing Type</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="Hourly"
                    checked={billingType === 'Hourly'}
                    onChange={(e) => handleBillingTypeChange(e.target.value as BillingType)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Hourly Billing</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="Fixed"
                    checked={billingType === 'Fixed'}
                    onChange={(e) => handleBillingTypeChange(e.target.value as BillingType)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Fixed Fee</span>
                </label>
              </div>
            </div>

            {/* Fixed Amount (if Fixed billing) */}
            {billingType === 'Fixed' && (
              <div>
                <label htmlFor="fixedAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Fixed Amount ($) <span className="text-red-500">*</span>
                </label>
                <input
                  id="fixedAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('fixedAmount')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
                {errors.fixedAmount && (
                  <p className="mt-1 text-sm text-red-600">{errors.fixedAmount.message}</p>
                )}
              </div>
            )}

            {/* Custom Rates Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">Hourly Rates</label>
                <button
                  type="button"
                  onClick={revertToDefaults}
                  disabled={!useCustomRates}
                  className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  Revert to Default Rates
                </button>
              </div>

              {/* Use Custom Rates Toggle */}
              <label className="flex items-center mb-4">
                <input
                  type="checkbox"
                  {...register('useCustomRates')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Use custom rates for this case</span>
              </label>

              {/* Rate Inputs */}
              <div className="space-y-4">
                {/* Partner Rate */}
                <div className="flex items-center space-x-4">
                  <label className="w-24 text-sm text-gray-700">Partner</label>
                  <div className="flex-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('partnerRate')}
                      disabled={!useCustomRates}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder={
                        defaultRates && !defaultRatesLoading
                          ? `Default: $${centsToDollars(defaultRates.partnerRate)}/hr`
                          : 'Enter rate'
                      }
                    />
                  </div>
                  <span className="text-sm text-gray-500">/hr</span>
                  {defaultRates && useCustomRates && (
                    <span className="text-xs text-gray-400 w-32">
                      Default: ${centsToDollars(defaultRates.partnerRate)}
                    </span>
                  )}
                </div>

                {/* Associate Rate */}
                <div className="flex items-center space-x-4">
                  <label className="w-24 text-sm text-gray-700">Associate</label>
                  <div className="flex-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('associateRate')}
                      disabled={!useCustomRates}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder={
                        defaultRates && !defaultRatesLoading
                          ? `Default: $${centsToDollars(defaultRates.associateRate)}/hr`
                          : 'Enter rate'
                      }
                    />
                  </div>
                  <span className="text-sm text-gray-500">/hr</span>
                  {defaultRates && useCustomRates && (
                    <span className="text-xs text-gray-400 w-32">
                      Default: ${centsToDollars(defaultRates.associateRate)}
                    </span>
                  )}
                </div>

                {/* Paralegal Rate */}
                <div className="flex items-center space-x-4">
                  <label className="w-24 text-sm text-gray-700">Paralegal</label>
                  <div className="flex-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('paralegalRate')}
                      disabled={!useCustomRates}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder={
                        defaultRates && !defaultRatesLoading
                          ? `Default: $${centsToDollars(defaultRates.paralegalRate)}/hr`
                          : 'Enter rate'
                      }
                    />
                  </div>
                  <span className="text-sm text-gray-500">/hr</span>
                  {defaultRates && useCustomRates && (
                    <span className="text-xs text-gray-400 w-32">
                      Default: ${centsToDollars(defaultRates.paralegalRate)}
                    </span>
                  )}
                </div>

                {errors.partnerRate && (
                  <p className="text-sm text-red-600">{errors.partnerRate.message}</p>
                )}
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={updateLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit(onSubmit)}
              disabled={updateLoading || !isDirty}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updateLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmation}
        onConfirm={confirmBillingTypeChange}
        onCancel={cancelBillingTypeChange}
        fromType={currentBillingType}
        toType={pendingBillingType || currentBillingType}
      />
    </>
  );
}
