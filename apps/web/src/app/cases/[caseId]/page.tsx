/**
 * Case Workspace Page
 * Main workspace page for viewing and managing a legal case
 * Route: /cases/[caseId]
 */

'use client';

import React, { useEffect, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';
import { useCaseWorkspaceStore } from '../../../stores/case-workspace.store';
import { CaseHeader } from '../../../components/case/CaseHeader';
import { WorkspaceTabs } from '../../../components/case/WorkspaceTabs';
import { CaseDocumentsList } from '../../../components/case/CaseDocumentsList';
import { TasksTab } from '../../../components/case/tabs/TasksTab';
import { OverviewTab } from '../../../components/case/tabs/OverviewTab';
import { CommunicationsTab } from '../../../components/case/tabs/CommunicationsTab';
import { TimeEntriesTab } from '../../../components/case/tabs/TimeEntriesTab';
import { NotesTab } from '../../../components/case/tabs/NotesTab';
import { IntelligenceTab } from '../../../components/case/tabs/IntelligenceTab';
import { AIInsightsPanel } from '../../../components/case/AIInsightsPanel';
import { ErrorBoundary } from '../../../components/errors/ErrorBoundary';
import { useCase } from '../../../hooks/useCase';
import { useSuggestions } from '../../../hooks/useSuggestions';
import { useSetAIContext } from '../../../contexts/AIAssistantContext';
import { useAuth } from '../../../lib/hooks/useAuth';
import type { Case, User, Document, Task, DocumentNode } from '@legal-platform/types';

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

  // Use the real useCase hook to get actual case data
  const { case: realCaseData, loading, error } = useCase(caseId);

  // Get current user for role-based features
  const { user } = useAuth();

  // Use AI suggestions hook with case context
  const {
    suggestions: aiSuggestions,
    loading: suggestionsLoading,
    acceptSuggestion,
    dismissSuggestion,
  } = useSuggestions({
    currentScreen: 'case-workspace',
    currentCaseId: caseId,
  });

  // Handlers for AI suggestions
  const handleDismissSuggestion = useCallback(
    async (suggestionId: string) => {
      try {
        await dismissSuggestion(suggestionId);
      } catch (err) {
        console.error('Failed to dismiss suggestion:', err);
      }
    },
    [dismissSuggestion]
  );

  const handleTakeAction = useCallback(
    async (suggestionId: string) => {
      try {
        await acceptSuggestion(suggestionId);
      } catch (err) {
        console.error('Failed to accept suggestion:', err);
      }
    },
    [acceptSuggestion]
  );

  // Derive case workspace data from API response using useMemo
  const caseData = useMemo<CaseWorkspaceData | null>(() => {
    if (!realCaseData || loading) return null;

    // Build workspace data from real case data (no mock data)
    return {
      case: {
        ...realCaseData,
        openedDate: new Date(realCaseData.openedDate),
        closedDate: realCaseData.closedDate ? new Date(realCaseData.closedDate) : null,
      },
      teamMembers: (realCaseData.teamMembers || []).map(
        (
          member: {
            user?: User;
            createdAt?: string | Date;
            lastActive?: string | Date;
          } & Partial<User>
        ) => {
          // Handle case where member has a nested user object
          const user = member.user || member;
          return {
            ...user,
            createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
            lastActive: user.lastActive ? new Date(user.lastActive) : new Date(),
          } as User;
        }
      ),
      nextDeadline: undefined,
      documents: [], // Documents are fetched by CaseDocumentsList component
      tasks: [], // TODO: Fetch from API
      folderTree: [], // TODO: Fetch from API
      recentActivity: [], // TODO: Fetch from API
      upcomingDeadlines: [], // TODO: Fetch from API
      stats: {
        totalDocuments: 0,
        openTasks: 0,
        billableHours: 0,
      },
    };
  }, [realCaseData, loading]);

  // Set selected case in store on mount
  useEffect(() => {
    setSelectedCase(caseId);
  }, [caseId, setSelectedCase]);

  // Set AI assistant context to case mode
  useSetAIContext('case', caseId, caseData?.case?.title);

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
        return (
          <CaseDocumentsList
            caseId={caseId}
            caseName={caseData.case.title}
            clientId={realCaseData?.client?.id || ''}
            userRole={(user?.role as 'Partner' | 'Associate' | 'Paralegal') || 'Associate'}
            className="p-6"
          />
        );
      case 'tasks':
        return <TasksTab tasks={caseData.tasks} users={caseData.teamMembers} />;
      case 'communications':
        return <CommunicationsTab caseId={caseId} caseTitle={caseData.case.title} />;
      case 'time-entries':
        return <TimeEntriesTab />;
      case 'notes':
        return <NotesTab />;
      case 'intelligence':
        return <IntelligenceTab caseId={caseId} />;
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

        {/* Tab Content Area - Add right padding when AI panel is expanded */}
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
          suggestions={aiSuggestions}
          loading={suggestionsLoading}
          onDismissSuggestion={handleDismissSuggestion}
          onTakeAction={handleTakeAction}
        />
      </div>
    </ErrorBoundary>
  );
}
