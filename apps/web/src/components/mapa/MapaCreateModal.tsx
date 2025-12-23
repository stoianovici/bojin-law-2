/**
 * MapaCreateModal Component
 * OPS-102: Mapa UI Components
 *
 * Modal for creating a new mapa (blank or from template)
 */

'use client';

import React, { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  useCaseMape,
  useMapaTemplates,
  type Mapa,
  type MapaTemplateDetail,
  type QuickSlotInput,
} from '../../hooks/useMapa';

export interface MapaCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  onCreated: (mapa: Mapa) => void;
}

type CreateMode = 'blank' | 'template' | 'quicklist';

/**
 * Parse quick list text into slot inputs
 * Lines ending with * are marked as required
 */
function parseQuickListSlots(text: string): QuickSlotInput[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const required = line.endsWith('*');
      const name = required ? line.slice(0, -1).trim() : line;
      return { name, required };
    })
    .filter((slot) => slot.name.length > 0);
}

/**
 * MapaCreateModal - create blank mapa or from template
 */
export function MapaCreateModal({ isOpen, onClose, caseId, onCreated }: MapaCreateModalProps) {
  const { createMapa, createFromTemplate, createMapaWithSlots, creating } = useCaseMape(caseId);
  const { templates, loading: loadingTemplates } = useMapaTemplates();

  const [mode, setMode] = useState<CreateMode>('blank');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [slotsText, setSlotsText] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsedSlots = parseQuickListSlots(slotsText);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      try {
        let newMapa: Mapa | undefined;

        if (mode === 'template' && selectedTemplateId) {
          newMapa = await createFromTemplate(selectedTemplateId);
        } else if (mode === 'quicklist') {
          if (!name.trim()) {
            setError('Numele mapei este obligatoriu');
            return;
          }
          if (parsedSlots.length === 0) {
            setError('Adaugă cel puțin o poziție în listă');
            return;
          }
          newMapa = await createMapaWithSlots({
            name: name.trim(),
            description: description.trim() || undefined,
            slots: parsedSlots,
          });
        } else {
          if (!name.trim()) {
            setError('Numele mapei este obligatoriu');
            return;
          }
          newMapa = await createMapa({
            caseId,
            name: name.trim(),
            description: description.trim() || undefined,
          });
        }

        if (!newMapa) {
          setError('Eroare la crearea mapei');
          return;
        }

        // Reset form
        setName('');
        setDescription('');
        setSlotsText('');
        setSelectedTemplateId(null);
        setMode('blank');

        onCreated(newMapa);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Eroare la crearea mapei');
      }
    },
    [
      mode,
      name,
      description,
      slotsText,
      parsedSlots,
      selectedTemplateId,
      caseId,
      createMapa,
      createFromTemplate,
      createMapaWithSlots,
      onCreated,
    ]
  );

  const handleClose = useCallback(() => {
    setName('');
    setDescription('');
    setSlotsText('');
    setSelectedTemplateId(null);
    setMode('blank');
    setError(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Crează mapă nouă</h2>
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Mode Selection */}
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setMode('blank')}
              className={clsx(
                'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
                mode === 'blank'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              )}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="text-xs font-medium">Goală</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('quicklist')}
              className={clsx(
                'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
                mode === 'quicklist'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              )}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              <span className="text-xs font-medium">Listă rapidă</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('template')}
              className={clsx(
                'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
                mode === 'template'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              )}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                />
              </svg>
              <span className="text-xs font-medium">Din șablon</span>
            </button>
          </div>

          {/* Blank Mode Form */}
          {mode === 'blank' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Denumire mapă <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  placeholder="ex: Mapa instanță"
                  className={clsx(
                    'w-full px-3 py-2 border border-gray-300 rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    'placeholder:text-gray-400'
                  )}
                />
              </div>
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Descriere (opțional)
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setDescription(e.target.value)
                  }
                  placeholder="Descriere scurtă a mapei..."
                  rows={3}
                  className={clsx(
                    'w-full px-3 py-2 border border-gray-300 rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    'placeholder:text-gray-400 resize-none'
                  )}
                />
              </div>
            </div>
          )}

          {/* Quick List Mode Form */}
          {mode === 'quicklist' && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="name-quick"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Denumire mapă <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name-quick"
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  placeholder="ex: Mapa instanță"
                  className={clsx(
                    'w-full px-3 py-2 border border-gray-300 rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    'placeholder:text-gray-400'
                  )}
                />
              </div>
              <div>
                <label
                  htmlFor="slots-list"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Documente necesare (câte unul pe linie)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Adaugă <code className="bg-gray-100 px-1 rounded">*</code> la final pentru poziții
                  obligatorii
                </p>
                <textarea
                  id="slots-list"
                  value={slotsText}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setSlotsText(e.target.value)
                  }
                  placeholder={`Cerere de chemare în judecată *\nÎntâmpinare *\nContract\nDovezi (facturi, chitanțe)`}
                  rows={6}
                  className={clsx(
                    'w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    'placeholder:text-gray-400 resize-none'
                  )}
                />
              </div>

              {/* Parsed slots preview */}
              {parsedSlots.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="text-xs font-medium text-gray-700 mb-2">
                    Previzualizare ({parsedSlots.length} poziții)
                  </h4>
                  <ul className="space-y-1 max-h-24 overflow-y-auto">
                    {parsedSlots.map((slot, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <span
                          className={clsx(
                            'w-2 h-2 rounded-full flex-shrink-0',
                            slot.required ? 'bg-amber-400' : 'bg-gray-300'
                          )}
                        />
                        <span className="text-gray-700 truncate">{slot.name}</span>
                        {slot.required && (
                          <span className="text-xs text-amber-600 flex-shrink-0">
                            (obligatoriu)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <label
                  htmlFor="description-quick"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Descriere (opțional)
                </label>
                <input
                  type="text"
                  id="description-quick"
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setDescription(e.target.value)
                  }
                  placeholder="Descriere scurtă a mapei..."
                  className={clsx(
                    'w-full px-3 py-2 border border-gray-300 rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    'placeholder:text-gray-400'
                  )}
                />
              </div>
            </div>
          )}

          {/* Template Mode Form */}
          {mode === 'template' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selectează șablon
                </label>
                {loadingTemplates ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <p className="text-sm text-gray-500">Nu există șabloane disponibile</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Creează mai întâi un șablon din setări
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {templates.map((template) => (
                      <TemplateOption
                        key={template.id}
                        template={template}
                        selected={selectedTemplateId === template.id}
                        onSelect={() => setSelectedTemplateId(template.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Template Preview */}
              {selectedTemplate && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Poziții ({selectedTemplate.slotDefinitions.length})
                  </h4>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedTemplate.slotDefinitions.map((slot, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <span
                          className={clsx(
                            'w-2 h-2 rounded-full',
                            slot.required ? 'bg-amber-400' : 'bg-gray-300'
                          )}
                        />
                        <span className="text-gray-700">{slot.name}</span>
                        {!slot.required && (
                          <span className="text-xs text-gray-400">(opțional)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

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
            disabled={
              creating ||
              (mode === 'blank' && !name.trim()) ||
              (mode === 'quicklist' && (!name.trim() || parsedSlots.length === 0)) ||
              (mode === 'template' && !selectedTemplateId)
            }
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              'bg-blue-600 text-white hover:bg-blue-700',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {creating ? 'Se creează...' : 'Crează mapă'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Template option component
 */
function TemplateOption({
  template,
  selected,
  onSelect,
}: {
  template: MapaTemplateDetail;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        'w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all',
        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
      )}
    >
      <div
        className={clsx(
          'w-10 h-10 rounded-lg flex items-center justify-center',
          selected ? 'bg-blue-100' : 'bg-gray-100'
        )}
      >
        <svg
          className={clsx('w-5 h-5', selected ? 'text-blue-600' : 'text-gray-500')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z"
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">{template.name}</div>
        <div className="text-sm text-gray-500">
          {template.slotDefinitions.length} poziții
          {template.caseType && ` • ${template.caseType}`}
        </div>
      </div>
      {selected && (
        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
}

MapaCreateModal.displayName = 'MapaCreateModal';
