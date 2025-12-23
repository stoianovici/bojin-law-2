/**
 * MapaSlotEditor Component
 * OPS-102: Mapa UI Components
 *
 * Modal for adding or editing a slot
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';

export interface MapaSlotEditorProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    id?: string;
    name: string;
    description: string;
    category: string;
    required: boolean;
  };
  onSave: (data: {
    name: string;
    description: string;
    category: string;
    required: boolean;
  }) => void;
}

/**
 * MapaSlotEditor - add or edit a slot
 */
export function MapaSlotEditor({ isOpen, onClose, initialData, onSave }: MapaSlotEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [required, setRequired] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!initialData?.id;

  // Reset form when modal opens with initial data
  useEffect(() => {
    if (isOpen && initialData) {
      setName(initialData.name);
      setDescription(initialData.description);
      setCategory(initialData.category);
      setRequired(initialData.required);
      setError(null);
    } else if (isOpen) {
      setName('');
      setDescription('');
      setCategory('');
      setRequired(true);
      setError(null);
    }
  }, [isOpen, initialData]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!name.trim()) {
        setError('Denumirea poziției este obligatorie');
        return;
      }

      onSave({
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        required,
      });
    },
    [name, description, category, required, onSave]
  );

  const handleClose = useCallback(() => {
    setName('');
    setDescription('');
    setCategory('');
    setRequired(true);
    setError(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Editează poziția' : 'Adaugă poziție'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="slot-name" className="block text-sm font-medium text-gray-700 mb-1">
              Denumire <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="slot-name"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="ex: Cerere de chemare în judecată"
              className={clsx(
                'w-full px-3 py-2 border border-gray-300 rounded-lg',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                'placeholder:text-gray-400'
              )}
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="slot-description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Descriere (opțional)
            </label>
            <textarea
              id="slot-description"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setDescription(e.target.value)
              }
              placeholder="Indicații suplimentare despre această poziție..."
              rows={2}
              className={clsx(
                'w-full px-3 py-2 border border-gray-300 rounded-lg',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                'placeholder:text-gray-400 resize-none'
              )}
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="slot-category" className="block text-sm font-medium text-gray-700 mb-1">
              Categorie (opțional)
            </label>
            <input
              type="text"
              id="slot-category"
              value={category}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCategory(e.target.value)}
              placeholder="ex: Acte procedurale, Dovezi, Concluzii"
              className={clsx(
                'w-full px-3 py-2 border border-gray-300 rounded-lg',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                'placeholder:text-gray-400'
              )}
            />
          </div>

          {/* Required Toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <label htmlFor="slot-required" className="text-sm font-medium text-gray-700">
                Obligatoriu
              </label>
              <p className="text-xs text-gray-500">
                Pozițiile obligatorii afectează statutul de completare al mapei
              </p>
            </div>
            <button
              type="button"
              id="slot-required"
              role="switch"
              aria-checked={required}
              onClick={() => setRequired(!required)}
              className={clsx(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent',
                'transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                required ? 'bg-blue-600' : 'bg-gray-200'
              )}
            >
              <span
                className={clsx(
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0',
                  'transition duration-200 ease-in-out',
                  required ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Anulează
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              'bg-blue-600 text-white hover:bg-blue-700',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isEditing ? 'Salvează' : 'Adaugă'}
          </button>
        </div>
      </div>
    </div>
  );
}

MapaSlotEditor.displayName = 'MapaSlotEditor';
