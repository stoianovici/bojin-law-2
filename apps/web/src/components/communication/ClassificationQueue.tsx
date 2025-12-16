'use client';

/**
 * Classification Queue Component
 * OPS-031: Classification Review & Correction
 *
 * Displays emails pending classification review with suggested cases
 * and allows users to assign or dismiss items.
 */

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import clsx from 'clsx';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  FileWarning,
  HelpCircle,
  Inbox,
  Loader2,
  Mail,
  Paperclip,
  RefreshCw,
  Scale,
  Search,
  X,
} from 'lucide-react';
import {
  useClassificationQueue,
  usePendingClassificationCount,
  useClassificationMutations,
  REASON_LABELS,
  REASON_DESCRIPTIONS,
  MATCH_TYPE_LABELS,
} from '../../hooks/useClassificationReview';
import type {
  PendingClassificationItem,
  ClassificationReason,
} from '../../hooks/useClassificationReview';

// ============================================================================
// Types
// ============================================================================

interface ClassificationQueueProps {
  onEmailClick?: (emailId: string) => void;
  onCaseClick?: (caseId: string) => void;
  maxHeight?: string;
}

// ============================================================================
// Reason Icon Mapping
// ============================================================================

const REASON_ICONS: Record<ClassificationReason, React.ReactNode> = {
  MULTI_CASE_CONFLICT: <Scale className="h-4 w-4" />,
  LOW_CONFIDENCE: <AlertTriangle className="h-4 w-4" />,
  NO_MATCHING_CASE: <Search className="h-4 w-4" />,
  COURT_NO_REFERENCE: <FileWarning className="h-4 w-4" />,
  UNKNOWN_CONTACT: <HelpCircle className="h-4 w-4" />,
};

const REASON_COLORS: Record<ClassificationReason, string> = {
  MULTI_CASE_CONFLICT: 'bg-amber-100 text-amber-700 border-amber-200',
  LOW_CONFIDENCE: 'bg-orange-100 text-orange-700 border-orange-200',
  NO_MATCHING_CASE: 'bg-red-100 text-red-700 border-red-200',
  COURT_NO_REFERENCE: 'bg-purple-100 text-purple-700 border-purple-200',
  UNKNOWN_CONTACT: 'bg-gray-100 text-gray-700 border-gray-200',
};

// ============================================================================
// Queue Item Component
// ============================================================================

interface QueueItemProps {
  item: PendingClassificationItem;
  isExpanded: boolean;
  onToggle: () => void;
  onAssign: (caseId: string) => void;
  onDismiss: () => void;
  onEmailClick?: (emailId: string) => void;
  onCaseClick?: (caseId: string) => void;
  isAssigning: boolean;
}

