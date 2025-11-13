/**
 * Case Workspace Page
 * Main workspace page for viewing and managing a legal case
 * Route: /cases/[caseId]
 */

'use client';

import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { useCaseWorkspaceStore } from '@/stores/case-workspace.store';
import { CaseHeader } from '@/components/case/CaseHeader';
import { WorkspaceTabs } from '@/components/case/WorkspaceTabs';
import { DocumentsTab } from '@/components/case/tabs/DocumentsTab';
import { TasksTab } from '@/components/case/tabs/TasksTab';
import { OverviewTab } from '@/components/case/tabs/OverviewTab';
import { CommunicationsTab } from '@/components/case/tabs/CommunicationsTab';
import { TimeEntriesTab } from '@/components/case/tabs/TimeEntriesTab';
import { NotesTab } from '@/components/case/tabs/NotesTab';
import { AIInsightsPanel } from '@/components/case/AIInsightsPanel';
import { QuickActionsBar } from '@/components/case/QuickActionsBar';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { createMockCaseWorkspace } from '@/lib/mockData';
import type { Case, User, Document, Task, AISuggestion, DocumentNode } from '@legal-platform/types';

interface CaseWorkspacePageProps {
  params: {
    caseId: string;
  };
}

/**
 * Type-safe workspace data structure
 * Replaces `any` type for better type safety
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
    type: 'document' | 'task' | 'deadline' | 'communication';
    description: string;
    timestamp: Date;
    userId: string;
  }>;
  upcomingDeadlines: Array<{
    date: Date;
    description: string;
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
  const { caseId } = params;
  const { activeTab, setActiveTab, setSelectedCase, aiPanelCollapsed } = useCaseWorkspaceStore();
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState<CaseWorkspaceData | null>(null);

  // Load case data on mount (using mock data for prototype)
  useEffect(() => {
    // Set the selected case in store
    setSelectedCase(caseId);

    // Simulate data loading
    const loadCaseData = async () => {
      // In a real app, this would fetch from API
      // For prototype, use factory to generate comprehensive mock data
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Generate mock workspace data using factory (Task 12)
      const mockWorkspace = createMockCaseWorkspace();

      // Structure data for component consumption
      // Ensure all dates are Date objects (not strings)
      const workspaceData: CaseWorkspaceData = {
        case: {
          ...mockWorkspace.case,
          id: caseId, // Use route caseId
          openedDate: new Date(mockWorkspace.case.openedDate),
          closedDate: mockWorkspace.case.closedDate ? new Date(mockWorkspace.case.closedDate) : null,
        },
        teamMembers: mockWorkspace.teamMembers.map(member => ({
          ...member,
          createdAt: new Date(member.createdAt),
          updatedAt: new Date(member.updatedAt),
        })),
        nextDeadline: {
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          description: 'Depunere răspuns la cerere',
        },
        documents: mockWorkspace.documents.map(doc => ({
          ...doc,
          createdAt: new Date(doc.createdAt),
          updatedAt: new Date(doc.updatedAt),
        })),
        tasks: mockWorkspace.tasks.map(task => ({
          ...task,
          dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
        })),
        folderTree: [mockWorkspace.documentTree],
        recentActivity: mockWorkspace.recentActivity.map(activity => ({
          ...activity,
          timestamp: new Date(activity.timestamp),
        })),
        upcomingDeadlines: [
          {
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            description: 'Depunere răspuns la cerere',
          },
          {
            date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            description: 'Ședință de judecată',
          },
        ],
        stats: {
          totalDocuments: mockWorkspace.documents.length,
          openTasks: mockWorkspace.tasks.filter(t => t.status !== 'Completed').length,
          billableHours: 24.5,
        },
        aiSuggestions: mockWorkspace.aiSuggestions.map(suggestion => ({
          ...suggestion,
          timestamp: new Date(suggestion.timestamp),
        })),
      };

      setCaseData(workspaceData);
      setLoading(false);
    };

    loadCaseData();
  }, [caseId, setSelectedCase]);

  // Set page title
  useEffect(() => {
    if (caseData?.case) {
      document.title = `${caseData.case.caseNumber} - ${caseData.case.title}`;
    }
  }, [caseData]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!caseData) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Cazul nu a fost găsit
          </h1>
          <p className="text-gray-600">
            Cazul cu ID-ul {caseId} nu există sau nu aveți acces la el.
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
        return (
          <DocumentsTab
            folderTree={caseData.folderTree}
            documents={caseData.documents}
          />
        );
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
        <WorkspaceTabs onTabChange={setActiveTab} />

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
        <AIInsightsPanel
          caseName={caseData.case.title}
          suggestions={caseData.aiSuggestions}
        />

        {/* Quick Actions Bar - Fixed at bottom */}
        <QuickActionsBar />
      </div>
    </ErrorBoundary>
  );
}
