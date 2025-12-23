'use client';

/**
 * MoveThreadModal Component
 * OPS-044: Manual email thread reassignment UI
 *
 * Modal for users to move email threads between cases.
 * Allows reassigning a thread from one case to another.
 */

import { useState, useCallback, useMemo } from 'react';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { X, Folder, Loader2, Check, Search, AlertCircle, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { useNotificationStore } from '../../stores/notificationStore';

// ============================================================================
// GraphQL Operations
// ============================================================================

const ASSIGN_THREAD_TO_CASE = gql`
  mutation AssignThreadToCase($conversationId: String!, $caseId: ID!) {
    assignThreadToCase(conversationId: $conversationId, caseId: $caseId) {
      thread {
        id
        conversationId
        case {
          id
          title
          caseNumber
        }
      }
      newContactAdded
      contactName
      contactEmail
    }
  }
`;

const GET_MY_CASES = gql`
  query GetMyCasesForMove {
    myCases {
      id
      caseNumber
      title
      status
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

interface CaseOption {
  id: string;
  caseNumber: string;
  title: string;
}

interface MoveThreadModalProps {
  conversationId: string;
  threadSubject: string;
  currentCaseId?: string;
  currentCaseTitle?: string;
  onClose: () => void;
  onMoved?: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function MoveThreadModal({
  conversationId,
  threadSubject,
  currentCaseId,
  currentCaseTitle,
  onClose,
  onMoved,
}: MoveThreadModalProps) {
  const { addNotification } = useNotificationStore();

  // State
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseSearch, setCaseSearch] = useState('');

  // Fetch all user's cases once
  const { data: casesData, loading: loadingCases } = useQuery<{
    myCases: Array<CaseOption & { status: string }>;
  }>(GET_MY_CASES, {
    fetchPolicy: 'cache-and-network',
  });

  // Assign mutation (OPS-125: updated for AssignThreadResult)
  const [assignThread, { loading: assigning }] = useMutation<{
    assignThreadToCase: {
      thread: {
        id: string;
        conversationId: string;
        case: { id: string; title: string; caseNumber: string } | null;
      };
      newContactAdded: boolean;
      contactName?: string;
      contactEmail?: string;
    };
  }>(ASSIGN_THREAD_TO_CASE, {
    refetchQueries: ['GetEmailThreadsByCase'],
  });

  // Filter cases: exclude current case, filter by search, only active cases
  const availableCases = useMemo(() => {
    const allCases = casesData?.myCases || [];
    const searchLower = caseSearch.toLowerCase().trim();

    return allCases.filter((c) => {
      // Exclude current case
      if (c.id === currentCaseId) return false;
      // Only active cases
      if (c.status !== 'Active') return false;
      // Filter by search if provided
      if (searchLower.length >= 2) {
        return (
          c.title.toLowerCase().includes(searchLower) ||
          c.caseNumber.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [casesData?.myCases, currentCaseId, caseSearch]);

  // Handle move
  const handleMove = useCallback(async () => {
    if (!selectedCaseId) {
      addNotification({
        type: 'error',
        title: 'Selectați un dosar',
        message: 'Alegeți un dosar în care să mutați conversația',
      });
      return;
    }

    try {
      const result = await assignThread({
        variables: {
          conversationId,
          caseId: selectedCaseId,
        },
      });

      const assignResult = result.data?.assignThreadToCase;
      const caseName = assignResult?.thread?.case?.title || 'dosarul selectat';

      // OPS-125: Show contact added message if applicable
      if (assignResult?.newContactAdded && assignResult?.contactEmail) {
        addNotification({
          type: 'success',
          title: 'Conversație mutată',
          message: `Conversația a fost mutată în ${caseName}. Contactul ${assignResult.contactName || assignResult.contactEmail} a fost adăugat automat.`,
        });
      } else {
        addNotification({
          type: 'success',
          title: 'Conversație mutată',
          message: `Conversația a fost mutată în ${caseName}`,
        });
      }

      onMoved?.();
      onClose();
    } catch (error) {
      console.error('[MoveThreadModal] Error moving thread:', error);
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: 'Nu s-a putut muta conversația',
      });
    }
  }, [conversationId, selectedCaseId, assignThread, addNotification, onMoved, onClose]);

  // Handle case selection
  const handleSelectCase = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Folder className="h-5 w-5 text-blue-600" />
            Mută în alt dosar
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded"
            aria-label="Închide"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Thread Preview */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Conversație:</p>
            <p className="font-medium text-gray-900 truncate">
              {threadSubject || '(Fără subiect)'}
            </p>
            {currentCaseTitle && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                <Folder className="h-4 w-4" />
                <span>Dosar actual: {currentCaseTitle}</span>
              </div>
            )}
          </div>

          {/* Case Search/Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selectați dosarul destinație:
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={caseSearch}
                onChange={(e) => setCaseSearch(e.target.value)}
                placeholder="Filtrați după nume sau număr dosar..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Case List */}
          <div className="space-y-2">
            {loadingCases && (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Se încarcă dosarele...
              </div>
            )}

            {!loadingCases && availableCases.length > 0 && (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {availableCases.map((caseData) => (
                  <button
                    key={caseData.id}
                    onClick={() => handleSelectCase(caseData.id)}
                    className={clsx(
                      'w-full p-3 rounded-lg border-2 text-left transition-all',
                      selectedCaseId === caseData.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={clsx(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                          selectedCaseId === caseData.id
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        )}
                      >
                        {selectedCaseId === caseData.id && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{caseData.title}</p>
                        <p className="text-sm text-gray-500">{caseData.caseNumber}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!loadingCases && availableCases.length === 0 && caseSearch.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                <AlertCircle className="h-4 w-4" />
                <span>Nu s-au găsit dosare pentru &ldquo;{caseSearch}&rdquo;</span>
              </div>
            )}

            {!loadingCases && availableCases.length === 0 && caseSearch.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                Nu aveți alte dosare active disponibile
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
          >
            Anulează
          </button>
          <button
            onClick={handleMove}
            disabled={assigning || !selectedCaseId}
            className={clsx(
              'px-4 py-2 text-sm text-white rounded-md transition-colors flex items-center gap-2',
              'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {assigning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Se mută...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                Mută conversația
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

MoveThreadModal.displayName = 'MoveThreadModal';

export default MoveThreadModal;
