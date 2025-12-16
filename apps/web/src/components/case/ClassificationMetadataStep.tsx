/**
 * Classification Metadata Step Component
 * OPS-028: Classification Metadata UI
 *
 * Optional step in case creation wizard for adding classification metadata.
 * Allows users to add keywords, reference numbers, and notes for AI classification.
 */

'use client';

import React, { useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ClassificationMetadata {
  keywords: string[];
  referenceNumbers: string[];
  classificationNotes: string;
}

interface ClassificationMetadataStepProps {
  data: ClassificationMetadata;
  onChange: (data: ClassificationMetadata) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

// ============================================================================
// Tag Input Component
// ============================================================================

interface TagInputProps {
  label: string;
  description: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  hint?: string;
}

function TagInput({ label, description, values, onChange, placeholder, hint }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const addTag = () => {
    const trimmed = inputValue.trim().toLowerCase();
    if (!trimmed) return;

    if (values.includes(trimmed)) {
      setInputValue('');
      return;
    }

    onChange([...values, trimmed]);
    setInputValue('');
  };

  const removeTag = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <p className="text-sm text-gray-500 mb-2">{description}</p>
      <div className="flex flex-wrap gap-2 p-3 border border-gray-300 rounded-md min-h-[48px] bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
        {values.map((value, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
          >
            {value}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="text-blue-600 hover:text-blue-800 focus:outline-none"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={values.length === 0 ? placeholder : '+ Adaugă...'}
          className="flex-1 min-w-[150px] border-none outline-none text-sm bg-transparent"
        />
      </div>
      {hint && (
        <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {hint}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ClassificationMetadataStep({
  data,
  onChange,
  onNext,
  onBack,
  onSkip,
}: ClassificationMetadataStepProps) {
  const handleKeywordsChange = useCallback(
    (keywords: string[]) => {
      onChange({ ...data, keywords });
    },
    [data, onChange]
  );

  const handleReferenceNumbersChange = useCallback(
    (referenceNumbers: string[]) => {
      onChange({ ...data, referenceNumbers });
    },
    [data, onChange]
  );

  const handleNotesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange({ ...data, classificationNotes: e.target.value });
    },
    [data, onChange]
  );

  const hasData =
    data.keywords.length > 0 || data.referenceNumbers.length > 0 || data.classificationNotes;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-medium text-gray-900">Clasificare Email (Opțional)</h3>
        <p className="mt-1 text-sm text-gray-500">
          Adăugați informații care ajută la clasificarea automată a emailurilor pentru acest dosar.
          Puteți sări acest pas și reveni mai târziu.
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex">
          <svg
            className="h-5 w-5 text-amber-400 flex-shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div className="ml-3">
            <h4 className="text-sm font-medium text-amber-800">Când este util acest pas?</h4>
            <p className="mt-1 text-sm text-amber-700">
              Dacă clientul are mai multe dosare active, aceste informații ajută sistemul să
              clasifice corect emailurile la dosarul potrivit.
            </p>
          </div>
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-5">
        {/* Keywords */}
        <TagInput
          label="Cuvinte cheie"
          description="Termeni specifici acestui dosar pentru potrivire automată"
          values={data.keywords}
          onChange={handleKeywordsChange}
          placeholder="ex: apartament, floreasca, reziliere"
          hint="Apăsați Enter pentru a adăuga. Folosiți termeni unici pentru acest dosar."
        />

        {/* Reference Numbers */}
        <TagInput
          label="Numere de referință"
          description="Numere de dosar instanță, contracte, sau alte identificatoare"
          values={data.referenceNumbers}
          onChange={handleReferenceNumbersChange}
          placeholder="ex: 1234/3/2024"
          hint="Format dosar instanță: număr/secție/an (ex: 1234/3/2024)"
        />

        {/* Classification Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Note pentru clasificare AI
          </label>
          <p className="text-sm text-gray-500 mb-2">
            Context suplimentar pentru clasificarea automată a emailurilor
          </p>
          <textarea
            value={data.classificationNotes}
            onChange={handleNotesChange}
            placeholder="ex: Dispută privind livrarea apartamentului din complexul X. Corespondență principală cu dezvoltatorul Y."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Opțional. Descrieți contextul dosarului pentru a ajuta AI-ul să clasifice emailurile.
          </p>
        </div>
      </div>

      {/* Preview */}
      {hasData && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Previzualizare metadate</h4>
          <div className="text-sm text-gray-600 space-y-2">
            {data.keywords.length > 0 && (
              <p>
                <span className="font-medium">Cuvinte cheie:</span> {data.keywords.join(', ')}
              </p>
            )}
            {data.referenceNumbers.length > 0 && (
              <p>
                <span className="font-medium">Referințe:</span> {data.referenceNumbers.join(', ')}
              </p>
            )}
            {data.classificationNotes && (
              <p>
                <span className="font-medium">Note:</span> {data.classificationNotes}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          Înapoi
        </button>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            Omite
          </button>
          <button
            type="button"
            onClick={onNext}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Continuă
          </button>
        </div>
      </div>
    </div>
  );
}

ClassificationMetadataStep.displayName = 'ClassificationMetadataStep';
