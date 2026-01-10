'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { Pencil, Briefcase, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, toast } from '@/components/ui';
import { CaseDetailTabs } from './CaseDetailTabs';
import { CaseSyncProgress } from './CaseSyncProgress';
import { EditTeamModal } from './EditTeamModal';
import { CaseApprovalInfo } from './CaseApprovalInfo';
import { RejectCaseModal } from './RejectCaseModal';
import { type Case } from './index';
import { useAuthStore, isPartner } from '@/store/authStore';
import { useCaseSyncStatus } from '@/hooks/useCaseSyncStatus';
import { useCaseApprovalActions } from '@/hooks/useCaseApproval';

interface CaseDetailPanelProps {
  caseData: Case | null;
  onEdit?: () => void;
  onApprovalComplete?: () => Promise<void>;
}

// Status to dot color and label mapping
const statusConfig: Record<string, { color: string; label: string }> = {
  Active: { color: 'bg-[#22C55E]', label: 'Activ' },
  PendingApproval: { color: 'bg-[#F59E0B]', label: 'In asteptare' },
  OnHold: { color: 'bg-[#666666]', label: 'Suspendat' },
  Closed: { color: 'bg-[#666666]', label: 'Inchis' },
  Archived: { color: 'bg-[#444444]', label: 'Arhivat' },
};

// Empty state component
function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-linear-text-tertiary">
      <Briefcase className="h-12 w-12 mb-4 opacity-30" />
      <p className="text-sm">Selecteaza un caz</p>
      <p className="text-xs mt-1 text-linear-text-muted">
        Alege un caz din lista pentru a vedea detaliile
      </p>
    </div>
  );
}

export function CaseDetailPanel({ caseData, onEdit, onApprovalComplete }: CaseDetailPanelProps) {
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const user = useAuthStore((state) => state.user);

  // Check if user can edit team (partners/admins only)
  const canEditTeam = user?.role ? isPartner(user.role) : false;

  // Sync status polling - only when caseData exists
  const { syncStatus, syncError, isStale, retryCaseSync } = useCaseSyncStatus({
    caseId: caseData?.id || '',
    initialStatus: (caseData as Case & { syncStatus?: string })?.syncStatus,
  });

  // Case approval actions
  const { approveCase, rejectCase, approving, rejecting } = useCaseApprovalActions();

  // Determine if showing approval actions
  const isPendingApproval = caseData?.status === 'PendingApproval';
  const showApprovalActions = isPendingApproval && canEditTeam;

  // Handle case approval with feedback
  const handleApprove = useCallback(async () => {
    if (!caseData?.id) return;

    const result = await approveCase(caseData.id);
    if (result.success) {
      toast({
        title: 'Caz aprobat',
        description: `Cazul "${caseData.title}" a fost aprobat cu succes.`,
        variant: 'success',
      });
      // Refresh case data to update UI
      if (onApprovalComplete) {
        await onApprovalComplete();
      }
    } else {
      toast({
        title: 'Eroare la aprobare',
        description: result.error || 'Nu s-a putut aproba cazul. Încercați din nou.',
        variant: 'error',
      });
    }
  }, [caseData?.id, caseData?.title, approveCase, onApprovalComplete]);

  if (!caseData) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-linear-bg-primary">
        <EmptyState />
      </div>
    );
  }

  const status = statusConfig[caseData.status] || { color: 'bg-[#666666]', label: caseData.status };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-linear-bg-primary">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 flex-shrink-0">
        {/* Row 1: Title */}
        <h1 className="text-2xl font-normal text-linear-text-primary truncate">{caseData.title}</h1>

        {/* Sync progress indicator */}
        {syncStatus && syncStatus !== 'Completed' && (
          <CaseSyncProgress
            syncStatus={syncStatus}
            syncError={syncError}
            isStale={isStale}
            onRetry={retryCaseSync}
            className="mt-2"
          />
        )}

        {/* Approval info for pending cases */}
        {isPendingApproval && caseData.approval && (
          <CaseApprovalInfo approval={caseData.approval} className="mt-3" />
        )}

        {/* Row 2: Case number, status, client, team, actions - full width */}
        <div className="flex items-center justify-between gap-4 mt-2">
          {/* Left: Meta info */}
          <div className="flex items-center gap-3 text-sm text-linear-text-secondary min-w-0">
            <span className="font-mono text-[#6366F1]">{caseData.caseNumber}</span>
            <span className="text-linear-text-muted">•</span>
            <span className="flex items-center gap-1.5">
              <div className={cn('w-2 h-2 rounded-full', status.color)} />
              {status.label}
            </span>
            {caseData.client && (
              <>
                <span className="text-linear-text-muted">•</span>
                <span className="truncate">{caseData.client.name}</span>
              </>
            )}
          </div>

          {/* Right: Team avatars + Edit team + Edit case */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Team avatars */}
            <div className="flex -space-x-2">
              {caseData.teamMembers?.slice(0, 4).map((member) => (
                <div
                  key={member.id}
                  className="w-7 h-7 rounded-full bg-linear-bg-tertiary border-2 border-linear-bg-primary flex items-center justify-center text-xs text-linear-text-secondary"
                  title={`${member.user.firstName} ${member.user.lastName} (${member.role})`}
                >
                  {member.user.firstName[0]}
                  {member.user.lastName[0]}
                </div>
              ))}
              {(caseData.teamMembers?.length ?? 0) > 4 && (
                <div className="w-7 h-7 rounded-full bg-linear-bg-quaternary border-2 border-linear-bg-primary flex items-center justify-center text-xs text-linear-text-tertiary">
                  +{(caseData.teamMembers?.length ?? 0) - 4}
                </div>
              )}
            </div>

            {canEditTeam && (
              <button
                onClick={() => setShowEditTeamModal(true)}
                className="text-xs text-linear-accent hover:text-linear-accent-hover whitespace-nowrap"
              >
                Editeaza echipa
              </button>
            )}

            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-[13px] text-linear-text-secondary hover:text-linear-text-primary hover:bg-linear-bg-hover rounded-md transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editeaza
            </button>

            {/* Approval actions for Partners */}
            {showApprovalActions && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-linear-border-subtle">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApprove}
                  disabled={approving || rejecting}
                  loading={approving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Aproba
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowRejectModal(true)}
                  disabled={approving || rejecting}
                >
                  <X className="h-4 w-4 mr-1" />
                  Respinge
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs and content */}
      <CaseDetailTabs
        caseData={caseData}
        userEmail={user?.email || ''}
        onTriggerSync={retryCaseSync}
        syncStatus={syncStatus}
      />

      {/* Edit Team Modal */}
      <EditTeamModal
        open={showEditTeamModal}
        onOpenChange={setShowEditTeamModal}
        caseId={caseData.id}
        currentTeam={caseData.teamMembers || []}
        onSuccess={onApprovalComplete}
      />

      {/* Reject Case Modal */}
      <RejectCaseModal
        open={showRejectModal}
        onOpenChange={setShowRejectModal}
        caseTitle={caseData.title}
        onReject={(reason) => rejectCase(caseData.id, reason)}
        loading={rejecting}
      />
    </div>
  );
}

export default CaseDetailPanel;
