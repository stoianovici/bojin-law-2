/**
 * PartnerDashboard - Dashboard for Partner Role
 * Displays operational widgets: supervised cases, firm overview, tasks, employee workload
 * KPI widgets moved to Analytics page
 */

'use client';

import React, { useMemo } from 'react';
import { DashboardGrid } from './DashboardGrid';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useDashboardStore } from '../../stores/dashboard.store';
import { usePartnerDashboard } from '../../hooks/usePartnerDashboard';
import { SupervisedCasesWidget } from './widgets/SupervisedCasesWidget';
import { FirmCasesOverviewWidget } from './widgets/FirmCasesOverviewWidget';
import { FirmTasksOverviewWidget } from './widgets/FirmTasksOverviewWidget';
import { EmployeeWorkloadWidget } from './widgets/EmployeeWorkloadWidget';
import { AISuggestionWidget } from './widgets/AISuggestionWidget';
import { TodayTasksWidget } from './widgets/TodayTasksWidget';
import type {
  WidgetPosition,
  SupervisedCasesWidget as SupervisedCasesWidgetType,
  FirmCasesOverviewWidget as FirmCasesOverviewWidgetType,
  FirmTasksOverviewWidget as FirmTasksOverviewWidgetType,
  EmployeeWorkloadWidget as EmployeeWorkloadWidgetType,
  AISuggestionWidget as AISuggestionWidgetType,
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

// Static widget configurations (data will be dynamic)

const mockFirmTasksOverviewWidget: FirmTasksOverviewWidgetType = {
  id: 'firm-tasks-overview',
  type: 'firmTasksOverview',
  title: 'Prezentare Sarcini Firmă',
  position: { i: 'firm-tasks-overview', x: 8, y: 5, w: 4, h: 5 },
  taskMetrics: {
    totalActiveTasks: 85,
    overdueCount: 3,
    dueTodayCount: 12,
    dueThisWeekCount: 28,
    completionRate: 92,
    avgCompletionRateTrend: 'up',
  },
  taskBreakdown: [
    { type: 'Cercetare', count: 18 },
    { type: 'Documentare', count: 32 },
    { type: 'Revizuire', count: 22 },
    { type: 'Întâlniri', count: 13 },
  ],
  priorityTasks: [
    {
      id: 'task-001',
      title: 'Redactare memoriu aparare - Litigiu ABC Industries',
      caseContext: 'Dosar 2025-001',
      priority: 'Urgent',
      assignee: 'Maria Ionescu',
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'task-002',
      title: 'Finalizare due diligence - M&A Tech Innovations',
      caseContext: 'Dosar 2025-008',
      priority: 'High',
      assignee: 'Ion Georgescu',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'task-003',
      title: 'Cercetare jurisprudenta ICCJ - Drept comercial',
      caseContext: 'Dosar 2025-001',
      priority: 'High',
      assignee: 'Elena Popa',
      dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    },
  ],
};

const mockEmployeeWorkloadWidget: EmployeeWorkloadWidgetType = {
  id: 'employee-workload',
  type: 'employeeWorkload',
  title: 'Utilizare Angajați',
  position: { i: 'employee-workload', x: 0, y: 10, w: 12, h: 6 },
  viewMode: 'weekly',
  employeeUtilization: [
    {
      employeeId: 'associate1',
      name: 'Maria Ionescu',
      dailyUtilization: 115,
      weeklyUtilization: 105,
      taskCount: 10,
      estimatedHours: 42,
      status: 'over',
      tasks: [
        { id: 't1', title: 'Memoriu aparare - ABC Industries', estimate: 8, type: 'Documentare' },
        { id: 't2', title: 'Cercetare ICCJ drept comercial', estimate: 6, type: 'Cercetare' },
        { id: 't3', title: 'Revizuire contract cesiune', estimate: 4, type: 'Revizuire' },
      ],
    },
    {
      employeeId: 'associate2',
      name: 'Ion Georgescu',
      dailyUtilization: 95,
      weeklyUtilization: 90,
      taskCount: 8,
      estimatedHours: 36,
      status: 'optimal',
      tasks: [
        { id: 't4', title: 'Due diligence M&A', estimate: 7, type: 'Cercetare' },
        { id: 't5', title: 'Intalnire client Tech Innovations', estimate: 2, type: 'Întâlnire' },
      ],
    },
    {
      employeeId: 'paralegal1',
      name: 'Elena Popa',
      dailyUtilization: 88,
      weeklyUtilization: 85,
      taskCount: 7,
      estimatedHours: 34,
      status: 'optimal',
    },
    {
      employeeId: 'paralegal2',
      name: 'Mihai Dumitrescu',
      dailyUtilization: 45,
      weeklyUtilization: 50,
      taskCount: 5,
      estimatedHours: 20,
      status: 'under',
    },
  ],
};

const mockMyTasksWidget: TaskListWidget = {
  id: 'my-tasks',
  type: 'taskList',
  title: 'Sarcinile Mele',
  position: { i: 'my-tasks', x: 6, y: 0, w: 6, h: 5 },
  tasks: [
    {
      id: 'task-p1',
      title: 'Revizuire strategie litigiu ABC Industries',
      caseContext: 'Dosar 2025-001',
      priority: 'High',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      timeEstimate: '2h',
    },
    {
      id: 'task-p2',
      title: 'Aprobare contract cesiune parti sociale',
      caseContext: 'M&A Tech Innovations',
      priority: 'Medium',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      timeEstimate: '1h',
    },
    {
      id: 'task-p3',
      title: 'Intalnire echipa - planificare Q1 2025',
      priority: 'Medium',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      timeEstimate: '1.5h',
    },
  ],
};

const mockAISuggestionsWidget: AISuggestionWidgetType = {
  id: 'ai-suggestions',
  type: 'aiSuggestion',
  title: 'Recomandări AI',
  position: { i: 'ai-suggestions', x: 0, y: 16, w: 12, h: 4 },
  suggestions: [
    {
      id: 'sug-1',
      text: 'Echipa are utilizare medie de 85% - optim! Maria Ionescu (115%) ar putea avea nevoie de redistribuire sarcini.',
      timestamp: '1 oră în urmă',
      type: 'insight',
    },
    {
      id: 'sug-2',
      text: 'Dosarul 2025-001 (ABC Industries) necesita atentie - termen instanta in 3 zile',
      timestamp: '2 ore în urmă',
      type: 'alert',
      actionLink: '/cases/case-001',
    },
    {
      id: 'sug-3',
      text: 'Mihai Dumitrescu (50% utilizare) poate prelua sarcini de la Maria Ionescu',
      timestamp: '3 ore în urmă',
      type: 'recommendation',
    },
  ],
};

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
        nextDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <DashboardGrid layout={defaultLayout} onLayoutChange={handleLayoutChange} isEditing={isEditing}>
        {/* Row 1: Equal-width widgets */}
        <div key="supervised-cases">
          <SupervisedCasesWidget widget={supervisedCasesWidget} />
        </div>

        <div key="my-tasks">
          <TodayTasksWidget widget={mockMyTasksWidget} />
        </div>

        <div key="ai-suggestions">
          <AISuggestionWidget widget={mockAISuggestionsWidget} />
        </div>

        {/* Row 2: Firm Tasks Overview (left, tall) */}
        <div key="firm-tasks-overview">
          <FirmTasksOverviewWidget widget={mockFirmTasksOverviewWidget} />
        </div>

        {/* Row 2: Right side container (stacked widgets) */}
        <div key="row2-right-stack" className="grid-stack-container">
          <div key="firm-cases-overview">
            <FirmCasesOverviewWidget widget={firmCasesOverviewWidget} />
          </div>

          <div key="employee-workload">
            <EmployeeWorkloadWidget widget={mockEmployeeWorkloadWidget} />
          </div>
        </div>
      </DashboardGrid>
    </div>
  );
}

PartnerDashboard.displayName = 'PartnerDashboard';
