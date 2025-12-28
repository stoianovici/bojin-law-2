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

export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'date' | 'autocomplete';

export interface AutocompleteOption {
  value: string;
  label: string;
}

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
  /** Display value for autocomplete fields (e.g., client name when value is client ID) */
  displayValue?: string;
  /** Search function for autocomplete fields */
  onSearch?: (query: string) => void;
  /** Options for autocomplete field (from search results) */
  autocompleteOptions?: AutocompleteOption[];
  /** Loading state for autocomplete search */
  autocompleteLoading?: boolean;
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
  displayValue: propDisplayValue,
  onSearch,
  autocompleteOptions = [],
  autocompleteLoading = false,
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');
  const [searchValue, setSearchValue] = useState<string>('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  const { updateCase, loading } = useCaseUpdate();
  const { addNotification } = useNotificationStore();

  // Convert value to string for editing
  const stringValue = value !== null && value !== undefined ? String(value) : '';

  // Start edit mode
  const handleEdit = () => {
    if (!editable) return;
    setEditValue(stringValue);
    if (fieldType === 'autocomplete') {
      setSearchValue(propDisplayValue || '');
      setShowAutocomplete(false);
    }
    setIsEditing(true);
    setValidationError(null);
  };

  // Handle autocomplete search input
  const handleSearchChange = (query: string) => {
    setSearchValue(query);
    setShowAutocomplete(true);
    onSearch?.(query);
  };

  // Handle autocomplete option selection
  const handleSelectOption = (option: AutocompleteOption) => {
    setEditValue(option.value);
    setSearchValue(option.label);
    setShowAutocomplete(false);
  };

  // Close autocomplete when clicking outside
  useEffect(() => {
    if (!isEditing || fieldType !== 'autocomplete') {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowAutocomplete(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, fieldType]);

  // Cancel editing
  const handleCancel = () => {
    setIsEditing(false);
    setEditValue('');
    setSearchValue('');
    setShowAutocomplete(false);
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
    if (editValue === stringValue) {
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to update field';
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
      if ((fieldType === 'text' || fieldType === 'textarea') && 'select' in inputRef.current) {
        inputRef.current.select();
      }
    }
  }, [isEditing, fieldType]);

  // Render edit mode
  if (isEditing) {
    return (
      <div className="py-3 border-b border-linear-border-subtle last:border-0">
        <dt className="text-sm font-medium text-linear-text-tertiary mb-1">{label}</dt>
        <dd className="flex items-start gap-2">
          <div className="flex-1">
            {fieldType === 'textarea' ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 border border-linear-accent rounded-md focus:outline-none focus:ring-2 focus:ring-linear-accent text-linear-text-primary resize-none"
                rows={3}
                disabled={loading}
              />
            ) : fieldType === 'select' && options ? (
              <select
                ref={inputRef as React.RefObject<HTMLSelectElement>}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 border border-linear-accent rounded-md focus:outline-none focus:ring-2 focus:ring-linear-accent text-linear-text-primary"
                disabled={loading}
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : fieldType === 'autocomplete' ? (
              <div className="relative">
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  type="text"
                  value={searchValue}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => searchValue && setShowAutocomplete(true)}
                  className="w-full px-3 py-2 border border-linear-accent rounded-md focus:outline-none focus:ring-2 focus:ring-linear-accent text-linear-text-primary"
                  disabled={loading}
                  placeholder={placeholder}
                />
                {showAutocomplete && (
                  <div
                    ref={autocompleteRef}
                    className="absolute z-10 w-full mt-1 bg-linear-bg-secondary border border-linear-border-subtle rounded-md shadow-lg max-h-60 overflow-auto"
                  >
                    {autocompleteLoading ? (
                      <div className="px-3 py-2 text-sm text-linear-text-tertiary">Se încarcă...</div>
                    ) : autocompleteOptions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-linear-text-tertiary">
                        {searchValue.length < 2
                          ? 'Tastați pentru a căuta...'
                          : 'Niciun rezultat găsit'}
                      </div>
                    ) : (
                      autocompleteOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleSelectOption(option)}
                          className="w-full px-3 py-2 text-left text-sm text-linear-text-primary hover:bg-linear-accent/10 focus:bg-linear-accent/10 focus:outline-none"
                        >
                          {option.label}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 border border-linear-accent rounded-md focus:outline-none focus:ring-2 focus:ring-linear-accent text-linear-text-primary"
                disabled={loading}
                step={fieldType === 'number' ? 'any' : undefined}
              />
            )}
            {validationError && <p className="mt-1 text-sm text-linear-error">{validationError}</p>}
            <p className="mt-1 text-xs text-linear-text-tertiary">Press Enter to save, ESC to cancel</p>
          </div>
          <div className="flex gap-1 pt-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="p-1.5 text-linear-success hover:bg-linear-success/10 rounded-md transition-colors disabled:opacity-50"
              title="Save"
              type="button"
            >
              <CheckIcon className="h-4 w-4" />
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="p-1.5 text-linear-error hover:bg-linear-error/10 rounded-md transition-colors disabled:opacity-50"
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
  // For autocomplete fields, use the displayValue prop (e.g., client name instead of ID)
  const displayContent = formatDisplay
    ? formatDisplay(value)
    : fieldType === 'autocomplete' && propDisplayValue
      ? propDisplayValue
      : value !== null && value !== undefined
        ? String(value)
        : placeholder;

  return (
    <div
      className={`py-3 border-b border-linear-border-subtle last:border-0 group ${
        editable ? 'cursor-pointer' : ''
      }`}
      onClick={handleEdit}
    >
      <dt className="text-sm font-medium text-linear-text-tertiary mb-1 flex items-center justify-between">
        <span>{label}</span>
        {editable && (
          <Pencil1Icon className="h-3.5 w-3.5 text-linear-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </dt>
      <dd
        className={`text-base ${
          value !== null && value !== undefined ? 'text-linear-text-primary' : 'text-linear-text-muted'
        } ${editable ? 'hover:text-linear-accent transition-colors' : ''}`}
      >
        {displayContent}
      </dd>
    </div>
  );
}
