/**
 * CaseCard Component
 * Displays enriched case information in a card layout
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { format, differenceInDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import type { CaseOverview, CaseStatus, CasePriority } from '@legal-platform/types';

interface CaseCardProps {
  case: CaseOverview;
  onQuickAction?: (action: 'addTask' | 'uploadDocument' | 'markComplete', caseId: string) => void;
}

/**
 * Status color mapping
 */
const STATUS_COLORS: Record<CaseStatus, string> = {
  Active: 'bg-green-100 text-green-800 border-green-200',
  Pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  OnHold: 'bg-gray-100 text-gray-800 border-gray-200',
  Closed: 'bg-gray-100 text-gray-600 border-gray-200',
  Archived: 'bg-gray-50 text-gray-500 border-gray-100',
};

/**
 * Priority color mapping
 */
const PRIORITY_COLORS: Record<CasePriority, string> = {
  High: 'bg-red-100 text-red-800',
  Medium: 'bg-amber-100 text-amber-800',
  Low: 'bg-blue-100 text-blue-800',
};

/**
 * Check if deadline is urgent (within 7 days)
 */
const isDeadlineUrgent = (deadline: Date): boolean => {
  const daysUntil = differenceInDays(deadline, new Date());
  return daysUntil >= 0 && daysUntil <= 7;
};

export function CaseCard({ case: caseItem, onQuickAction }: CaseCardProps) {
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showHoverStats, setShowHoverStats] = useState(false);

  const handleQuickAction = (action: 'addTask' | 'uploadDocument' | 'markComplete') => {
    onQuickAction?.(action, caseItem.id);
    setShowQuickActions(false);
  };

  const urgentDeadline = caseItem.nextDeadline && isDeadlineUrgent(caseItem.nextDeadline);

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative group"
      onMouseEnter={() => setShowHoverStats(true)}
      onMouseLeave={() => setShowHoverStats(false)}
    >
      {/* Quick Actions Menu */}
      <div className="absolute top-4 right-4">
        <button
          onClick={() => setShowQuickActions(!showQuickActions)}
          className="p-1 rounded-md hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Quick actions"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
        </button>

        {/* Quick Actions Dropdown */}
        {showQuickActions && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
            <div className="py-1">
              <button
                onClick={() => handleQuickAction('addTask')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Adaugă Sarcină
              </button>
              <button
                onClick={() => handleQuickAction('uploadDocument')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Încarcă Document
              </button>
              <button
                onClick={() => handleQuickAction('markComplete')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Marchează Complet
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Card Content - Clickable */}
      <Link href={`/cases/${caseItem.id}`} className="block p-6">
        {/* Header: Title and Case Number */}
        <div className="mb-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900 pr-8">{caseItem.title}</h3>
          </div>
          <p className="text-sm text-gray-500">Case #{caseItem.caseNumber}</p>
        </div>

        {/* Client Name */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Client:</span> {caseItem.clientName}
          </p>
        </div>

        {/* Case Type and Status */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            {caseItem.caseType}
          </span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${STATUS_COLORS[caseItem.status]}`}
          >
            {caseItem.status}
          </span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${PRIORITY_COLORS[caseItem.priority]}`}
          >
            Prioritate {caseItem.priority === 'High' ? 'Înaltă' : caseItem.priority === 'Medium' ? 'Medie' : 'Scăzută'}
          </span>
        </div>

        {/* Assigned Attorneys */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">Avocați Asignați:</p>
          <div className="flex items-center gap-2">
            {caseItem.assignedAttorneys.map((attorney) => (
              <div key={attorney.id} className="flex items-center gap-2" title={attorney.name}>
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
                  {attorney.initials}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dates: Last Activity and Next Deadline */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Ultima Activitate:</span>
            <span className="text-gray-900 font-medium">
              {format(caseItem.lastActivityDate, 'dd MMM yyyy', { locale: ro })}
            </span>
          </div>
          {caseItem.nextDeadline && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Termen Limită:</span>
              <span
                className={`font-medium ${urgentDeadline ? 'text-red-600' : 'text-gray-900'}`}
              >
                {format(caseItem.nextDeadline, 'dd MMM yyyy', { locale: ro })}
                {urgentDeadline && (
                  <span className="ml-1 text-xs font-semibold">⚠️ URGENT</span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Hover Stats - Quick Document/Task Counts */}
        {showHoverStats && (caseItem.documentCount !== undefined || caseItem.taskCount !== undefined) && (
          <div className="border-t border-gray-200 pt-3 mt-3">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {caseItem.documentCount !== undefined && (
                <div className="flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
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
                  <span>{caseItem.documentCount} documente</span>
                </div>
              )}
              {caseItem.taskCount !== undefined && (
                <div className="flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
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
                  <span>{caseItem.taskCount} sarcini</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Link>
    </div>
  );
}
