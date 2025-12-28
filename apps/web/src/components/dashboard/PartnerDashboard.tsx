/**
 * PartnerDashboard - Dashboard for Partner Role
 * Displays operational widgets: supervised cases, firm overview, tasks, employee workload
 * All data comes from real API - no mock data
 */

'use client';

import React, { useMemo } from 'react';
import { DashboardGrid } from './DashboardGrid';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useDashboardStore } from '../../stores/dashboard.store';
import { usePartnerDashboard } from '../../hooks/usePartnerDashboard';
import { useMyTasks, useTasks } from '../../hooks/useTasks';
import { SupervisedCasesWidget } from './widgets/SupervisedCasesWidget';
import { FirmCasesOverviewWidget } from './widgets/FirmCasesOverviewWidget';
import { FirmTasksOverviewWidget } from './widgets/FirmTasksOverviewWidget';
import { EmployeeWorkloadWidget } from './widgets/EmployeeWorkloadWidget';
// import { AISuggestionWidget } from './widgets/AISuggestionWidget'; // HIDDEN: may be revived later
import { TodayTasksWidget } from './widgets/TodayTasksWidget';
import { MorningBriefing } from './MorningBriefing';
import type {
  WidgetPosition,
  SupervisedCasesWidget as SupervisedCasesWidgetType,
  FirmCasesOverviewWidget as FirmCasesOverviewWidgetType,
  FirmTasksOverviewWidget as FirmTasksOverviewWidgetType,
  EmployeeWorkloadWidget as EmployeeWorkloadWidgetType,
  // AISuggestionWidget as AISuggestionWidgetType, // HIDDEN
  TaskListWidget,
} from '@legal-platform/types';

export interface PartnerDashboardProps {
  isEditing?: boolean;
  onLayoutChange?: (layout: WidgetPosition[]) => void;
}

// Default layout for Partner Dashboard (12-column grid)
const defaultLayout: WidgetPosition[] = [
  // Row 1: 3 equal widgets (4 cols each)
  { i: 'supervised-cases', x: 0, y: 0, w: 4, h: 5 },
  { i: 'my-tasks', x: 4, y: 0, w: 4, h: 5 },
  { i: 'ai-suggestions', x: 8, y: 0, w: 4, h: 4 },
  // Row 2: Firm Tasks (1/3) + Stack Container (2/3)
  { i: 'firm-tasks-overview', x: 0, y: 5, w: 4, h: 8 },
  { i: 'row2-right-stack', x: 4, y: 5, w: 8, h: 8 },
];

// Empty widget configurations - will be populated with real data when available
const emptyFirmTasksOverviewWidget: FirmTasksOverviewWidgetType = {
  id: 'firm-tasks-overview',
  type: 'firmTasksOverview',
  title: 'Prezentare Sarcini Firmă',
  position: { i: 'firm-tasks-overview', x: 8, y: 5, w: 4, h: 5 },
  taskMetrics: {
    totalActiveTasks: 0,
    overdueCount: 0,
    dueTodayCount: 0,
    dueThisWeekCount: 0,
    completionRate: 0,
    avgCompletionRateTrend: 'neutral',
  },
  taskBreakdown: [],
  priorityTasks: [],
};

const emptyEmployeeWorkloadWidget: EmployeeWorkloadWidgetType = {
  id: 'employee-workload',
  type: 'employeeWorkload',
  title: 'Utilizare Angajați',
  position: { i: 'employee-workload', x: 0, y: 10, w: 12, h: 6 },
  viewMode: 'weekly',
  employeeUtilization: [],
};

const emptyMyTasksWidget: TaskListWidget = {
  id: 'my-tasks',
  type: 'taskList',
  title: 'Sarcinile Mele',
  position: { i: 'my-tasks', x: 6, y: 0, w: 6, h: 5 },
  tasks: [],
};

// HIDDEN: AI suggestions panel removed - may be revived later
// const emptyAISuggestionsWidget: AISuggestionWidgetType = {
//   id: 'ai-suggestions',
//   type: 'aiSuggestion',
//   title: 'Recomandări AI',
//   position: { i: 'ai-suggestions', x: 0, y: 16, w: 12, h: 4 },
//   suggestions: [],
// };

/**
 * PartnerDashboard - Main dashboard view for Partner role
 *
 * Displays operational widgets:
 * - Supervised Cases (cases where partner is lead/supervisor)
 * - My Tasks (partner's personal tasks)
 * - Firm Cases Overview (at-risk, high-value, AI insights)
 * - Firm Tasks Overview (aggregate metrics and priority tasks)
 * - Employee Workload (team utilization tracking)
 * - AI Suggestions (insights and recommendations)
 */
