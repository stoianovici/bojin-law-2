/**
 * ParalegalDashboard - Dashboard for Paralegal Role
 * Displays assigned tasks, document requests, deadline calendar, and AI suggestions
 */

'use client';

import React, { useState } from 'react';
import { DashboardGrid } from './DashboardGrid';
import { AssignedTasksWidget } from './widgets/AssignedTasksWidget';
import { DocumentRequestsWidget, type DocumentRequestsWidgetData } from './widgets/DocumentRequestsWidget';
import { DeadlineCalendarWidget } from './widgets/DeadlineCalendarWidget';
import { AISuggestionWidget } from './widgets/AISuggestionWidget';
import type { WidgetPosition, KanbanWidget, CalendarWidget, AISuggestionWidget as AISuggestionWidgetType } from '@legal-platform/types';

export interface ParalegalDashboardProps {
  isEditing?: boolean;
  onLayoutChange?: (layout: WidgetPosition[]) => void;
}

// Default layout for Paralegal Dashboard
const defaultLayout: WidgetPosition[] = [
  { i: 'assigned-tasks', x: 0, y: 0, w: 8, h: 6 },
  { i: 'document-requests', x: 8, y: 0, w: 4, h: 6 },
  { i: 'deadline-calendar', x: 0, y: 6, w: 6, h: 4 },
  { i: 'ai-suggestions', x: 6, y: 6, w: 6, h: 4 },
];

// Mock data for Paralegal widgets
const mockAssignedTasksWidget: KanbanWidget = {
  id: 'assigned-tasks',
  type: 'kanban',
  title: 'Sarcini Atribuite',
  position: { i: 'assigned-tasks', x: 0, y: 0, w: 8, h: 5 },
  columns: [
    {
      id: 'todo',
      title: 'De Făcut',
      tasks: [
        {
          id: 'task-1',
          title: 'Arhivare documente caz #2345',
          dueDate: new Date('2025-11-13'),
          assignedBy: 'Maria Ionescu',
        },
        {
          id: 'task-2',
          title: 'Pregătire dosar instanță',
          dueDate: new Date('2025-11-14'),
          assignedBy: 'Alexandru Popescu',
        },
        {
          id: 'task-3',
          title: 'Verificare semnături contract',
          dueDate: new Date('2025-11-15'),
          assignedBy: 'Elena Dumitrescu',
        },
      ],
    },
    {
      id: 'inprogress',
      title: 'În Lucru',
      tasks: [
        {
          id: 'task-4',
          title: 'Scanare și indexare documente',
          dueDate: new Date('2025-11-12'),
          assignedBy: 'Maria Ionescu',
        },
        {
          id: 'task-5',
          title: 'Notificare client - termen instanță',
          dueDate: new Date('2025-11-13'),
          assignedBy: 'Andrei Constantin',
        },
      ],
    },
    {
      id: 'complete',
      title: 'Finalizate',
      tasks: [
        {
          id: 'task-6',
          title: 'Depunere memoriu la instanță',
          dueDate: new Date('2025-11-11'),
          assignedBy: 'Alexandru Popescu',
        },
        {
          id: 'task-7',
          title: 'Actualizare bază de date clienți',
          dueDate: new Date('2025-11-10'),
          assignedBy: 'Maria Ionescu',
        },
        {
          id: 'task-8',
          title: 'Pregătire copii certificate',
          dueDate: new Date('2025-11-09'),
          assignedBy: 'Elena Dumitrescu',
        },
      ],
    },
  ],
};

const mockDocumentRequestsWidget: DocumentRequestsWidgetData = {
  id: 'document-requests',
  type: 'documentRequests',
  title: 'Cereri Documente',
  position: { i: 'document-requests', x: 8, y: 0, w: 4, h: 5 },
  requests: [
    {
      id: 'req-1',
      requesterName: 'Maria Ionescu',
      documentType: 'Contract semnat - SC TECH SRL',
      caseContext: 'Caz #2345',
      urgency: 'Urgent',
      requestedDate: new Date('2025-11-12'),
    },
    {
      id: 'req-2',
      requesterName: 'Alexandru Popescu',
      documentType: 'Certificate fiscale client',
      caseContext: 'Caz #4567',
      urgency: 'Normal',
      requestedDate: new Date('2025-11-13'),
    },
    {
      id: 'req-3',
      requesterName: 'Elena Dumitrescu',
      documentType: 'Acte societate - fuziune',
      caseContext: 'Caz #6789',
      urgency: 'Urgent',
      requestedDate: new Date('2025-11-14'),
    },
    {
      id: 'req-4',
      requesterName: 'Andrei Constantin',
      documentType: 'Contracte de muncă angajați',
      caseContext: 'Caz #8901',
      urgency: 'Normal',
      requestedDate: new Date('2025-11-15'),
    },
    {
      id: 'req-5',
      requesterName: 'Cristina Stancu',
      documentType: 'Factură prestări servicii',
      caseContext: 'Caz #1234',
      urgency: 'Normal',
      requestedDate: new Date('2025-11-16'),
    },
  ],
};

