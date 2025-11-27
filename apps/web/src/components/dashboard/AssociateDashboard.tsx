/**
 * AssociateDashboard - Dashboard for Associate Role
 * Displays active cases, today's tasks, deadlines, recent documents, and AI suggestions
 */

'use client';

import React, { useState } from 'react';
import { DashboardGrid } from './DashboardGrid';
import { ActiveCasesWidget } from './widgets/ActiveCasesWidget';
import { TodayTasksWidget } from './widgets/TodayTasksWidget';
import { DeadlinesWidget } from './widgets/DeadlinesWidget';
import { RecentDocumentsWidget } from './widgets/RecentDocumentsWidget';
import { AISuggestionWidget } from './widgets/AISuggestionWidget';
import type { WidgetPosition, CaseListWidget, TaskListWidget, DeadlineWidget, DocumentListWidget, AISuggestionWidget as AISuggestionWidgetType } from '@legal-platform/types';

export interface AssociateDashboardProps {
  isEditing?: boolean;
  onLayoutChange?: (layout: WidgetPosition[]) => void;
}

// Default layout for Associate Dashboard (12-column grid)
const defaultLayout: WidgetPosition[] = [
  // Row 1: 2 equal widgets (6 cols each = 50% each)
  { i: 'active-cases', x: 0, y: 0, w: 6, h: 5 },
  { i: 'today-tasks', x: 6, y: 0, w: 6, h: 5 },
  // Row 2: 3 equal widgets (4 cols each = 33.33% each)
  { i: 'deadlines', x: 0, y: 5, w: 4, h: 5 },
  { i: 'recent-documents', x: 4, y: 5, w: 4, h: 5 },
  { i: 'ai-suggestions', x: 8, y: 5, w: 4, h: 4 },
];

