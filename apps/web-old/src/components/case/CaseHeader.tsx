/**
 * CaseHeader - Header component for case workspace
 * Displays case information, team members, deadline, and action buttons
 */

'use client';

import React from 'react';
import * as Avatar from '@radix-ui/react-avatar';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { format, differenceInDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { clsx } from 'clsx';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Case, CaseStatus, CaseType, User } from '@legal-platform/types';
import { Calendar, Eye, Pencil, Plus, MoreVertical, UserCircle } from 'lucide-react';
import { useCaseEditPermission } from '@/hooks/useCaseEditPermission';

export interface CaseHeaderProps {
  case: Case;
  teamMembers?: User[];
  nextDeadline?: {
    date: Date;
    description: string;
  };
  onAddTeamMember?: () => void;
  onMenuAction?: (action: string) => void;
}

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: CaseStatus }) {
  const statusConfig: Record<CaseStatus, { label: string; className: string }> = {
    PendingApproval: {
      label: 'Pending Approval',
      className: 'bg-linear-warning/15 text-linear-warning border-linear-warning/30',
    },
    Active: {
      label: 'Activ',
      className: 'bg-linear-success/15 text-linear-success border-linear-success/30',
    },
    OnHold: {
      label: 'Suspendat',
      className: 'bg-linear-warning/15 text-linear-warning border-linear-warning/30',
    },
    Closed: {
      label: 'Închis',
      className: 'bg-linear-bg-tertiary text-linear-text-primary border-linear-border-subtle',
    },
    Archived: {
      label: 'Arhivat',
      className: 'bg-linear-bg-tertiary text-linear-text-muted border-linear-border-subtle',
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className={clsx(
        'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border',
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

/**
 * Case Type Label Component
 */
function CaseTypeLabel({ type }: { type: CaseType }) {
  const typeLabels: Record<CaseType, string> = {
    Litigation: 'Litigiu',
    Contract: 'Contract',
    Advisory: 'Consultanță',
    Criminal: 'Penal',
    Other: 'Altele',
  };

  return (
    <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-linear-accent/10 text-linear-accent border border-linear-accent/30">
      {typeLabels[type]}
    </span>
  );
}

/**
 * Team Member Avatar Component
 */
function TeamMemberAvatar({ user }: { user: User }) {
  const firstName = user.firstName || 'U';
  const lastName = user.lastName || 'U';
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <Avatar.Root className="relative inline-flex h-9 w-9 rounded-full hover:ring-2 hover:ring-linear-accent hover:ring-offset-2 transition-all">
      <Avatar.Fallback
        className="flex h-full w-full items-center justify-center rounded-full bg-linear-accent text-white text-sm font-medium"
        title={`${firstName} ${lastName} - ${user.role || 'User'}`}
      >
        {initials}
      </Avatar.Fallback>
    </Avatar.Root>
  );
}

/**
 * Deadline Indicator Component
 */
function DeadlineIndicator({ date, description }: { date: Date; description: string }) {
  const daysUntil = differenceInDays(date, new Date());

  const urgencyConfig = {
    className:
      daysUntil < 3
        ? 'text-linear-error bg-linear-error/10'
        : daysUntil < 7
          ? 'text-linear-warning bg-linear-warning/10'
          : 'text-linear-accent bg-linear-accent/10',
    icon: <Calendar className="w-4 h-4" />,
  };

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-2 px-4 py-2 rounded-lg border',
        urgencyConfig.className
      )}
    >
      {urgencyConfig.icon}
      <div className="flex flex-col">
        <span className="text-xs font-medium">Termen Următor:</span>
        <span className="text-sm font-semibold">
          {format(date, 'dd MMM yyyy', { locale: ro })} - {description}
        </span>
      </div>
    </div>
  );
}

/**
 * CaseHeader Component
 *
 * Main header component for case workspace showing case details,
 * team members, deadline, and action buttons.
 *
 * Memoized for performance optimization to prevent unnecessary re-renders
 * when parent component updates but props remain unchanged.
 */
function CaseHeaderComponent({
  case: caseData,
  teamMembers = [],
  nextDeadline,
  onAddTeamMember,
  onMenuAction,
}: CaseHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canEdit } = useCaseEditPermission(caseData.id);

  const isEditMode = searchParams.get('edit') === 'true';

  const toggleEditMode = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (isEditMode) {
      params.delete('edit');
    } else {
      params.set('edit', 'true');
    }
    const queryString = params.toString();
    router.push(`/cases/${caseData.id}${queryString ? `?${queryString}` : ''}`);
  };

  const visibleTeamMembers = teamMembers.slice(0, 5);
  const remainingCount = teamMembers.length - 5;

  return (
    <header className="bg-linear-bg-secondary border-b border-linear-border-subtle shadow-sm p-6">
      <div className="max-w-7xl mx-auto">
        {/* Top Row: Case Number, Title, Status */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Case Number Badge */}
              <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold bg-linear-accent text-white">
                {caseData.caseNumber}
              </span>
              <StatusBadge status={caseData.status} />
              <CaseTypeLabel type={caseData.type} />
            </div>

            {/* Case Title */}
            <h1 className="text-3xl font-bold text-linear-text-primary leading-tight">
              {caseData.title}
            </h1>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={toggleEditMode}
                className={clsx(
                  'inline-flex items-center px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-2 transition-colors',
                  isEditMode
                    ? 'text-white bg-linear-accent hover:bg-linear-accent-hover'
                    : 'text-linear-text-secondary bg-linear-bg-secondary border border-linear-border hover:bg-linear-bg-hover'
                )}
              >
                {isEditMode ? (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Vizualizare
                  </>
                ) : (
                  <>
                    <Pencil className="w-4 h-4 mr-2" />
                    Editează
                  </>
                )}
              </button>
            )}

            <button
              onClick={onAddTeamMember}
              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-linear-accent hover:bg-linear-accent-hover focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-2 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adaugă Membru
            </button>

            {/* More Options Dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className="inline-flex items-center justify-center w-10 h-10 rounded-md text-linear-text-secondary bg-linear-bg-secondary border border-linear-border hover:bg-linear-bg-hover focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-2 transition-colors"
                  aria-label="Mai multe opțiuni"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="min-w-[200px] bg-linear-bg-elevated rounded-md shadow-lg border border-linear-border-subtle p-1 z-50"
                  sideOffset={5}
                >
                  <DropdownMenu.Item
                    className="flex items-center px-3 py-2 text-sm text-linear-text-secondary rounded-md hover:bg-linear-bg-hover focus:bg-linear-bg-hover cursor-pointer outline-none"
                    onSelect={() => onMenuAction?.('export')}
                  >
                    Exportă Detalii
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="flex items-center px-3 py-2 text-sm text-linear-text-secondary rounded-md hover:bg-linear-bg-hover focus:bg-linear-bg-hover cursor-pointer outline-none"
                    onSelect={() => onMenuAction?.('archive')}
                  >
                    Arhivează Caz
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="h-px bg-linear-border-subtle my-1" />
                  <DropdownMenu.Item
                    className="flex items-center px-3 py-2 text-sm text-linear-error rounded-md hover:bg-linear-error/10 focus:bg-linear-error/10 cursor-pointer outline-none"
                    onSelect={() => onMenuAction?.('delete')}
                  >
                    Șterge Caz
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>

        {/* Bottom Row: Client, Team Members, Deadline */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4 flex-wrap">
            {/* Client Name */}
            <div className="flex items-center gap-2 text-linear-text-secondary">
              <UserCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Client: {caseData.clientId}</span>
            </div>

            {/* Team Members */}
            {teamMembers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-linear-text-secondary">Echipă:</span>
                <div className="flex items-center -space-x-2">
                  {visibleTeamMembers.map((member) => (
                    <TeamMemberAvatar key={member.id} user={member} />
                  ))}
                  {remainingCount > 0 && (
                    <span className="flex items-center justify-center h-9 w-9 rounded-full bg-linear-bg-tertiary text-linear-text-secondary text-xs font-medium border-2 border-linear-bg-secondary">
                      +{remainingCount}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Next Deadline */}
          {nextDeadline && (
            <DeadlineIndicator date={nextDeadline.date} description={nextDeadline.description} />
          )}
        </div>
      </div>
    </header>
  );
}

// Memoized export for performance optimization
export const CaseHeader = React.memo(CaseHeaderComponent);
CaseHeader.displayName = 'CaseHeader';
