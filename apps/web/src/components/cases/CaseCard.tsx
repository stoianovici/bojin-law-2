'use client';

import Link from 'next/link';
import { Briefcase, Calendar, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { CaseSyncProgress } from './CaseSyncProgress';
import { useCaseSyncStatus } from '@/hooks/useCaseSyncStatus';

export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  status: string;
  type: string;
  openedDate: string;
  client: {
    id: string;
    name: string;
  };
  teamMembers: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl?: string;
    };
  }>;
  billingType?: 'Hourly' | 'Fixed';
  fixedAmount?: number;
  customRates?: {
    partnerRate?: number;
    associateRate?: number;
    paralegalRate?: number;
  };
  syncStatus?: 'Pending' | 'Syncing' | 'Completed' | 'Failed';
  syncError?: string;
  approval?: {
    id: string;
    submittedBy: {
      id: string;
      firstName: string;
      lastName: string;
    };
    submittedAt: string;
    reviewedBy?: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
    reviewedAt?: string | null;
    status: 'Pending' | 'Approved' | 'Rejected';
    rejectionReason?: string | null;
    revisionCount: number;
  };
}

export const statusBadgeVariants: Record<string, BadgeVariant> = {
  Active: 'success',
  PendingApproval: 'warning',
  OnHold: 'warning',
  Closed: 'default',
  Archived: 'default',
};

export const statusLabels: Record<string, string> = {
  Active: 'Activ',
  PendingApproval: 'În așteptare',
  OnHold: 'Suspendat',
  Closed: 'Închis',
  Archived: 'Arhivat',
};

interface CaseCardProps {
  caseData: Case;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

export function CaseCard({ caseData, isSelected, onSelect }: CaseCardProps) {
  const leadMember = caseData.teamMembers.find((m) => m.role === 'Lead');
  const { syncStatus, syncError, isStale, retryCaseSync } = useCaseSyncStatus({
    caseId: caseData.id,
    initialStatus: caseData.syncStatus,
  });

  const cardContent = (
    <Card
      className={cn(
        'p-4 transition-colors cursor-pointer border',
        isSelected
          ? 'border-linear-accent bg-linear-bg-tertiary'
          : 'border-transparent hover:border-linear-border-default hover:shadow-sm hover:bg-linear-bg-elevated'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-linear-text-secondary" />
          <span className="text-xs text-linear-text-secondary font-mono">
            {caseData.caseNumber}
          </span>
        </div>
        <Badge variant={statusBadgeVariants[caseData.status] || 'default'} size="sm">
          {statusLabels[caseData.status] || caseData.status}
        </Badge>
      </div>

      <h3 className="font-light text-linear-text-primary mb-1 line-clamp-1">{caseData.title}</h3>

      <p className="text-sm text-linear-text-secondary mb-3 line-clamp-2">{caseData.description}</p>

      {syncStatus && syncStatus !== 'Completed' && (
        <CaseSyncProgress
          syncStatus={syncStatus}
          syncError={syncError}
          isStale={isStale}
          onRetry={retryCaseSync}
          className="mb-3"
        />
      )}

      <div className="flex items-center justify-between text-xs text-linear-text-secondary">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {caseData.client.name}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(caseData.openedDate).toLocaleDateString('ro-RO')}
          </span>
        </div>
        {leadMember && (
          <div className="flex items-center gap-2">
            <Avatar
              src={leadMember.user.avatarUrl}
              name={`${leadMember.user.firstName} ${leadMember.user.lastName}`}
              size="xs"
            />
            <span>
              {leadMember.user.firstName} {leadMember.user.lastName}
            </span>
          </div>
        )}
      </div>
    </Card>
  );

  if (onSelect) {
    return <div onClick={() => onSelect(caseData.id)}>{cardContent}</div>;
  }

  return <Link href={`/cases/${caseData.id}`}>{cardContent}</Link>;
}
