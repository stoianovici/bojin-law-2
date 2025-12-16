/**
 * Textarea Component
 *
 * A multiline text input component with validation states.
 * Fully supports Romanian diacritics (ă, â, î, ș, ț).
 *
 * @example
 * ```tsx
 * <Textarea
 *   label="Descriere"
 *   placeholder="Introduceți descrierea..."
 *   rows={4}
 *   required
 * />
 *
 * <Textarea
 *   label="Comentarii"
 *   validationState="error"
 *   errorMessage="Comentariul este prea scurt"
 * />
 * ```
 */

import { forwardRef, useId } from 'react';
import { clsx } from 'clsx';
import { TextareaProps } from '@legal-platform/types';

/**
 * Textarea component with validation states and accessibility features
 *
 * @param label - Label text for the textarea
 * @param validationState - Validation state (default, error, success, warning)
 * @param errorMessage - Error message to display
 * @param successMessage - Success message to display
 * @param warningMessage - Warning message to display
 * @param helperText - Helper text to display
 * @param required - Whether the textarea is required
 * @param rows - Number of rows
 * @param className - Additional CSS classes
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      validationState = 'default',
      errorMessage,
      successMessage,
      warningMessage,
      helperText,
      required = false,
      rows = 4,
      className,
      id,
      ...props
    },
    ref
  ) => {
    // Generate unique ID if not provided
    const generatedId = useId();
    const textareaId = id || generatedId;
    const helperId = `${textareaId}-helper`;

    // Determine which message to show
    const message =
      validationState === 'error'
        ? errorMessage
        : validationState === 'success'
          ? successMessage
          : validationState === 'warning'
            ? warningMessage
            : helperText;

    // Base textarea styles
    const textareaBaseStyles =
      'w-full rounded-lg border bg-white px-3 py-2 font-sans text-base transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 resize-vertical';

    // Validation state styles
    const stateStyles = {
      default: 'border-neutral-300 focus:border-primary-500 focus:ring-primary-500',
      error: 'border-error-500 focus:border-error-500 focus:ring-error-500',
      success: 'border-success-500 focus:border-success-500 focus:ring-success-500',
      warning: 'border-warning-500 focus:border-warning-500 focus:ring-warning-500',
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
          <label htmlFor={textareaId} className="mb-1 block text-sm font-medium text-neutral-700">
            {label}
            {required && (
              <span className="ml-1 text-error-500" aria-label="required">
                *
              </span>
            )}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={clsx(textareaBaseStyles, stateStyles[validationState ?? 'default'])}
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

Textarea.displayName = 'Textarea';
