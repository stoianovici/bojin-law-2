/**
 * ActionConfirmCard Component
 * OPS-071: AssistantPill Components
 * OPS-097: AI Task Creation with Editable Duration Card
 *
 * Displays a proposed action from the AI assistant with confirm/reject buttons.
 * Supports editable fields with validation and quick selection chips.
 * Uses the Card component from the UI package.
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { CheckIcon, Cross2Icon, ClockIcon } from '@radix-ui/react-icons';
import { Card } from '@legal-platform/ui';
import { clsx } from 'clsx';
import type { EditableField, QuickOption } from '../../stores/assistant.store';

// ============================================================================
// Types
// ============================================================================

export interface ActionConfirmCardProps {
  action: {
    type: string;
    displayText: string;
    confirmationPrompt?: string;
    entityPreview?: Record<string, unknown>;
    editableFields?: EditableField[];
  };
  onConfirm: (modifications?: Record<string, unknown>) => void;
  onReject: () => void;
  isLoading: boolean;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface EditableFieldInputProps {
  field: EditableField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}

/**
 * Renders an editable field with quick options and input
 */
function EditableFieldInput({ field, value, onChange }: EditableFieldInputProps) {
  const handleQuickOptionClick = useCallback(
    (optionValue: string | number) => {
      onChange(field.key, optionValue);
    },
    [field.key, onChange]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue =
        field.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value;
      onChange(field.key, inputValue);
    },
    [field.key, field.type, onChange]
  );

  const isEmpty = value === undefined || value === null || value === '';

  return (
    <div className="bg-white rounded-lg p-3 border border-gray-200">
      <div className="flex items-center gap-2 mb-2">
        <ClockIcon className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </span>
      </div>

      {/* Quick options chips */}
      {field.quickOptions && field.quickOptions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {field.quickOptions.map((option: QuickOption) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => handleQuickOptionClick(option.value)}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-full transition-colors',
                value === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* Manual input */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">sau:</span>
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={handleInputChange}
          placeholder={field.placeholder || ''}
          min={field.type === 'number' ? 0 : undefined}
          step={field.type === 'number' ? 0.5 : undefined}
          className={clsx(
            'flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20',
            isEmpty && field.required ? 'border-gray-200' : 'border-gray-200'
          )}
        />
        {field.type === 'number' && <span className="text-sm text-gray-500">ore</span>}
      </div>

      {/* Suggestion text */}
      {field.suggestion && (
        <p className="mt-2 text-xs text-gray-500 italic">Sugestie: {field.suggestion}</p>
      )}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * Action confirmation card with preview, editable fields, and buttons
 */
export function ActionConfirmCard({
  action,
  onConfirm,
  onReject,
  isLoading,
}: ActionConfirmCardProps) {
  // State for editable field values
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    if (action.editableFields) {
      action.editableFields.forEach((field) => {
        if (field.defaultValue !== undefined) {
          initial[field.key] = field.defaultValue;
        }
      });
    }
    return initial;
  });

  // Handle field value changes
  const handleFieldChange = useCallback((key: string, value: unknown) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Check if all required fields are filled
  const allRequiredFieldsFilled = useMemo(() => {
    if (!action.editableFields) return true;
    return action.editableFields
      .filter((field) => field.required)
      .every((field) => {
        const value = fieldValues[field.key];
        return value !== undefined && value !== null && value !== '';
      });
  }, [action.editableFields, fieldValues]);

  // Handle confirm with modifications
  const handleConfirm = useCallback(() => {
    if (!allRequiredFieldsFilled) return;

    // Only pass modifications if there are editable fields with values
    const hasModifications = Object.keys(fieldValues).length > 0;
    onConfirm(hasModifications ? fieldValues : undefined);
  }, [allRequiredFieldsFilled, fieldValues, onConfirm]);

  return (
    <Card
      data-testid="action-confirm-card"
      className="mb-4 border-primary/20 bg-primary/5"
      footer={
        <div className="flex gap-2">
          <button
            onClick={onReject}
            disabled={isLoading}
            data-testid="action-reject"
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Cross2Icon className="h-4 w-4" />
            <span>Anulează</span>
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || !allRequiredFieldsFilled}
            data-testid="action-confirm"
            className={clsx(
              'flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors disabled:opacity-50',
              allRequiredFieldsFilled
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            )}
          >
            <CheckIcon className="h-4 w-4" />
            <span>Confirmă</span>
          </button>
        </div>
      }
    >
      {/* Body content */}
      <p className="text-sm font-medium text-gray-900 mb-2">
        {action.confirmationPrompt || 'Confirmați această acțiune?'}
      </p>

      {/* Entity preview */}
      {action.entityPreview && (
        <div className="bg-white rounded-lg p-3 text-sm space-y-1 mb-3">
          {Object.entries(action.entityPreview).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <span className="text-gray-500">{key}:</span>
              <span className="font-medium">{String(value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Editable fields */}
      {action.editableFields && action.editableFields.length > 0 && (
        <div className="space-y-3">
          {action.editableFields.map((field) => (
            <EditableFieldInput
              key={field.key}
              field={field}
              value={fieldValues[field.key]}
              onChange={handleFieldChange}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

ActionConfirmCard.displayName = 'ActionConfirmCard';
