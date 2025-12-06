'use client';

/**
 * Out-of-Office Banner Component
 * Story 4.5: Team Workload Management
 *
 * AC: 5 - Shows when viewing tasks of OOO user with reassignment info
 */

import { useState } from 'react';
import {
  CalendarX,
  User,
  ArrowRight,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import type { AvailabilityType, ReassignmentResult } from '@legal-platform/types';

interface OOOBannerProps {
  userName: string;
  availabilityType: AvailabilityType;
  startDate: Date;
  endDate: Date;
  reason?: string;
  delegateName?: string;
  delegateId?: string;
  reassignedTasks?: ReassignmentResult[];
  onViewDelegate?: () => void;
}

const AVAILABILITY_CONFIG: Record<
  AvailabilityType,
  { label: string; bgColor: string; borderColor: string; textColor: string }
> = {
  OutOfOffice: {
    label: 'Out of Office',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
  },
  Vacation: {
    label: 'On Vacation',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
  },
  SickLeave: {
    label: 'On Sick Leave',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-700',
  },
  ReducedHours: {
    label: 'Reduced Hours',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
  },
  Training: {
    label: 'In Training',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
  },
};

function formatDateRange(start: Date, end: Date): string {
  const startStr = new Date(start).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const endStr = new Date(end).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startStr} - ${endStr}`;
}

export function OOOBanner({
  userName,
  availabilityType,
  startDate,
  endDate,
  reason,
  delegateName,
  delegateId,
  reassignedTasks = [],
  onViewDelegate,
}: OOOBannerProps) {
  const [showReassigned, setShowReassigned] = useState(false);
  const config = AVAILABILITY_CONFIG[availabilityType];

  return (
    <div
      className={`rounded-lg border ${config.bgColor} ${config.borderColor} p-4`}
      role="alert"
      aria-label={`${userName} is ${config.label.toLowerCase()}`}
    >
      <div className="flex items-start gap-3">
        <CalendarX className={`h-5 w-5 ${config.textColor} flex-shrink-0 mt-0.5`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium ${config.textColor}`}>{userName}</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}
            >
              {config.label}
            </span>
          </div>

          <div className="mt-1 text-sm text-gray-600">
            {formatDateRange(startDate, endDate)}
            {reason && <span className="ml-2 text-gray-500">• {reason}</span>}
          </div>

          {/* Delegate Info */}
          {delegateName && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <ArrowRight className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">Delegated to</span>
              {onViewDelegate && delegateId ? (
                <button
                  onClick={onViewDelegate}
                  className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-800"
                >
                  <User className="h-4 w-4" />
                  {delegateName}
                  <ExternalLink className="h-3 w-3" />
                </button>
              ) : (
                <span className="font-medium text-gray-700">{delegateName}</span>
              )}
            </div>
          )}

          {/* Reassigned Tasks */}
          {reassignedTasks.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowReassigned(!showReassigned)}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
              >
                <AlertCircle className="h-4 w-4" />
                <span>
                  {reassignedTasks.length} task{reassignedTasks.length !== 1 ? 's' : ''}{' '}
                  reassigned
                </span>
                {showReassigned ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showReassigned && (
                <div className="mt-2 space-y-2 pl-5">
                  {reassignedTasks.map((task) => (
                    <div
                      key={task.taskId}
                      className="flex items-center gap-2 text-sm p-2 bg-white rounded border"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {task.taskTitle}
                        </div>
                        <div className="text-xs text-gray-500">{task.reason}</div>
                      </div>
                      {task.success ? (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                          Reassigned
                        </span>
                      ) : (
                        <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">
                          Failed
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
