'use client';

import * as React from 'react';
import { useState } from 'react';
import { Pencil, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CaseDetailTabs } from './CaseDetailTabs';
import { CaseSyncProgress } from './CaseSyncProgress';
import { type Case } from './index';
import { useAuthStore, isPartner } from '@/store/authStore';
import { useCaseSyncStatus } from '@/hooks/useCaseSyncStatus';

interface CaseDetailPanelProps {
  caseData: Case | null;
  onEdit?: () => void;
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

export function CaseDetailPanel({ caseData, onEdit }: CaseDetailPanelProps) {
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const user = useAuthStore((state) => state.user);

  // Check if user can edit team (partners/admins only)
  const canEditTeam = user?.role ? isPartner(user.role) : false;
  // Check if user can view billing info (partners only)
  const canViewBilling = user?.role ? isPartner(user.role) : false;

  // Sync status polling - only when caseData exists
  const { syncStatus, syncError, retryCaseSync } = useCaseSyncStatus({
    caseId: caseData?.id || '',
    initialStatus: (caseData as any)?.syncStatus,
  });

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
            onRetry={retryCaseSync}
            className="mt-2"
          />
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
    </div>
  );
}

export default CaseDetailPanel;
