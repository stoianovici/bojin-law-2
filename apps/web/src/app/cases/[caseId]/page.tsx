/**
 * Case Workspace Page
 * Main workspace page for viewing and managing a legal case
 * Route: /cases/[caseId]
 */

'use client';

import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { useCaseWorkspaceStore } from '../../../stores/case-workspace.store';
import { CaseHeader } from '../../../components/case/CaseHeader';
import { WorkspaceTabs } from '../../../components/case/WorkspaceTabs';
import { DocumentsTab } from '../../../components/case/tabs/DocumentsTab';
import { TasksTab } from '../../../components/case/tabs/TasksTab';
import { OverviewTab } from '../../../components/case/tabs/OverviewTab';
import { CommunicationsTab } from '../../../components/case/tabs/CommunicationsTab';
import { TimeEntriesTab } from '../../../components/case/tabs/TimeEntriesTab';
import { NotesTab } from '../../../components/case/tabs/NotesTab';
import { AIInsightsPanel } from '../../../components/case/AIInsightsPanel';
import { QuickActionsBar } from '../../../components/case/QuickActionsBar';
import { ErrorBoundary } from '../../../components/errors/ErrorBoundary';
import { createMockCaseWorkspace } from '../../../lib/mockData';
import { useCase } from '../../../hooks/useCase';
import type { Case, User, Document, Task, AISuggestion, DocumentNode } from '@legal-platform/types';

interface CaseWorkspacePageProps {
  params: Promise<{
    caseId: string;
  }>;
}

/**
 * Type-safe workspace data structure
 */
interface CaseWorkspaceData {
  case: Case;
  teamMembers: User[];
  nextDeadline?: {
    date: Date;
    description: string;
  };
  documents: Document[];
  tasks: Task[];
  folderTree: DocumentNode[];
  recentActivity: Array<{
    id: string;
    type: 'document' | 'task' | 'communication' | 'note';
    description: string;
    timestamp: Date;
    userId: string;
  }>;
  upcomingDeadlines: Array<{
    id: string;
    title: string;
    date: Date;
    status: 'upcoming' | 'today' | 'overdue';
  }>;
  stats: {
    totalDocuments: number;
    openTasks: number;
    billableHours: number;
  };
  aiSuggestions: AISuggestion[];
}

/**
 * Loading Skeleton Component
 */
function LoadingSkeleton() {
  return (
    <div className="h-screen flex flex-col bg-gray-50 animate-pulse">
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
      <div className="flex-1 p-6">
        <div className="h-full bg-white rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Case Workspace Page Component
 *
 * Displays complete case workspace with all tabs and panels
 */
export default function CaseWorkspacePage({ params }: CaseWorkspacePageProps) {
  const { caseId } = React.use(params);
  const { activeTab, setSelectedCase, aiPanelCollapsed } = useCaseWorkspaceStore();
  const [caseData, setCaseData] = useState<CaseWorkspaceData | null>(null);

  // Use the real useCase hook to get actual case data
  const { case: realCaseData, loading, error } = useCase(caseId);

  // Load case data on mount
  useEffect(() => {
    // Set the selected case in store
    setSelectedCase(caseId);

    // Load workspace data when real case data is available
    if (realCaseData && !loading) {
      // Generate mock workspace data using factory
      const mockWorkspace = createMockCaseWorkspace();

      // Merge real case data with mock workspace features
      const workspaceData: CaseWorkspaceData = {
        case: {
          ...realCaseData,
          openedDate: new Date(realCaseData.openedDate),
          closedDate: realCaseData.closedDate ? new Date(realCaseData.closedDate) : null,
        },
        teamMembers: (realCaseData.teamMembers || []).map((member: any) => {
          // Handle case where member has a nested user object
          const user = member.user || member;
          return {
            ...user,
            createdAt: new Date(user.createdAt || Date.now()),
            lastActive: new Date(user.lastActive || Date.now()),
          };
        }),
        nextDeadline: {
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          description: 'Next deadline',
        },
        documents: mockWorkspace.documents.map((doc) => ({
          ...doc,
          createdAt: new Date(doc.createdAt),
          updatedAt: new Date(doc.updatedAt),
        })),
        tasks: mockWorkspace.tasks.map((task) => ({
          ...task,
          dueDate: new Date(task.dueDate),
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
        })),
        folderTree: [mockWorkspace.documentTree],
        recentActivity: mockWorkspace.recentActivity.map((activity) => ({
          ...activity,
          timestamp: new Date(activity.timestamp),
        })),
        upcomingDeadlines: [
          {
            id: 'deadline-1',
            title: 'Filing response',
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: 'upcoming' as const,
          },
          {
            id: 'deadline-2',
            title: 'Court hearing',
            date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            status: 'upcoming' as const,
          },
        ],
        stats: {
          totalDocuments: mockWorkspace.documents.length,
          openTasks: mockWorkspace.tasks.filter((t) => t.status !== 'Completed').length,
          billableHours: 24.5,
        },
        aiSuggestions: mockWorkspace.aiSuggestions.map((suggestion) => ({
          ...suggestion,
          timestamp: new Date(suggestion.timestamp),
        })),
      };

      setCaseData(workspaceData);
    }
  }, [caseId, setSelectedCase, realCaseData, loading]);

  // Set page title
  useEffect(() => {
    if (caseData?.case) {
      document.title = `${caseData.case.caseNumber} - ${caseData.case.title}`;
    }
  }, [caseData]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Case</h1>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Case Not Found</h1>
          <p className="text-gray-600">
            The case with ID {caseId} does not exist or you don&apos;t have access to it.
          </p>
        </div>
      </div>
    );
  }

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewTab
            case={caseData.case}
            teamMembers={caseData.teamMembers}
            recentActivity={caseData.recentActivity}
            upcomingDeadlines={caseData.upcomingDeadlines}
            stats={caseData.stats}
          />
        );
      case 'documents':
        return <DocumentsTab folderTree={caseData.folderTree} documents={caseData.documents} />;
      case 'tasks':
        return <TasksTab tasks={caseData.tasks} users={caseData.teamMembers} />;
      case 'communications':
        return <CommunicationsTab />;
      case 'time-entries':
        return <TimeEntriesTab />;
      case 'notes':
        return <NotesTab />;
      default:
        return <OverviewTab case={caseData.case} />;
    }
  };

  return (
    <ErrorBoundary>
      {/* Remove MainLayout padding for full-width workspace */}
      <div className="flex flex-col bg-gray-50 min-h-full -m-6">
        {/* Case Header */}
        <CaseHeader
          case={caseData.case}
          teamMembers={caseData.teamMembers}
          nextDeadline={caseData.nextDeadline}
        />

        {/* Workspace Tabs */}
        <WorkspaceTabs />

        {/* Tab Content Area - Add right padding when AI panel is expanded, bottom padding for QuickActionsBar */}
        <div
          className={clsx(
            'flex-1 overflow-hidden relative pb-32 transition-all duration-300',
            // Add right padding to avoid content being hidden behind AI panel
            aiPanelCollapsed ? 'pr-12' : 'pr-80'
          )}
        >
          {renderTabContent()}
        </div>

        {/* AI Insights Panel - Fixed position, starts below TopBar */}
        <AIInsightsPanel caseName={caseData.case.title} suggestions={caseData.aiSuggestions} />

        {/* Quick Actions Bar - Fixed at bottom */}
        <QuickActionsBar />
      </div>
    </ErrorBoundary>
  );
}
