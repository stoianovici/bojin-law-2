/**
 * EmployeeWorkloadWidget - Partner Dashboard Employee Workload Tracking
 * Displays employee utilization with daily/weekly views and task breakdown
 *
 * Performance Optimizations (Story 1.6 Task 16):
 * - Virtualization with react-window for 50+ employees
 * - Debounced view toggle to prevent rapid re-renders
 * - Memoized employee sorting
 * - Lazy-loaded detail rows (only render when expanded)
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
// TODO: Fix react-window import for Next.js 16 + React 19 compatibility
// import { FixedSizeList as List } from 'react-window';
import { WidgetContainer } from '../WidgetContainer';
import type { EmployeeWorkloadWidget as EmployeeWorkloadWidgetType } from '@legal-platform/types';
import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';

export interface EmployeeWorkloadWidgetProps {
  widget: EmployeeWorkloadWidgetType;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
}

/**
 * Custom debounce hook for performance optimization
 * Delays state updates to prevent rapid re-renders
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Status Icon Component
 */
function StatusIcon({ status }: { status: 'over' | 'optimal' | 'under' }) {
  const statusConfig = {
    over: {
      icon: '⚠️',
      label: 'Supra-utilizat',
      color: 'text-red-600',
    },
    optimal: {
      icon: '✓',
      label: 'Optimal',
      color: 'text-green-600',
    },
    under: {
      icon: '⏸️',
      label: 'Sub-utilizat',
      color: 'text-yellow-600',
    },
  };

  const config = statusConfig[status];

  return (
    <span className={clsx('text-lg', config.color)} title={config.label}>
      {config.icon}
    </span>
  );
}

/**
 * Utilization Bar Component
 */
function UtilizationBar({ utilization, status }: { utilization: number; status: 'over' | 'optimal' | 'under' }) {
  const getBarColor = () => {
    if (status === 'over') return 'bg-red-500';
    if (status === 'optimal') return 'bg-green-500';
    return 'bg-yellow-500';
  };

  // Cap display at 150% for visual consistency
  const displayWidth = Math.min(utilization, 150);

  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-300', getBarColor())}
          style={{ width: `${(displayWidth / 150) * 100}%` }}
        />
      </div>
      <span className={clsx('text-sm font-medium min-w-[3rem] text-right', status === 'over' ? 'text-red-600' : status === 'optimal' ? 'text-green-600' : 'text-yellow-600')}>
        {utilization}%
      </span>
    </div>
  );
}

/**
 * Employee Row Component (Memoized for performance)
 */
