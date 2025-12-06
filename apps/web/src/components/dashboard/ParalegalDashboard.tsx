/**
 * ParalegalDashboard - Dashboard for Paralegal Role
 * Displays assigned tasks, document requests, deadline calendar, and AI suggestions
 */

'use client';

import React, { useState } from 'react';
import { DashboardGrid } from './DashboardGrid';
import { AssignedTasksWidget } from './widgets/AssignedTasksWidget';
import {
  DocumentRequestsWidget,
  type DocumentRequestsWidgetData,
} from './widgets/DocumentRequestsWidget';
import { DeadlineCalendarWidget } from './widgets/DeadlineCalendarWidget';
import { AISuggestionWidget } from './widgets/AISuggestionWidget';
import type {
  WidgetPosition,
  KanbanWidget,
  CalendarWidget,
  AISuggestionWidget as AISuggestionWidgetType,
} from '@legal-platform/types';

export interface ParalegalDashboardProps {
  isEditing?: boolean;
  onLayoutChange?: (layout: WidgetPosition[]) => void;
}

// Default layout for Paralegal Dashboard (12-column grid)
const defaultLayout: WidgetPosition[] = [
  // Row 1: Assigned Tasks (2/3) + Deadline Calendar (1/3)
  { i: 'assigned-tasks', x: 0, y: 0, w: 8, h: 6 },
  { i: 'deadline-calendar', x: 8, y: 0, w: 4, h: 6 },
  // Row 2: Document Requests + AI Recommendations (50/50)
  { i: 'document-requests', x: 0, y: 6, w: 6, h: 6 },
  { i: 'ai-suggestions', x: 6, y: 6, w: 6, h: 4 },
];

// Empty widget configurations - will be populated with real data when available
const emptyAssignedTasksWidget: KanbanWidget = {
  id: 'assigned-tasks',
  type: 'kanban',
  title: 'Sarcini Atribuite',
  position: { i: 'assigned-tasks', x: 0, y: 0, w: 8, h: 5 },
  columns: [
    { id: 'todo', title: 'De Făcut', tasks: [] },
    { id: 'inprogress', title: 'În Lucru', tasks: [] },
    { id: 'complete', title: 'Finalizate', tasks: [] },
  ],
};

const emptyDocumentRequestsWidget: DocumentRequestsWidgetData = {
  id: 'document-requests',
  type: 'documentRequests',
  title: 'Cereri Documente',
  position: { i: 'document-requests', x: 8, y: 0, w: 4, h: 5 },
  requests: [],
};

const emptyDeadlineCalendarWidget: CalendarWidget = {
  id: 'deadline-calendar',
  type: 'calendar',
  title: 'Calendar Termene',
  position: { i: 'deadline-calendar', x: 0, y: 5, w: 6, h: 4 },
  events: [],
  view: 'month',
};

const emptyAISuggestionsWidget: AISuggestionWidgetType = {
  id: 'ai-suggestions',
  type: 'aiSuggestion',
  title: 'Recomandări AI',
  position: { i: 'ai-suggestions', x: 6, y: 5, w: 6, h: 4 },
  suggestions: [],
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
      <DashboardGrid
        layout={defaultLayout}
        onLayoutChange={handleLayoutChange}
        isEditing={isEditing}
      >
        {/* Row 1: Assigned Tasks (2/3) + Deadline Calendar (1/3) */}
        <div key="assigned-tasks">
          <AssignedTasksWidget widget={emptyAssignedTasksWidget} />
        </div>

        <div key="deadline-calendar">
          <DeadlineCalendarWidget widget={emptyDeadlineCalendarWidget} />
        </div>

        {/* Row 2: Document Requests + AI Recommendations (50/50) */}
        <div key="document-requests">
          <DocumentRequestsWidget widget={emptyDocumentRequestsWidget} />
        </div>

        <div key="ai-suggestions">
          <AISuggestionWidget widget={emptyAISuggestionsWidget} />
        </div>
      </DashboardGrid>
    </div>
  );
}

ParalegalDashboard.displayName = 'ParalegalDashboard';
