/**
 * Pending Approval Table Component
 *
 * Displays pending approval cases with review actions for Partners.
 * Used inline in the main /cases page when filtering by PendingApproval status.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PendingCaseWithRelations } from '../../hooks/usePendingCases';
import { useCaseApprove, useCaseReject } from '../../hooks/useCaseApproval';
import { useNotificationStore } from '../../stores/notificationStore';
import { ReviewCaseModal } from './ReviewCaseModal';

// Revision count badge
function RevisionBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <span className="inline-flex items-center rounded-full bg-linear-warning/15 px-2.5 py-0.5 text-xs font-medium text-linear-warning border border-linear-warning/30">
      Revizie #{count}
    </span>
  );
}

// Format date helper
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat('ro-RO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

// Calculate time since submission for FIFO urgency indicator
function getTimeSinceSubmission(submittedAt: Date | string): string {
  const now = new Date();
  const submitted = new Date(submittedAt);
  const diffMs = now.getTime() - submitted.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `acum ${diffDays} ${diffDays === 1 ? 'zi' : 'zile'}`;
  }
  if (diffHours > 0) {
    return `acum ${diffHours} ${diffHours === 1 ? 'oră' : 'ore'}`;
  }
  return 'Tocmai acum';
}

interface PendingApprovalTableProps {
  cases: PendingCaseWithRelations[];
  onRefetch: () => void;
}

export function PendingApprovalTable({ cases, onRefetch }: PendingApprovalTableProps) {
  const router = useRouter();
  const { approveCase, loading: approveLoading } = useCaseApprove();
  const { rejectCase, loading: rejectLoading } = useCaseReject();
  const { addNotification } = useNotificationStore();
  const [selectedCase, setSelectedCase] = useState<PendingCaseWithRelations | null>(null);

  const handleApprove = async (caseId: string) => {
    try {
      const caseToApprove = cases.find((c) => c.id === caseId);
      if (caseToApprove && caseToApprove.teamMembers && caseToApprove.teamMembers.length === 0) {
        const confirmed = window.confirm(
          'Acest dosar nu are membri de echipă alocați. Doriți să-l aprobați oricum?'
        );
        if (!confirmed) {
          return;
        }
      }

      await approveCase(caseId);

      addNotification({
        type: 'success',
        title: 'Dosar aprobat',
        message: 'Dosarul este acum activ și asociatul a fost notificat.',
      });

      setSelectedCase(null);
      await onRefetch();
    } catch (err) {
      const error = err as Error;
      let errorMessage = 'A apărut o eroare la aprobarea dosarului.';

      if (error.message.includes('FORBIDDEN')) {
        errorMessage = 'Doar Partenerii pot aproba dosare.';
      } else if (error.message.includes('BAD_USER_INPUT')) {
        errorMessage = 'Dosarul nu este în starea de aprobare.';
      }

      addNotification({
        type: 'error',
        title: 'Aprobare eșuată',
        message: errorMessage,
      });
    }
  };

  const handleReject = async (caseId: string, reason: string) => {
    try {
      await rejectCase(caseId, reason);

      addNotification({
        type: 'success',
        title: 'Dosar respins',
        message: 'Dosarul a fost respins și asociatul a fost notificat.',
      });

      setSelectedCase(null);
      await onRefetch();
    } catch (err) {
      const error = err as Error;
      let errorMessage = 'A apărut o eroare la respingerea dosarului.';

      if (error.message.includes('FORBIDDEN')) {
        errorMessage = 'Doar Partenerii pot respinge dosare.';
      } else if (error.message.includes('BAD_USER_INPUT')) {
        errorMessage = 'Dosarul nu este în starea de aprobare sau motivul este invalid.';
      } else if (error.message.includes('at least 10 characters')) {
        errorMessage = 'Motivul respingerii trebuie să aibă cel puțin 10 caractere.';
      }

      addNotification({
        type: 'error',
        title: 'Respingere eșuată',
        message: errorMessage,
      });
    }
  };

  const handleRowClick = (caseId: string) => {
    router.push(`/cases/${caseId}`);
  };

  if (cases.length === 0) {
    return null;
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-linear-border-subtle bg-linear-bg-secondary shadow">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-linear-border-subtle table-fixed">
            <thead className="bg-linear-bg-tertiary">
              <tr>
                <th
                  scope="col"
                  className="w-1/5 px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
                >
                  Titlu dosar
                </th>
                <th
                  scope="col"
                  className="w-1/6 px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
                >
                  Client
                </th>
                <th
                  scope="col"
                  className="w-1/6 px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
                >
                  Trimis de
                </th>
                <th
                  scope="col"
                  className="w-1/6 px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
                >
                  Data trimiterii
                </th>
                <th
                  scope="col"
                  className="w-24 px-4 py-3 text-center text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
                >
                  Revizie
                </th>
                <th
                  scope="col"
                  className="w-28 px-4 py-3 text-right text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
                >
                  Acțiuni
                </th>
              </tr>
            </thead>
            <tbody className="bg-linear-bg-secondary divide-y divide-linear-border-subtle">
              {cases.map((caseItem) => (
                <tr key={caseItem.id} className="hover:bg-linear-bg-hover transition-colors">
                  <td
                    className="px-4 py-4 cursor-pointer"
                    onClick={() => handleRowClick(caseItem.id)}
                  >
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-linear-text-primary truncate">
                        {caseItem.title}
                      </div>
                      <div className="text-sm text-linear-text-tertiary">{caseItem.caseNumber}</div>
                    </div>
                  </td>
                  <td
                    className="px-4 py-4 cursor-pointer"
                    onClick={() => handleRowClick(caseItem.id)}
                  >
                    <div className="text-sm text-linear-text-primary truncate">
                      {caseItem.client?.name || 'N/A'}
                    </div>
                  </td>
                  <td
                    className="px-4 py-4 cursor-pointer"
                    onClick={() => handleRowClick(caseItem.id)}
                  >
                    <div className="text-sm font-medium text-linear-text-primary">
                      {caseItem.approval?.submittedBy
                        ? `${caseItem.approval.submittedBy.firstName} ${caseItem.approval.submittedBy.lastName}`
                        : 'Necunoscut'}
                    </div>
                  </td>
                  <td
                    className="px-4 py-4 cursor-pointer"
                    onClick={() => handleRowClick(caseItem.id)}
                  >
                    <div className="flex flex-col">
                      <div className="text-sm text-linear-text-primary">
                        {caseItem.approval?.submittedAt
                          ? formatDate(caseItem.approval.submittedAt)
                          : 'N/A'}
                      </div>
                      <div className="text-xs text-linear-text-tertiary">
                        {caseItem.approval?.submittedAt
                          ? getTimeSinceSubmission(caseItem.approval.submittedAt)
                          : ''}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {caseItem.approval?.revisionCount !== undefined && (
                      <RevisionBadge count={caseItem.approval.revisionCount} />
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCase(caseItem);
                      }}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-linear-accent hover:bg-linear-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-linear-accent transition-colors"
                    >
                      Revizuire
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-linear-border-subtle">
          {cases.map((caseItem) => (
            <div key={caseItem.id} className="p-4">
              <div className="cursor-pointer" onClick={() => handleRowClick(caseItem.id)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1 mr-2">
                    <div className="text-sm font-medium text-linear-text-primary truncate">
                      {caseItem.title}
                    </div>
                    <div className="text-sm text-linear-text-tertiary truncate">
                      {caseItem.caseNumber}
                    </div>
                  </div>
                  {caseItem.approval?.revisionCount !== undefined &&
                    caseItem.approval.revisionCount > 0 && (
                      <RevisionBadge count={caseItem.approval.revisionCount} />
                    )}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-linear-text-tertiary">Client:</span>
                    <span className="text-linear-text-primary truncate ml-2">
                      {caseItem.client?.name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-linear-text-tertiary">Trimis de:</span>
                    <span className="text-linear-text-primary">
                      {caseItem.approval?.submittedBy
                        ? `${caseItem.approval.submittedBy.firstName} ${caseItem.approval.submittedBy.lastName}`
                        : 'Necunoscut'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-linear-text-tertiary">Data:</span>
                    <span className="text-linear-text-primary">
                      {caseItem.approval?.submittedAt
                        ? getTimeSinceSubmission(caseItem.approval.submittedAt)
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <button
                  onClick={() => setSelectedCase(caseItem)}
                  className="w-full inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-linear-accent hover:bg-linear-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-linear-accent transition-colors"
                >
                  Revizuire
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Review Case Modal */}
      {selectedCase && (
        <ReviewCaseModal
          case={selectedCase}
          isOpen={!!selectedCase}
          onClose={() => setSelectedCase(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          loading={approveLoading || rejectLoading}
        />
      )}
    </>
  );
}