const EmployeeRow = React.memo(function EmployeeRow({
  employee,
  viewMode,
  isExpanded,
  onToggleExpand,
}: {
  employee: EmployeeWorkloadWidgetType['employeeUtilization'][0];
  viewMode: 'daily' | 'weekly';
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const utilization = viewMode === 'daily' ? employee.dailyUtilization : employee.weeklyUtilization;

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div
        className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand();
          }
        }}
        aria-expanded={isExpanded}
        aria-label={`Detalii pentru ${employee.name}`}
      >
        <div className="flex items-center gap-3 mb-2">
          {/* Avatar */}
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-medium text-blue-700">
              {employee.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </span>
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate" title={employee.name}>
              {employee.name}
            </div>
            <p className="text-xs text-gray-600">
              {employee.taskCount} {employee.taskCount === 1 ? 'task' : 'taskuri'} • {employee.estimatedHours}h
            </p>
          </div>

          {/* Status Icon */}
          <StatusIcon status={employee.status} />

          {/* Expand/Collapse Icon */}
          <svg
            className={clsx('w-5 h-5 text-gray-400 transition-transform', isExpanded && 'rotate-180')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Utilization Bar */}
        <UtilizationBar utilization={utilization} status={employee.status} />
      </div>

      {/* Expanded Details */}
      {isExpanded && employee.tasks && employee.tasks.length > 0 && (
        <div className="px-3 pb-3 bg-gray-50">
          <div className="pt-2 border-t border-gray-200">
            <div className="text-xs font-medium text-gray-700 mb-2">Taskuri Atribuite</div>
            <div className="space-y-1">
              {employee.tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-900 truncate flex-1 mr-2" title={task.title}>
                    {task.title}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-gray-500">{task.type}</span>
                    <span className="text-gray-900 font-medium">{task.estimate}h</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-xs">
              <span className="text-gray-600">Capacitate disponibilă:</span>
              <span className={clsx('font-medium', employee.status === 'over' ? 'text-red-600' : 'text-green-600')}>
                {employee.status === 'over'
                  ? `Supra-alocat cu ${employee.estimatedHours - (viewMode === 'daily' ? 8 : 40)}h`
                  : `${(viewMode === 'daily' ? 8 : 40) - employee.estimatedHours}h disponibile`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * EmployeeWorkloadWidget - Displays employee utilization and workload
 *
 * Shows employee utilization with daily/weekly toggle, color-coded bars,
 * and expandable task details.
 *
 * Performance: Uses virtualization for 50+ employees, debounced view toggle
 */
export function EmployeeWorkloadWidget({
  widget,
  isLoading,
  onRefresh,
  onConfigure,
  onRemove,
}: EmployeeWorkloadWidgetProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>(widget.viewMode || 'weekly');
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());

  // Debounce view mode changes to prevent rapid re-renders (300ms delay)
  const debouncedViewMode = useDebounce(viewMode, 300);

  // Sort employees by utilization (descending) - over-utilized first
  // Uses debounced view mode for performance
  const sortedEmployees = React.useMemo(() => {
    return [...widget.employeeUtilization].sort((a, b) => {
      const aUtil = debouncedViewMode === 'daily' ? a.dailyUtilization : a.weeklyUtilization;
      const bUtil = debouncedViewMode === 'daily' ? b.dailyUtilization : b.weeklyUtilization;
      return bUtil - aUtil;
    });
  }, [widget.employeeUtilization, debouncedViewMode]);

  const handleToggleExpand = (employeeId: string) => {
    setExpandedEmployees((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  const handleRebalanceWorkload = () => {
    // Navigate to workload management page (to be implemented)
    router.push('/workload-management');
  };

  // Calculate summary statistics
  const overUtilizedCount = sortedEmployees.filter((e) => e.status === 'over').length;
  const underUtilizedCount = sortedEmployees.filter((e) => e.status === 'under').length;
  const optimalCount = sortedEmployees.filter((e) => e.status === 'optimal').length;

  // Virtualization threshold - use virtual list for 10+ employees
  // TODO: Re-enable after fixing react-window compatibility with Next.js 16 + React 19
  const useVirtualization = false; // sortedEmployees.length >= 10;
  const ITEM_HEIGHT = 80; // Estimated height per employee row
  const MAX_HEIGHT = 400; // Max height for the list container

  // Row renderer for react-window
  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const employee = sortedEmployees[index];
      return (
        <div style={style} key={employee.employeeId} data-testid="employee-row">
          <EmployeeRow
            employee={employee}
            viewMode={debouncedViewMode}
            isExpanded={expandedEmployees.has(employee.employeeId)}
            onToggleExpand={() => handleToggleExpand(employee.employeeId)}
          />
        </div>
      );
    },
    [sortedEmployees, debouncedViewMode, expandedEmployees]
  );

  // Icon for widget header
  const icon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );

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
      {/* View Mode Toggle and Summary */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            className={clsx(
              'px-3 py-1 text-xs font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
              viewMode === 'daily'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
            onClick={() => setViewMode('daily')}
          >
            Zilnic
          </button>
          <button
            className={clsx(
              'px-3 py-1 text-xs font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
              viewMode === 'weekly'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
            onClick={() => setViewMode('weekly')}
          >
            Săptămânal
          </button>
        </div>

        <div className="flex gap-2 text-xs">
          <span className="text-red-600 font-medium">⚠️ {overUtilizedCount}</span>
          <span className="text-green-600 font-medium">✓ {optimalCount}</span>
          <span className="text-yellow-600 font-medium">⏸️ {underUtilizedCount}</span>
        </div>
      </div>

      {/* Employee List */}
      {sortedEmployees.length === 0 ? (
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
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <p className="text-sm">Nu există date despre utilizarea angajaților</p>
        </div>
      ) : (
        <>
          {/* Employee List - with virtualization for 10+ employees */}
          {useVirtualization ? (
            <div className="border rounded-lg overflow-hidden">
              <List
                height={Math.min(MAX_HEIGHT, sortedEmployees.length * ITEM_HEIGHT)}
                itemCount={sortedEmployees.length}
                itemSize={ITEM_HEIGHT}
                width="100%"
              >
                {Row}
              </List>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              {sortedEmployees.map((employee) => (
                <EmployeeRow
                  key={employee.employeeId}
                  employee={employee}
                  viewMode={debouncedViewMode}
                  isExpanded={expandedEmployees.has(employee.employeeId)}
                  onToggleExpand={() => handleToggleExpand(employee.employeeId)}
                />
              ))}
            </div>
          )}

          {/* Rebalance Workload Button */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <button
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              onClick={handleRebalanceWorkload}
            >
              Rebalansează Workload-ul
            </button>
          </div>
        </>
      )}
    </WidgetContainer>
  );
}

EmployeeWorkloadWidget.displayName = 'EmployeeWorkloadWidget';
