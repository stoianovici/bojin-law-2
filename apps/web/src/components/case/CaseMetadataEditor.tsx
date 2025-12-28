/**
 * Case Metadata Editor Component
 * OPS-038: Contacts & Metadata in Case Flow
 *
 * Editable section for case classification metadata:
 * - Reference numbers (court file numbers, contract refs)
 * - Keywords for email classification
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { useCaseMetadata } from '../../hooks/useCaseMetadata';
import { useNotificationStore } from '../../stores/notificationStore';

// ============================================================================
// Types
// ============================================================================

export interface CaseMetadataEditorProps {
  caseId: string;
  referenceNumbers: string[];
  keywords: string[];
  readOnly?: boolean;
}

// ============================================================================
// Sub-components
// ============================================================================

interface TagInputProps {
  label: string;
  placeholder: string;
  values: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

function TagInput({
  label,
  placeholder,
  values,
  onAdd,
  onRemove,
  disabled,
  readOnly,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed && !values.includes(trimmed)) {
      onAdd(trimmed);
      setInputValue('');
    }
  }, [inputValue, values, onAdd]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-linear-text-secondary mb-2">{label}</label>

      {/* Tags display */}
      <div className="flex flex-wrap gap-2 mb-2">
        {values.length === 0 ? (
          <span className="text-sm text-linear-text-muted italic">Niciun element adăugat</span>
        ) : (
          values.map((value, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-2 py-1 bg-linear-accent/15 text-linear-accent rounded-md text-sm"
            >
              {value}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  disabled={disabled}
                  className="hover:text-linear-accent disabled:opacity-50"
                  aria-label={`Șterge ${value}`}
                >
                  <Cross2Icon className="h-3 w-3" />
                </button>
              )}
            </span>
          ))
        )}
      </div>

      {/* Input field */}
      {!readOnly && (
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 px-3 py-2 text-sm border border-linear-border rounded-md focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent disabled:bg-linear-bg-tertiary"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={disabled || !inputValue.trim()}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-linear-accent bg-linear-accent/15 border border-linear-accent/30 rounded-md hover:bg-linear-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusIcon className="h-4 w-4" />
            Adaugă
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CaseMetadataEditor({
  caseId,
  referenceNumbers: initialReferenceNumbers,
  keywords: initialKeywords,
  readOnly = false,
}: CaseMetadataEditorProps) {
  const [referenceNumbers, setReferenceNumbers] = useState<string[]>(initialReferenceNumbers);
  const [keywords, setKeywords] = useState<string[]>(initialKeywords);
  const [hasChanges, setHasChanges] = useState(false);

  const { updateMetadata, loading } = useCaseMetadata();
  const { addNotification } = useNotificationStore();

  // Handler for adding reference number
  const handleAddReferenceNumber = useCallback((value: string) => {
    setReferenceNumbers((prev) => [...prev, value]);
    setHasChanges(true);
  }, []);

  // Handler for removing reference number
  const handleRemoveReferenceNumber = useCallback((index: number) => {
    setReferenceNumbers((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  }, []);

  // Handler for adding keyword
  const handleAddKeyword = useCallback((value: string) => {
    setKeywords((prev) => [...prev, value]);
    setHasChanges(true);
  }, []);

  // Handler for removing keyword
  const handleRemoveKeyword = useCallback((index: number) => {
    setKeywords((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  }, []);

  // Save changes
  const handleSave = async () => {
    try {
      await updateMetadata(caseId, {
        referenceNumbers,
        keywords,
      });
      setHasChanges(false);
      addNotification({
        type: 'success',
        title: 'Salvat',
        message: 'Metadatele dosarului au fost actualizate.',
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: 'Nu s-au putut salva metadatele. Vă rugăm încercați din nou.',
      });
    }
  };

  // Reset changes
  const handleReset = () => {
    setReferenceNumbers(initialReferenceNumbers);
    setKeywords(initialKeywords);
    setHasChanges(false);
  };

  return (
    <div className="space-y-6">
      {/* Reference Numbers */}
      <TagInput
        label="Numere dosar instanță"
        placeholder="ex: 1234/5/2024"
        values={referenceNumbers}
        onAdd={handleAddReferenceNumber}
        onRemove={handleRemoveReferenceNumber}
        disabled={loading}
        readOnly={readOnly}
      />

      {/* Keywords */}
      <TagInput
        label="Cuvinte cheie clasificare"
        placeholder="ex: contract furnizare"
        values={keywords}
        onAdd={handleAddKeyword}
        onRemove={handleRemoveKeyword}
        disabled={loading}
        readOnly={readOnly}
      />

      {/* Action Buttons */}
      {!readOnly && hasChanges && (
        <div className="flex justify-end gap-3 pt-4 border-t border-linear-border-subtle">
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-linear-text-secondary bg-linear-bg-secondary border border-linear-border rounded-md hover:bg-linear-bg-hover transition-colors disabled:opacity-50"
          >
            Anulează
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-linear-accent rounded-md hover:bg-linear-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            Salvează
          </button>
        </div>
      )}
    </div>
  );
}

CaseMetadataEditor.displayName = 'CaseMetadataEditor';
