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

// Default layout for Associate Dashboard
const defaultLayout: WidgetPosition[] = [
  { i: 'active-cases', x: 0, y: 0, w: 6, h: 5 },
  { i: 'today-tasks', x: 6, y: 0, w: 6, h: 5 },
  { i: 'deadlines', x: 0, y: 5, w: 4, h: 5 },
  { i: 'recent-documents', x: 4, y: 5, w: 8, h: 5 },
  { i: 'ai-suggestions', x: 0, y: 10, w: 12, h: 4 },
];

// Mock data for Associate widgets
const mockActiveCasesWidget: CaseListWidget = {
  id: 'active-cases',
  type: 'caseList',
  title: 'Cazurile Mele Active',
  position: { i: 'active-cases', x: 0, y: 0, w: 6, h: 4 },
  cases: [
    {
      id: 'case-1',
      caseNumber: '2345/2025',
      title: 'Litigiu Contract Comercial - SC TECH SRL',
      clientName: 'SC TECH Solutions SRL',
      status: 'Active',
      nextDeadline: new Date('2025-11-15'),
    },
    {
      id: 'case-2',
      caseNumber: '4567/2025',
      title: 'Contract Închiriere Spațiu',
      clientName: 'ABC Industries SA',
      status: 'Active',
      nextDeadline: new Date('2025-11-20'),
    },
    {
      id: 'case-3',
      caseNumber: '6789/2025',
      title: 'Consultanță Fuziune și Achiziție',
      clientName: 'Global Invest SRL',
      status: 'Active',
      nextDeadline: new Date('2025-11-18'),
    },
    {
      id: 'case-4',
      caseNumber: '8901/2025',
      title: 'Drept Muncii - Litigiu Angajat',
      clientName: 'Retail Corp SRL',
      status: 'OnHold',
      nextDeadline: new Date('2025-12-01'),
    },
    {
      id: 'case-5',
      caseNumber: '1234/2025',
      title: 'Contract Prestări Servicii',
      clientName: 'Digital Marketing SA',
      status: 'Active',
      nextDeadline: new Date('2025-11-25'),
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
      title: 'Pregătire memoriu pentru termen 15.11',
      caseContext: 'Caz #2345',
      priority: 'High',
      dueDate: new Date('2025-11-12'),
      completed: false,
      timeEstimate: '3 ore',
    },
    {
      id: 'task-2',
      title: 'Redactare contract de vânzare-cumpărare',
      caseContext: 'Caz #4567',
      priority: 'Medium',
      dueDate: new Date('2025-11-12'),
      completed: false,
      timeEstimate: '2 ore',
    },
    {
      id: 'task-3',
      title: 'Întâlnire cu clientul - discuție strategie',
      caseContext: 'Caz #6789',
      priority: 'High',
      dueDate: new Date('2025-11-12'),
      completed: false,
      timeEstimate: '1.5 ore',
    },
    {
      id: 'task-4',
      title: 'Analiză jurisprudență drept muncii',
      caseContext: 'Caz #8901',
      priority: 'Low',
      dueDate: new Date('2025-11-12'),
      completed: true,
      timeEstimate: '2 ore',
    },
    {
      id: 'task-5',
      title: 'Revizuire contract prestări servicii',
      caseContext: 'Caz #1234',
      priority: 'Medium',
      dueDate: new Date('2025-11-12'),
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
      date: new Date('2025-11-13'),
      description: 'Depunere răspuns la cerere - Dosar 2345/2025',
      caseId: 'case-1',
      daysRemaining: 1,
      urgent: true,
    },
    {
      id: 'deadline-2',
      date: new Date('2025-11-15'),
      description: 'Termen instanță - Litigiu comercial',
      caseId: 'case-1',
      daysRemaining: 3,
      urgent: false,
    },
    {
      id: 'deadline-3',
      date: new Date('2025-11-16'),
      description: 'Semnare contract închiriere',
      caseId: 'case-2',
      daysRemaining: 4,
      urgent: false,
    },
    {
      id: 'deadline-4',
      date: new Date('2025-11-18'),
      description: 'Prezentare analiză due diligence',
      caseId: 'case-3',
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
      title: 'Contract prestări servicii juridice - SC TECH SRL',
      type: 'Contract',
      lastModified: new Date('2025-11-12T09:30:00'),
      version: 3,
      icon: 'file-text',
    },
    {
      id: 'doc-2',
      title: 'Memoriu apărare - Dosar 2345/2025',
      type: 'Motion',
      lastModified: new Date('2025-11-11T16:45:00'),
      version: 2,
      icon: 'gavel',
    },
    {
      id: 'doc-3',
      title: 'Cerere chemare în judecată - Litigiu comercial',
      type: 'Motion',
      lastModified: new Date('2025-11-10T14:20:00'),
      version: 1,
      icon: 'gavel',
    },
    {
      id: 'doc-4',
      title: 'Contract închiriere spațiu comercial - draft',
      type: 'Contract',
      lastModified: new Date('2025-11-09T11:15:00'),
      version: 4,
      icon: 'file-text',
    },
    {
      id: 'doc-5',
      title: 'Notă juridică - Fuziune ABC Industries',
      type: 'Memo',
      lastModified: new Date('2025-11-08T10:30:00'),
      version: 1,
      icon: 'mail',
    },
    {
      id: 'doc-6',
      title: 'Analiză jurisprudență - Drept muncii',
      type: 'Memo',
      lastModified: new Date('2025-11-07T15:00:00'),
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
      text: 'Consideră folosirea șablonului Contract #12 pentru cazul #4567',
      timestamp: '2 ore în urmă',
      type: 'recommendation',
      actionLink: '/templates/12',
    },
    {
      id: 'sug-2',
      text: '3 precedente relevante găsite pentru cercetarea ta în drept muncii',
      timestamp: '4 ore în urmă',
      type: 'insight',
      actionLink: '/research/precedents',
    },
    {
      id: 'sug-3',
      text: 'Termenul pentru cazul #2345 se apropie - 1 zi rămasă',
      timestamp: '5 ore în urmă',
      type: 'alert',
      actionLink: '/cases/2345',
    },
    {
      id: 'sug-4',
      text: 'Documentul "Memoriu apărare" are modificări nesalvate',
      timestamp: '1 zi în urmă',
      type: 'alert',
      actionLink: '/documents/doc-2',
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
  const [layout, setLayout] = useState<WidgetPosition[]>(defaultLayout);
  const [isLoading] = useState(false);

  const handleLayoutChange = (newLayout: WidgetPosition[]) => {
    setLayout(newLayout);
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
      <DashboardGrid layout={layout} onLayoutChange={handleLayoutChange} isEditing={isEditing}>
        <div key="active-cases" data-grid={{ i: 'active-cases', x: 0, y: 0, w: 6, h: 5 }}>
          <ActiveCasesWidget widget={mockActiveCasesWidget} />
        </div>

        <div key="today-tasks" data-grid={{ i: 'today-tasks', x: 6, y: 0, w: 6, h: 5 }}>
          <TodayTasksWidget widget={mockTodayTasksWidget} />
        </div>

        <div key="deadlines" data-grid={{ i: 'deadlines', x: 0, y: 5, w: 4, h: 5 }}>
          <DeadlinesWidget widget={mockDeadlinesWidget} />
        </div>

        <div key="recent-documents" data-grid={{ i: 'recent-documents', x: 4, y: 5, w: 8, h: 5 }}>
          <RecentDocumentsWidget widget={mockRecentDocumentsWidget} />
        </div>

        <div key="ai-suggestions" data-grid={{ i: 'ai-suggestions', x: 0, y: 10, w: 12, h: 4 }}>
          <AISuggestionWidget widget={mockAISuggestionsWidget} />
        </div>
      </DashboardGrid>
    </div>
  );
}

AssociateDashboard.displayName = 'AssociateDashboard';
