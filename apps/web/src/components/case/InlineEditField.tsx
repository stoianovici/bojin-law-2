/**
 * Inline Edit Field Component
 * Story 2.8: Case CRUD Operations UI - Task 11
 *
 * Reusable component for inline editing of case fields
 * Features: Click to edit, ESC to cancel, Enter to save, optimistic updates
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Pencil1Icon, CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { useCaseUpdate, type UpdateCaseInput } from '../../hooks/useCaseUpdate';
import { useNotificationStore } from '../../stores/notificationStore';

export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'date';

export interface InlineEditFieldProps {
  caseId: string;
  fieldName: keyof UpdateCaseInput;
  value: string | number | null | undefined;
  label: string;
  fieldType?: FieldType;
  editable?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>; // For select fields
  validate?: (value: string | number) => string | null; // Returns error message or null
  onSuccess?: () => void;
  formatDisplay?: (value: string | number | null | undefined) => React.ReactNode;
}

/**
 * InlineEditField Component
 *
 * Allows inline editing of case fields with optimistic updates
 */
export function InlineEditField({
  caseId,
  fieldName,
  value,
  label,
  fieldType = 'text',
  editable = true,
  placeholder = 'Click to edit',
  options,
  validate,
  onSuccess,
  formatDisplay,
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  const { updateCase, loading } = useCaseUpdate();
  const { addNotification } = useNotificationStore();

  // Convert value to string for editing
  const displayValue = value !== null && value !== undefined ? String(value) : '';

  // Start edit mode
  const handleEdit = () => {
    if (!editable) return;
    setEditValue(displayValue);
    setIsEditing(true);
    setValidationError(null);
  };

  // Cancel editing
  const handleCancel = () => {
    setIsEditing(false);
    setEditValue('');
    setValidationError(null);
  };

  // Save changes
  const handleSave = async () => {
    // Validate if validator provided
    if (validate) {
      const error = validate(editValue);
      if (error) {
        setValidationError(error);
        return;
      }
    }

    // Don't save if value hasn't changed
    if (editValue === displayValue) {
      handleCancel();
      return;
    }

    try {
      // Convert value to appropriate type
      let valueToSave: string | number | Date | null = editValue;

      if (fieldType === 'number') {
        valueToSave = editValue === '' ? null : parseFloat(editValue);
      } else if (fieldType === 'date') {
        valueToSave = editValue ? new Date(editValue) : null;
      }

      // Create update input
      const input: UpdateCaseInput = {
        [fieldName]: valueToSave,
      };

      // Call mutation
      await updateCase(caseId, input);

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Success',
        message: `${label} updated successfully`,
      });

      // Exit edit mode
      setIsEditing(false);
      setEditValue('');

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      // Show error notification
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update field';
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: `Failed to update ${label.toLowerCase()}: ${errorMessage}`,
      });

      // Keep in edit mode so user can retry
      setValidationError('Update failed. Please try again.');
    }
  };

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && fieldType !== 'textarea') {
      e.preventDefault();
      handleSave();
    }
  };

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (
        (fieldType === 'text' || fieldType === 'textarea') &&
        'select' in inputRef.current
      ) {
        inputRef.current.select();
      }
    }
  }, [isEditing, fieldType]);

  // Render edit mode
  if (isEditing) {
    return (
      <div className="py-3 border-b border-gray-200 last:border-0">
        <dt className="text-sm font-medium text-gray-500 mb-1">{label}</dt>
        <dd className="flex items-start gap-2">
          <div className="flex-1">
            {fieldType === 'textarea' ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 resize-none"
                rows={3}
                disabled={loading}
              />
            ) : fieldType === 'select' && options ? (
              <select
                ref={inputRef as React.RefObject<HTMLSelectElement>}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                disabled={loading}
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                disabled={loading}
                step={fieldType === 'number' ? 'any' : undefined}
              />
            )}
            {validationError && (
              <p className="mt-1 text-sm text-red-600">{validationError}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Press Enter to save, ESC to cancel
            </p>
          </div>
          <div className="flex gap-1 pt-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
              title="Save"
              type="button"
            >
              <CheckIcon className="h-4 w-4" />
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
              title="Cancel"
              type="button"
            >
              <Cross2Icon className="h-4 w-4" />
            </button>
          </div>
        </dd>
      </div>
    );
  }

  // Render display mode
  const displayContent = formatDisplay
    ? formatDisplay(value)
    : value !== null && value !== undefined
      ? String(value)
      : placeholder;

  return (
    <div
      className={`py-3 border-b border-gray-200 last:border-0 group ${
        editable ? 'cursor-pointer' : ''
      }`}
      onClick={handleEdit}
    >
      <dt className="text-sm font-medium text-gray-500 mb-1 flex items-center justify-between">
        <span>{label}</span>
        {editable && (
          <Pencil1Icon className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </dt>
      <dd
        className={`text-base ${
          value !== null && value !== undefined ? 'text-gray-900' : 'text-gray-400'
        } ${editable ? 'hover:text-blue-600 transition-colors' : ''}`}
      >
        {displayContent}
      </dd>
    </div>
  );
}
