/**
 * Global Email Sources Panel Component
 * OPS-028: Classification Metadata UI
 *
 * Firm settings panel for managing court/authority email addresses.
 * Used by AI email classification to identify institutional senders.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  useGlobalEmailSources,
  type GlobalEmailSource,
  type GlobalEmailSourceCategory,
  type CreateGlobalEmailSourceInput,
  type UpdateGlobalEmailSourceInput,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
} from '../../hooks/useGlobalEmailSources';
import { useNotificationStore } from '../../stores/notificationStore';

// ============================================================================
// Types
// ============================================================================

interface EditingSource {
  id: string | null;
  category: GlobalEmailSourceCategory;
  name: string;
  domains: string[];
  emails: string[];
  classificationHint: string;
}

const EMPTY_SOURCE: EditingSource = {
  id: null,
  category: 'Court',
  name: '',
  domains: [],
  emails: [],
  classificationHint: '',
};

// ============================================================================
// Tag Input Component
// ============================================================================

interface TagInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  validator?: (value: string) => string | null;
}

function TagInput({ label, values, onChange, placeholder, validator }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    if (validator) {
      const validationError = validator(trimmed);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    if (values.includes(trimmed)) {
      setError('Această valoare există deja');
      return;
    }

    onChange([...values, trimmed]);
    setInputValue('');
    setError(null);
  };

  const removeTag = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-md min-h-[42px] bg-white">
        {values.map((value, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
          >
            {value}
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
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={values.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] border-none outline-none text-sm"
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <p className="mt-1 text-xs text-gray-500">Apăsați Enter pentru a adăuga</p>
    </div>
  );
}

// ============================================================================
// Source Card Component
// ============================================================================

interface SourceCardProps {
  source: GlobalEmailSource;
  onEdit: () => void;
  onDelete: () => void;
}

function SourceCard({ source, onEdit, onDelete }: SourceCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{CATEGORY_ICONS[source.category]}</span>
          <div>
            <h4 className="font-medium text-gray-900">{source.name}</h4>
            <p className="text-sm text-gray-500">{CATEGORY_LABELS[source.category]}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Editează"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  onDelete();
                  setConfirmDelete(false);
                }}
                className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
              >
                Confirmă
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
              >
                Anulează
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
              title="Șterge"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {source.domains.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-500 mb-1">Domenii:</p>
          <div className="flex flex-wrap gap-1">
            {source.domains.map((domain, i) => (
              <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                {domain}
              </span>
            ))}
          </div>
        </div>
      )}

      {source.emails.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-gray-500 mb-1">Adrese email:</p>
          <div className="flex flex-wrap gap-1">
            {source.emails.map((email, i) => (
              <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                {email}
              </span>
            ))}
          </div>
        </div>
      )}

      {source.classificationHint && (
        <div className="mt-2">
          <p className="text-xs font-medium text-gray-500 mb-1">Indicație clasificare:</p>
          <p className="text-sm text-gray-600">{source.classificationHint}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Edit Modal Component
// ============================================================================

interface EditModalProps {
  source: EditingSource;
  onClose: () => void;
  onSave: (source: EditingSource) => void;
  saving: boolean;
}

function EditModal({ source, onClose, onSave, saving }: EditModalProps) {
  const [formData, setFormData] = useState<EditingSource>(source);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave(formData);
  };

  const validateDomain = (domain: string): string | null => {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)*$/;
    if (!domainRegex.test(domain)) {
      return 'Format domeniu invalid';
    }
    return null;
  };

  const validateEmail = (email: string): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Format email invalid';
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {source.id ? 'Editare sursă email' : 'Adăugare sursă email nouă'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={saving}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categorie <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    category: e.target.value as GlobalEmailSourceCategory,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(Object.keys(CATEGORY_LABELS) as GlobalEmailSourceCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nume <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ex: Tribunalul București"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Domains */}
            <TagInput
              label="Domenii email"
              values={formData.domains}
              onChange={(domains) => setFormData({ ...formData, domains })}
              placeholder="ex: just.ro"
              validator={validateDomain}
            />

            {/* Email addresses */}
            <TagInput
              label="Adrese email specifice"
              values={formData.emails}
              onChange={(emails) => setFormData({ ...formData, emails })}
              placeholder="ex: grefa@tribunal.ro"
              validator={validateEmail}
            />

            {/* Classification hint */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Indicație pentru clasificare AI
              </label>
              <textarea
                value={formData.classificationHint}
                onChange={(e) => setFormData({ ...formData, classificationHint: e.target.value })}
                placeholder="ex: Emailurile de la această sursă conțin de obicei numere de dosar"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Opțional. Ajută AI-ul să clasifice emailurile de la această sursă.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Anulează
              </button>
              <button
                type="submit"
                disabled={saving || !formData.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && (
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
                {source.id ? 'Salvează' : 'Adaugă'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function GlobalEmailSourcesPanel() {
  const {
    sources,
    loading,
    error,
    createSource,
    createLoading,
    updateSource,
    updateLoading,
    deleteSource,
    deleteLoading,
  } = useGlobalEmailSources();
  const { addNotification } = useNotificationStore();

  const [editingSource, setEditingSource] = useState<EditingSource | null>(null);

  const handleCreate = useCallback(() => {
    setEditingSource({ ...EMPTY_SOURCE });
  }, []);

  const handleEdit = useCallback((source: GlobalEmailSource) => {
    setEditingSource({
      id: source.id,
      category: source.category,
      name: source.name,
      domains: source.domains,
      emails: source.emails,
      classificationHint: source.classificationHint || '',
    });
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      const result = await deleteSource(id);
      if (result.success) {
        addNotification({
          type: 'success',
          title: 'Sursă ștearsă',
          message: 'Sursa de email a fost ștearsă cu succes.',
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Eroare',
          message: result.error || 'Nu s-a putut șterge sursa.',
        });
      }
    },
    [deleteSource, addNotification]
  );

  const handleSave = useCallback(
    async (formData: EditingSource) => {
      if (formData.id) {
        // Update existing
        const input: UpdateGlobalEmailSourceInput = {
          category: formData.category,
          name: formData.name,
          domains: formData.domains,
          emails: formData.emails,
          classificationHint: formData.classificationHint || undefined,
        };

        const result = await updateSource(formData.id, input);
        if (result.success) {
          addNotification({
            type: 'success',
            title: 'Sursă actualizată',
            message: 'Sursa de email a fost actualizată cu succes.',
          });
          setEditingSource(null);
        } else {
          addNotification({
            type: 'error',
            title: 'Eroare',
            message: result.error || 'Nu s-a putut actualiza sursa.',
          });
        }
      } else {
        // Create new
        const input: CreateGlobalEmailSourceInput = {
          category: formData.category,
          name: formData.name,
          domains: formData.domains.length > 0 ? formData.domains : undefined,
          emails: formData.emails.length > 0 ? formData.emails : undefined,
          classificationHint: formData.classificationHint || undefined,
        };

        const result = await createSource(input);
        if (result.success) {
          addNotification({
            type: 'success',
            title: 'Sursă creată',
            message: 'Sursa de email a fost adăugată cu succes.',
          });
          setEditingSource(null);
        } else {
          addNotification({
            type: 'error',
            title: 'Eroare',
            message: result.error || 'Nu s-a putut crea sursa.',
          });
        }
      }
    },
    [createSource, updateSource, addNotification]
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-600">
          <p className="font-medium">Eroare la încărcarea surselor de email</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Surse Email Globale</h2>
            <p className="mt-1 text-sm text-gray-600">
              Configurați adresele email ale instanțelor și autorităților. Emailurile de la aceste
              surse vor fi clasificate automat pe baza numărului de dosar.
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Adaugă sursă
          </button>
        </div>
      </div>

      <div className="p-6">
        {sources.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nicio sursă configurată</h3>
            <p className="mt-1 text-sm text-gray-500">
              Adăugați adresele instanțelor și autorităților pentru clasificare automată.
            </p>
            <button
              onClick={handleCreate}
              className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50"
            >
              + Adaugă prima sursă
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                onEdit={() => handleEdit(source)}
                onDelete={() => handleDelete(source.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="px-6 pb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <svg
              className="h-5 w-5 text-blue-400 flex-shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3 text-sm text-blue-700">
              <p className="font-medium">Cum funcționează?</p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>
                  Emailurile de la domeniile configurate sunt marcate ca fiind de la
                  instanțe/autorități
                </li>
                <li>AI-ul extrage automat numerele de dosar pentru a clasifica emailurile</li>
                <li>Aceste setări sunt comune pentru toate dosarele firmei</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingSource && (
        <EditModal
          source={editingSource}
          onClose={() => setEditingSource(null)}
          onSave={handleSave}
          saving={createLoading || updateLoading}
        />
      )}
    </div>
  );
}

GlobalEmailSourcesPanel.displayName = 'GlobalEmailSourcesPanel';