// Realistic Romanian law firm data for Associate widgets
const mockActiveCasesWidget: CaseListWidget = {
  id: 'active-cases',
  type: 'caseList',
  title: 'Cazurile Mele Active',
  position: { i: 'active-cases', x: 0, y: 0, w: 6, h: 4 },
  cases: [
    {
      id: 'case-001',
      caseNumber: '2025-001',
      title: 'Litigiu Contract - ABC Industries vs XYZ Logistics',
      clientName: 'SC ABC Industries SRL',
      status: 'Active',
      nextDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
    },
    {
      id: 'case-002',
      caseNumber: '2025-002',
      title: 'Contract Review - ABC Industries',
      clientName: 'SC ABC Industries SRL',
      status: 'Active',
      nextDeadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
    },
    {
      id: 'case-012',
      caseNumber: '2025-008',
      title: 'M&A Advisory - Tech Innovations',
      clientName: 'Tech Innovations Romania SRL',
      status: 'Active',
      nextDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
    {
      id: 'case-005',
      caseNumber: '2024-015',
      title: 'Litigiu Drept Muncii - Fost Angajat',
      clientName: 'SC ABC Industries SRL',
      status: 'OnHold',
      nextDeadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days
    },
    {
      id: 'case-018',
      caseNumber: '2025-011',
      title: 'Contract Licenta Software',
      clientName: 'Tech Innovations Romania SRL',
      status: 'Active',
      nextDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    },
  ],
};

const mockTodayTasksWidget: TaskListWidget = {
  id: 'today-tasks',
  type: 'taskList',
  title: 'Sarcini Astăzi',
  position: { i: 'today-tasks', x: 6, y: 0, w: 6, h: 4 },
  tasks: [
    {
      id: 'task-1',
      title: 'Redactare memoriu aparare - termen Tribunal',
      caseContext: 'Litigiu ABC Industries',
      priority: 'High',
      dueDate: new Date(),
      completed: false,
      timeEstimate: '3 ore',
    },
    {
      id: 'task-2',
      title: 'Revizuire contract cesiune parti sociale',
      caseContext: 'M&A Tech Innovations',
      priority: 'Medium',
      dueDate: new Date(),
      completed: false,
      timeEstimate: '2 ore',
    },
    {
      id: 'task-3',
      title: 'Intalnire client - strategie litigiu',
      caseContext: 'ABC Industries vs XYZ',
      priority: 'High',
      dueDate: new Date(),
      completed: false,
      timeEstimate: '1.5 ore',
    },
    {
      id: 'task-4',
      title: 'Cercetare jurisprudenta ICCJ - drept muncii',
      caseContext: 'Litigiu Angajat',
      priority: 'Low',
      dueDate: new Date(),
      completed: true,
      timeEstimate: '2 ore',
    },
    {
      id: 'task-5',
      title: 'Analiza due diligence financiar',
      caseContext: 'M&A Tech Innovations',
      priority: 'Medium',
      dueDate: new Date(),
      completed: false,
      timeEstimate: '1 oră',
    },
  ],
};

const mockDeadlinesWidget: DeadlineWidget = {
  id: 'deadlines',
  type: 'deadline',
  title: 'Termene Această Săptămână',
  position: { i: 'deadlines', x: 0, y: 4, w: 4, h: 4 },
  deadlines: [
    {
      id: 'deadline-1',
      date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      description: 'Depunere intampinare - Dosar 2025-001',
      caseId: 'case-001',
      daysRemaining: 1,
      urgent: true,
    },
    {
      id: 'deadline-2',
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      description: 'Termen instanta - Tribunalul Bucuresti',
      caseId: 'case-001',
      daysRemaining: 3,
      urgent: false,
    },
    {
      id: 'deadline-3',
      date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      description: 'Finalizare contract cesiune parti sociale',
      caseId: 'case-012',
      daysRemaining: 4,
      urgent: false,
    },
    {
      id: 'deadline-4',
      date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      description: 'Prezentare raport due diligence',
      caseId: 'case-012',
      daysRemaining: 6,
      urgent: false,
    },
  ],
};

const mockRecentDocumentsWidget: DocumentListWidget = {
  id: 'recent-documents',
  type: 'documentList',
  title: 'Documente Recente',
  position: { i: 'recent-documents', x: 4, y: 4, w: 8, h: 4 },
  documents: [
    {
      id: 'doc-1',
      title: 'Contract de Cesiune Parti Sociale - Tech Innovations',
      type: 'Contract',
      lastModified: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      version: 3,
      icon: 'file-text',
    },
    {
      id: 'doc-2',
      title: 'Memoriu de Aparare - Dosar 2025-001',
      type: 'Motion',
      lastModified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      version: 2,
      icon: 'gavel',
    },
    {
      id: 'doc-3',
      title: 'Cerere de Chemare in Judecata - Litigiu Comercial',
      type: 'Motion',
      lastModified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      version: 1,
      icon: 'gavel',
    },
    {
      id: 'doc-4',
      title: 'Due Diligence Report - M&A Tech Innovations',
      type: 'Memo',
      lastModified: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      version: 1,
      icon: 'file-text',
    },
    {
      id: 'doc-5',
      title: 'NDA - Acord de Confidentialitate',
      type: 'Contract',
      lastModified: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      version: 1,
      icon: 'mail',
    },
    {
      id: 'doc-6',
      title: 'Raport Expertiza Contabila - ABC Industries',
      type: 'Other',
      lastModified: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      version: 1,
      icon: 'mail',
    },
  ],
};

const mockAISuggestionsWidget: AISuggestionWidgetType = {
  id: 'ai-suggestions',
  type: 'aiSuggestion',
  title: 'Recomandări AI',
  position: { i: 'ai-suggestions', x: 0, y: 8, w: 12, h: 4 },
  suggestions: [
    {
      id: 'sug-1',
      text: 'Foloseste sablonul "Contract Cesiune" pentru dosarul M&A Tech Innovations',
      timestamp: '2 ore în urmă',
      type: 'recommendation',
      actionLink: '/templates/cesiune',
    },
    {
      id: 'sug-2',
      text: '5 hotarari ICCJ relevante gasite pentru cercetarea in drept comercial',
      timestamp: '4 ore în urmă',
      type: 'insight',
      actionLink: '/research/precedents',
    },
    {
      id: 'sug-3',
      text: 'Termenul pentru depunere intampinare - Dosar 2025-001 - maine',
      timestamp: '5 ore în urmă',
      type: 'alert',
      actionLink: '/cases/case-001',
    },
    {
      id: 'sug-4',
      text: 'Documentul "Due Diligence Report" necesita revizuire finala',
      timestamp: '1 zi în urmă',
      type: 'alert',
      actionLink: '/documents/doc-4',
    },
  ],
};

/**
 * AssociateDashboard - Main dashboard view for Associate role
 *
 * Displays:
 * - Active cases (case list with status and next deadline)
 * - Today's tasks (task list with priority and completion status)
 * - Deadlines this week (timeline view with urgency indicators)
 * - Recent documents (document list with version and type)
 * - AI suggestions (recommendations and alerts)
 */
export function AssociateDashboard({ isEditing = false, onLayoutChange }: AssociateDashboardProps) {
  const [isLoading] = useState(false);

  const handleLayoutChange = (newLayout: WidgetPosition[]) => {
    onLayoutChange?.(newLayout);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Se încarcă dashboard-ul...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <DashboardGrid layout={defaultLayout} onLayoutChange={handleLayoutChange} isEditing={isEditing}>
        {/* Row 1: Active Cases + Today's Tasks (50/50) */}
        <div key="active-cases">
          <ActiveCasesWidget widget={mockActiveCasesWidget} />
        </div>

        <div key="today-tasks">
          <TodayTasksWidget widget={mockTodayTasksWidget} />
        </div>

        {/* Row 2: 3 equal widgets (1/3 each) */}
        <div key="deadlines">
          <DeadlinesWidget widget={mockDeadlinesWidget} />
        </div>

        <div key="recent-documents">
          <RecentDocumentsWidget widget={mockRecentDocumentsWidget} />
        </div>

        <div key="ai-suggestions">
          <AISuggestionWidget widget={mockAISuggestionsWidget} />
        </div>
      </DashboardGrid>
    </div>
  );
}

AssociateDashboard.displayName = 'AssociateDashboard';
