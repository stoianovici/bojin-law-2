/**
 * ActiveCasesWidget - Associate Dashboard Active Cases List
 * Displays list of active cases with status badges and deadlines
 */

'use client';

import React from 'react';
import { WidgetContainer } from '../WidgetContainer';
import type { CaseListWidget as CaseListWidgetType } from '@legal-platform/types';
import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';

export interface ActiveCasesWidgetProps {
  widget: CaseListWidgetType;
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
 * Case List Item Component
 */
function CaseListItem({
  caseItem,
  onClick,
}: {
  caseItem: CaseListWidgetType['cases'][0];
  onClick: () => void;
}) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

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
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-900">{caseItem.caseNumber}</span>
            <CaseStatusBadge status={caseItem.status} />
          </div>
          <h4 className="text-sm font-semibold text-gray-900 mb-1 truncate">{caseItem.title}</h4>
          <div className="flex items-center gap-2 text-xs text-gray-600">
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
        </div>
        {caseItem.nextDeadline && (
          <div className="flex flex-col items-end text-xs">
            <span className="text-gray-500 mb-1">Termen:</span>
            <span className="text-gray-900 font-medium">{formatDate(caseItem.nextDeadline)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ActiveCasesWidget - Displays list of active cases for Associate
 *
 * Shows case number, title, client name, status badge, and next deadline.
 * Clicking a case navigates to case detail page (route only).
 */
export function ActiveCasesWidget({
  widget,
  isLoading,
  onRefresh,
  onConfigure,
  onRemove,
}: ActiveCasesWidgetProps) {
  const router = useRouter();

  // Icon for widget header
  const icon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );

  const handleCaseClick = (caseId: string) => {
    // Navigate to case detail page (route only, page will be built in future story)
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
      {widget.cases.length === 0 ? (
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-sm">Nu există cazuri active</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {widget.cases.map((caseItem) => (
            <CaseListItem
              key={caseItem.id}
              caseItem={caseItem}
              onClick={() => handleCaseClick(caseItem.id)}
            />
          ))}
        </div>
      )}
    </WidgetContainer>
  );
}

ActiveCasesWidget.displayName = 'ActiveCasesWidget';
