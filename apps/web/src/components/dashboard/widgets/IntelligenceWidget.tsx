'use client';

/**
 * Intelligence Widget Component
 * Story 5.2: Communication Intelligence Engine - Task 22
 *
 * Dashboard widget showing AI intelligence summary across all user's cases:
 * - Upcoming extracted deadlines
 * - High-priority action items requiring attention
 * - Active high-severity risks
 *
 * Accessibility requirements:
 * - Widget container with role="region" and aria-label="Intelligence summary"
 * - Count badges with aria-label: "3 pending deadlines"
 * - Risk indicators with severity in aria-label: "2 high severity risks"
 * - Links with descriptive text, not "click here"
 */

import React from 'react';
import { format, isPast, differenceInDays } from 'date-fns';
import { WidgetContainer } from '../WidgetContainer';
import { Brain, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface IntelligenceWidgetData {
  id: string;
  title: string;
  collapsed?: boolean;
  upcomingDeadlines: Array<{
    id: string;
    description: string;
    dueDate: string;
    caseId: string;
    caseTitle: string;
    confidence: 'Low' | 'Medium' | 'High';
  }>;
  highPriorityActions: Array<{
    id: string;
    description: string;
    caseId: string;
    caseTitle: string;
    priority: 'Urgent' | 'High';
    createdAt: string;
  }>;
  activeRisks: Array<{
    id: string;
    type: string;
    description: string;
    severity: 'High' | 'Medium' | 'Low';
    caseId: string;
    caseTitle: string;
  }>;
  summary: {
    totalPendingItems: number;
    highSeverityRisks: number;
    urgentDeadlines: number;
  };
}

export interface IntelligenceWidgetProps {
  widget: IntelligenceWidgetData;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
}

// ============================================================================
// Priority/Severity Badge
// ============================================================================

interface BadgeProps {
  type: 'deadline' | 'priority' | 'severity';
  value: string;
}

function Badge({ type, value }: BadgeProps) {
  const config = {
    deadline: {
      Urgent: 'bg-red-100 text-red-800',
      High: 'bg-orange-100 text-orange-800',
      Medium: 'bg-yellow-100 text-yellow-800',
      Low: 'bg-gray-100 text-gray-700',
    },
    priority: {
      Urgent: 'bg-red-100 text-red-800',
      High: 'bg-orange-100 text-orange-800',
    },
    severity: {
      High: 'bg-red-100 text-red-800',
      Medium: 'bg-orange-100 text-orange-800',
      Low: 'bg-yellow-100 text-yellow-800',
    },
  };

  const colorClass = config[type][value as keyof (typeof config)[typeof type]] || 'bg-gray-100 text-gray-700';

  return (
    <span
      className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', colorClass)}
      aria-label={`${type === 'severity' ? 'Severity' : type === 'priority' ? 'Priority' : 'Confidence'}: ${value}`}
    >
      {value}
    </span>
  );
}

// ============================================================================
// Deadline Item
// ============================================================================

interface DeadlineItemProps {
  deadline: IntelligenceWidgetData['upcomingDeadlines'][0];
}

function DeadlineItem({ deadline }: DeadlineItemProps) {
  const dueDate = new Date(deadline.dueDate);
  const isOverdue = isPast(dueDate);
  const daysUntilDue = differenceInDays(dueDate, new Date());
  const isUrgent = !isOverdue && daysUntilDue <= 2;

  return (
    <div className="p-2 hover:bg-gray-50 rounded transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{deadline.description}</p>
          <div className="flex items-center gap-2 mt-1">
            <a
              href={`/cases/${deadline.caseId}?tab=intelligence`}
              className="text-xs text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={`View case: ${deadline.caseTitle}`}
            >
              {deadline.caseTitle}
            </a>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge type="deadline" value={deadline.confidence} />
          <span
            className={clsx(
              'text-xs',
              isOverdue ? 'text-red-600 font-medium' : isUrgent ? 'text-orange-600' : 'text-gray-500'
            )}
          >
            {format(dueDate, 'MMM d')}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Action Item
// ============================================================================

interface ActionItemProps {
  action: IntelligenceWidgetData['highPriorityActions'][0];
}

function ActionItem({ action }: ActionItemProps) {
  return (
    <div className="p-2 hover:bg-gray-50 rounded transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{action.description}</p>
          <a
            href={`/cases/${action.caseId}?tab=intelligence`}
            className="text-xs text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`View case: ${action.caseTitle}`}
          >
            {action.caseTitle}
          </a>
        </div>
        <Badge type="priority" value={action.priority} />
      </div>
    </div>
  );
}

// ============================================================================
// Risk Item
// ============================================================================

interface RiskItemProps {
  risk: IntelligenceWidgetData['activeRisks'][0];
}

function RiskItem({ risk }: RiskItemProps) {
  return (
    <div className="p-2 hover:bg-gray-50 rounded transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={clsx(
                'h-4 w-4 flex-shrink-0',
                risk.severity === 'High'
                  ? 'text-red-500'
                  : risk.severity === 'Medium'
                    ? 'text-orange-500'
                    : 'text-yellow-500'
              )}
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-gray-900 truncate">{risk.description}</p>
          </div>
          <div className="flex items-center gap-2 mt-1 ml-6">
            <span className="text-xs text-gray-500">{risk.type.replace(/([A-Z])/g, ' $1').trim()}</span>
            <span className="text-gray-300">|</span>
            <a
              href={`/cases/${risk.caseId}?tab=intelligence`}
              className="text-xs text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={`View case: ${risk.caseTitle}`}
            >
              {risk.caseTitle}
            </a>
          </div>
        </div>
        <Badge type="severity" value={risk.severity} />
      </div>
    </div>
  );
}

// ============================================================================
// Section Component
// ============================================================================

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  countLabel: string;
  children: React.ReactNode;
  emptyText: string;
}

