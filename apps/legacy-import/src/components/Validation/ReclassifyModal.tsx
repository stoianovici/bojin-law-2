'use client';

import { useState, useEffect } from 'react';
import { X, FileText, Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ReclassifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
  document: { id: string; fileName: string } | null;
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export default function ReclassifyModal({
  isOpen,
  onClose,
  onSubmit,
  document,
  isLoading = false,
}: ReclassifyModalProps) {
  const [note, setNote] = useState('');

  // Reset note when modal opens with a new document
  useEffect(() => {
    if (isOpen) {
      setNote('');
    }
  }, [isOpen, document?.id]);

  const handleSubmit = () => {
    if (note.trim()) {
      onSubmit(note.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey && note.trim() && !isLoading) {
      handleSubmit();
    }
  };

  if (!isOpen || !document) return null;

  const isSubmitDisabled = !note.trim() || isLoading;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Reclasificare document</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Document filename */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">Document:</p>
            <p className="font-medium text-gray-900 break-all">{document.fileName}</p>
          </div>

          {/* Annotation field */}
          <div className="mb-4">
            <label
              htmlFor="reclassify-note"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Ce tip de document este acesta?
            </label>
            <textarea
              id="reclassify-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ce tip de document este acesta?"
              rows={4}
              disabled={isLoading}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          {/* Helper text with examples */}
          <p className="text-sm text-gray-500">
            Ex: Contract de vanzare-cumparare, Notificare, Factura, etc.
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Anuleaza
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Se salveaza...
              </>
            ) : (
              'Salveaza'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
