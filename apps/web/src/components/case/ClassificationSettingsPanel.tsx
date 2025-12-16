/**
 * Classification Settings Panel Component
 * OPS-028: Classification Metadata UI
 *
 * Panel for viewing and editing classification metadata in case settings.
 * Allows users to manage keywords, reference numbers, and notes for AI classification.
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import {
  useCaseClassification,
  type UpdateCaseClassificationInput,
} from '../../hooks/useGlobalEmailSources';
import { useNotificationStore } from '../../stores/notificationStore';

// ============================================================================
// Types
// ============================================================================

interface CaseClassificationData {
  keywords: string[];
  referenceNumbers: string[];
  subjectPatterns: string[];
  classificationNotes: string | null;
}

interface ClassificationSettingsPanelProps {
  caseId: string;
  initialData?: CaseClassificationData;
  readOnly?: boolean;
}

// ============================================================================
// Tag Input Component
// ============================================================================

interface TagInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}

function TagInput({ label, values, onChange, placeholder, disabled }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const addTag = () => {
    const trimmed = inputValue.trim().toLowerCase();
    if (!trimmed || disabled) return;

    if (values.includes(trimmed)) {
      setInputValue('');
      return;
    }

    onChange([...values, trimmed]);
    setInputValue('');
  };

  const removeTag = (index: number) => {
    if (disabled) return;
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div
        className={clsx(
          'flex flex-wrap gap-2 p-2 border rounded-md min-h-[40px]',
          disabled
            ? 'bg-gray-50 border-gray-200'
            : 'bg-white border-gray-300 focus-within:ring-2 focus-within:ring-blue-500'
        )}
      >
        {values.map((value, index) => (
          <span
            key={index}
            className={clsx(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm',
              disabled ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-800'
            )}
          >
            {value}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="text-blue-600 hover:text-blue-800 focus:outline-none"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addTag}
            placeholder={values.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[100px] border-none outline-none text-sm bg-transparent"
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ClassificationSettingsPanel({
  caseId,
  initialData,
  readOnly = false,
}: ClassificationSettingsPanelProps) {
  const { updateClassification, loading } = useCaseClassification();
  const { addNotification } = useNotificationStore();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<CaseClassificationData>({
    keywords: initialData?.keywords || [],
    referenceNumbers: initialData?.referenceNumbers || [],
    subjectPatterns: initialData?.subjectPatterns || [],
    classificationNotes: initialData?.classificationNotes || null,
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        keywords: initialData.keywords || [],
        referenceNumbers: initialData.referenceNumbers || [],
        subjectPatterns: initialData.subjectPatterns || [],
        classificationNotes: initialData.classificationNotes || null,
      });
    }
  }, [initialData]);

  const handleChange = useCallback(
    <K extends keyof CaseClassificationData>(field: K, value: CaseClassificationData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setHasChanges(true);
    },
    []
  );

  const handleSave = useCallback(async () => {
    const input: UpdateCaseClassificationInput = {
      keywords: formData.keywords,
      referenceNumbers: formData.referenceNumbers,
      subjectPatterns: formData.subjectPatterns,
      classificationNotes: formData.classificationNotes || undefined,
    };

    const result = await updateClassification(caseId, input);

    if (result.success) {
      addNotification({
        type: 'success',
        title: 'Setări salvate',
        message: 'Metadatele de clasificare au fost actualizate.',
      });
      setIsEditing(false);
      setHasChanges(false);
    } else {
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: result.error || 'Nu s-au putut salva setările.',
      });
    }
  }, [caseId, formData, updateClassification, addNotification]);

  const handleCancel = useCallback(() => {
    setFormData({
      keywords: initialData?.keywords || [],
      referenceNumbers: initialData?.referenceNumbers || [],
      subjectPatterns: initialData?.subjectPatterns || [],
      classificationNotes: initialData?.classificationNotes || null,
    });
    setIsEditing(false);
    setHasChanges(false);
  }, [initialData]);

  const isEmpty =
    formData.keywords.length === 0 &&
    formData.referenceNumbers.length === 0 &&
    formData.subjectPatterns.length === 0 &&
    !formData.classificationNotes;

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          <h3 className="font-medium text-gray-900">Clasificare Email</h3>
        </div>
        {!readOnly && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Editează
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {isEmpty && !isEditing ? (
          <div className="text-center py-6">
            <svg
              className="mx-auto h-10 w-10 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">Nicio metadată de clasificare configurată</p>
            {!readOnly && (
              <button
                onClick={() => setIsEditing(true)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                + Adaugă metadate
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Keywords */}
            <TagInput
              label="Cuvinte cheie"
              values={formData.keywords}
              onChange={(keywords) => handleChange('keywords', keywords)}
              placeholder="Adaugă cuvânt cheie..."
              disabled={!isEditing}
            />

            {/* Reference Numbers */}
            <TagInput
              label="Numere de referință"
              values={formData.referenceNumbers}
              onChange={(referenceNumbers) => handleChange('referenceNumbers', referenceNumbers)}
              placeholder="ex: 1234/3/2024"
              disabled={!isEditing}
            />

            {/* Subject Patterns */}
            <TagInput
              label="Tipare subiect email"
              values={formData.subjectPatterns}
              onChange={(subjectPatterns) => handleChange('subjectPatterns', subjectPatterns)}
              placeholder="ex: *dosar*2024*"
              disabled={!isEditing}
            />

            {/* Classification Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note pentru AI</label>
              {isEditing ? (
                <textarea
                  value={formData.classificationNotes || ''}
                  onChange={(e) => handleChange('classificationNotes', e.target.value || null)}
                  placeholder="Context pentru clasificarea automată..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-sm text-gray-600">
                  {formData.classificationNotes || (
                    <span className="text-gray-400 italic">Nicio notă</span>
                  )}
                </p>
              )}
            </div>

            {/* Actions */}
            {isEditing && (
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  Anulează
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading || !hasChanges}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {loading && (
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
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
          </>
        )}
      </div>

      {/* Help text */}
      {isEditing && (
        <div className="px-4 pb-4">
          <div className="bg-gray-50 rounded-md p-3 text-xs text-gray-600">
            <p className="font-medium mb-1">Cum ajută aceste metadate?</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Cuvintele cheie ajută la identificarea emailurilor relevante</li>
              <li>Numerele de referință (ex: număr dosar instanță) permit potrivire exactă</li>
              <li>Tiparele de subiect folosesc * pentru orice caractere</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

ClassificationSettingsPanel.displayName = 'ClassificationSettingsPanel';