function Section({ title, icon, count, countLabel, children, emptyText }: SectionProps) {
  return (
    <div className="border-t border-gray-100 pt-3">
      <div className="flex items-center justify-between mb-2 px-2">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          {icon}
          {title}
        </div>
        {count > 0 && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
            aria-label={countLabel}
          >
            {count}
          </span>
        )}
      </div>
      {count === 0 ? (
        <p className="text-xs text-gray-500 px-2 py-2">{emptyText}</p>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </div>
  );
}

// ============================================================================
// Main Widget Component
// ============================================================================

export function IntelligenceWidget({
  widget,
  isLoading,
  onRefresh,
  onConfigure,
  onRemove,
}: IntelligenceWidgetProps) {
  const { upcomingDeadlines, highPriorityActions, activeRisks, summary } = widget;

  // Widget header icon
  const icon = <Brain className="w-5 h-5 text-purple-600" aria-hidden="true" />;

  // High severity risks (shown prominently)
  const highSeverityRisks = activeRisks.filter((r) => r.severity === 'High');

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
      <div role="region" aria-label="Intelligence summary">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 bg-blue-50 rounded">
            <div className="text-lg font-bold text-blue-700" aria-label={`${summary.totalPendingItems} pending items`}>
              {summary.totalPendingItems}
            </div>
            <div className="text-xs text-blue-600">Pending</div>
          </div>
          <div className="text-center p-2 bg-orange-50 rounded">
            <div className="text-lg font-bold text-orange-700" aria-label={`${summary.urgentDeadlines} urgent deadlines`}>
              {summary.urgentDeadlines}
            </div>
            <div className="text-xs text-orange-600">Urgent</div>
          </div>
          <div className="text-center p-2 bg-red-50 rounded">
            <div className="text-lg font-bold text-red-700" aria-label={`${summary.highSeverityRisks} high severity risks`}>
              {summary.highSeverityRisks}
            </div>
            <div className="text-xs text-red-600">High Risks</div>
          </div>
        </div>

        {/* High Severity Risk Alert */}
        {highSeverityRisks.length > 0 && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg" role="alert">
            <div className="flex items-center gap-2 text-sm text-red-800">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <span className="font-medium">
                {highSeverityRisks.length} high severity risk{highSeverityRisks.length !== 1 ? 's' : ''} require attention
              </span>
            </div>
          </div>
        )}

        {/* Upcoming Deadlines */}
        <Section
          title="Upcoming Deadlines"
          icon={<Clock className="h-4 w-4 text-orange-500" aria-hidden="true" />}
          count={upcomingDeadlines.length}
          countLabel={`${upcomingDeadlines.length} pending deadlines`}
          emptyText="No upcoming deadlines"
        >
          {upcomingDeadlines.slice(0, 3).map((deadline) => (
            <DeadlineItem key={deadline.id} deadline={deadline} />
          ))}
          {upcomingDeadlines.length > 3 && (
            <a
              href="/cases?filter=deadlines"
              className="block text-center text-xs text-blue-600 hover:underline py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              View all {upcomingDeadlines.length} deadlines
            </a>
          )}
        </Section>

        {/* High Priority Action Items */}
        <Section
          title="Action Items"
          icon={<CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />}
          count={highPriorityActions.length}
          countLabel={`${highPriorityActions.length} high priority actions`}
          emptyText="No high-priority action items"
        >
          {highPriorityActions.slice(0, 3).map((action) => (
            <ActionItem key={action.id} action={action} />
          ))}
          {highPriorityActions.length > 3 && (
            <a
              href="/cases?filter=actions"
              className="block text-center text-xs text-blue-600 hover:underline py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              View all {highPriorityActions.length} action items
            </a>
          )}
        </Section>

        {/* Active Risks */}
        <Section
          title="Active Risks"
          icon={<AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" />}
          count={activeRisks.length}
          countLabel={`${activeRisks.length} active risks`}
          emptyText="No active risks detected"
        >
          {activeRisks.slice(0, 3).map((risk) => (
            <RiskItem key={risk.id} risk={risk} />
          ))}
          {activeRisks.length > 3 && (
            <a
              href="/cases?filter=risks"
              className="block text-center text-xs text-blue-600 hover:underline py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              View all {activeRisks.length} risks
            </a>
          )}
        </Section>
      </div>
    </WidgetContainer>
  );
}

IntelligenceWidget.displayName = 'IntelligenceWidget';
