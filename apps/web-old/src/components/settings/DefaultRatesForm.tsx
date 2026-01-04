/**
 * Default Rates Form Component
 * Story 2.8.1: Billing & Rate Management - Task 9
 *
 * Form for Partners to set default hourly rates for their firm.
 * Uses React Hook Form with Zod validation.
 */

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUpdateDefaultRates } from '@/hooks/useDefaultRates';
import { useNotificationStore } from '@/stores/notificationStore';

// Validation schema
const defaultRatesSchema = z.object({
  partnerRate: z
    .number({
      required_error: 'Partner rate is required',
      invalid_type_error: 'Partner rate must be a number',
    })
    .positive('Partner rate must be greater than 0')
    .multipleOf(0.01, 'Partner rate must have at most 2 decimal places'),
  associateRate: z
    .number({
      required_error: 'Associate rate is required',
      invalid_type_error: 'Associate rate must be a number',
    })
    .positive('Associate rate must be greater than 0')
    .multipleOf(0.01, 'Associate rate must have at most 2 decimal places'),
  paralegalRate: z
    .number({
      required_error: 'Paralegal rate is required',
      invalid_type_error: 'Paralegal rate must be a number',
    })
    .positive('Paralegal rate must be greater than 0')
    .multipleOf(0.01, 'Paralegal rate must have at most 2 decimal places'),
});

type DefaultRatesFormData = z.infer<typeof defaultRatesSchema>;

interface DefaultRatesFormProps {
  initialRates: {
    partnerRate: number;
    associateRate: number;
    paralegalRate: number;
  } | null;
}

/**
 * Converts cents to dollars for display
 * @param cents Amount in cents
 * @returns Amount in dollars
 */
function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Converts dollars to cents for storage
 * @param dollars Amount in dollars
 * @returns Amount in cents (rounded to nearest cent)
 */
function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function DefaultRatesForm({ initialRates }: DefaultRatesFormProps) {
  const { updateDefaultRates, loading } = useUpdateDefaultRates();
  const { addNotification } = useNotificationStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<DefaultRatesFormData>({
    resolver: zodResolver(defaultRatesSchema),
    defaultValues: initialRates
      ? {
          partnerRate: centsToDollars(initialRates.partnerRate),
          associateRate: centsToDollars(initialRates.associateRate),
          paralegalRate: centsToDollars(initialRates.paralegalRate),
        }
      : {
          partnerRate: undefined,
          associateRate: undefined,
          paralegalRate: undefined,
        },
  });

  const onSubmit = async (data: DefaultRatesFormData) => {
    try {
      // Convert dollars to cents before sending to API
      const result = await updateDefaultRates({
        partnerRate: dollarsToCents(data.partnerRate),
        associateRate: dollarsToCents(data.associateRate),
        paralegalRate: dollarsToCents(data.paralegalRate),
      });

      if (result.success) {
        addNotification({
          type: 'success',
          title: 'Rates Updated',
          message: 'Default billing rates have been saved successfully.',
        });

        // Update form with new values (converted back to dollars)
        if (result.rates) {
          reset({
            partnerRate: centsToDollars(result.rates.partnerRate),
            associateRate: centsToDollars(result.rates.associateRate),
            paralegalRate: centsToDollars(result.rates.paralegalRate),
          });
        }
      } else {
        addNotification({
          type: 'error',
          title: 'Failed to Update Rates',
          message: result.error || 'An error occurred while saving the rates.',
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Partner Rate */}
      <div>
        <label htmlFor="partnerRate" className="block text-sm font-medium text-gray-700 mb-1">
          Partner Rate
        </label>
        <div className="relative mt-1 rounded-md shadow-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-gray-500 sm:text-sm">€</span>
          </div>
          <input
            type="number"
            id="partnerRate"
            step="0.01"
            min="0"
            {...register('partnerRate', { valueAsNumber: true })}
            className={`block w-full rounded-md border-gray-300 pl-7 pr-12 focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
              errors.partnerRate
                ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
                : ''
            }`}
            placeholder="500.00"
            aria-invalid={errors.partnerRate ? 'true' : 'false'}
            aria-describedby={errors.partnerRate ? 'partnerRate-error' : undefined}
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="text-gray-500 sm:text-sm">/hr</span>
          </div>
        </div>
        {errors.partnerRate && (
          <p className="mt-1 text-sm text-red-600" id="partnerRate-error">
            {errors.partnerRate.message}
          </p>
        )}
      </div>

      {/* Associate Rate */}
      <div>
        <label htmlFor="associateRate" className="block text-sm font-medium text-gray-700 mb-1">
          Associate Rate
        </label>
        <div className="relative mt-1 rounded-md shadow-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-gray-500 sm:text-sm">€</span>
          </div>
          <input
            type="number"
            id="associateRate"
            step="0.01"
            min="0"
            {...register('associateRate', { valueAsNumber: true })}
            className={`block w-full rounded-md border-gray-300 pl-7 pr-12 focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
              errors.associateRate
                ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
                : ''
            }`}
            placeholder="300.00"
            aria-invalid={errors.associateRate ? 'true' : 'false'}
            aria-describedby={errors.associateRate ? 'associateRate-error' : undefined}
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="text-gray-500 sm:text-sm">/hr</span>
          </div>
        </div>
        {errors.associateRate && (
          <p className="mt-1 text-sm text-red-600" id="associateRate-error">
            {errors.associateRate.message}
          </p>
        )}
      </div>

      {/* Paralegal Rate */}
      <div>
        <label htmlFor="paralegalRate" className="block text-sm font-medium text-gray-700 mb-1">
          Paralegal Rate
        </label>
        <div className="relative mt-1 rounded-md shadow-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-gray-500 sm:text-sm">€</span>
          </div>
          <input
            type="number"
            id="paralegalRate"
            step="0.01"
            min="0"
            {...register('paralegalRate', { valueAsNumber: true })}
            className={`block w-full rounded-md border-gray-300 pl-7 pr-12 focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
              errors.paralegalRate
                ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
                : ''
            }`}
            placeholder="150.00"
            aria-invalid={errors.paralegalRate ? 'true' : 'false'}
            aria-describedby={errors.paralegalRate ? 'paralegalRate-error' : undefined}
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="text-gray-500 sm:text-sm">/hr</span>
          </div>
        </div>
        {errors.paralegalRate && (
          <p className="mt-1 text-sm text-red-600" id="paralegalRate-error">
            {errors.paralegalRate.message}
          </p>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-500">
          {isDirty ? 'You have unsaved changes' : 'No changes'}
        </p>
        <button
          type="submit"
          disabled={!isDirty || loading}
          className={`px-6 py-2 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
            !isDirty || loading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {loading ? (
            <span className="flex items-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
              Saving...
            </span>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </form>
  );
}
