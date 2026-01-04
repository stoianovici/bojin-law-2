'use client';

import * as React from 'react';
import { useState } from 'react';
import { Pencil, ClipboardList, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CaseDetailTabs } from './CaseDetailTabs';
import { type Case } from './index';
import { useAuthStore, isPartner } from '@/store/authStore';

interface CaseDetailPanelProps {
  caseData: Case | null;
  onEdit?: () => void;
  onNewTask?: () => void;
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

export function CaseDetailPanel({ caseData, onEdit, onNewTask }: CaseDetailPanelProps) {
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const user = useAuthStore((state) => state.user);

  // Check if user can edit team (partners/admins only)
  const canEditTeam = user?.role ? isPartner(user.role) : false;
  // Check if user can view billing info (partners only)
  const canViewBilling = user?.role ? isPartner(user.role) : false;

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
      <div className="px-8 pt-6 pb-0 flex-shrink-0">
        {/* Top row: Title + Meta on left, Team + Actions on right */}
        <div className="flex items-start justify-between gap-6">
          {/* Left side: Title and meta */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-normal text-linear-text-primary mb-2 truncate">
              {caseData.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-linear-text-secondary">
              <span className="font-mono text-[#6366F1]">{caseData.caseNumber}</span>
              <span className="text-linear-text-muted">•</span>
              <span className="flex items-center gap-1.5">
                <div className={cn('w-2 h-2 rounded-full', status.color)} />
                {status.label}
              </span>
              {caseData.client && (
                <>
                  <span className="text-linear-text-muted">•</span>
                  <span>{caseData.client.name}</span>
                </>
              )}
            </div>
          </div>

          {/* Right side: Team avatars + Actions */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Team avatars */}
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {caseData.teamMembers?.slice(0, 4).map((member) => (
                  <div
                    key={member.id}
                    className="w-8 h-8 rounded-full bg-linear-bg-tertiary border-2 border-linear-bg-primary flex items-center justify-center text-xs text-linear-text-secondary"
                    title={`${member.user.firstName} ${member.user.lastName} (${member.role})`}
                  >
                    {member.user.firstName[0]}
                    {member.user.lastName[0]}
                  </div>
                ))}
                {(caseData.teamMembers?.length ?? 0) > 4 && (
                  <div className="w-8 h-8 rounded-full bg-linear-bg-quaternary border-2 border-linear-bg-primary flex items-center justify-center text-xs text-linear-text-tertiary">
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
            </div>

            {/* Separator */}
            <div className="w-px h-8 bg-linear-border-subtle" />

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-linear-border-default hover:bg-linear-bg-hover hover:text-linear-text-primary text-[13px] font-light text-linear-text-secondary rounded-lg transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editeaza
              </button>
              <button
                onClick={onNewTask}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-linear-border-default hover:bg-linear-bg-hover hover:text-linear-text-primary text-[13px] font-light text-linear-text-secondary rounded-lg transition-colors"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Sarcina noua
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs and content */}
      <CaseDetailTabs caseData={caseData} userEmail={user?.email || ''} />
    </div>
  );
}

export default CaseDetailPanel;
