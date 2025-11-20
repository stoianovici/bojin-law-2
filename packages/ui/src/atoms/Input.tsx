/**
 * Input Component
 *
 * A form input component with validation states and labels.
 * Fully supports Romanian diacritics (ă, â, î, ș, ț) in all text inputs.
 *
 * @example
 * ```tsx
 * <Input
 *   type="text"
 *   label="Nume complet"
 *   placeholder="Introduceți numele dvs."
 *   required
 * />
 *
 * <Input
 *   type="email"
 *   label="Email"
 *   validationState="error"
 *   errorMessage="Adresa de email este invalidă"
 * />
 *
 * <Input
 *   type="text"
 *   label="Oraș"
 *   validationState="success"
 *   successMessage="Orașul a fost validat"
 * />
 * ```
 */

import { forwardRef, useId } from 'react';
import { clsx } from 'clsx';
import { InputProps } from '@legal-platform/types';

/**
 * Input component with validation states and accessibility features
 *
 * @param type - Input type (text, email, password, etc.)
 * @param label - Label text for the input
 * @param validationState - Validation state (default, error, success, warning)
 * @param errorMessage - Error message to display
 * @param successMessage - Success message to display
 * @param warningMessage - Warning message to display
 * @param helperText - Helper text to display
 * @param required - Whether the input is required
 * @param size - Size of the input (sm, md, lg)
 * @param className - Additional CSS classes
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      type = 'text',
      label,
      validationState = 'default',
      errorMessage,
      successMessage,
      warningMessage,
      helperText,
      required = false,
      size = 'md',
      className,
      id,
      ...props
    },
    ref
  ) => {
    // Generate unique ID if not provided
    const generatedId = useId();
    const inputId = id || generatedId;
    const helperId = `${inputId}-helper`;

    // Determine which message to show
    const message =
      validationState === 'error'
        ? errorMessage
        : validationState === 'success'
        ? successMessage
        : validationState === 'warning'
        ? warningMessage
        : helperText;

    // Base input styles
    const inputBaseStyles =
      'w-full rounded-lg border bg-white px-3 font-sans transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';

    // Size-specific styles
    const sizeStyles = {
      sm: 'h-8 text-sm',
      md: 'h-10 text-base',
      lg: 'h-12 text-lg',
    };

    // Validation state styles
    const stateStyles = {
      default:
        'border-neutral-300 focus:border-primary-500 focus:ring-primary-500',
      error: 'border-error-500 focus:border-error-500 focus:ring-error-500',
      success:
        'border-success-500 focus:border-success-500 focus:ring-success-500',
      warning:
        'border-warning-500 focus:border-warning-500 focus:ring-warning-500',
    };

    // Message color styles
    const messageStyles = {
      default: 'text-neutral-600',
      error: 'text-error-700',
      success: 'text-success-700',
      warning: 'text-warning-700',
    };

    return (
      <div className={clsx('w-full', className)}>
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1 block text-sm font-medium text-neutral-700"
          >
            {label}
            {required && (
              <span className="ml-1 text-error-500" aria-label="required">
                *
              </span>
            )}
          </label>
        )}
        <input
          ref={ref}
          type={type}
          id={inputId}
          className={clsx(
            inputBaseStyles,
            sizeStyles[size ?? 'md'],
            stateStyles[validationState ?? 'default']
          )}
          aria-required={required}
          aria-invalid={validationState === 'error'}
          aria-describedby={message ? helperId : undefined}
          {...props}
        />
        {message && (
          <p
            id={helperId}
            className={clsx('mt-1 text-sm', messageStyles[validationState ?? 'default'])}
            role={validationState === 'error' ? 'alert' : 'status'}
          >
            {message}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
