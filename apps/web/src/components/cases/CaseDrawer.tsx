'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  X,
  MoreHorizontal,
  ExternalLink,
  Archive,
  Briefcase,
  Calendar,
  Users,
  User,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Case, statusLabels } from './CaseCard';

export interface CaseDrawerProps {
  caseData: Case | null;
  onClose: () => void;
  onArchive?: () => void;
  onEdit?: () => void;
}

const statusBadgeVariants: Record<string, BadgeVariant> = {
  Active: 'success',
  PendingApproval: 'warning',
  OnHold: 'warning',
  Closed: 'default',
  Archived: 'default',
};

export function CaseDrawer({ caseData, onClose, onArchive, onEdit }: CaseDrawerProps) {
  if (!caseData) {
    return null;
  }

  const leadMember = caseData.teamMembers.find((m) => m.role === 'Lead');
  const otherMembers = caseData.teamMembers.filter((m) => m.role !== 'Lead');

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-linear-border-subtle px-4 py-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/cases/${caseData.id}`}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-secondary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
            title="Deschide pagina cazului"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
          <button
            onClick={onArchive}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-secondary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
            title="Arhiveaza"
          >
            <Archive className="h-4 w-4" />
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md border border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-secondary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
            title="Mai multe"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-linear-text-tertiary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
          title="Inchide"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-5">
          {/* Court Case Number */}
          {caseData.referenceNumbers?.[0] && (
            <div className="mb-2 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-linear-text-tertiary" />
              <span className="text-[11px] font-mono text-linear-accent">
                {caseData.referenceNumbers[0]}
              </span>
            </div>
          )}

          {/* Title */}
          <h2 className="mb-4 text-lg font-normal leading-[1.4] text-linear-text-primary">
            {caseData.title}
          </h2>

          {/* Description */}
          {caseData.description && (
            <p className="mb-6 text-[13px] text-linear-text-secondary leading-relaxed">
              {caseData.description}
            </p>
          )}

          {/* Properties */}
          <div className="mb-6 flex flex-col gap-3 border-b border-linear-border-subtle pb-6">
            {/* Status */}
            <div className="flex items-center gap-3">
              <span className="w-[100px] shrink-0 text-xs text-linear-text-tertiary">Status</span>
              <div className="flex flex-1 items-center gap-2">
                <Badge variant={statusBadgeVariants[caseData.status] || 'default'} size="sm">
                  {statusLabels[caseData.status] || caseData.status}
                </Badge>
              </div>
            </div>

            {/* Type */}
            <div className="flex items-center gap-3">
              <span className="w-[100px] shrink-0 text-xs text-linear-text-tertiary">Tip caz</span>
              <div className="flex flex-1 items-center gap-2 text-[13px] text-linear-text-primary">
                <FileText className="h-4 w-4 text-linear-text-tertiary" />
                <span>{caseData.type}</span>
              </div>
            </div>

            {/* Client */}
            <div className="flex items-center gap-3">
              <span className="w-[100px] shrink-0 text-xs text-linear-text-tertiary">Client</span>
              <div className="flex flex-1 items-center gap-2 text-[13px]">
                <Users className="h-4 w-4 text-linear-text-tertiary" />
                <Link
                  href={`/clients/${caseData.client.id}`}
                  className="text-linear-accent hover:underline"
                >
                  {caseData.client.name}
                </Link>
              </div>
            </div>

            {/* Opened Date */}
            <div className="flex items-center gap-3">
              <span className="w-[100px] shrink-0 text-xs text-linear-text-tertiary">Deschis</span>
              <div className="flex flex-1 items-center gap-2 text-[13px] text-linear-text-primary">
                <Calendar className="h-4 w-4 text-linear-text-tertiary" />
                <span>
                  {new Date(caseData.openedDate).toLocaleDateString('ro-RO', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Team Lead */}
            {leadMember && (
              <div className="flex items-center gap-3">
                <span className="w-[100px] shrink-0 text-xs text-linear-text-tertiary">
                  Responsabil
                </span>
                <div className="flex flex-1 items-center gap-2 text-[13px] text-linear-text-primary">
                  <Avatar
                    size="xs"
                    name={`${leadMember.user.firstName} ${leadMember.user.lastName}`}
                    src={leadMember.user.avatarUrl}
                  />
                  <span>
                    {leadMember.user.firstName} {leadMember.user.lastName}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Team Members */}
          {otherMembers.length > 0 && (
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-normal uppercase tracking-[0.5px] text-linear-text-tertiary">
                  Echipa
                </span>
                <span className="text-[11px] text-linear-text-muted">
                  {otherMembers.length} membri
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {otherMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-md bg-linear-bg-tertiary px-3 py-2"
                  >
                    <Avatar
                      size="xs"
                      name={`${member.user.firstName} ${member.user.lastName}`}
                      src={member.user.avatarUrl}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-linear-text-primary truncate">
                        {member.user.firstName} {member.user.lastName}
                      </div>
                      <div className="text-[11px] text-linear-text-tertiary">{member.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="border-t border-linear-border-subtle pt-4">
            <div className="mb-3">
              <span className="text-xs font-normal uppercase tracking-[0.5px] text-linear-text-tertiary">
                Actiuni rapide
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <Link
                href={`/cases/${caseData.id}`}
                className="flex items-center gap-2 px-3 py-2 text-[13px] text-linear-text-secondary rounded-md transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
              >
                <ExternalLink className="h-4 w-4" />
                Vezi detalii complete
              </Link>
              <Link
                href={`/cases/${caseData.id}/documents`}
                className="flex items-center gap-2 px-3 py-2 text-[13px] text-linear-text-secondary rounded-md transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
              >
                <FileText className="h-4 w-4" />
                Documente caz
              </Link>
              <Link
                href={`/tasks?caseId=${caseData.id}`}
                className="flex items-center gap-2 px-3 py-2 text-[13px] text-linear-text-secondary rounded-md transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
              >
                <User className="h-4 w-4" />
                Sarcini asociate
              </Link>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default CaseDrawer;
