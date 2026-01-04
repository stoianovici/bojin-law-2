'use client';

import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Case, statusLabels } from './CaseCard';

interface CaseRowProps {
  caseData: Case;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

const statusDotColors: Record<string, string> = {
  Active: 'bg-green-500',
  PendingApproval: 'bg-yellow-500',
  OnHold: 'bg-orange-500',
  Closed: 'bg-gray-500',
  Archived: 'bg-gray-400',
};

const statusBadgeVariants: Record<string, BadgeVariant> = {
  Active: 'success',
  PendingApproval: 'warning',
  OnHold: 'warning',
  Closed: 'default',
  Archived: 'default',
};

export function CaseRow({ caseData, isSelected, onSelect }: CaseRowProps) {
  const leadMember = caseData.teamMembers.find((m) => m.role === 'Lead');
  const leadName = leadMember
    ? `${leadMember.user.firstName} ${leadMember.user.lastName}`
    : undefined;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-150',
        'bg-linear-bg-secondary border border-linear-border-subtle',
        'hover:border-linear-border-default hover:shadow-sm',
        isSelected && 'border-linear-accent bg-linear-bg-tertiary'
      )}
      onClick={() => onSelect?.(caseData.id)}
    >
      {/* Status indicator dot */}
      <div
        className={cn(
          'w-2 h-2 rounded-full shrink-0',
          statusDotColors[caseData.status] || 'bg-gray-500'
        )}
      />

      {/* Case number */}
      <span className="text-[11px] font-mono text-linear-accent shrink-0">
        {caseData.caseNumber}
      </span>

      {/* Title and client */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-light text-linear-text-primary truncate">
          {caseData.title}
        </div>
        <div className="text-[11px] text-linear-text-tertiary truncate">{caseData.client.name}</div>
      </div>

      {/* Case type badge */}
      <span className="text-[11px] bg-linear-bg-tertiary px-2 py-0.5 rounded text-linear-text-secondary shrink-0">
        Dosar
      </span>

      {/* Status badge */}
      <Badge variant={statusBadgeVariants[caseData.status] || 'default'} size="sm">
        {statusLabels[caseData.status] || caseData.status}
      </Badge>

      {/* Opened date */}
      <div className="flex items-center gap-1 text-xs text-linear-text-secondary shrink-0">
        <Calendar className="h-3.5 w-3.5" />
        <span>{new Date(caseData.openedDate).toLocaleDateString('ro-RO')}</span>
      </div>

      {/* Team lead Avatar */}
      {leadMember && (
        <Avatar src={leadMember.user.avatarUrl} name={leadName} size="xs" className="shrink-0" />
      )}
    </div>
  );
}
