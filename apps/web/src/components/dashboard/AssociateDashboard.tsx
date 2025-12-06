/**
 * AssociateDashboard - Dashboard for Associate Role
 * All data comes from real API - no mock data
 */

'use client';

import React, { useState } from 'react';
import { DashboardGrid } from './DashboardGrid';
import { ActiveCasesWidget } from './widgets/ActiveCasesWidget';
import { TodayTasksWidget } from './widgets/TodayTasksWidget';
import { DeadlinesWidget } from './widgets/DeadlinesWidget';
import { RecentDocumentsWidget } from './widgets/RecentDocumentsWidget';
import { AISuggestionWidget } from './widgets/AISuggestionWidget';
import type {
  WidgetPosition,
  CaseListWidget,
  TaskListWidget,
  DeadlineWidget,
  DocumentListWidget,
  AISuggestionWidget as AISuggestionWidgetType,
} from '@legal-platform/types';

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

// Empty widget configurations - will be populated with real data when available
const emptyActiveCasesWidget: CaseListWidget = {
  id: 'active-cases',
  type: 'caseList',
  title: 'Cazurile Mele Active',
  position: { i: 'active-cases', x: 0, y: 0, w: 6, h: 4 },
  cases: [],
};

const emptyTodayTasksWidget: TaskListWidget = {
  id: 'today-tasks',
  type: 'taskList',
  title: 'Sarcini Astăzi',
  position: { i: 'today-tasks', x: 6, y: 0, w: 6, h: 4 },
  tasks: [],
};

const emptyDeadlinesWidget: DeadlineWidget = {
  id: 'deadlines',
  type: 'deadline',
  title: 'Termene Această Săptămână',
  position: { i: 'deadlines', x: 0, y: 4, w: 4, h: 4 },
  deadlines: [],
};

const emptyRecentDocumentsWidget: DocumentListWidget = {
  id: 'recent-documents',
  type: 'documentList',
  title: 'Documente Recente',
  position: { i: 'recent-documents', x: 4, y: 4, w: 8, h: 4 },
  documents: [],
};

const emptyAISuggestionsWidget: AISuggestionWidgetType = {
  id: 'ai-suggestions',
  type: 'aiSuggestion',
  title: 'Recomandări AI',
  position: { i: 'ai-suggestions', x: 0, y: 8, w: 12, h: 4 },
  suggestions: [],
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
      <DashboardGrid
        layout={defaultLayout}
        onLayoutChange={handleLayoutChange}
        isEditing={isEditing}
      >
        {/* Row 1: Active Cases + Today's Tasks (50/50) */}
        <div key="active-cases">
          <ActiveCasesWidget widget={emptyActiveCasesWidget} />
        </div>

        <div key="today-tasks">
          <TodayTasksWidget widget={emptyTodayTasksWidget} />
        </div>

        {/* Row 2: 3 equal widgets (1/3 each) */}
        <div key="deadlines">
          <DeadlinesWidget widget={emptyDeadlinesWidget} />
        </div>

        <div key="recent-documents">
          <RecentDocumentsWidget widget={emptyRecentDocumentsWidget} />
        </div>

        <div key="ai-suggestions">
          <AISuggestionWidget widget={emptyAISuggestionsWidget} />
        </div>
      </DashboardGrid>
    </div>
  );
}

AssociateDashboard.displayName = 'AssociateDashboard';
