'use client';

/**
 * ClassificationModal Component
 * OPS-042: Classification Modal (NECLAR Queue)
 *
 * Modal for users to classify uncertain emails (NECLAR queue).
 * Shows email preview, suggested cases with confidence scores,
 * and allows assigning to a case or marking as ignored.
 */

import { useState, useCallback } from 'react';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  X,
  Mail,
  Folder,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  XCircle,
  Search,
  AlertCircle,
  Clock,
  Tag,
  Hash,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useNotificationStore } from '../../stores/notificationStore';

// ============================================================================
// GraphQL Operations
// ============================================================================

const GET_UNCERTAIN_EMAIL = gql`
  query GetUncertainEmail($id: ID!) {
    uncertainEmail(id: $id) {
      id
      subject
      from {
        name
        address
      }
      receivedDateTime
      bodyPreview
      bodyContent
      suggestedCases {
        id
        caseNumber
        title
        score
        signals {
          type
          weight
          matched
        }
        lastActivityAt
      }
      uncertaintyReason
    }
  }
`;

const CLASSIFY_UNCERTAIN_EMAIL = gql`
  mutation ClassifyUncertainEmail($emailId: ID!, $action: ClassificationActionInput!) {
    classifyUncertainEmail(emailId: $emailId, action: $action) {
      email {
        id
        classificationState
        caseId
      }
      case {
        id
        title
        caseNumber
      }
      wasIgnored
    }
  }
`;

