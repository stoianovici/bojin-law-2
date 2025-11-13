/**
 * OverviewTab - Case overview with summary cards
 * Displays case details, team, activity, deadlines, and stats
 */

'use client';

import React from 'react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { clsx } from 'clsx';
import type { Case, User, Task } from '@legal-platform/types';
import * as Avatar from '@radix-ui/react-avatar';

export interface OverviewTabProps {
  case: Case;
  teamMembers?: User[];
  recentActivity?: ActivityItem[];
  upcomingDeadlines?: DeadlineItem[];
  stats?: CaseStats;
  onEditDetails?: () => void;
  className?: string;
}

export interface ActivityItem {
  id: string;
  type: 'document' | 'task' | 'communication' | 'note';
  description: string;
  timestamp: Date;
  userId?: string;
}

export interface DeadlineItem {
  id: string;
  title: string;
  date: Date;
  status: 'upcoming' | 'today' | 'overdue';
}

export interface CaseStats {
  totalDocuments: number;
  openTasks: number;
  billableHours: number;
}

/**
 * Card Component
 */
interface CardProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

function Card({ title, children, action, className }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-white rounded-lg border border-gray-200 shadow-sm',
        className,
      )}
    >
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/**
 * OverviewTab Component
 *
 * Displays case overview in grid layout with various information cards
 */
export function OverviewTab({
  case: caseData,
  teamMembers = [],
  recentActivity = [],
  upcomingDeadlines = [],
  stats = { totalDocuments: 0, openTasks: 0, billableHours: 0 },
  onEditDetails,
  className,
}: OverviewTabProps) {
  return (
    <div className={clsx('h-full overflow-y-auto bg-gray-50 p-6', className)}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Case Details Card */}
          <Card
            title="Detalii Caz"
            action={
              <button
                onClick={onEditDetails}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Editează
              </button>
            }
          >
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-600 mb-1">Descriere</dt>
                <dd className="text-gray-900">{caseData.description}</dd>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-gray-600 mb-1">Data Deschidere</dt>
                  <dd className="text-gray-900">
                    {format(caseData.openedDate, 'dd MMMM yyyy', { locale: ro })}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-600 mb-1">Valoare Caz</dt>
                  <dd className="text-gray-900">
                    {caseData.value
                      ? `${caseData.value.toLocaleString('ro-RO')} RON`
                      : 'N/A'}
                  </dd>
                </div>
              </div>
              <div>
                <dt className="text-gray-600 mb-1">Tip Caz</dt>
                <dd className="text-gray-900">{caseData.type}</dd>
              </div>
            </dl>
          </Card>

          {/* Team Members Card */}
          <Card title="Membrii Echipei">
            <div className="space-y-3">
              {teamMembers.map((member) => {
                const initials = `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase();
                return (
                  <div key={member.id} className="flex items-center gap-3">
                    <Avatar.Root className="inline-flex h-10 w-10 rounded-full">
                      <Avatar.Fallback className="flex h-full w-full items-center justify-center rounded-full bg-blue-600 text-white text-sm font-medium">
                        {initials}
                      </Avatar.Fallback>
                    </Avatar.Root>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="text-xs text-gray-600">{member.role}</p>
                    </div>
                    <div className="text-xs text-gray-500">{member.email}</div>
                  </div>
                );
              })}
              {teamMembers.length === 0 && (
                <p className="text-sm text-gray-500">Niciun membru în echipă</p>
              )}
            </div>
          </Card>

          {/* Recent Activity Card */}
          <Card title="Activitate Recentă">
            <div className="space-y-3">
              {recentActivity.slice(0, 10).map((activity) => (
                <div key={activity.id} className="flex gap-3">
                  <div className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-blue-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {format(activity.timestamp, "dd MMM 'la' HH:mm", {
                        locale: ro,
                      })}
                    </p>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <p className="text-sm text-gray-500">Nicio activitate recentă</p>
              )}
            </div>
          </Card>

          {/* Key Deadlines Card */}
          <Card title="Termene Importante">
            <div className="space-y-3">
              {upcomingDeadlines.map((deadline) => {
                const statusColors = {
                  upcoming: 'text-blue-700 bg-blue-50',
                  today: 'text-yellow-700 bg-yellow-50',
                  overdue: 'text-red-700 bg-red-50',
                };
                return (
                  <div
                    key={deadline.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {deadline.title}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {format(deadline.date, 'dd MMMM yyyy', { locale: ro })}
                      </p>
                    </div>
                    <div
                      className={clsx(
                        'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                        statusColors[deadline.status],
                      )}
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>
                        {deadline.status === 'overdue'
                          ? 'Întârziat'
                          : deadline.status === 'today'
                            ? 'Astăzi'
                            : 'Viitor'}
                      </span>
                    </div>
                  </div>
                );
              })}
              {upcomingDeadlines.length === 0 && (
                <p className="text-sm text-gray-500">Niciun termen programat</p>
              )}
            </div>
          </Card>

          {/* Quick Stats Card - Full Width */}
          <div className="lg:col-span-2">
            <Card title="Statistici Rapide">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Documents */}
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.totalDocuments}
                    </p>
                    <p className="text-sm text-gray-600">Total Documente</p>
                  </div>
                </div>

                {/* Open Tasks */}
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-yellow-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.openTasks}
                    </p>
                    <p className="text-sm text-gray-600">Sarcini Deschise</p>
                  </div>
                </div>

                {/* Billable Hours */}
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.billableHours}
                    </p>
                    <p className="text-sm text-gray-600">Ore Facturabile Luna Aceasta</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

OverviewTab.displayName = 'OverviewTab';
