/**
 * References Section Component
 * OPS-212: Part of Expandable Case Workspace Epic
 *
 * Displays and allows inline editing of case reference numbers:
 * - Court file numbers (Nr. Dosar Instanță)
 * - Contract numbers (Nr. Contract)
 * - Registration numbers (Nr. Înregistrare)
 * - Execution file numbers (Nr. Dosar Executare)
 * - Custom references
 */

'use client';

import React, { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { Cross2Icon, PlusIcon, Pencil1Icon, CheckIcon } from '@radix-ui/react-icons';
import { useCaseUpdate } from '../../../hooks/useCaseUpdate';
import { useNotificationStore } from '../../../stores/notificationStore';

// ============================================================================
// Types
// ============================================================================

export interface CaseReference {
  type: string;
  value: string;
}

export interface ReferencesSectionProps {
  caseId: string;
  /** References stored as metadata.references array */
  references: CaseReference[];
  /** Current case metadata object */
  metadata: Record<string, unknown>;
  /** Whether the section is editable */
  editable: boolean;
  /** Optional class name */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const REFERENCE_TYPES = [
  { value: 'courtFileNumber', label: 'Nr. Dosar Instanță' },
  { value: 'contractNumber', label: 'Nr. Contract' },
  { value: 'registrationNumber', label: 'Nr. Înregistrare' },
  { value: 'executionFileNumber', label: 'Nr. Dosar Executare' },
  { value: 'custom', label: 'Altă referință' },
] as const;

// ============================================================================
// Sub-components
// ============================================================================

interface CardProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

function Card({ title, children, action, className }: CardProps) {
  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200 shadow-sm', className)}>
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

interface ReferenceItemProps {
  reference: CaseReference;
  editable: boolean;
  onEdit: (newValue: string) => void;
  onRemove: () => void;
  loading: boolean;
}

function ReferenceItem({ reference, editable, onEdit, onRemove, loading }: ReferenceItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(reference.value);

  const typeLabel =
    REFERENCE_TYPES.find((t) => t.value === reference.type)?.label || reference.type;

  const handleSave = useCallback(() => {
    if (editValue.trim() && editValue !== reference.value) {
      onEdit(editValue.trim());
    }
    setIsEditing(false);
  }, [editValue, reference.value, onEdit]);

  const handleCancel = useCallback(() => {
    setEditValue(reference.value);
    setIsEditing(false);
  }, [reference.value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="py-3 border-b border-gray-200 last:border-0">
        <dt className="text-sm font-medium text-gray-500 mb-1">{typeLabel}</dt>
        <dd className="flex items-center gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-3 py-2 border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            disabled={loading}
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={loading || !editValue.trim()}
            className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
            title="Salvează"
            type="button"
          >
            <CheckIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
            title="Anulează"
            type="button"
          >
            <Cross2Icon className="h-4 w-4" />
          </button>
        </dd>
        <p className="mt-1 text-xs text-gray-500">Enter pentru a salva, ESC pentru a anula</p>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'py-3 border-b border-gray-200 last:border-0 group',
        editable && 'cursor-pointer'
      )}
      onClick={() => editable && setIsEditing(true)}
    >
      <dt className="text-sm font-medium text-gray-500 mb-1 flex items-center justify-between">
        <span>{typeLabel}</span>
        {editable && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Pencil1Icon className="h-3.5 w-3.5 text-gray-400" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              disabled={loading}
              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
              title="Șterge"
              type="button"
            >
              <Cross2Icon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </dt>
      <dd
        className={clsx(
          'text-base text-gray-900',
          editable && 'hover:text-blue-600 transition-colors'
        )}
      >
        {reference.value}
      </dd>
    </div>
  );
}

interface AddReferenceFormProps {
  existingTypes: string[];
  onAdd: (type: string, value: string, customLabel?: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function AddReferenceForm({ existingTypes, onAdd, onCancel, loading }: AddReferenceFormProps) {
  const [selectedType, setSelectedType] = useState('');
  const [value, setValue] = useState('');
  const [customLabel, setCustomLabel] = useState('');

  // Filter out already used types (except custom which can have multiple)
  const availableTypes = REFERENCE_TYPES.filter(
    (t) => t.value === 'custom' || !existingTypes.includes(t.value)
  );

  const handleSubmit = () => {
    if (selectedType && value.trim()) {
      onAdd(selectedType, value.trim(), selectedType === 'custom' ? customLabel.trim() : undefined);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tip referință</label>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
          disabled={loading}
        >
          <option value="">Selectează tipul...</option>
          {availableTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {selectedType === 'custom' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Etichetă</label>
          <input
            type="text"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="ex: Nr. Referat"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            disabled={loading}
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Valoare</label>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ex: 1234/5/2024"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          disabled={loading}
          autoFocus
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
        >
          Anulează
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !selectedType || !value.trim()}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Adaugă
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ReferencesSection Component
 *
 * Displays case reference numbers with inline editing capability.
 * References are stored in the case metadata.references array.
 */
export function ReferencesSection({
  caseId,
  references: initialReferences,
  metadata,
  editable,
  className,
}: ReferencesSectionProps) {
  const [references, setReferences] = useState<CaseReference[]>(initialReferences);
  const [isAdding, setIsAdding] = useState(false);

  const { updateCase, loading } = useCaseUpdate();
  const { addNotification } = useNotificationStore();

  // Get existing types to filter available options
  const existingTypes = references.map((r) => r.type);

  // Update references in the database
  const saveReferences = useCallback(
    async (newReferences: CaseReference[]) => {
      try {
        await updateCase(caseId, {
          metadata: {
            ...metadata,
            references: newReferences,
          },
        });
        setReferences(newReferences);
        addNotification({
          type: 'success',
          title: 'Salvat',
          message: 'Referințele au fost actualizate.',
        });
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Eroare',
          message: 'Nu s-au putut salva referințele. Încercați din nou.',
        });
        // Revert to initial state on error
        setReferences(initialReferences);
      }
    },
    [caseId, metadata, updateCase, addNotification, initialReferences]
  );

  // Handle editing a reference value
  const handleEditReference = useCallback(
    (index: number, newValue: string) => {
      const newReferences = [...references];
      newReferences[index] = { ...newReferences[index], value: newValue };
      saveReferences(newReferences);
    },
    [references, saveReferences]
  );

  // Handle removing a reference
  const handleRemoveReference = useCallback(
    (index: number) => {
      const newReferences = references.filter((_, i) => i !== index);
      saveReferences(newReferences);
    },
    [references, saveReferences]
  );

  // Handle adding a new reference
  const handleAddReference = useCallback(
    (type: string, value: string, customLabel?: string) => {
      const newReference: CaseReference = {
        type: customLabel ? `custom:${customLabel}` : type,
        value,
      };
      const newReferences = [...references, newReference];
      saveReferences(newReferences);
      setIsAdding(false);
    },
    [references, saveReferences]
  );

  // Get display label for a reference type
  const getTypeLabel = (type: string): string => {
    if (type.startsWith('custom:')) {
      return type.slice(7); // Remove 'custom:' prefix
    }
    return REFERENCE_TYPES.find((t) => t.value === type)?.label || type;
  };

  return (
    <Card
      title="Referințe"
      className={className}
      action={
        editable &&
        !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <PlusIcon className="h-4 w-4" />
            Adaugă
          </button>
        )
      }
    >
      <div className="space-y-0">
        {references.map((ref, index) => (
          <ReferenceItem
            key={`${ref.type}-${index}`}
            reference={{ ...ref, type: getTypeLabel(ref.type) }}
            editable={editable}
            onEdit={(newValue) => handleEditReference(index, newValue)}
            onRemove={() => handleRemoveReference(index)}
            loading={loading}
          />
        ))}

        {isAdding && (
          <div className="pt-3">
            <AddReferenceForm
              existingTypes={existingTypes}
              onAdd={handleAddReference}
              onCancel={() => setIsAdding(false)}
              loading={loading}
            />
          </div>
        )}

        {references.length === 0 && !isAdding && (
          <p className="text-gray-400 text-sm py-2">Nicio referință adăugată</p>
        )}
      </div>
    </Card>
  );
}

ReferencesSection.displayName = 'ReferencesSection';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse references from case metadata
 * @param metadata - Case metadata object
 * @returns Array of CaseReference objects
 */
export function parseReferencesFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): CaseReference[] {
  if (!metadata) return [];

  const refs = metadata.references;
  if (!Array.isArray(refs)) return [];

  return refs.filter(
    (r): r is CaseReference =>
      typeof r === 'object' &&
      r !== null &&
      typeof r.type === 'string' &&
      typeof r.value === 'string'
  );
}
