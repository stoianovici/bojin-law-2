/**
 * Create Case Modal Component
 * Story 2.8: Case CRUD Operations UI - Tasks 6, 7, 8
 * Story 2.8.1: Billing & Rate Management - Task 11
 * Story 2.8.2: Case Approval Workflow - Task 12
 *
 * Modal dialog for creating new cases with form validation and billing setup
 */

'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as Dialog from '@radix-ui/react-dialog';
import type { CaseType, BillingType } from '@legal-platform/types';
import { useCaseCreate } from '../../hooks/useCaseCreate';
import { useDefaultRates } from '../../hooks/useDefaultRates';
import { useNotificationStore } from '../../stores/notificationStore';
import { FinancialData } from '../auth/FinancialData';
import { useAuth } from '../../contexts/AuthContext';

// Validation schema
const createCaseSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(500, 'Title must not exceed 500 characters'),
  clientId: z.string().uuid('Please select a valid client'),
  type: z.enum(['Litigation', 'Contract', 'Advisory', 'Criminal', 'Other'], {
    required_error: 'Please select a case type',
  }),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  value: z.number().positive('Value must be positive').optional().nullable(),
  billingType: z.enum(['Hourly', 'Fixed'], {
    required_error: 'Please select a billing type',
  }),
  fixedAmount: z.number().positive('Fixed amount must be positive').optional().nullable(),
  useCustomRates: z.boolean(),
  customPartnerRate: z.number().positive('Rate must be positive').optional().nullable(),
  customAssociateRate: z.number().positive('Rate must be positive').optional().nullable(),
  customParalegalRate: z.number().positive('Rate must be positive').optional().nullable(),
}).refine(
  (data) => {
    // If billing type is Fixed, fixedAmount is required
    if (data.billingType === 'Fixed') {
      return data.fixedAmount != null && data.fixedAmount > 0;
    }
    return true;
  },
  {
    message: 'Fixed amount is required when billing type is Fixed',
    path: ['fixedAmount'],
  }
);

type CreateCaseFormData = z.infer<typeof createCaseSchema>;

function centsToDollars(cents: number): number {
  return cents / 100;
}

function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

