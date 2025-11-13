/**
 * PartnerDashboard - Dashboard for Partner Role
 * Displays operational widgets: supervised cases, firm overview, tasks, employee workload
 * KPI widgets moved to Analytics page
 */

'use client';

import React from 'react';
import { DashboardGrid } from './DashboardGrid';
import { useDashboardStore } from '@/stores/dashboard.store';
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

// Mock data for new operational widgets
const mockSupervisedCasesWidget: SupervisedCasesWidgetType = {
  id: 'supervised-cases',
  type: 'supervisedCases',
  title: 'Cazuri Supravegheate',
  position: { i: 'supervised-cases', x: 0, y: 0, w: 6, h: 5 },
  cases: [
    {
      id: 'case-001',
      caseNumber: 'DOC-2025-1234',
      title: 'Litigiu comercial - Societatea ABC vs XYZ',
      clientName: 'SC ABC Solutions SRL',
      status: 'Active',
      supervisorId: 'partner-1',
      teamSize: 4,
      riskLevel: 'high',
      nextDeadline: new Date('2025-11-16'),
    },
    {
      id: 'case-002',
      caseNumber: 'DOC-2025-1567',
      title: 'Contract parteneriat - Mega Corp',
      clientName: 'Mega Corp International',
      status: 'Active',
      supervisorId: 'partner-1',
      teamSize: 3,
      riskLevel: 'medium',
      nextDeadline: new Date('2025-11-20'),
    },
    {
      id: 'case-003',
      caseNumber: 'DOC-2025-1890',
      title: 'Dosar penal - Apărare client Popescu',
      clientName: 'Ion Popescu',
      status: 'Active',
      supervisorId: 'partner-1',
      teamSize: 2,
      riskLevel: 'low',
      nextDeadline: new Date('2025-11-25'),
    },
  ],
};

