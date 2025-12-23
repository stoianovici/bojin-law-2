/**
 * MapaDetail Component
 * OPS-102: Mapa UI Components
 * OPS-103: Mapa Print/Export Functionality
 *
 * Full view of a mapa with all slots
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { clsx } from 'clsx';
import { useMapa } from '../../hooks/useMapa';
import { MapaSlotItem } from './MapaSlotItem';
import { DocumentAssignModal } from './DocumentAssignModal';
import { MapaSlotEditor } from './MapaSlotEditor';
import { usePrintMapa } from './usePrintMapa';

export interface MapaDetailProps {
  mapaId: string;
  caseId: string;
  caseName?: string;
  caseNumber?: string;
  onBack: () => void;
  onDeleted: () => void;
  className?: string;
}

/**
 * MapaDetail - full view of a mapa with all slots
 */
export function MapaDetail({
  mapaId,
  caseId,
  caseName,
  caseNumber,
  onBack,
  onDeleted,
  className,
}: MapaDetailProps) {
  const {
    mapa,
    loading,
    error,
    deleteMapa,
    deleting,
    addSlot,
    updateSlot,
    deleteSlot,
    assignDocument,
    unassignDocument,
  } = useMapa(mapaId);

  const { printMapa } = usePrintMapa();

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [slotEditorOpen, setSlotEditorOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{
    id?: string;
    name: string;
    description: string;
    category: string;
    required: boolean;
  } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const printMenuRef = useRef<HTMLDivElement>(null);

  const handleAssignClick = useCallback((slotId: string) => {
    setSelectedSlotId(slotId);
    setAssignModalOpen(true);
  }, []);

  const handleUnassign = useCallback(
    async (slotId: string) => {
      try {
        await unassignDocument(slotId);
      } catch (err) {
        console.error('Failed to unassign document:', err);
      }
    },
    [unassignDocument]
  );

  const handleAddSlot = useCallback(() => {
    setEditingSlot({
      name: '',
      description: '',
      category: '',
      required: true,
    });
    setSlotEditorOpen(true);
  }, []);

  const handleEditSlot = useCallback(
    (slotId: string) => {
      const slot = mapa?.slots.find((s) => s.id === slotId);
      if (slot) {
        setEditingSlot({
          id: slot.id,
          name: slot.name,
          description: slot.description || '',
          category: slot.category || '',
          required: slot.required,
        });
        setSlotEditorOpen(true);
      }
    },
    [mapa]
  );

  const handleDeleteSlot = useCallback(
    async (slotId: string) => {
      if (window.confirm('Ești sigur că vrei să ștergi această poziție?')) {
        try {
          await deleteSlot(slotId);
        } catch (err) {
          console.error('Failed to delete slot:', err);
        }
      }
    },
    [deleteSlot]
  );

  const handleSaveSlot = useCallback(
    async (data: { name: string; description: string; category: string; required: boolean }) => {
      try {
        if (editingSlot?.id) {
          await updateSlot(editingSlot.id, {
            name: data.name,
            description: data.description || undefined,
            category: data.category || undefined,
            required: data.required,
          });
        } else {
          const maxOrder = mapa?.slots.reduce((max, s) => Math.max(max, s.order), -1) ?? -1;
          await addSlot({
            name: data.name,
            description: data.description || undefined,
            category: data.category || undefined,
            required: data.required,
            order: maxOrder + 1,
          });
        }
        setSlotEditorOpen(false);
        setEditingSlot(null);
      } catch (err) {
        console.error('Failed to save slot:', err);
      }
    },
    [editingSlot, mapa, addSlot, updateSlot]
  );

  const handleDocumentAssigned = useCallback(
    async (caseDocumentId: string) => {
      if (!selectedSlotId) return;
      try {
        await assignDocument(selectedSlotId, caseDocumentId);
        setAssignModalOpen(false);
        setSelectedSlotId(null);
      } catch (err) {
        console.error('Failed to assign document:', err);
      }
    },
    [selectedSlotId, assignDocument]
  );

  const handleDeleteMapa = useCallback(async () => {
    try {
      await deleteMapa();
      onDeleted();
    } catch (err) {
      console.error('Failed to delete mapa:', err);
    }
  }, [deleteMapa, onDeleted]);

  const handlePrintWithToc = useCallback(() => {
    if (!mapa) return;
    printMapa(mapa, caseName || 'Dosar', caseNumber || 'N/A', {
      includeTableOfContents: true,
      includeMissingPlaceholders: false,
    });
    setPrintMenuOpen(false);
  }, [mapa, caseName, caseNumber, printMapa]);

  const handlePrintWithMissing = useCallback(() => {
    if (!mapa) return;
    printMapa(mapa, caseName || 'Dosar', caseNumber || 'N/A', {
      includeTableOfContents: true,
      includeMissingPlaceholders: true,
    });
    setPrintMenuOpen(false);
  }, [mapa, caseName, caseNumber, printMapa]);

  const handlePrintTocOnly = useCallback(() => {
    if (!mapa) return;
    printMapa(mapa, caseName || 'Dosar', caseNumber || 'N/A', {
      includeTableOfContents: true,
      includeMissingPlaceholders: false,
    });
    setPrintMenuOpen(false);
  }, [mapa, caseName, caseNumber, printMapa]);

  // Loading state
  if (loading && !mapa) {
    return (
      <div className={clsx('p-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
          <div className="space-y-3 mt-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={clsx('p-6', className)}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Eroare la încărcarea mapei: {error.message}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!mapa) {
    return (
      <div className={clsx('p-6', className)}>
        <div className="text-center py-12">
          <h3 className="text-sm font-medium text-gray-900">Mapa nu a fost găsită</h3>
        </div>
      </div>
    );
  }

  const selectedSlotName = mapa.slots.find((s) => s.id === selectedSlotId)?.name || '';

  return (
    <div className={clsx('p-6', className)}>
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
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
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">{mapa.name}</h2>
          {mapa.description && <p className="text-sm text-gray-500">{mapa.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {/* Print Dropdown */}
          <div className="relative" ref={printMenuRef}>
            <button
              onClick={() => setPrintMenuOpen(!printMenuOpen)}
              className={clsx(
                'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
                'text-gray-700 hover:bg-gray-100 transition-colors',
                'border border-gray-200'
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              Tipărește
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {printMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPrintMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="py-1">
                    <button
                      onClick={handlePrintWithToc}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Cu cuprins
                    </button>
                    <button
                      onClick={handlePrintWithMissing}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      Cu poziții lipsă
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={handlePrintTocOnly}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 10h16M4 14h16M4 18h16"
                        />
                      </svg>
                      Doar cuprins
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Delete Button */}
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleting}
            className={clsx(
              'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
              'text-red-600 hover:bg-red-50 transition-colors',
              'disabled:opacity-50'
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Șterge
          </button>
        </div>
      </div>

      {/* Completion Status */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Completare</span>
          <div className="flex items-center gap-2">
            {mapa.completionStatus.isComplete ? (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Complet
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                {mapa.completionStatus.requiredSlots - mapa.completionStatus.filledRequiredSlots}{' '}
                documente obligatorii lipsă
              </span>
            )}
            <span className="text-sm text-gray-500">
              {mapa.completionStatus.filledSlots} / {mapa.completionStatus.totalSlots}
            </span>
          </div>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-300',
              mapa.completionStatus.isComplete ? 'bg-green-500' : 'bg-blue-500'
            )}
            style={{ width: `${mapa.completionStatus.percentComplete}%` }}
          />
        </div>
      </div>

      {/* Slots List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-700">Poziții ({mapa.slots.length})</h3>
          <button
            onClick={handleAddSlot}
            className={clsx(
              'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium',
              'bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors'
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Adaugă poziție
          </button>
        </div>

        {mapa.slots.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <svg
              className="w-10 h-10 mx-auto text-gray-400 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm text-gray-500">Nu există poziții în această mapă</p>
            <button
              onClick={handleAddSlot}
              className={clsx(
                'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium mt-3',
                'bg-blue-600 text-white hover:bg-blue-700 transition-colors'
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Adaugă prima poziție
            </button>
          </div>
        ) : (
          mapa.slots.map((slot) => (
            <MapaSlotItem
              key={slot.id}
              slot={slot}
              onAssign={() => handleAssignClick(slot.id)}
              onUnassign={() => handleUnassign(slot.id)}
              onEdit={() => handleEditSlot(slot.id)}
              onDelete={() => handleDeleteSlot(slot.id)}
            />
          ))
        )}
      </div>

      {/* Document Assign Modal */}
      <DocumentAssignModal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setSelectedSlotId(null);
        }}
        caseId={caseId}
        slotId={selectedSlotId || ''}
        slotName={selectedSlotName}
        onAssign={handleDocumentAssigned}
      />

      {/* Slot Editor Modal */}
      <MapaSlotEditor
        isOpen={slotEditorOpen}
        onClose={() => {
          setSlotEditorOpen(false);
          setEditingSlot(null);
        }}
        initialData={editingSlot || undefined}
        onSave={handleSaveSlot}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Șterge mapa</h3>
            <p className="text-sm text-gray-600 mb-6">
              Ești sigur că vrei să ștergi mapa <strong>{mapa.name}</strong>? Această acțiune nu
              poate fi anulată.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Anulează
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  handleDeleteMapa();
                }}
                disabled={deleting}
                className={clsx(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  'bg-red-600 text-white hover:bg-red-700',
                  'disabled:opacity-50'
                )}
              >
                {deleting ? 'Se șterge...' : 'Șterge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

MapaDetail.displayName = 'MapaDetail';