const SEARCH_CASES = gql`
  query SearchCases($search: String, $limit: Int) {
    cases(filters: { search: $search, status: Active }, limit: $limit) {
      cases {
        id
        caseNumber
        title
      }
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

interface ClassificationSignal {
  type: string;
  weight: number;
  matched: string;
}

interface SuggestedCase {
  id: string;
  caseNumber: string;
  title: string;
  score: number;
  signals: ClassificationSignal[];
  lastActivityAt: string | null;
}

interface UncertainEmail {
  id: string;
  subject: string;
  from: { name?: string; address: string };
  receivedDateTime: string;
  bodyPreview: string;
  bodyContent?: string;
  suggestedCases: SuggestedCase[];
  uncertaintyReason?: string;
}

interface ClassificationModalProps {
  emailId: string;
  onClose: () => void;
  onClassified?: () => void;
}

// ============================================================================
// Helper Components
// ============================================================================

function SignalBadge({ signal }: { signal: ClassificationSignal }) {
  const getSignalIcon = () => {
    switch (signal.type) {
      case 'KEYWORD_SUBJECT':
      case 'KEYWORD_BODY':
        return <Tag className="h-3 w-3" />;
      case 'REFERENCE_NUMBER':
        return <Hash className="h-3 w-3" />;
      case 'RECENT_ACTIVITY':
        return <Clock className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getSignalLabel = () => {
    switch (signal.type) {
      case 'KEYWORD_SUBJECT':
        return `"${signal.matched}" în subiect`;
      case 'KEYWORD_BODY':
        return `"${signal.matched}" în conținut`;
      case 'REFERENCE_NUMBER':
        return `Nr. ref: ${signal.matched}`;
      case 'RECENT_ACTIVITY':
        return signal.matched;
      case 'CONTACT_MATCH':
        return 'Contact asociat';
      default:
        return signal.matched;
    }
  };

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
      {getSignalIcon()}
      {getSignalLabel()}
    </span>
  );
}

function CaseOption({
  caseData,
  isSelected,
  onSelect,
}: {
  caseData: SuggestedCase;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const scorePercentage = Math.min(caseData.score, 100);
  const scoreColor =
    scorePercentage >= 70
      ? 'text-green-600'
      : scorePercentage >= 40
        ? 'text-yellow-600'
        : 'text-gray-500';

  return (
    <button
      onClick={onSelect}
      className={clsx(
        'w-full p-3 rounded-lg border-2 text-left transition-all',
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={clsx(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
              isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
            )}
          >
            {isSelected && <Check className="h-3 w-3 text-white" />}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">{caseData.title}</p>
            <p className="text-sm text-gray-500">{caseData.caseNumber}</p>
          </div>
        </div>
        <span className={clsx('text-sm font-semibold flex-shrink-0', scoreColor)}>
          {scorePercentage}% potrivire
        </span>
      </div>

      {/* Signals */}
      {caseData.signals.length > 0 && (
        <div className="mt-2 ml-7 flex flex-wrap gap-1">
          {caseData.signals.slice(0, 3).map((signal, idx) => (
            <SignalBadge key={idx} signal={signal} />
          ))}
        </div>
      )}

      {/* Last activity */}
      {caseData.lastActivityAt && (
        <p className="mt-2 ml-7 text-xs text-gray-500 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Ultima activitate:{' '}
          {new Date(caseData.lastActivityAt).toLocaleDateString('ro-RO', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      )}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ClassificationModal({ emailId, onClose, onClassified }: ClassificationModalProps) {
  const { addNotification } = useNotificationStore();

  // State
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [showFullEmail, setShowFullEmail] = useState(false);
  const [showOtherCase, setShowOtherCase] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState<'case' | 'ignore' | null>(null);

  // Fetch email details
  const {
    data: emailData,
    loading: loadingEmail,
    error: emailError,
  } = useQuery<{ uncertainEmail: UncertainEmail }>(GET_UNCERTAIN_EMAIL, {
    variables: { id: emailId },
  });

  // Search cases for "Alt dosar"
  const { data: searchData, loading: searchingCases } = useQuery<{
    cases: { cases: Array<{ id: string; caseNumber: string; title: string }> };
  }>(SEARCH_CASES, {
    variables: { search: caseSearch, limit: 10 },
    skip: !showOtherCase || caseSearch.length < 2,
  });

  // Classify mutation
  const [classifyEmail, { loading: classifying }] = useMutation<{
    classifyUncertainEmail: {
      email: { id: string; classificationState: string; caseId: string | null };
      case: { id: string; title: string; caseNumber: string } | null;
      wasIgnored: boolean;
    };
  }>(CLASSIFY_UNCERTAIN_EMAIL, {
    refetchQueries: ['GetUncertainEmails', 'GetUncertainEmailsCount'],
  });

  const email = emailData?.uncertainEmail;

  // Handle classification
  const handleClassify = useCallback(async () => {
    if (selectedAction === 'ignore') {
      try {
        await classifyEmail({
          variables: {
            emailId,
            action: { type: 'IGNORE' },
          },
        });

        addNotification({
          type: 'success',
          title: 'Email ignorat',
          message: 'Emailul a fost marcat ca nerelevant',
        });

        onClassified?.();
        onClose();
      } catch (error) {
        console.error('[ClassificationModal] Error ignoring email:', error);
        addNotification({
          type: 'error',
          title: 'Eroare',
          message: 'Nu s-a putut ignora emailul',
        });
      }
      return;
    }

    if (!selectedCaseId) {
      addNotification({
        type: 'error',
        title: 'Selectați un dosar',
        message: 'Alegeți un dosar pentru a clasifica emailul',
      });
      return;
    }

    try {
      const result = await classifyEmail({
        variables: {
          emailId,
          action: { type: 'ASSIGN_TO_CASE', caseId: selectedCaseId },
        },
      });

      const caseName = result.data?.classifyUncertainEmail?.case?.title || 'dosarul selectat';

      addNotification({
        type: 'success',
        title: 'Email clasificat',
        message: `Emailul a fost adăugat în ${caseName}`,
      });

      onClassified?.();
      onClose();
    } catch (error) {
      console.error('[ClassificationModal] Error classifying email:', error);
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: 'Nu s-a putut clasifica emailul',
      });
    }
  }, [
    emailId,
    selectedCaseId,
    selectedAction,
    classifyEmail,
    addNotification,
    onClassified,
    onClose,
  ]);

  // Handle case selection
  const handleSelectCase = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
    setSelectedAction('case');
    setShowOtherCase(false);
  }, []);

  // Handle ignore selection
  const handleSelectIgnore = useCallback(() => {
    setSelectedCaseId(null);
    setSelectedAction('ignore');
    setShowOtherCase(false);
  }, []);

  // Loading state
  if (loadingEmail) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span>Se încarcă...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (emailError || !email) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Eroare la încărcarea emailului</span>
          </div>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Închide
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            Clasifică emailul
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
          {/* Email Preview */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">De la:</span>{' '}
                  {email.from.name || email.from.address}
                  {email.from.name && (
                    <span className="text-gray-400 ml-1">&lt;{email.from.address}&gt;</span>
                  )}
                </p>
                <p className="font-medium text-gray-900 mt-1">{email.subject}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(email.receivedDateTime).toLocaleDateString('ro-RO', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            <div className="mt-3 text-sm text-gray-700">
              <p className={clsx(!showFullEmail && 'line-clamp-3')}>
                {showFullEmail ? email.bodyContent || email.bodyPreview : email.bodyPreview}
              </p>
              {(email.bodyContent?.length || 0) > (email.bodyPreview?.length || 0) && (
                <button
                  onClick={() => setShowFullEmail(!showFullEmail)}
                  className="mt-2 text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                >
                  {showFullEmail ? (
                    <>
                      <ChevronUp className="h-4 w-4" /> Ascunde
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" /> Vezi tot emailul
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Contact Info */}
          <div className="text-sm text-gray-600">
            <span className="font-medium">{email.from.name || email.from.address}</span> are{' '}
            {email.suggestedCases.length}{' '}
            {email.suggestedCases.length === 1 ? 'dosar activ' : 'dosare active'}:
          </div>

          {/* Suggested Cases */}
          <div className="space-y-2">
            {email.suggestedCases.map((caseData) => (
              <CaseOption
                key={caseData.id}
                caseData={caseData}
                isSelected={selectedCaseId === caseData.id && selectedAction === 'case'}
                onSelect={() => handleSelectCase(caseData.id)}
              />
            ))}

            {/* Other Case Option */}
            <button
              onClick={() => setShowOtherCase(!showOtherCase)}
              className={clsx(
                'w-full p-3 rounded-lg border-2 text-left transition-all',
                showOtherCase
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={clsx(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                    showOtherCase ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                  )}
                >
                  {showOtherCase && <Check className="h-3 w-3 text-white" />}
                </div>
                <Folder className="h-4 w-4 text-gray-400" />
                <span className="text-gray-700">Alt dosar...</span>
              </div>
              <p className="text-sm text-gray-500 ml-7 mt-1">Caută sau selectează un alt dosar</p>
            </button>

            {/* Case Search (when "Alt dosar" is selected) */}
            {showOtherCase && (
              <div className="ml-7 mt-2 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={caseSearch}
                    onChange={(e) => setCaseSearch(e.target.value)}
                    placeholder="Caută dosar..."
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>
                {searchingCases && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Se caută...
                  </div>
                )}
                {searchData?.cases?.cases && searchData.cases.cases.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {searchData.cases.cases.map(
                      (c: { id: string; caseNumber: string; title: string }) => (
                        <button
                          key={c.id}
                          onClick={() => handleSelectCase(c.id)}
                          className={clsx(
                            'w-full p-2 text-left rounded hover:bg-gray-100 text-sm',
                            selectedCaseId === c.id && 'bg-blue-50'
                          )}
                        >
                          <span className="font-medium">{c.title}</span>
                          <span className="text-gray-500 ml-2">{c.caseNumber}</span>
                        </button>
                      )
                    )}
                  </div>
                )}
                {caseSearch.length >= 2 &&
                  !searchingCases &&
                  searchData?.cases?.cases?.length === 0 && (
                    <p className="text-sm text-gray-500 py-2">
                      Nu s-au găsit dosare pentru „{caseSearch}"
                    </p>
                  )}
              </div>
            )}

            {/* Ignore Option */}
            <button
              onClick={handleSelectIgnore}
              className={clsx(
                'w-full p-3 rounded-lg border-2 text-left transition-all',
                selectedAction === 'ignore'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={clsx(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                    selectedAction === 'ignore'
                      ? 'border-orange-500 bg-orange-500'
                      : 'border-gray-300'
                  )}
                >
                  {selectedAction === 'ignore' && <Check className="h-3 w-3 text-white" />}
                </div>
                <XCircle className="h-4 w-4 text-gray-400" />
                <span className="text-gray-700">Ignoră</span>
              </div>
              <p className="text-sm text-gray-500 ml-7 mt-1">
                Emailul nu e relevant pentru niciun dosar
              </p>
            </button>
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
            onClick={handleClassify}
            disabled={classifying || (!selectedCaseId && selectedAction !== 'ignore')}
            className={clsx(
              'px-4 py-2 text-sm text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
              selectedAction === 'ignore'
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-blue-600 hover:bg-blue-700'
            )}
          >
            {classifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Se procesează...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Confirmă
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClassificationModal;