const mockFirmCasesOverviewWidget: FirmCasesOverviewWidgetType = {
  id: 'firm-cases-overview',
  type: 'firmCasesOverview',
  title: 'Prezentare Cazuri Firmă',
  position: { i: 'firm-cases-overview', x: 0, y: 5, w: 8, h: 5 },
  atRiskCases: [
    {
      id: 'case-004',
      caseNumber: 'DOC-2025-2345',
      title: 'Urgență: Recurs instanță supremă',
      reason: 'Termen depunere în 2 zile',
      assignedPartner: 'Maria Ionescu',
      daysUntilDeadline: 2,
    },
    {
      id: 'case-005',
      caseNumber: 'DOC-2025-2678',
      title: 'Lipsă activitate - Caz civil Mureș',
      reason: 'Lipsă activitate de 15 zile',
      assignedPartner: 'Andrei Constantin',
    },
  ],
  highValueCases: [
    {
      id: 'case-006',
      caseNumber: 'DOC-2025-3456',
      title: 'Fuziune corporativă - Deal €2M',
      value: 2000000,
      assignedPartner: 'Elena Dumitrescu',
      priority: 'strategic',
    },
    {
      id: 'case-007',
      caseNumber: 'DOC-2025-3789',
      title: 'Client VIP - Consultanță juridică complexă',
      value: 150000,
      assignedPartner: 'Alexandru Popescu',
      priority: 'vip',
    },
  ],
  aiInsights: [
    {
      id: 'insight-001',
      caseId: 'case-008',
      caseNumber: 'DOC-2025-4567',
      message: 'Pattern detectat: Întârzieri repetate în documentație pentru cazuri similare',
      type: 'pattern',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'insight-002',
      caseId: 'case-009',
      caseNumber: 'DOC-2025-4890',
      message: 'Oportunitate: Consolidare 3 cazuri similare pentru eficiență',
      type: 'opportunity',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
  ],
};

const mockFirmTasksOverviewWidget: FirmTasksOverviewWidgetType = {
  id: 'firm-tasks-overview',
  type: 'firmTasksOverview',
  title: 'Prezentare Sarcini Firmă',
  position: { i: 'firm-tasks-overview', x: 8, y: 5, w: 4, h: 5 },
  taskMetrics: {
    totalActiveTasks: 127,
    overdueCount: 8,
    dueTodayCount: 15,
    dueThisWeekCount: 43,
    completionRate: 87,
    avgCompletionRateTrend: 'up',
  },
  taskBreakdown: [
    { type: 'Cercetare', count: 32 },
    { type: 'Documentare', count: 45 },
    { type: 'Revizuire', count: 28 },
    { type: 'Întâlniri', count: 22 },
  ],
  priorityTasks: [
    {
      id: 'task-001',
      title: 'Pregătire memoriu apărare - Caz urgent',
      caseContext: 'DOC-2025-2345',
      priority: 'Urgent',
      assignee: 'Maria Ionescu',
      dueDate: new Date('2025-11-14'),
    },
    {
      id: 'task-002',
      title: 'Revizuire contract fuziune corporativă',
      caseContext: 'DOC-2025-3456',
      priority: 'High',
      assignee: 'Elena Dumitrescu',
      dueDate: new Date('2025-11-15'),
    },
    {
      id: 'task-003',
      title: 'Cercetare jurisprudență instanță europeană',
      caseContext: 'DOC-2025-1234',
      priority: 'High',
      assignee: 'Alexandru Popescu',
      dueDate: new Date('2025-11-16'),
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
      employeeId: 'emp-001',
      name: 'Maria Ionescu',
      dailyUtilization: 125,
      weeklyUtilization: 110,
      taskCount: 12,
      estimatedHours: 44,
      status: 'over',
      tasks: [
        { id: 't1', title: 'Memoriu apărare urgent', estimate: 8, type: 'Documentare' },
        { id: 't2', title: 'Cercetare jurisprudență', estimate: 6, type: 'Cercetare' },
        { id: 't3', title: 'Revizuire contract', estimate: 4, type: 'Revizuire' },
      ],
    },
    {
      employeeId: 'emp-002',
      name: 'Alexandru Popescu',
      dailyUtilization: 100,
      weeklyUtilization: 95,
      taskCount: 10,
      estimatedHours: 38,
      status: 'optimal',
      tasks: [
        { id: 't4', title: 'Cercetare CJUE', estimate: 7, type: 'Cercetare' },
        { id: 't5', title: 'Întâlnire client', estimate: 2, type: 'Întâlnire' },
      ],
    },
    {
      employeeId: 'emp-003',
      name: 'Elena Dumitrescu',
      dailyUtilization: 87,
      weeklyUtilization: 85,
      taskCount: 8,
      estimatedHours: 34,
      status: 'optimal',
    },
    {
      employeeId: 'emp-004',
      name: 'Andrei Constantin',
      dailyUtilization: 37,
      weeklyUtilization: 40,
      taskCount: 4,
      estimatedHours: 16,
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
      title: 'Revizuire strategie caz DOC-2025-1234',
      caseContext: 'DOC-2025-1234',
      priority: 'High',
      dueDate: new Date('2025-11-14'),
      timeEstimate: '2h',
    },
    {
      id: 'task-p2',
      title: 'Aprobare contract parteneriat',
      caseContext: 'DOC-2025-1567',
      priority: 'Medium',
      dueDate: new Date('2025-11-15'),
      timeEstimate: '1h',
    },
    {
      id: 'task-p3',
      title: 'Întâlnire echipă - planificare trimestru',
      priority: 'Medium',
      dueDate: new Date('2025-11-16'),
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
      text: 'Echipa ta are utilizare medie de 95% - excelent! Maria Ionescu ar putea avea nevoie de suport.',
      timestamp: '1 oră în urmă',
      type: 'insight',
    },
    {
      id: 'sug-2',
      text: 'Cazul DOC-2025-2345 necesită atenție urgentă - termen în 2 zile',
      timestamp: '2 ore în urmă',
      type: 'alert',
      actionLink: '/cases/case-004',
    },
    {
      id: 'sug-3',
      text: 'Consolidarea cazurilor DOC-2025-4567, 4890, 5123 ar putea economisi 15h echipă',
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
  const { partnerLayout, updateLayout } = useDashboardStore();

  const handleLayoutChange = (newLayout: WidgetPosition[]) => {
    updateLayout('Partner', newLayout);
    onLayoutChange?.(newLayout);
  };

  return (
    <div>
      <DashboardGrid layout={partnerLayout} onLayoutChange={handleLayoutChange} isEditing={isEditing}>
        <div key="supervised-cases">
          <SupervisedCasesWidget widget={mockSupervisedCasesWidget} />
        </div>

        <div key="my-tasks">
          <TodayTasksWidget widget={mockMyTasksWidget} />
        </div>

        <div key="firm-cases-overview">
          <FirmCasesOverviewWidget widget={mockFirmCasesOverviewWidget} />
        </div>

        <div key="firm-tasks-overview">
          <FirmTasksOverviewWidget widget={mockFirmTasksOverviewWidget} />
        </div>

        <div key="employee-workload">
          <EmployeeWorkloadWidget widget={mockEmployeeWorkloadWidget} />
        </div>

        <div key="ai-suggestions">
          <AISuggestionWidget widget={mockAISuggestionsWidget} />
        </div>
      </DashboardGrid>
    </div>
  );
}

PartnerDashboard.displayName = 'PartnerDashboard';