function QueueItem({
  item,
  isExpanded,
  onToggle,
  onAssign,
  onDismiss,
  onEmailClick,
  onCaseClick,
  isAssigning,
}: QueueItemProps) {
  const fromAddress = item.email.from?.address ?? 'Unknown';
  const fromName = item.email.from?.name ?? fromAddress;

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      {/* Header Row */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
        )}

        <Mail className="h-5 w-5 text-blue-500 flex-shrink-0" />

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">
              {item.email.subject || '(fără subiect)'}
            </span>
            {item.email.hasAttachments && (
              <Paperclip className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            )}
          </div>
          <div className="text-sm text-gray-500 truncate">
            De la: {fromName}
            {fromName !== fromAddress && ` <${fromAddress}>`}
          </div>
        </div>

        {/* Reason Badge */}
        <span
          className={clsx(
            'px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 border flex-shrink-0',
            REASON_COLORS[item.reason]
          )}
          title={REASON_DESCRIPTIONS[item.reason]}
        >
          {REASON_ICONS[item.reason]}
          <span className="hidden sm:inline">{REASON_LABELS[item.reason]}</span>
        </span>

        <span className="text-xs text-gray-400 flex-shrink-0">
          {format(new Date(item.createdAt), 'd MMM, HH:mm', { locale: ro })}
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t bg-gray-50">
          {/* Email Preview */}
          {item.email.bodyPreview && (
            <div className="mt-3 mb-4">
              <div className="text-xs text-gray-500 mb-1">Previzualizare:</div>
              <div className="text-sm text-gray-700 bg-white p-2 rounded border line-clamp-3">
                {item.email.bodyPreview}
              </div>
            </div>
          )}

          {/* Detected References */}
          {item.detectedReferences.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-1">Referințe detectate:</div>
              <div className="flex flex-wrap gap-1">
                {item.detectedReferences.map((ref, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-mono"
                  >
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Cases */}
          <div className="mb-4">
            <div className="text-xs text-gray-500 mb-2">Dosare sugerate:</div>
            {item.suggestedCases.length > 0 ? (
              <div className="space-y-2">
                {item.suggestedCases.map((suggestion) => (
                  <div
                    key={suggestion.caseId}
                    className="flex items-center justify-between bg-white p-2 rounded border"
                  >
                    <div className="min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCaseClick?.(suggestion.caseId);
                        }}
                        className="font-medium text-blue-600 hover:underline truncate block"
                      >
                        {suggestion.case.title}
                      </button>
                      <div className="text-xs text-gray-500">
                        {suggestion.case.caseNumber}
                        {suggestion.case.client && ` • ${suggestion.case.client.name}`}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <span>{MATCH_TYPE_LABELS[suggestion.matchType]}</span>
                        <span>•</span>
                        <span>{Math.round(suggestion.confidence * 100)}% încredere</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAssign(suggestion.caseId);
                      }}
                      disabled={isAssigning}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {isAssigning ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Atribuie
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">
                Niciun dosar sugerat. Căutați manual sau ignorați emailul.
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEmailClick?.(item.email.id);
              }}
              className="text-sm text-blue-600 hover:underline"
            >
              Vezi email complet
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              disabled={isAssigning}
              className="px-3 py-1.5 text-gray-600 text-sm rounded-md hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Ignoră
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ClassificationQueue({
  onEmailClick,
  onCaseClick,
  maxHeight = 'calc(100vh - 200px)',
}: ClassificationQueueProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterReason, setFilterReason] = useState<ClassificationReason | undefined>();
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const { items, total, loading, error, refetch } = useClassificationQueue(
    filterReason ? { reason: filterReason } : undefined
  );
  const { assignFromQueue, dismissFromQueue, mutating } = useClassificationMutations();

  const handleAssign = async (pendingId: string, caseId: string) => {
    setAssigningId(pendingId);
    const result = await assignFromQueue(pendingId, caseId);
    if (result.success) {
      setExpandedId(null);
      refetch();
    } else {
      // TODO: Show error toast
      console.error(result.error);
    }
    setAssigningId(null);
  };

  const handleDismiss = async (pendingId: string) => {
    setAssigningId(pendingId);
    const result = await dismissFromQueue(pendingId);
    if (result.success) {
      setExpandedId(null);
      refetch();
    } else {
      console.error(result.error);
    }
    setAssigningId(null);
  };

  const reasonCounts = useMemo(() => {
    const counts: Partial<Record<ClassificationReason, number>> = {};
    items.forEach((item) => {
      counts[item.reason] = (counts[item.reason] || 0) + 1;
    });
    return counts;
  }, [items]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg">
        <p className="font-medium">Eroare la încărcarea cozii de clasificare</p>
        <p className="text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Coadă clasificare</h2>
            {total > 0 && (
              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                {total}
              </span>
            )}
          </div>
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Reîmprospătează"
          >
            <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setFilterReason(undefined)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-sm transition-colors',
              !filterReason
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            Toate ({total})
          </button>
          {(Object.keys(REASON_LABELS) as ClassificationReason[]).map((reason) => {
            const count = reasonCounts[reason] || 0;
            if (count === 0 && reason !== filterReason) return null;
            return (
              <button
                key={reason}
                onClick={() => setFilterReason(reason === filterReason ? undefined : reason)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-1',
                  filterReason === reason
                    ? REASON_COLORS[reason]
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {REASON_ICONS[reason]}
                <span className="hidden md:inline">{REASON_LABELS[reason]}</span>
                {count > 0 && <span>({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Queue Items */}
      <div className="overflow-y-auto" style={{ maxHeight }}>
        {loading && items.length === 0 ? (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-gray-500">Se încarcă...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Toate emailurile sunt clasificate!</p>
            <p className="text-sm text-gray-400 mt-1">
              Nu sunt emailuri care necesită revizuire manuală.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {items.map((item) => (
              <QueueItem
                key={item.id}
                item={item}
                isExpanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                onAssign={(caseId) => handleAssign(item.id, caseId)}
                onDismiss={() => handleDismiss(item.id)}
                onEmailClick={onEmailClick}
                onCaseClick={onCaseClick}
                isAssigning={assigningId === item.id || mutating}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Badge Component for Sidebar
// ============================================================================

export function ClassificationQueueBadge() {
  const { count, loading } = usePendingClassificationCount();

  if (loading || count === 0) return null;

  return (
    <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-medium rounded-full">
      {count > 99 ? '99+' : count}
    </span>
  );
}
