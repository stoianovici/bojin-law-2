/**
 * PendingApprovalsWidget - Partner Dashboard Pending Approvals List
 * Displays pending approval items with action buttons
 */

'use client';

import React, { useState } from 'react';
import { WidgetContainer } from '../WidgetContainer';
import type { ApprovalListWidget } from '@legal-platform/types';
import { clsx } from 'clsx';
import { Button } from '@legal-platform/ui';

export interface PendingApprovalsWidgetProps {
  widget: ApprovalListWidget;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
}

interface ApprovalItem {
  id: string;
  type: 'document' | 'timeEntry' | 'expense';
  name: string;
  requester: string;
  submittedDate: string;
}

/**
 * Approval Item Component
 */
function ApprovalItemRow({ item }: { item: ApprovalItem }) {
  const [isHovered, setIsHovered] = useState(false);
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = () => {
    setActionLoading('approve');
    // Mock action - in real app would call API
    setTimeout(() => {
      setActionLoading(null);
      console.log('Approved:', item.id);
    }, 500);
  };

  const handleReject = () => {
    setActionLoading('reject');
    // Mock action - in real app would call API
    setTimeout(() => {
      setActionLoading(null);
      console.log('Rejected:', item.id);
    }, 500);
  };

  const typeIcons = {
    document: (
      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    timeEntry: (
      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    expense: (
      <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
  };

  const typeLabels = {
    document: 'Document',
    timeEntry: 'Înregistrare timp',
    expense: 'Cheltuială',
  };

  return (
    <div
      className={clsx(
        'flex items-center justify-between p-3 rounded-lg border border-gray-200 transition-colors',
        isHovered ? 'bg-gray-50' : 'bg-white'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="flex-shrink-0 mt-1">{typeIcons[item.type]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-500 uppercase">
              {typeLabels[item.type]}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900 truncate mb-1">{item.name}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>De la: {item.requester}</span>
            <span>•</span>
            <span>{item.submittedDate}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-4">
        <Button
          variant="primary"
          size="sm"
          onClick={handleApprove}
          disabled={actionLoading !== null}
          className="whitespace-nowrap"
        >
          {actionLoading === 'approve' ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Se procesează...
            </span>
          ) : (
            'Aprobă'
          )}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleReject}
          disabled={actionLoading !== null}
          className="whitespace-nowrap"
        >
          {actionLoading === 'reject' ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Se procesează...
            </span>
          ) : (
            'Respinge'
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * PendingApprovalsWidget - Displays pending approval items
 *
 * Shows a list of pending items requiring approval (documents, time entries, expense reports)
 * with requester name, submission date, and approve/reject action buttons (visual only).
 */
export function PendingApprovalsWidget({
  widget,
  isLoading,
  onRefresh,
  onConfigure,
  onRemove,
}: PendingApprovalsWidgetProps) {
  // Icon for widget header
  const icon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );

  // Map approval items from widget data
  const approvalItems: ApprovalItem[] = (widget.approvals || []).map((approval) => ({
    id: approval.id,
    type: approval.type,
    name: approval.itemName,
    requester: approval.requester,
    submittedDate: approval.submittedDate.toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
  }));

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
      <div className="space-y-3">
        {approvalItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm font-medium">Nicio aprobare în așteptare</p>
            <p className="text-xs mt-1">Toate cererile au fost procesate</p>
          </div>
        ) : (
          approvalItems.map((item) => <ApprovalItemRow key={item.id} item={item} />)
        )}
      </div>
      {approvalItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            {approvalItems.length} {approvalItems.length === 1 ? 'cerere' : 'cereri'} în așteptare -
            Date mockup
          </p>
        </div>
      )}
    </WidgetContainer>
  );
}

PendingApprovalsWidget.displayName = 'PendingApprovalsWidget';
