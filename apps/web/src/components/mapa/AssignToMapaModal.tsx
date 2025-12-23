/**
 * AssignToMapaModal Component
 *
 * Modal for assigning a document to a mapa slot from the documents view.
 * Supports selecting existing mapa or creating a new one with quick list.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  useCaseMape,
  useMapa,
  type Mapa,
  type MapaSlot,
  type QuickSlotInput,
} from '../../hooks/useMapa';

export interface DocumentInfo {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface AssignToMapaModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  document: DocumentInfo;
  onAssigned: (mapaId: string, slotId: string) => void;
}

type Step = 'select-mapa' | 'select-slot' | 'create-mapa';

/**
 * Parse quick list text into slot inputs
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
 * AssignToMapaModal - assign document to a mapa slot
 */
export function AssignToMapaModal({
  isOpen,
  onClose,
  caseId,
  document,
  onAssigned,
}: AssignToMapaModalProps) {
  const { mape, loading: loadingMape, createMapaWithSlots, creating } = useCaseMape(caseId);

  const [step, setStep] = useState<Step>('select-mapa');
  const [selectedMapaId, setSelectedMapaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create mapa form state
  const [newMapaName, setNewMapaName] = useState('');
  const [newMapaDescription, setNewMapaDescription] = useState('');
  const [slotsText, setSlotsText] = useState('');

  const parsedSlots = parseQuickListSlots(slotsText);

  const handleClose = useCallback(() => {
    setStep('select-mapa');
    setSelectedMapaId(null);
    setError(null);
    setNewMapaName('');
    setNewMapaDescription('');
    setSlotsText('');
    onClose();
  }, [onClose]);

  const handleSelectMapa = useCallback((mapaId: string) => {
    setSelectedMapaId(mapaId);
    setStep('select-slot');
  }, []);

  const handleBack = useCallback(() => {
    if (step === 'select-slot' || step === 'create-mapa') {
      setStep('select-mapa');
      setSelectedMapaId(null);
    }
  }, [step]);

  const handleCreateMapa = useCallback(async () => {
    if (!newMapaName.trim()) {
      setError('Numele mapei este obligatoriu');
      return;
    }
    if (parsedSlots.length === 0) {
      setError('Adaugă cel puțin o poziție în listă');
      return;
    }

    try {
      setError(null);
      const newMapa = await createMapaWithSlots({
        name: newMapaName.trim(),
        description: newMapaDescription.trim() || undefined,
        slots: parsedSlots,
      });

      if (newMapa) {
        setSelectedMapaId(newMapa.id);
        setStep('select-slot');
        setNewMapaName('');
        setNewMapaDescription('');
        setSlotsText('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare la crearea mapei');
    }
  }, [newMapaName, newMapaDescription, parsedSlots, createMapaWithSlots]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {step !== 'select-mapa' && (
              <button
                onClick={handleBack}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {step === 'select-mapa' && 'Adaugă în mapă'}
                {step === 'select-slot' && 'Selectează poziția'}
                {step === 'create-mapa' && 'Crează mapă nouă'}
              </h2>
              <p className="text-sm text-gray-500 truncate max-w-xs">{document.fileName}</p>
            </div>
          </div>
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
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Select Mapa */}
          {step === 'select-mapa' && (
            <div className="space-y-4">
              {/* Create new mapa option */}
              <button
                onClick={() => setStep('create-mapa')}
                className={clsx(
                  'w-full flex items-center gap-3 p-4 rounded-lg border-2 border-dashed',
                  'border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors'
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium">Crează mapă nouă</div>
                  <div className="text-sm text-blue-600">Cu listă rapidă de documente</div>
                </div>
              </button>

              {/* Existing mapas */}
              {loadingMape ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : mape.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Nu există mape în acest dosar</p>
                  <p className="text-xs text-gray-400 mt-1">Creează prima mapă mai sus</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Mape existente</p>
                  {mape.map((mapa) => (
                    <MapaOption
                      key={mapa.id}
                      mapa={mapa}
                      onClick={() => handleSelectMapa(mapa.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Slot */}
          {step === 'select-slot' && selectedMapaId && (
            <SlotSelector
              mapaId={selectedMapaId}
              caseDocumentId={document.id}
              onAssigned={(slotId) => {
                onAssigned(selectedMapaId, slotId);
                handleClose();
              }}
              onError={setError}
            />
          )}

          {/* Step 3: Create Mapa */}
          {step === 'create-mapa' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="mapa-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Denumire mapă <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="mapa-name"
                  value={newMapaName}
                  onChange={(e) => setNewMapaName(e.target.value)}
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
                  onChange={(e) => setSlotsText(e.target.value)}
                  placeholder={`Cerere de chemare în judecată *\nÎntâmpinare *\nContract\nDovezi`}
                  rows={5}
                  className={clsx(
                    'w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    'placeholder:text-gray-400 resize-none'
                  )}
                />
              </div>

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
                <label htmlFor="mapa-desc" className="block text-sm font-medium text-gray-700 mb-1">
                  Descriere (opțional)
                </label>
                <input
                  type="text"
                  id="mapa-desc"
                  value={newMapaDescription}
                  onChange={(e) => setNewMapaDescription(e.target.value)}
                  placeholder="Descriere scurtă..."
                  className={clsx(
                    'w-full px-3 py-2 border border-gray-300 rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    'placeholder:text-gray-400'
                  )}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer for create mapa step */}
        {step === 'create-mapa' && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Înapoi
            </button>
            <button
              onClick={handleCreateMapa}
              disabled={creating || !newMapaName.trim() || parsedSlots.length === 0}
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                'bg-blue-600 text-white hover:bg-blue-700',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {creating ? 'Se creează...' : 'Crează și continuă'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Mapa option card
 */
function MapaOption({ mapa, onClick }: { mapa: Mapa; onClick: () => void }) {
  const { completionStatus } = mapa;
  const emptySlots = completionStatus.totalSlots - completionStatus.filledSlots;

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200',
        'hover:border-blue-300 hover:bg-blue-50 transition-colors text-left'
      )}
    >
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
        <svg
          className="w-5 h-5 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">{mapa.name}</div>
        <div className="flex items-center gap-2 text-sm">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all',
                completionStatus.isComplete ? 'bg-green-500' : 'bg-blue-500'
              )}
              style={{ width: `${completionStatus.percentComplete}%` }}
            />
          </div>
          <span className="text-gray-500 text-xs whitespace-nowrap">
            {emptySlots > 0 ? `${emptySlots} libere` : 'Completă'}
          </span>
        </div>
      </div>
      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

/**
 * Slot selector component - fetches mapa details and allows slot selection
 */
function SlotSelector({
  mapaId,
  caseDocumentId,
  onAssigned,
  onError,
}: {
  mapaId: string;
  caseDocumentId: string;
  onAssigned: (slotId: string) => void;
  onError: (error: string | null) => void;
}) {
  const { mapa, loading, assignDocument } = useMapa(mapaId);
  const [assigning, setAssigning] = useState<string | null>(null);

  const handleAssign = async (slotId: string) => {
    setAssigning(slotId);
    onError(null);

    try {
      await assignDocument(slotId, caseDocumentId);
      onAssigned(slotId);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Eroare la asignare');
    } finally {
      setAssigning(null);
    }
  };

  if (loading || !mapa) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const emptySlots = mapa.slots.filter((s) => !s.document);
  const filledSlots = mapa.slots.filter((s) => s.document);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Selectează poziția pentru document:</p>

      {emptySlots.length === 0 ? (
        <div className="text-center py-6 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-sm text-amber-700">Toate pozițiile sunt ocupate</p>
          <p className="text-xs text-amber-600 mt-1">
            Poți dezasigna un document existent din detaliile mapei
          </p>
        </div>
      ) : (
        <>
          {/* Empty slots first */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Poziții libere ({emptySlots.length})
            </p>
            {emptySlots.map((slot) => (
              <SlotRow
                key={slot.id}
                slot={slot}
                onClick={() => handleAssign(slot.id)}
                disabled={assigning !== null}
                loading={assigning === slot.id}
              />
            ))}
          </div>

          {/* Filled slots shown as disabled */}
          {filledSlots.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Poziții ocupate ({filledSlots.length})
              </p>
              {filledSlots.map((slot) => (
                <SlotRow key={slot.id} slot={slot} disabled />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Individual slot row
 */
function SlotRow({
  slot,
  onClick,
  disabled,
  loading,
}: {
  slot: MapaSlot;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const hasDocument = slot.document !== null;

  return (
    <button
      onClick={onClick}
      disabled={disabled || hasDocument}
      className={clsx(
        'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
        hasDocument
          ? 'border-gray-100 bg-gray-50 cursor-not-allowed'
          : disabled
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
      )}
    >
      {/* Status icon */}
      {hasDocument ? (
        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      ) : slot.required ? (
        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      ) : (
        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-gray-400" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div
          className={clsx('font-medium truncate', hasDocument ? 'text-gray-500' : 'text-gray-900')}
        >
          {slot.name}
          {slot.required && !hasDocument && <span className="text-amber-600 ml-1">*</span>}
        </div>
        {hasDocument && slot.document && (
          <div className="text-xs text-gray-400 truncate">{slot.document.document.fileName}</div>
        )}
      </div>

      {/* Action indicator */}
      {loading ? (
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      ) : !hasDocument && !disabled ? (
        <svg
          className="w-5 h-5 text-blue-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ) : hasDocument ? (
        <span className="text-xs text-gray-400">Ocupat</span>
      ) : null}
    </button>
  );
}

AssignToMapaModal.displayName = 'AssignToMapaModal';
