'use client';

/**
 * Workload Meter Component
 * Story 4.5: Team Workload Management
 *
 * AC: 2 - Workload meter displaying hours allocated per person per day
 */

import { useMemo } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import type { TeamWorkloadSummary, UserWorkload, WorkloadStatus } from '@legal-platform/types';

interface WorkloadMeterProps {
  data: TeamWorkloadSummary;
  onUserClick?: (userId: string) => void;
  isLoading?: boolean;
}

const STATUS_CONFIG: Record<
  WorkloadStatus,
  { color: string; bgColor: string; icon: typeof CheckCircle; label: string }
> = {
  UnderUtilized: {
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    icon: TrendingDown,
    label: 'Under-utilized',
  },
  Optimal: {
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: CheckCircle,
    label: 'Optimal',
  },
  NearCapacity: {
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    icon: TrendingUp,
    label: 'Near Capacity',
  },
  Overloaded: {
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: AlertCircle,
    label: 'Overloaded',
  },
};

function getProgressColor(status: WorkloadStatus): string {
  switch (status) {
    case 'UnderUtilized':
      return 'bg-gray-400';
    case 'Optimal':
      return 'bg-green-500';
    case 'NearCapacity':
      return 'bg-orange-500';
    case 'Overloaded':
      return 'bg-red-500';
  }
}

function UserWorkloadCard({ workload, onClick }: { workload: UserWorkload; onClick?: () => void }) {
  const config = STATUS_CONFIG[workload.status];
  const Icon = config.icon;
  const progressPercent = Math.min(100, workload.averageUtilization);

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-lg border hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
            {workload.user.firstName[0]}
            {workload.user.lastName[0]}
          </div>
          <div>
            <div className="font-medium text-gray-900">
              {workload.user.firstName} {workload.user.lastName}
            </div>
            <div className="text-xs text-gray-500">{workload.user.role}</div>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${config.bgColor} ${config.color}`}
        >
          <Icon className="h-3 w-3" />
          {config.label}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Utilization</span>
          <span>{workload.averageUtilization.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${getProgressColor(workload.status)} transition-all`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-gray-500 text-xs">Allocated</div>
          <div className="font-medium">{workload.weeklyAllocated.toFixed(1)}h</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">Capacity</div>
          <div className="font-medium">{workload.weeklyCapacity.toFixed(0)}h</div>
        </div>
      </div>
    </button>
  );
}

export function WorkloadMeter({ data, onUserClick, isLoading = false }: WorkloadMeterProps) {
  const sortedMembers = useMemo(() => {
    return [...data.members].sort((a, b) => {
      // Sort by status priority (Overloaded first, then NearCapacity, etc.)
      const statusOrder: Record<WorkloadStatus, number> = {
        Overloaded: 0,
        NearCapacity: 1,
        Optimal: 2,
        UnderUtilized: 3,
      };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }, [data.members]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Team Workload</h2>
          </div>
          <div className="text-sm text-gray-500">
            {data.members.length} team member{data.members.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="px-4 py-3 border-b bg-gray-50 grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {data.teamAverageUtilization.toFixed(0)}%
          </div>
          <div className="text-xs text-gray-500">Avg Utilization</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{data.overloadedCount}</div>
          <div className="text-xs text-gray-500">Overloaded</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-500">{data.underUtilizedCount}</div>
          <div className="text-xs text-gray-500">Under-utilized</div>
        </div>
      </div>

      {/* Team Members Grid */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedMembers.map((member) => (
          <UserWorkloadCard
            key={member.userId}
            workload={member}
            onClick={() => onUserClick?.(member.userId)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t bg-gray-50 flex flex-wrap gap-4 text-xs">
        <span className="font-medium text-gray-600">Status:</span>
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const Icon = config.icon;
          return (
            <span
              key={status}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${config.bgColor} ${config.color}`}
            >
              <Icon className="h-3 w-3" />
              {config.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
