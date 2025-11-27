/**
 * Case List Table Component
 * Story 2.8: Case CRUD Operations UI - Task 3
 *
 * Displays cases in table format with accessibility features
 */

'use client';

import { useRouter } from 'next/navigation';
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
      return 'bg-green-100 text-green-800';
    case 'OnHold':
      return 'bg-yellow-100 text-yellow-800';
    case 'Closed':
      return 'bg-gray-100 text-gray-800';
    case 'Archived':
      return 'bg-slate-100 text-slate-800';
    default:
      return 'bg-gray-100 text-gray-800';
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
          <Avatar.Root className="inline-flex h-8 w-8 select-none items-center justify-center overflow-hidden rounded-full bg-blue-100 align-middle">
            <Avatar.Fallback className="text-xs font-medium text-blue-700">
              {initials}
            </Avatar.Fallback>
          </Avatar.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white shadow-md animate-in fade-in-0 zoom-in-95"
            sideOffset={5}
          >
            {fullName}
            {member.role && <span className="text-gray-300"> ({member.role})</span>}
            <Tooltip.Arrow className="fill-gray-900" />
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
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="w-32 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Nr. Dosar
              </th>
              <th
                scope="col"
                className="w-1/4 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Titlu
              </th>
              <th
                scope="col"
                className="w-1/5 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Client
              </th>
              <th
                scope="col"
                className="w-28 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Tip
              </th>
              <th
                scope="col"
                className="w-28 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Echipă
              </th>
              <th
                scope="col"
                className="w-20 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Acțiuni
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {cases.map((caseItem) => (
              <tr
                key={caseItem.id}
                onClick={() => handleRowClick(caseItem.id)}
                className="hover:bg-gray-50 cursor-pointer transition-colors focus-within:bg-gray-50"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRowClick(caseItem.id);
                  }
                }}
              >
                <td className="px-4 py-4 text-sm font-medium text-gray-900">
                  <div className="truncate" title={caseItem.caseNumber}>
                    {caseItem.caseNumber.length > 12
                      ? `${caseItem.caseNumber.slice(-12)}`
                      : caseItem.caseNumber}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-900">
                  <div className="truncate" title={caseItem.title}>
                    {caseItem.title}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-500">
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
                <td className="px-4 py-4 text-sm text-gray-500">
                  <div className="truncate">
                    {getTypeLabel(caseItem.type)}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex -space-x-2">
                    {caseItem.teamMembers.slice(0, 3).map((member) => (
                      <TeamMemberAvatar key={member.id} member={member} />
                    ))}
                    {caseItem.teamMembers.length > 3 && (
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                        +{caseItem.teamMembers.length - 3}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-500">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowClick(caseItem.id);
                    }}
                    className="text-blue-600 hover:text-blue-900 font-medium focus:outline-none focus:underline"
                    aria-label={`Vezi detalii pentru dosarul ${caseItem.caseNumber}`}
                  >
                    Vezi
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-gray-200">
        {cases.map((caseItem) => (
          <div
            key={caseItem.id}
            onClick={() => handleRowClick(caseItem.id)}
            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleRowClick(caseItem.id);
              }
            }}
            role="button"
            aria-label={`Vezi dosarul ${caseItem.caseNumber}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0 flex-1 mr-2">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {caseItem.caseNumber.length > 12
                    ? `${caseItem.caseNumber.slice(-12)}`
                    : caseItem.caseNumber}
                </div>
                <div className="text-sm text-gray-500 mt-1 truncate">{caseItem.title}</div>
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
                <span className="text-gray-500">Client:</span>
                <span className="text-gray-900 truncate ml-2">{caseItem.client.name}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Tip:</span>
                <span className="text-gray-900">{getTypeLabel(caseItem.type)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Echipă:</span>
                <div className="flex -space-x-2">
                  {caseItem.teamMembers.slice(0, 3).map((member) => (
                    <TeamMemberAvatar key={member.id} member={member} />
                  ))}
                  {caseItem.teamMembers.length > 3 && (
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                      +{caseItem.teamMembers.length - 3}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
