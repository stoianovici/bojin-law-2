/**
 * Case List Table Component
 * Story 2.8: Case CRUD Operations UI - Task 3
 * OPS-330: Linear Design Migration
 *
 * Displays cases in table format with accessibility features
 */

'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import * as Avatar from '@radix-ui/react-avatar';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { CaseStatus } from '@legal-platform/types';

interface TeamMember {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface Client {
  id: string;
  name: string;
}

interface Case {
  id: string;
  caseNumber: string;
  title: string;
  client: Client;
  status: CaseStatus;
  type: string;
  teamMembers: TeamMember[];
}

interface CaseListTableProps {
  cases: Case[];
}

function getStatusColor(status: CaseStatus): string {
  switch (status) {
    case 'Active':
      return 'bg-linear-success/15 text-linear-success';
    case 'OnHold':
      return 'bg-linear-warning/15 text-linear-warning';
    case 'Closed':
      return 'bg-linear-bg-tertiary text-linear-text-tertiary';
    case 'Archived':
      return 'bg-linear-bg-tertiary text-linear-text-muted';
    default:
      return 'bg-linear-bg-tertiary text-linear-text-tertiary';
  }
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
}

function getStatusLabel(status: CaseStatus): string {
  const labels: Record<CaseStatus, string> = {
    Active: 'Activ',
    PendingApproval: 'În aprobare',
    OnHold: 'În așteptare',
    Closed: 'Închis',
    Archived: 'Arhivat',
  };
  return labels[status] || status;
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    Litigation: 'Litigiu',
    Contract: 'Contract',
    Advisory: 'Consultanță',
    Criminal: 'Penal',
    Other: 'Altele',
  };
  return labels[type] || type;
}

function TeamMemberAvatar({ member }: { member: TeamMember }) {
  const initials = getInitials(member.user.firstName, member.user.lastName);
  const fullName = `${member.user.firstName} ${member.user.lastName}`;

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Avatar.Root className="inline-flex h-8 w-8 select-none items-center justify-center overflow-hidden rounded-full bg-linear-accent-muted align-middle">
            <Avatar.Fallback className="text-xs font-medium text-linear-accent">
              {initials}
            </Avatar.Fallback>
          </Avatar.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 rounded-md bg-linear-bg-elevated border border-linear-border-subtle px-3 py-1.5 text-sm text-linear-text-primary shadow-md animate-in fade-in-0 zoom-in-95"
            sideOffset={5}
          >
            {fullName}
            {member.role && <span className="text-linear-text-tertiary"> ({member.role})</span>}
            <Tooltip.Arrow className="fill-linear-bg-elevated" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

export function CaseListTable({ cases }: CaseListTableProps) {
  const router = useRouter();

  const handleRowClick = (caseId: string) => {
    router.push(`/cases/${caseId}`);
  };

  if (cases.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-linear-border-subtle bg-linear-bg-secondary shadow">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-linear-border-subtle table-fixed">
          <thead className="bg-linear-bg-tertiary">
            <tr>
              <th
                scope="col"
                className="w-32 px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
              >
                Nr. Dosar
              </th>
              <th
                scope="col"
                className="w-1/4 px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
              >
                Titlu
              </th>
              <th
                scope="col"
                className="w-1/5 px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
              >
                Client
              </th>
              <th
                scope="col"
                className="w-28 px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="w-24 px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
              >
                Tip
              </th>
              <th
                scope="col"
                className="w-28 px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
              >
                Echipă
              </th>
              <th
                scope="col"
                className="w-20 px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
              >
                Acțiuni
              </th>
            </tr>
          </thead>
          <motion.tbody
            className="bg-linear-bg-secondary divide-y divide-linear-border-subtle"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
            }}
          >
            {cases.map((caseItem) => (
              <motion.tr
                key={caseItem.id}
                onClick={() => handleRowClick(caseItem.id)}
                className="hover:bg-linear-bg-hover cursor-pointer transition-colors duration-150 focus-within:bg-linear-bg-hover"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRowClick(caseItem.id);
                  }
                }}
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <td className="px-4 py-4 text-sm font-medium text-linear-text-primary">
                  <div className="truncate" title={caseItem.caseNumber}>
                    {caseItem.caseNumber.length > 12
                      ? `${caseItem.caseNumber.slice(-12)}`
                      : caseItem.caseNumber}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-linear-text-primary">
                  <div className="truncate" title={caseItem.title}>
                    {caseItem.title}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-linear-text-secondary">
                  <div className="truncate" title={caseItem.client.name}>
                    {caseItem.client.name}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                      caseItem.status
                    )}`}
                  >
                    {getStatusLabel(caseItem.status)}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm text-linear-text-secondary">
                  <div className="truncate">{getTypeLabel(caseItem.type)}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex -space-x-2">
                    {caseItem.teamMembers.slice(0, 3).map((member) => (
                      <TeamMemberAvatar key={member.id} member={member} />
                    ))}
                    {caseItem.teamMembers.length > 3 && (
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-linear-bg-tertiary text-xs font-medium text-linear-text-secondary">
                        +{caseItem.teamMembers.length - 3}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-linear-text-secondary">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowClick(caseItem.id);
                    }}
                    className="text-linear-accent hover:text-linear-accent-hover font-medium focus:outline-none focus:underline transition-colors"
                    aria-label={`Vezi detalii pentru dosarul ${caseItem.caseNumber}`}
                  >
                    Vezi
                  </button>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <motion.div
        className="md:hidden divide-y divide-linear-border-subtle"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
        }}
      >
        {cases.map((caseItem) => (
          <motion.div
            key={caseItem.id}
            onClick={() => handleRowClick(caseItem.id)}
            className="p-4 hover:bg-linear-bg-hover cursor-pointer transition-colors duration-150"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleRowClick(caseItem.id);
              }
            }}
            role="button"
            aria-label={`Vezi dosarul ${caseItem.caseNumber}`}
            variants={{
              hidden: { opacity: 0, x: -12 },
              visible: { opacity: 1, x: 0 },
            }}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0 flex-1 mr-2">
                <div className="text-sm font-medium text-linear-text-primary truncate">
                  {caseItem.caseNumber.length > 12
                    ? `${caseItem.caseNumber.slice(-12)}`
                    : caseItem.caseNumber}
                </div>
                <div className="text-sm text-linear-text-secondary mt-1 truncate">
                  {caseItem.title}
                </div>
              </div>
              <span
                className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                  caseItem.status
                )}`}
              >
                {getStatusLabel(caseItem.status)}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-linear-text-tertiary">Client:</span>
                <span className="text-linear-text-primary truncate ml-2">
                  {caseItem.client.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-linear-text-tertiary">Tip:</span>
                <span className="text-linear-text-primary">{getTypeLabel(caseItem.type)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-linear-text-tertiary">Echipă:</span>
                <div className="flex -space-x-2">
                  {caseItem.teamMembers.slice(0, 3).map((member) => (
                    <TeamMemberAvatar key={member.id} member={member} />
                  ))}
                  {caseItem.teamMembers.length > 3 && (
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-linear-bg-tertiary text-xs font-medium text-linear-text-secondary">
                      +{caseItem.teamMembers.length - 3}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
