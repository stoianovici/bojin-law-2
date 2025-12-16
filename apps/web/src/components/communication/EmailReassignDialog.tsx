'use client';

/**
 * Email Reassign Dialog Component
 * OPS-031: Classification Review & Correction
 *
 * Modal dialog for moving an email to a different case.
 * Shows available cases for the same client with search capability.
 */

import { useState, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import {
  ArrowRight,
  Briefcase,
  Check,
  Loader2,
  Mail,
  Paperclip,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
import {
  useCasesForReassignment,
  useClassificationMutations,
} from '../../hooks/useClassificationReview';
import type { CaseForReassignment } from '../../hooks/useClassificationReview';

// ============================================================================
// Types
// ============================================================================

interface EmailReassignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  emailId: string;
  emailSubject: string;
  emailFrom: string;
  currentCaseId?: string;
  currentCaseTitle?: string;
  onSuccess?: (newCaseId: string, newCaseTitle: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function EmailReassignDialog({
  isOpen,
  onClose,
  emailId,
  emailSubject,
  emailFrom,
  currentCaseId,
  currentCaseTitle,
  onSuccess,
}: EmailReassignDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [moveAttachments, setMoveAttachments] = useState(true);
  const [addSenderAsActor, setAddSenderAsActor] = useState(false);

  const { cases, loading: casesLoading } = useCasesForReassignment(isOpen ? emailId : null);
  const { moveEmail, moveLoading } = useClassificationMutations();

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedCaseId(null);
      setReason('');
      setMoveAttachments(true);
      setAddSenderAsActor(false);
    }
  }, [isOpen]);

  // Filter cases by search query
  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases;
    const query = searchQuery.toLowerCase();
    return cases.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.caseNumber.toLowerCase().includes(query) ||
        c.client?.name.toLowerCase().includes(query)
    );
  }, [cases, searchQuery]);

  const selectedCase = cases.find((c) => c.id === selectedCaseId);

  const handleSubmit = async () => {
    if (!selectedCaseId) return;

    const result = await moveEmail({
      emailId,
      toCaseId: selectedCaseId,
      reason: reason.trim() || undefined,
      moveAttachments,
      addSenderAsActor,
    });

    if (result.success) {
      onSuccess?.(selectedCaseId, selectedCase?.title ?? '');
      onClose();
    } else {
      // TODO: Show error toast
      console.error(result.error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Mută email în alt dosar</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Email Info */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-gray-900 truncate">
                {emailSubject || '(fără subiect)'}
              </div>
              <div className="text-sm text-gray-500 truncate">De la: {emailFrom}</div>
              {currentCaseTitle && (
                <div className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                  <span>Dosar actual:</span>
                  <span className="font-medium text-gray-700">{currentCaseTitle}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Caută dosar după nume, număr sau client..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Case List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {casesLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="h-6 w-6 text-blue-500 animate-spin mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Se încarcă dosarele...</p>
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="py-8 text-center">
              <Briefcase className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">
                {searchQuery ? 'Niciun dosar găsit' : 'Nu există dosare disponibile'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCases.map((caseItem) => (
                <CaseOption
                  key={caseItem.id}
                  caseItem={caseItem}
                  isSelected={selectedCaseId === caseItem.id}
                  isCurrent={currentCaseId === caseItem.id}
                  onSelect={() => setSelectedCaseId(caseItem.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Options */}
        {selectedCaseId && (
          <div className="px-6 py-4 border-t bg-gray-50 space-y-3">
            {/* Reason */}
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Motiv (opțional)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="De ce mutați emailul?"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Checkboxes */}
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={moveAttachments}
                  onChange={(e) => setMoveAttachments(e.target.checked)}
                  className="rounded"
                />
                <Paperclip className="h-4 w-4 text-gray-400" />
                <span>Mută și atașamentele</span>
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={addSenderAsActor}
                  onChange={(e) => setAddSenderAsActor(e.target.checked)}
                  className="rounded"
                />
                <UserPlus className="h-4 w-4 text-gray-400" />
                <span>Adaugă expeditor ca actor</span>
              </label>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Anulează
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedCaseId || moveLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {moveLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Mută în dosar
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Case Option Component
// ============================================================================

interface CaseOptionProps {
  caseItem: CaseForReassignment;
  isSelected: boolean;
  isCurrent: boolean;
  onSelect: () => void;
}

function CaseOption({ caseItem, isSelected, isCurrent, onSelect }: CaseOptionProps) {
  return (
    <button
      onClick={onSelect}
      disabled={isCurrent}
      className={clsx(
        'w-full text-left px-4 py-3 rounded-lg border transition-colors',
        isSelected && 'border-blue-500 bg-blue-50',
        !isSelected && !isCurrent && 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
        isCurrent && 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Briefcase
              className={clsx('h-4 w-4', isSelected ? 'text-blue-500' : 'text-gray-400')}
            />
            <span className={clsx('font-medium truncate', isSelected && 'text-blue-700')}>
              {caseItem.title}
            </span>
            {isCurrent && (
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                Actual
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500 mt-0.5 truncate">
            {caseItem.caseNumber}
            {caseItem.client && ` • ${caseItem.client.name}`}
          </div>
        </div>
        {isSelected && (
          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Check className="h-3 w-3 text-white" />
          </div>
        )}
      </div>
    </button>
  );
}