interface CreateCaseModalProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function CreateCaseModal({ trigger, onSuccess }: CreateCaseModalProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { createCase, loading } = useCaseCreate();
  const { rates: defaultRates } = useDefaultRates();
  const { addNotification } = useNotificationStore();

  // Story 2.8.2: Associates create cases with PendingApproval status
  const isAssociate = user?.role === 'Associate';

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    control,
  } = useForm<CreateCaseFormData>({
    resolver: zodResolver(createCaseSchema),
    defaultValues: {
      title: '',
      clientId: '',
      type: undefined,
      description: '',
      value: null,
      billingType: 'Hourly',
      fixedAmount: null,
      useCustomRates: false,
      customPartnerRate: null,
      customAssociateRate: null,
      customParalegalRate: null,
    },
  });

  // Watch billing type and custom rates toggle
  const billingType = useWatch({ control, name: 'billingType' });
  const useCustomRates = useWatch({ control, name: 'useCustomRates' });

  const handleClose = () => {
    if (isDirty && !confirm('You have unsaved changes. Are you sure you want to close?')) {
      return;
    }
    setOpen(false);
    reset();
  };

  const onSubmit = async (data: CreateCaseFormData) => {
    try {
      // Build custom rates object if enabled
      const customRates = data.useCustomRates && (
        data.customPartnerRate != null ||
        data.customAssociateRate != null ||
        data.customParalegalRate != null
      ) ? {
        partnerRate: data.customPartnerRate ? dollarsToCents(data.customPartnerRate) : undefined,
        associateRate: data.customAssociateRate ? dollarsToCents(data.customAssociateRate) : undefined,
        paralegalRate: data.customParalegalRate ? dollarsToCents(data.customParalegalRate) : undefined,
      } : undefined;

      // Story 2.8.2: Associates submit for approval, Partners create directly as Active
      const result = await createCase({
        title: data.title,
        clientId: data.clientId,
        type: data.type as CaseType,
        description: data.description,
        value: data.value ?? undefined,
        billingType: data.billingType as BillingType,
        fixedAmount: data.fixedAmount ? dollarsToCents(data.fixedAmount) : undefined,
        customRates,
        submitForApproval: isAssociate, // Associates submit for approval, Partners bypass
      });

      if (result.success) {
        // Story 2.8.2: Different success messages based on role
        if (isAssociate) {
          addNotification({
            type: 'success',
            title: 'Case Submitted for Approval',
            message: "Case submitted for approval. You'll be notified when it's reviewed.",
          });
        } else {
          addNotification({
            type: 'success',
            title: 'Case Created',
            message: `Case ${result.case?.caseNumber} has been created successfully.`,
          });
        }
        setOpen(false);
        reset();
        onSuccess?.();
      } else {
        addNotification({
          type: 'error',
          title: 'Failed to Create Case',
          message: result.error || 'An error occurred while creating the case.',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred. Please try again.',
      });
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {trigger || (
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium">
            + New Case
          </button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50" />

        <Dialog.Content
          className="fixed z-50 bg-white shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 overflow-y-auto
            inset-0 md:inset-auto
            md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2
            md:w-full md:max-w-2xl md:max-h-[90vh] md:rounded-lg
            data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
            md:data-[state=closed]:slide-out-to-left-1/2 md:data-[state=closed]:slide-out-to-top-[48%]
            md:data-[state=open]:slide-in-from-left-1/2 md:data-[state=open]:slide-in-from-top-[48%]"
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            handleClose();
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            handleClose();
          }}
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <Dialog.Title className="text-2xl font-bold text-gray-900">
                Create New Case
              </Dialog.Title>
              <Dialog.Close
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </Dialog.Close>
            </div>

            {/* Story 2.8.2: Approval Notice for Associates */}
            {isAssociate && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-start gap-3">
                  <svg
                    className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm text-blue-800">
                    This case will be submitted for Partner approval before becoming active.
                  </p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  {...register('title')}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.title ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter case title"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              {/* Client ID - Temporary UUID input until clients query is available */}
              <div>
                <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-1">
                  Client ID <span className="text-red-500">*</span>
                </label>
                <input
                  id="clientId"
                  type="text"
                  {...register('clientId')}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.clientId ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter client UUID (e.g., 123e4567-e89b-12d3-a456-426614174000)"
                />
                {errors.clientId && (
                  <p className="mt-1 text-sm text-red-600">{errors.clientId.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Note: Client dropdown will be added when clients query API is available
                </p>
              </div>

              {/* Case Type */}
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                  Case Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="type"
                  {...register('type')}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.type ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select case type</option>
                  <option value="Litigation">Litigation</option>
                  <option value="Contract">Contract</option>
                  <option value="Advisory">Advisory</option>
                  <option value="Criminal">Criminal</option>
                  <option value="Other">Other</option>
                </select>
                {errors.type && <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>}
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  {...register('description')}
                  rows={4}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.description ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter case description (minimum 10 characters)"
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              {/* Value (Partners only - Story 2.8.3) */}
              <FinancialData>
                <div>
                  <label htmlFor="value" className="block text-sm font-medium text-gray-700 mb-1">
                    Case Value (Optional)
                  </label>
                  <input
                    id="value"
                    type="number"
                    step="0.01"
                    {...register('value', { valueAsNumber: true })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.value ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter monetary value"
                  />
                  {errors.value && (
                    <p className="mt-1 text-sm text-red-600">{errors.value.message}</p>
                  )}
                </div>
              </FinancialData>

              {/* Billing Section (Partners only - Story 2.8.1) */}
              <FinancialData>
                <div className="border-t border-gray-200 pt-6 space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Billing Information</h3>

                  {/* Billing Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Billing Type <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="Hourly"
                          {...register('billingType')}
                          className="mr-2"
                        />
                        <span className="text-sm">Hourly Billing</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="Fixed"
                          {...register('billingType')}
                          className="mr-2"
                        />
                        <span className="text-sm">Fixed Fee</span>
                      </label>
                    </div>
                    {errors.billingType && (
                      <p className="mt-1 text-sm text-red-600">{errors.billingType.message}</p>
                    )}
                  </div>

                  {/* Fixed Amount (shown when Fixed billing type selected) */}
                  {billingType === 'Fixed' && (
                    <div>
                      <label htmlFor="fixedAmount" className="block text-sm font-medium text-gray-700 mb-1">
                        Fixed Amount <span className="text-red-500">*</span>
                      </label>
                      <div className="relative mt-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          id="fixedAmount"
                          step="0.01"
                          min="0"
                          {...register('fixedAmount', { valueAsNumber: true })}
                          className={`block w-full rounded-md border-gray-300 pl-7 pr-3 focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                            errors.fixedAmount ? 'border-red-300' : ''
                          }`}
                          placeholder="0.00"
                        />
                      </div>
                      {errors.fixedAmount && (
                        <p className="mt-1 text-sm text-red-600">{errors.fixedAmount.message}</p>
                      )}
                    </div>
                  )}

                  {/* Default Rates Preview (shown when Hourly billing type selected) */}
                  {billingType === 'Hourly' && !useCustomRates && defaultRates && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                      <p className="text-sm font-medium text-blue-900 mb-2">Default Hourly Rates:</p>
                      <div className="text-sm text-blue-800 space-y-1">
                        <div>Partner: ${centsToDollars(defaultRates.partnerRate).toFixed(2)}/hr</div>
                        <div>Associate: ${centsToDollars(defaultRates.associateRate).toFixed(2)}/hr</div>
                        <div>Paralegal: ${centsToDollars(defaultRates.paralegalRate).toFixed(2)}/hr</div>
                      </div>
                    </div>
                  )}

                  {/* Custom Rates Toggle */}
                  {billingType === 'Hourly' && (
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          {...register('useCustomRates')}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Use custom rates for this case</span>
                      </label>
                    </div>
                  )}

                  {/* Custom Rates Inputs */}
                  {billingType === 'Hourly' && useCustomRates && (
                    <div className="space-y-3 pl-4 border-l-2 border-gray-200">
                      <div>
                        <label htmlFor="customPartnerRate" className="block text-sm font-medium text-gray-700 mb-1">
                          Partner Rate
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <span className="text-gray-500 sm:text-sm">$</span>
                          </div>
                          <input
                            type="number"
                            id="customPartnerRate"
                            step="0.01"
                            min="0"
                            {...register('customPartnerRate', { valueAsNumber: true })}
                            className="block w-full rounded-md border-gray-300 pl-7 pr-12 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            placeholder={defaultRates ? centsToDollars(defaultRates.partnerRate).toFixed(2) : '0.00'}
                          />
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <span className="text-gray-500 sm:text-sm">/hr</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="customAssociateRate" className="block text-sm font-medium text-gray-700 mb-1">
                          Associate Rate
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <span className="text-gray-500 sm:text-sm">$</span>
                          </div>
                          <input
                            type="number"
                            id="customAssociateRate"
                            step="0.01"
                            min="0"
                            {...register('customAssociateRate', { valueAsNumber: true })}
                            className="block w-full rounded-md border-gray-300 pl-7 pr-12 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            placeholder={defaultRates ? centsToDollars(defaultRates.associateRate).toFixed(2) : '0.00'}
                          />
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <span className="text-gray-500 sm:text-sm">/hr</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="customParalegalRate" className="block text-sm font-medium text-gray-700 mb-1">
                          Paralegal Rate
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <span className="text-gray-500 sm:text-sm">$</span>
                          </div>
                          <input
                            type="number"
                            id="customParalegalRate"
                            step="0.01"
                            min="0"
                            {...register('customParalegalRate', { valueAsNumber: true })}
                            className="block w-full rounded-md border-gray-300 pl-7 pr-12 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            placeholder={defaultRates ? centsToDollars(defaultRates.paralegalRate).toFixed(2) : '0.00'}
                          />
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <span className="text-gray-500 sm:text-sm">/hr</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </FinancialData>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading && (
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  )}
                  {loading ? 'Creating...' : 'Create Case'}
                </button>
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
