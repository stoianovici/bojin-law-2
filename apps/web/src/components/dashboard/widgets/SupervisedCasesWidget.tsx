/**
 * SupervisedCasesWidget - Partner Dashboard Supervised Cases List
 * Displays cases where the current partner is supervisor/lead with risk indicators
 */

'use client';

import React, { useMemo } from 'react';
import { WidgetContainer } from '../WidgetContainer';
import type { SupervisedCasesWidget as SupervisedCasesWidgetType } from '@legal-platform/types';
import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';

export interface SupervisedCasesWidgetProps {
  widget: SupervisedCasesWidgetType;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
}

/**
 * Case Status Badge Component
 */
function CaseStatusBadge({ status }: { status: 'Active' | 'OnHold' | 'Closed' | 'Archived' }) {
  const statusConfig = {
    Active: {
      label: 'Activ',
      className: 'bg-blue-100 text-blue-700',
    },
    OnHold: {
      label: 'În Așteptare',
      className: 'bg-yellow-100 text-yellow-700',
    },
    Closed: {
      label: 'Închis',
      className: 'bg-gray-100 text-gray-700',
    },
    Archived: {
      label: 'Arhivat',
      className: 'bg-gray-100 text-gray-500',
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

/**
 * Risk Level Indicator Component
 */
function RiskLevelIndicator({ level }: { level: 'high' | 'medium' | 'low' }) {
  const riskConfig = {
    high: {
      label: 'Risc Ridicat',
      className: 'bg-red-100 text-red-700 border-red-300',
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L1 21h22L12 2zm0 4l8.5 15h-17L12 6zm-1 6v4h2v-4h-2zm0 5v2h2v-2h-2z" />
        </svg>
      ),
    },
    medium: {
      label: 'Risc Mediu',
      className: 'bg-orange-100 text-orange-700 border-orange-300',
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      ),
    },
    low: {
      label: 'Risc Scăzut',
      className: 'bg-green-100 text-green-700 border-green-300',
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
        </svg>
      ),
    },
  };

  const config = riskConfig[level];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium',
        config.className
      )}
      title={config.label}
    >
      {config.icon}
      <span className="hidden sm:inline">{config.label}</span>
    </span>
  );
}

/**
 * Case List Item Component
 */
function CaseListItem({
  caseItem,
  onClick,
}: {
  caseItem: SupervisedCasesWidgetType['cases'][0];
  onClick: () => void;
}) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getDeadlineUrgency = (deadline: Date) => {
    const now = new Date();
    const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) return { color: 'text-red-600', label: 'Depășit' };
    if (daysRemaining === 0) return { color: 'text-red-600', label: 'Astăzi' };
    if (daysRemaining <= 3) return { color: 'text-orange-600', label: `${daysRemaining} zile` };
    return { color: 'text-gray-900', label: formatDate(deadline) };
  };

  const deadlineInfo = caseItem.nextDeadline ? getDeadlineUrgency(caseItem.nextDeadline) : null;

  return (
    <div
      onClick={onClick}
      className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors last:border-b-0"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Caz ${caseItem.caseNumber}: ${caseItem.title}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <button
              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              {caseItem.caseNumber}
            </button>
            <CaseStatusBadge status={caseItem.status} />
            <RiskLevelIndicator level={caseItem.riskLevel} />
          </div>
          <h4 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-1" title={caseItem.title}>
            {caseItem.title}
          </h4>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span>{caseItem.clientName}</span>
          </div>
          <div className="flex items-center gap-1 text-gray-600" title="Mărimea echipei">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span>{caseItem.teamSize} membri</span>
          </div>
        </div>
        {deadlineInfo && (
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className={clsx('font-medium', deadlineInfo.color)}>{deadlineInfo.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * SupervisedCasesWidget - Displays list of supervised cases for Partner
 *
 * Shows cases where the current partner is supervisor/lead.
 * Displays case number, title, client, status, risk level, team size, and deadline.
 * Cases are sorted by risk level (high first), then by next deadline.
 */
export function SupervisedCasesWidget({
  widget,
  isLoading,
  onRefresh,
  onConfigure,
  onRemove,
}: SupervisedCasesWidgetProps) {
  const router = useRouter();

  // Sort cases by risk level (high -> medium -> low) and then by deadline
  const sortedCases = useMemo(() => {
    const riskOrder = { high: 0, medium: 1, low: 2 };

    return [...widget.cases].sort((a, b) => {
      // First sort by risk level
      const riskDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      if (riskDiff !== 0) return riskDiff;

      // Then sort by deadline (cases with deadlines first, sorted by date)
      if (a.nextDeadline && !b.nextDeadline) return -1;
      if (!a.nextDeadline && b.nextDeadline) return 1;
      if (a.nextDeadline && b.nextDeadline) {
        return new Date(a.nextDeadline).getTime() - new Date(b.nextDeadline).getTime();
      }

      return 0;
    });
  }, [widget.cases]);

  // Icon for widget header
  const icon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
      />
    </svg>
  );

  const handleCaseClick = (caseId: string) => {
    // Navigate to case detail page
    router.push(`/cases/${caseId}`);
  };

  return (
    <WidgetContainer
      id={widget.id}
      title={widget.title}
      icon={icon}
      isLoading={isLoading}
      onRefresh={onRefresh}
      onConfigure={onConfigure}
      onRemove={onRemove}
      collapsed={widget.collapsed}
    >
      {sortedCases.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
          <p className="text-sm">Nu există cazuri supravegheate</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-100">
            {sortedCases.map((caseItem) => (
              <CaseListItem
                key={caseItem.id}
                caseItem={caseItem}
                onClick={() => handleCaseClick(caseItem.id)}
              />
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <button
              className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded py-1"
              onClick={() => router.push('/cases?filter=supervised')}
            >
              Vezi Toate Cazurile Supravegheate ({widget.cases.length})
            </button>
          </div>
        </>
      )}
    </WidgetContainer>
  );
}

SupervisedCasesWidget.displayName = 'SupervisedCasesWidget';
