/**
 * DocumentRequestsWidget - Paralegal Dashboard Document Requests
 * Displays pending document requests from attorneys
 */

'use client';

import React from 'react';
import { WidgetContainer } from '../WidgetContainer';
import type { BaseWidget } from '@legal-platform/types';
import { clsx } from 'clsx';

// Document Request specific types
export interface DocumentRequest {
  id: string;
  requesterName: string;
  documentType: string;
  caseContext: string;
  urgency: 'Normal' | 'Urgent';
  requestedDate: Date;
}

export interface DocumentRequestsWidgetData extends BaseWidget {
  type: 'documentRequests';
  requests: DocumentRequest[];
}

export interface DocumentRequestsWidgetProps {
  widget: DocumentRequestsWidgetData;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
}

/**
 * Urgency Badge Component
 */
function UrgencyBadge({ urgency }: { urgency: 'Normal' | 'Urgent' }) {
  const config = {
    Normal: {
      label: 'Normal',
      className: 'bg-blue-100 text-blue-700',
    },
    Urgent: {
      label: 'Urgent',
      className: 'bg-red-100 text-red-700',
    },
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
        config[urgency].className
      )}
    >
      {config[urgency].label}
    </span>
  );
}

/**
 * Document Request Item Component
 */
function DocumentRequestItem({ request }: { request: DocumentRequest }) {
  const formatDate = (date: Date) => {
    const now = new Date();
    const reqDate = new Date(date);
    const diffInDays = Math.floor((now.getTime() - reqDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Astăzi';
    if (diffInDays === 1) return 'Ieri';
    return reqDate.toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: 'short',
    });
  };

  const handleUpload = () => {
    // Visual only - no actual functionality
    console.log('Upload document for request:', request.id);
  };

  const handleRequestClarification = () => {
    // Visual only - no actual functionality
    console.log('Request clarification for:', request.id);
  };

  return (
    <div className="p-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-gray-900">{request.documentType}</h4>
            <UrgencyBadge urgency={request.urgency} />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span>Solicitat de {request.requesterName}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span>{request.caseContext}</span>
            <span className="text-gray-400">•</span>
            <span>{formatDate(request.requestedDate)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={handleUpload}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          Încarcă Document
        </button>
        <button
          onClick={handleRequestClarification}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Solicită Clarificări
        </button>
      </div>
    </div>
  );
}

/**
 * DocumentRequestsWidget - Displays pending document requests
 *
 * Shows requester name, document type, case context, and urgency level.
 * Includes action buttons for upload and clarification (visual only).
 */
export function DocumentRequestsWidget({
  widget,
  isLoading,
  onRefresh,
  onConfigure,
  onRemove,
}: DocumentRequestsWidgetProps) {
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

  // Count urgent requests
  const urgentCount = (widget.requests || []).filter((r) => r.urgency === 'Urgent').length;

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
      {widget.requests.length === 0 ? (
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
          <p className="text-sm">Nu există cereri de documente</p>
        </div>
      ) : (
        <>
          {/* Urgent requests summary */}
          {urgentCount > 0 && (
            <div className="px-3 py-2 bg-red-50 border-b border-red-100 mb-3">
              <div className="flex items-center gap-2 text-sm text-red-700">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  {urgentCount} cerere{urgentCount > 1 ? '' : ''} urgent{urgentCount > 1 ? 'e' : 'ă'}
                </span>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {widget.requests.map((request) => (
              <DocumentRequestItem key={request.id} request={request} />
            ))}
          </div>
        </>
      )}
    </WidgetContainer>
  );
}

DocumentRequestsWidget.displayName = 'DocumentRequestsWidget';