const mockDeadlineCalendarWidget: CalendarWidget = {
  id: 'deadline-calendar',
  type: 'calendar',
  title: 'Calendar Termene',
  position: { i: 'deadline-calendar', x: 0, y: 5, w: 6, h: 4 },
  events: [
    {
      id: 'deadline-1',
      title: 'Depunere răspuns instanță',
      date: new Date('2025-11-13'),
      description: 'Dosar 2345/2025',
      caseContext: 'Litigiu comercial',
      urgency: 'Urgent',
    },
    {
      id: 'deadline-2',
      title: 'Termen judecată',
      date: new Date('2025-11-15'),
      description: 'Dosar 4567/2025',
      caseContext: 'Contract închiriere',
      urgency: 'Normal',
    },
    {
      id: 'deadline-3',
      title: 'Semnare contract',
      date: new Date('2025-11-16'),
      description: 'Client ABC Industries',
      caseContext: 'Fuziune și achiziție',
      urgency: 'Normal',
    },
    {
      id: 'deadline-4',
      title: 'Depunere cerere executare',
      date: new Date('2025-11-18'),
      description: 'Dosar 6789/2025',
      caseContext: 'Drept muncii',
      urgency: 'Normal',
    },
    {
      id: 'deadline-5',
      title: 'Termen conciliere',
      date: new Date('2025-11-20'),
      description: 'Dosar 8901/2025',
      caseContext: 'Litigiu angajat',
      urgency: 'Normal',
    },
  ],
  view: 'month',
};

const mockAISuggestionsWidget: AISuggestionWidgetType = {
  id: 'ai-suggestions',
  type: 'aiSuggestion',
  title: 'Recomandări AI',
  position: { i: 'ai-suggestions', x: 6, y: 5, w: 6, h: 4 },
  suggestions: [
    {
      id: 'sug-1',
      text: 'Cererea de document pentru cazul #8901 întârziată cu 2 zile',
      timestamp: '1 oră în urmă',
      type: 'alert',
      actionLink: '/document-requests/req-3',
    },
    {
      id: 'sug-2',
      text: 'Termen depunere instanță pentru cazul #6789 în 3 zile',
      timestamp: '3 ore în urmă',
      type: 'alert',
      actionLink: '/cases/6789',
    },
    {
      id: 'sug-3',
      text: 'Ai finalizat 8 sarcini săptămâna aceasta - progres excelent!',
      timestamp: '5 ore în urmă',
      type: 'insight',
    },
    {
      id: 'sug-4',
      text: 'Sugestie: Arhivează documentele finalizate pentru cazul #2345',
      timestamp: '1 zi în urmă',
      type: 'recommendation',
      actionLink: '/cases/2345',
    },
  ],
};

/**
 * ParalegalDashboard - Main dashboard view for Paralegal role
 *
 * Displays:
 * - Assigned tasks (Kanban board with To Do, In Progress, Complete columns)
 * - Document requests (list of pending requests from attorneys)
 * - Deadline calendar (monthly view with colored dots for deadlines)
 * - AI suggestions (alerts and recommendations)
 */
export function ParalegalDashboard({ isEditing = false, onLayoutChange }: ParalegalDashboardProps) {
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
        <div key="assigned-tasks" data-grid={{ i: 'assigned-tasks', x: 0, y: 0, w: 8, h: 6 }}>
          <AssignedTasksWidget widget={mockAssignedTasksWidget} />
        </div>

        <div key="document-requests" data-grid={{ i: 'document-requests', x: 8, y: 0, w: 4, h: 6 }}>
          <DocumentRequestsWidget widget={mockDocumentRequestsWidget} />
        </div>

        <div key="deadline-calendar" data-grid={{ i: 'deadline-calendar', x: 0, y: 6, w: 6, h: 4 }}>
          <DeadlineCalendarWidget widget={mockDeadlineCalendarWidget} />
        </div>

        <div key="ai-suggestions" data-grid={{ i: 'ai-suggestions', x: 6, y: 6, w: 6, h: 4 }}>
          <AISuggestionWidget widget={mockAISuggestionsWidget} />
        </div>
      </DashboardGrid>
    </div>
  );
}

ParalegalDashboard.displayName = 'ParalegalDashboard';
