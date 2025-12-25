/**
 * OverviewTab - Case overview with summary cards
 * OPS-214: Refactored to use section components with edit mode support
 * OPS-225: Added section groups to separate editable from operational sections
 *
 * Displays case details, team, activity, deadlines, and stats.
 * Editable sections use inline editing when ?edit=true and user has permission.
 */

'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { clsx } from 'clsx';
import * as Avatar from '@radix-ui/react-avatar';
import { Clock, FileText, ClipboardList } from 'lucide-react';

// Section components
import {
  CaseDetailsSection,
  ContactsSection,
  ReferencesSection,
  BillingSection,
  SectionGroup,
  parseReferencesFromMetadata,
} from '../sections';

// Hooks
import { useCaseEditPermission } from '../../../hooks/useCaseEditPermission';

// Other components
import { CaseRevenueKPIWidget } from '../CaseRevenueKPIWidget';
import { EditRatesModal } from '../EditRatesModal';
import { CaseAISummarySection } from '../CaseAISummarySection';
import { FinancialData } from '../../auth/FinancialData';

// Types
import type { CaseWithFullRelations } from '../../../hooks/useCase';

// ============================================================================
// Types
// ============================================================================

interface CaseTeamMember {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
}

export interface OverviewTabProps {
  case: CaseWithFullRelations;
  teamMembers?: CaseTeamMember[];
  recentActivity?: ActivityItem[];
  upcomingDeadlines?: DeadlineItem[];
  stats?: CaseStats;
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

// ============================================================================
// Card Component (for read-only sections)
// ============================================================================

interface CardProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

function Card({ title, children, action, className }: CardProps) {
  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200 shadow-sm', className)}>
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ============================================================================
// OverviewTab Component
// ============================================================================

/**
 * OverviewTab Component
 *
 * Displays case overview in grid layout with various information cards.
 * Supports edit mode via ?edit=true query param for users with permission.
 */
export function OverviewTab({
  case: caseData,
  teamMembers = [],
  recentActivity = [],
  upcomingDeadlines = [],
  stats = { totalDocuments: 0, openTasks: 0, billableHours: 0 },
  className,
}: OverviewTabProps) {
  const [showEditRatesModal, setShowEditRatesModal] = useState(false);
  const searchParams = useSearchParams();

  // Check edit permissions
  const {
    canEdit,
    canEditFinancials,
    isLoading: permissionLoading,
  } = useCaseEditPermission(caseData.id);

  // Determine if edit mode is active
  const isEditMode = searchParams.get('edit') === 'true' && canEdit;

  // Parse references from metadata
  const references = parseReferencesFromMetadata(caseData.metadata as Record<string, unknown>);

  // Prepare case details data for section component
  const caseDetailsData = {
    title: caseData.title,
    caseNumber: caseData.caseNumber,
    description: caseData.description,
    type: caseData.type,
    clientId: caseData.clientId,
    clientName: caseData.client?.name,
    value: caseData.value,
    openedDate: caseData.openedDate,
  };

  // Prepare billing data for section component
  const billingData = {
    type: caseData.billingType,
    fixedAmount: caseData.fixedAmount,
    customRates: caseData.customRates,
  };

  // Count items for badges
  const contactsCount = caseData.actors?.length || 0;
  const referencesCount = references.length;

  return (
    <div className={clsx('h-full overflow-y-auto bg-gray-50 p-6', className)}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ================================================================== */}
        {/* EDITABLE SECTION GROUP - "Informații Dosar"                       */}
        {/* ================================================================== */}
        <SectionGroup
          title="Informații Dosar"
          variant="editable"
          storageKey={`case-${caseData.id}-info`}
          count={contactsCount + referencesCount}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Case Details Section */}
            <CaseDetailsSection
              caseId={caseData.id}
              caseData={caseDetailsData}
              editable={isEditMode && !permissionLoading}
              canEditFinancials={canEditFinancials}
            />

            {/* Contacts Section */}
            <ContactsSection
              caseId={caseData.id}
              actors={caseData.actors || []}
              editable={isEditMode && !permissionLoading}
            />

            {/* References Section */}
            <ReferencesSection
              caseId={caseData.id}
              references={references}
              metadata={(caseData.metadata as Record<string, unknown>) || {}}
              editable={isEditMode && !permissionLoading}
            />

            {/* Billing Section */}
            <BillingSection
              caseId={caseData.id}
              billing={billingData}
              editable={isEditMode && canEditFinancials && !permissionLoading}
            />
          </div>
        </SectionGroup>

        {/* ================================================================== */}
        {/* READ-ONLY SECTION GROUP - "Stare Operațională"                    */}
        {/* ================================================================== */}
        <SectionGroup
          title="Stare Operațională"
          variant="readonly"
          storageKey={`case-${caseData.id}-status`}
        >
          <div className="space-y-6">
            {/* AI Summary Section */}
            <CaseAISummarySection caseId={caseData.id} />

            {/* Grid for team, activity, deadlines */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Team Members Card */}
              <Card title="Membrii Echipei">
                <div className="space-y-3">
                  {teamMembers.map((member) => {
                    const firstName = member.firstName || 'U';
                    const lastName = member.lastName || 'U';
                    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
                    return (
                      <div key={member.id} className="flex items-center gap-3">
                        <Avatar.Root className="inline-flex h-10 w-10 rounded-full">
                          <Avatar.Fallback className="flex h-full w-full items-center justify-center rounded-full bg-blue-600 text-white text-sm font-medium">
                            {initials}
                          </Avatar.Fallback>
                        </Avatar.Root>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {firstName} {lastName}
                          </p>
                          <p className="text-xs text-gray-600">{member.role || 'Team Member'}</p>
                        </div>
                        <div className="text-xs text-gray-500">{member.email || ''}</div>
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
                      <div key={deadline.id} className="flex items-center justify-between gap-3">
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
                            statusColors[deadline.status]
                          )}
                        >
                          <Clock className="w-3 h-3" />
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

              {/* Quick Stats Card */}
              <Card title="Statistici Rapide">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Total Documents */}
                  <div key="total-documents" className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalDocuments}</p>
                      <p className="text-sm text-gray-600">Total Documente</p>
                    </div>
                  </div>

                  {/* Open Tasks */}
                  <div key="open-tasks" className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                      <ClipboardList className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats.openTasks}</p>
                      <p className="text-sm text-gray-600">Sarcini Deschise</p>
                    </div>
                  </div>

                  {/* Billable Hours */}
                  <div key="billable-hours" className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats.billableHours}</p>
                      <p className="text-sm text-gray-600">Ore Facturabile</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Revenue KPI Widget - Full Width (Partners only, Fixed cases only) */}
            <FinancialData>
              <Card title="Metrici Venituri">
                <CaseRevenueKPIWidget caseId={caseData.id} billingType={caseData.billingType} />
              </Card>
            </FinancialData>
          </div>
        </SectionGroup>
      </div>

      {/* Edit Rates Modal */}
      <EditRatesModal
        caseId={caseData.id}
        isOpen={showEditRatesModal}
        onClose={() => setShowEditRatesModal(false)}
        currentBillingType={caseData.billingType}
        currentFixedAmount={caseData.fixedAmount}
        currentCustomRates={caseData.customRates}
      />
    </div>
  );
}

OverviewTab.displayName = 'OverviewTab';
