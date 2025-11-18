/**
 * FirmTasksOverviewWidget - Partner Dashboard Firm Tasks Overview
 * Displays aggregate task metrics and breakdown across the firm
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { WidgetContainer } from '../WidgetContainer';
import type { FirmTasksOverviewWidget as FirmTasksOverviewWidgetType } from '@legal-platform/types';
import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export interface FirmTasksOverviewWidgetProps {
  widget: FirmTasksOverviewWidgetType;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
}

/**
 * Metric Card Component
 */
function MetricCard({
  label,
  value,
  badge,
  color,
}: {
  label: string;
  value: number;
  badge?: boolean;
  color?: 'red' | 'orange' | 'blue' | 'green';
}) {
  const colorClasses = {
    red: 'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-orange-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
  };

  const badgeClass = color ? colorClasses[color] : 'bg-gray-100 text-gray-700';

  return (
    <div className="flex flex-col p-3 bg-gray-50 rounded-lg">
      <span className="text-xs text-gray-600 mb-1">{label}</span>
      {badge ? (
        <span
          className={clsx(
            'inline-flex items-center self-start px-2 py-1 rounded-full text-lg font-bold',
            badgeClass
          )}
        >
          {value}
        </span>
      ) : (
        <span className="text-2xl font-bold text-gray-900">{value}</span>
      )}
    </div>
  );
}

/**
 * Priority Task Item Component
 */
function PriorityTaskItem({
  task,
  onClick,
}: {
  task: FirmTasksOverviewWidgetType['priorityTasks'][0];
  onClick: () => void;
}) {
  const priorityConfig = {
    High: {
      className: 'bg-orange-100 text-orange-700',
      icon: '⬆',
    },
    Urgent: {
      className: 'bg-red-100 text-red-700',
      icon: '🔥',
    },
  };

  const config = priorityConfig[task.priority];

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  return (
    <div
      onClick={onClick}
      className="p-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors last:border-b-0"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Task prioritar: ${task.title}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={clsx(
                'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                config.className
              )}
            >
              {config.icon} {task.priority}
            </span>
            <span className="text-xs text-gray-500">{task.caseContext}</span>
          </div>
          <h5 className="text-sm font-medium text-gray-900 mb-1 line-clamp-1" title={task.title}>
            {task.title}
          </h5>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              {task.assignee}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {formatDate(task.dueDate)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * FirmTasksOverviewWidget - Displays firm-wide task metrics
 *
 * Shows aggregate task metrics, task breakdown by type, and priority tasks.
 * Uses recharts for visualizing task breakdown.
 */
export function FirmTasksOverviewWidget({
  widget,
  isLoading,
  onRefresh,
  onConfigure,
  onRemove,
}: FirmTasksOverviewWidgetProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [announceMessage, setAnnounceMessage] = useState('');
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const INITIAL_DISPLAY_COUNT = 3;

  const { taskMetrics, taskBreakdown, priorityTasks } = widget;

  // Focus management and screen reader announcements
  useEffect(() => {
    if (priorityTasks && priorityTasks.length > INITIAL_DISPLAY_COUNT) {
      if (isExpanded && expandButtonRef.current) {
        expandButtonRef.current.focus();
        setAnnounceMessage(`Afișare extinsă. Se afișează toate cele ${priorityTasks.length} taskuri prioritare.`);
      } else if (!isExpanded && expandButtonRef.current) {
        setAnnounceMessage(`Afișare redusă. Se afișează primele ${INITIAL_DISPLAY_COUNT} taskuri prioritare.`);
      }
      const timer = setTimeout(() => setAnnounceMessage(''), 1000);
      return () => clearTimeout(timer);
    }
  }, [isExpanded, priorityTasks]);

  // Format task breakdown data for chart
  const chartData = taskBreakdown.map((item) => ({
    name: item.type,
    count: item.count,
  }));

  // Color scheme for chart bars
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

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

  const handleTaskClick = (taskId: string) => {
    router.push(`/tasks/${taskId}`);
  };

  const handleViewAllTasks = () => {
    router.push('/tasks');
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
      {/* Task Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <MetricCard label="Taskuri Active" value={taskMetrics.totalActiveTasks} />
        <MetricCard label="Întârziate" value={taskMetrics.overdueCount} badge color="red" />
        <MetricCard label="Astăzi" value={taskMetrics.dueTodayCount} badge color="orange" />
        <MetricCard
          label="Săptămâna Asta"
          value={taskMetrics.dueThisWeekCount}
          badge
          color="blue"
        />
      </div>

      {/* Completion Rate with Trend */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-600">Rata de Finalizare</span>
          {taskMetrics.avgCompletionRateTrend && (
            <span
              className={clsx(
                'text-xs font-medium',
                taskMetrics.avgCompletionRateTrend === 'up'
                  ? 'text-green-600'
                  : taskMetrics.avgCompletionRateTrend === 'down'
                    ? 'text-red-600'
                    : 'text-gray-600'
              )}
            >
              {taskMetrics.avgCompletionRateTrend === 'up' && '↑ În creștere'}
              {taskMetrics.avgCompletionRateTrend === 'down' && '↓ În scădere'}
              {taskMetrics.avgCompletionRateTrend === 'neutral' && '→ Stabil'}
            </span>
          )}
        </div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-gray-900">{taskMetrics.completionRate}%</span>
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${taskMetrics.completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Task Breakdown Chart */}
      {taskBreakdown && taskBreakdown.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-gray-700 mb-2">Distribuție pe Tip</h4>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Priority Tasks */}
      {priorityTasks && priorityTasks.length > 0 && (
        <div>
          {/* Screen reader announcements */}
          <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {announceMessage}
          </div>
          <h4 className="text-xs font-medium text-gray-700 mb-2">
            Taskuri Prioritare ({priorityTasks.length})
          </h4>
          <div className="divide-y divide-gray-100 border rounded-lg overflow-hidden">
            {(isExpanded ? priorityTasks : priorityTasks.slice(0, INITIAL_DISPLAY_COUNT)).map((task) => (
              <PriorityTaskItem
                key={task.id}
                task={task}
                onClick={() => handleTaskClick(task.id)}
              />
            ))}
          </div>
          {priorityTasks.length > INITIAL_DISPLAY_COUNT && (
            <div className="mt-2">
              <button
                ref={expandButtonRef}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded py-1 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? 'Arată mai puține taskuri' : 'Arată mai multe taskuri'}
              >
                {isExpanded ? (
                  <span className="flex items-center justify-center gap-1">
                    <span>Arată Mai Puține</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1">
                    <span>Arată Mai Multe ({priorityTasks.length - INITIAL_DISPLAY_COUNT} taskuri)</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* View All Tasks Link */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <button
          className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded py-1"
          onClick={handleViewAllTasks}
        >
          Vezi Gestionarea Taskurilor
        </button>
      </div>
    </WidgetContainer>
  );
}

FirmTasksOverviewWidget.displayName = 'FirmTasksOverviewWidget';