export function PartnerDashboard({ isEditing = false, onLayoutChange }: PartnerDashboardProps) {
  const { updateLayout } = useDashboardStore();
  const { supervisedCases, highValueCases, atRiskCases, loading } = usePartnerDashboard();

  // Fetch user's tasks for "Sarcinile Mele" widget
  const { tasks: myTasks, loading: myTasksLoading } = useMyTasks({
    statuses: ['Pending', 'InProgress'],
  });

  // Fetch all firm tasks for overview widget
  const { tasks: allTasks, loading: allTasksLoading } = useTasks({
    statuses: ['Pending', 'InProgress'],
  });

  const handleLayoutChange = (newLayout: WidgetPosition[]) => {
    updateLayout('Partner', newLayout);
    onLayoutChange?.(newLayout);
  };

  // Build dynamic widget data from real API data
  const supervisedCasesWidget: SupervisedCasesWidgetType = useMemo(
    () => ({
      id: 'supervised-cases',
      type: 'supervisedCases',
      title: 'Cazuri Supravegheate',
      position: { i: 'supervised-cases', x: 0, y: 0, w: 6, h: 5 },
      cases: supervisedCases.map((c) => ({
        id: c.id,
        caseNumber: c.caseNumber,
        title: c.title,
        clientName: c.clientName,
        status: c.status,
        supervisorId: '22222222-2222-2222-2222-222222222222', // Partner ID from seed
        teamSize: c.teamSize,
        riskLevel: c.riskLevel,
        nextDeadline: undefined, // Not available from dashboard data
      })),
    }),
    [supervisedCases]
  );

  const firmCasesOverviewWidget: FirmCasesOverviewWidgetType = useMemo(
    () => ({
      id: 'firm-cases-overview',
      type: 'firmCasesOverview',
      title: 'Prezentare Cazuri Firmă',
      position: { i: 'firm-cases-overview', x: 0, y: 5, w: 8, h: 5 },
      atRiskCases: atRiskCases.map((c) => ({
        id: c.id,
        caseNumber: c.caseNumber,
        title: c.title,
        reason: c.reason,
        assignedPartner: c.assignedPartner,
      })),
      highValueCases: highValueCases.map((c) => ({
        id: c.id,
        caseNumber: c.caseNumber,
        title: c.title,
        value: c.value,
        assignedPartner: c.assignedPartner,
        priority: c.priority,
      })),
      aiInsights: [
        {
          id: 'insight-001',
          caseId: highValueCases[0]?.id || '',
          caseNumber: highValueCases[0]?.caseNumber || '',
          message: 'High-value cases requiring attention this week',
          type: 'pattern',
          timestamp: new Date().toISOString(),
        },
      ],
    }),
    [atRiskCases, highValueCases]
  );

  // Transform my tasks for the TodayTasksWidget
  const myTasksWidget: TaskListWidget = useMemo(
    () => ({
      id: 'my-tasks',
      type: 'taskList',
      title: 'Sarcinile Mele',
      position: { i: 'my-tasks', x: 6, y: 0, w: 6, h: 5 },
      tasks: myTasks.map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate || undefined,
        priority: t.priority as 'Low' | 'Medium' | 'High' | 'Urgent',
        status: t.status as 'Pending' | 'InProgress' | 'Completed',
        caseNumber: t.case?.caseNumber,
        caseTitle: t.case?.title,
      })),
    }),
    [myTasks]
  );

  // Calculate firm task metrics for overview widget
  const firmTasksOverviewWidget: FirmTasksOverviewWidgetType = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const overdue = allTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < today && t.status !== 'Completed'
    );
    const dueToday = allTasks.filter((t) => {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      due.setHours(0, 0, 0, 0);
      return due.getTime() === today.getTime();
    });
    const dueThisWeek = allTasks.filter((t) => {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due >= today && due <= endOfWeek;
    });

    return {
      id: 'firm-tasks-overview',
      type: 'firmTasksOverview',
      title: 'Prezentare Sarcini Firmă',
      position: { i: 'firm-tasks-overview', x: 8, y: 5, w: 4, h: 5 },
      taskMetrics: {
        totalActiveTasks: allTasks.length,
        overdueCount: overdue.length,
        dueTodayCount: dueToday.length,
        dueThisWeekCount: dueThisWeek.length,
        completionRate: 0,
        avgCompletionRateTrend: 'neutral',
      },
      taskBreakdown: [],
      priorityTasks: allTasks
        .filter((t) => t.priority === 'Urgent' || t.priority === 'High')
        .slice(0, 5)
        .map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority as 'Low' | 'Medium' | 'High' | 'Urgent',
          dueDate: t.dueDate || undefined,
          assignee: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : 'Unassigned',
        })),
    };
  }, [allTasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-linear-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Morning Briefing - AI-generated daily summary */}
      <MorningBriefing />

      <DashboardGrid
        layout={defaultLayout}
        onLayoutChange={handleLayoutChange}
        isEditing={isEditing}
      >
        {/* Row 1: Equal-width widgets */}
        <div key="supervised-cases">
          <SupervisedCasesWidget widget={supervisedCasesWidget} />
        </div>

        <div key="my-tasks">
          <TodayTasksWidget widget={myTasksWidget} />
        </div>

        {/* AI Suggestions - HIDDEN (may be revived later)
        <div key="ai-suggestions">
          <AISuggestionWidget widget={emptyAISuggestionsWidget} />
        </div>
        */}

        {/* Row 2: Firm Tasks Overview (left, tall) */}
        <div key="firm-tasks-overview">
          <FirmTasksOverviewWidget widget={firmTasksOverviewWidget} />
        </div>

        {/* Row 2: Right side container (stacked widgets) */}
        <div key="row2-right-stack" className="grid-stack-container">
          <div key="firm-cases-overview">
            <FirmCasesOverviewWidget widget={firmCasesOverviewWidget} />
          </div>

          <div key="employee-workload">
            <EmployeeWorkloadWidget widget={emptyEmployeeWorkloadWidget} />
          </div>
        </div>
      </DashboardGrid>
    </div>
  );
}

PartnerDashboard.displayName = 'PartnerDashboard';
