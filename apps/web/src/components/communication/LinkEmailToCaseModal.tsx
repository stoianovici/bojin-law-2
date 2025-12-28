'use client';

/**
 * LinkEmailToCaseModal Component
 * OPS-062: UI Multi-Case Email Display
 *
 * Modal for linking an email to additional cases.
 * Shows available cases (not already linked) for the user to select.
 */

import { useState, useCallback, useMemo } from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { X, Link2, Loader2, Check, Search, AlertCircle, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { useEmailCaseLinks, type EmailCaseLink } from '../../hooks/useEmailSync';
import { useNotificationStore } from '../../stores/notificationStore';

// ============================================================================
// GraphQL Operations
// ============================================================================

const GET_MY_CASES = gql`
  query GetMyCasesForLink {
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

interface LinkEmailToCaseModalProps {
  /** The email ID to link */
  emailId: string;
  /** Email subject for display */
  emailSubject: string;
  /** Already linked case IDs to exclude from options */
  linkedCaseIds: string[];
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when email is linked */
  onLinked?: (link: EmailCaseLink) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function LinkEmailToCaseModal({
  emailId,
  emailSubject,
  linkedCaseIds,
  onClose,
  onLinked,
}: LinkEmailToCaseModalProps) {
  const { addNotification } = useNotificationStore();
  const { linkEmailToCase, linking } = useEmailCaseLinks();

  // State
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseSearch, setCaseSearch] = useState('');

  // Fetch all user's cases
  const { data: casesData, loading: loadingCases } = useQuery<{
    myCases: Array<CaseOption & { status: string }>;
  }>(GET_MY_CASES, {
    fetchPolicy: 'cache-and-network',
  });

  // Filter cases: exclude already linked, filter by search, only active cases
  const availableCases = useMemo(() => {
    const allCases = casesData?.myCases || [];
    const searchLower = caseSearch.toLowerCase().trim();

    return allCases.filter((c) => {
      // Exclude already linked cases
      if (linkedCaseIds.includes(c.id)) return false;
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
  }, [casesData?.myCases, linkedCaseIds, caseSearch]);

  // Handle link
  const handleLink = useCallback(async () => {
    if (!selectedCaseId) {
      addNotification({
        type: 'error',
        title: 'Selectați un dosar',
        message: 'Alegeți un dosar pentru a adăuga emailul',
      });
      return;
    }

    try {
      const link = await linkEmailToCase(emailId, selectedCaseId, false);

      if (link) {
        const caseName = link.case?.title || 'dosarul selectat';

        addNotification({
          type: 'success',
          title: 'Email adăugat',
          message: `Emailul a fost adăugat în ${caseName}`,
        });

        onLinked?.(link);
        onClose();
      }
    } catch (error) {
      console.error('[LinkEmailToCaseModal] Error linking email:', error);
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: 'Nu s-a putut adăuga emailul la dosar',
      });
    }
  }, [emailId, selectedCaseId, linkEmailToCase, addNotification, onLinked, onClose]);

  // Handle case selection
  const handleSelectCase = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-linear-bg-secondary rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Link2 className="h-5 w-5 text-linear-accent" />
            Adaugă email la dosar
          </h3>
          <button
            onClick={onClose}
            className="text-linear-text-muted hover:text-linear-text-secondary p-1 rounded"
            aria-label="Închide"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Email Preview */}
          <div className="bg-linear-bg-tertiary rounded-lg p-3 border border-linear-border-subtle">
            <p className="text-sm text-linear-text-tertiary mb-1">Email:</p>
            <p className="font-medium text-linear-text-primary truncate">{emailSubject || '(Fără subiect)'}</p>
            {linkedCaseIds.length > 0 && (
              <p className="mt-2 text-xs text-linear-text-tertiary">
                Deja în {linkedCaseIds.length} dosar{linkedCaseIds.length === 1 ? '' : 'e'}
              </p>
            )}
          </div>

          {/* Info Message */}
          <div className="bg-linear-accent/10 rounded-lg p-3 border border-linear-accent/30">
            <p className="text-sm text-linear-accent">
              Selectați un dosar pentru a adăuga acest email. Emailul va apărea în ambele dosare.
            </p>
          </div>

          {/* Case Search/Filter */}
          <div>
            <label className="block text-sm font-medium text-linear-text-secondary mb-2">
              Selectați dosarul:
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-linear-text-muted" />
              <input
                type="text"
                value={caseSearch}
                onChange={(e) => setCaseSearch(e.target.value)}
                placeholder="Filtrați după nume sau număr dosar..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-linear-border rounded-md focus:ring-linear-accent focus:border-linear-accent"
              />
            </div>
          </div>

          {/* Case List */}
          <div className="space-y-2">
            {loadingCases && (
              <div className="flex items-center gap-2 text-sm text-linear-text-tertiary py-2">
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
                        ? 'border-linear-accent bg-linear-accent/10'
                        : 'border-linear-border-subtle hover:border-linear-border hover:bg-linear-bg-tertiary'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={clsx(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                          selectedCaseId === caseData.id
                            ? 'border-linear-accent bg-linear-accent'
                            : 'border-linear-border'
                        )}
                      >
                        {selectedCaseId === caseData.id && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-linear-text-primary truncate">{caseData.title}</p>
                        <p className="text-sm text-linear-text-tertiary">{caseData.caseNumber}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!loadingCases && availableCases.length === 0 && caseSearch.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-linear-text-tertiary py-4">
                <AlertCircle className="h-4 w-4" />
                <span>Nu s-au găsit dosare pentru &ldquo;{caseSearch}&rdquo;</span>
              </div>
            )}

            {!loadingCases && availableCases.length === 0 && caseSearch.length === 0 && (
              <p className="text-sm text-linear-text-tertiary text-center py-4">
                Nu aveți alte dosare active disponibile
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t bg-linear-bg-tertiary">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-linear-text-secondary hover:bg-linear-bg-hover rounded-md transition-colors"
          >
            Anulează
          </button>
          <button
            onClick={handleLink}
            disabled={linking || !selectedCaseId}
            className={clsx(
              'px-4 py-2 text-sm text-white rounded-md transition-colors flex items-center gap-2',
              'bg-linear-accent hover:bg-linear-accent-hover disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {linking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Se adaugă...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Adaugă la dosar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

LinkEmailToCaseModal.displayName = 'LinkEmailToCaseModal';

export default LinkEmailToCaseModal;
