/**
 * Case Workspace Page
 * Main workspace page for viewing and managing a legal case
 * Route: /cases/[caseId]
 *
 * OPS-358: Updated to use Linear-style components (Breadcrumb, TabBar)
 */

'use client';

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useCaseWorkspaceStore } from '../../../stores/case-workspace.store';
import { CaseHeader } from '../../../components/case/CaseHeader';
import { Breadcrumb } from '../../../components/linear/Breadcrumb';
import { TabBar, type TabOption } from '../../../components/linear/TabBar';
import { CaseDocumentsList } from '../../../components/case/CaseDocumentsList';
import { TasksTab } from '../../../components/case/tabs/TasksTab';
import { OverviewTab } from '../../../components/case/tabs/OverviewTab';
import { CommunicationsTab } from '../../../components/case/tabs/CommunicationsTab';
import { TimeEntriesTab } from '../../../components/case/tabs/TimeEntriesTab';
import { NotesTab } from '../../../components/case/tabs/NotesTab';
import { IntelligenceTab } from '../../../components/case/tabs/IntelligenceTab';
import { MapaList } from '../../../components/mapa';
// import { AIInsightsPanel } from '../../../components/case/AIInsightsPanel'; // HIDDEN: may be revived later
import { ErrorBoundary } from '../../../components/errors/ErrorBoundary';
import { useCase } from '../../../hooks/useCase';
// import { useSuggestions } from '../../../hooks/useSuggestions'; // HIDDEN: AI panel removed
import { useSetAIContext } from '../../../contexts/AIAssistantContext';
import { useAuth } from '../../../lib/hooks/useAuth';
import { AddTeamMemberModal } from '../../../components/case/AddTeamMemberModal';
import type { User, Document, Task, DocumentNode, WorkspaceTab } from '@legal-platform/types';
import type { CaseWithFullRelations } from '../../../hooks/useCase';

// ====================================================================
// Tab Configuration
// ====================================================================

const workspaceTabs: TabOption<WorkspaceTab>[] = [
  { value: 'overview', label: 'Detalii' },
  { value: 'documents', label: 'Documente' },
  { value: 'mape', label: 'Mape' },
  { value: 'tasks', label: 'Sarcini' },
  { value: 'communications', label: 'Comunicări' },
  { value: 'time-entries', label: 'Timp' },
  { value: 'notes', label: 'Notițe' },
  { value: 'intelligence', label: 'AI' },
];

interface CaseWorkspacePageProps {
  params: Promise<{
    caseId: string;
  }>;
}

/**
 * Type-safe workspace data structure
 */
interface CaseWorkspaceData {
  case: CaseWithFullRelations;
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
    <div className="flex h-screen animate-pulse flex-col bg-linear-bg-primary">
      <div className="border-b border-linear-border-subtle bg-linear-bg-secondary p-6">
        <div className="mb-4 h-8 w-1/3 rounded bg-linear-bg-tertiary" />
        <div className="h-4 w-1/2 rounded bg-linear-bg-tertiary" />
      </div>
      <div className="flex-1 p-6">
        <div className="h-full rounded-lg bg-linear-bg-secondary" />
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
  const { activeTab, setActiveTab, setSelectedCase } = useCaseWorkspaceStore();

  // Modal state
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);

  // Use the real useCase hook to get actual case data
  const { case: realCaseData, loading, error } = useCase(caseId);

  // Get current user for role-based features
  const { user } = useAuth();

  // HIDDEN: AI suggestions panel removed - may be revived later
  // const {
  //   suggestions: aiSuggestions,
  //   loading: suggestionsLoading,
  //   acceptSuggestion,
  //   dismissSuggestion,
  // } = useSuggestions({
  //   currentScreen: 'case-workspace',
  //   currentCaseId: caseId,
  // });

  // const handleDismissSuggestion = useCallback(
  //   async (suggestionId: string) => {
  //     try {
  //       await dismissSuggestion(suggestionId);
  //     } catch (err) {
  //       console.error('Failed to dismiss suggestion:', err);
  //     }
  //   },
  //   [dismissSuggestion]
  // );

  // const handleTakeAction = useCallback(
  //   async (suggestionId: string) => {
  //     try {
  //       await acceptSuggestion(suggestionId);
  //     } catch (err) {
  //       console.error('Failed to accept suggestion:', err);
  //     }
  //   },
  //   [acceptSuggestion]
  // );

  // Handlers for header actions
  const handleAddTeamMember = useCallback(() => {
    setAddMemberModalOpen(true);
  }, []);

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
      teamMembers: (realCaseData.teamMembers || []).map((member) => {
        // Type cast to handle both nested user and flat structures
        const m = member as unknown as {
          user?: User;
          createdAt?: string | Date;
          lastActive?: string | Date;
        } & Partial<User>;
        // Handle case where member has a nested user object
        const user = m.user || m;
        return {
          ...user,
          createdAt: user.createdAt ? new Date(user.createdAt as string | Date) : new Date(),
          lastActive: user.lastActive ? new Date(user.lastActive as string | Date) : new Date(),
        } as User;
      }),
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
      <div className="flex h-screen items-center justify-center bg-linear-bg-primary">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-linear-text-primary">Error Loading Case</h1>
          <p className="text-linear-text-secondary">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex h-screen items-center justify-center bg-linear-bg-primary">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-linear-text-primary">Case Not Found</h1>
          <p className="text-linear-text-secondary">
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
      case 'mape':
        return (
          <MapaList
            caseId={caseId}
            caseName={caseData.case.title}
            caseNumber={caseData.case.caseNumber}
          />
        );
      case 'tasks':
        return <TasksTab tasks={caseData.tasks} users={caseData.teamMembers} />;
      case 'communications':
        return <CommunicationsTab caseId={caseId} />;
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

  // Breadcrumb items
  const breadcrumbItems = [{ label: 'Cazuri', href: '/cases' }, { label: caseData.case.title }];

  return (
    <ErrorBoundary>
      {/* Remove MainLayout padding for full-width workspace */}
      <div className="-m-6 flex min-h-full flex-col bg-linear-bg-primary">
        {/* Breadcrumb Navigation */}
        <div className="border-b border-linear-border-subtle bg-linear-bg-secondary px-6 py-3">
          <Breadcrumb items={breadcrumbItems} />
        </div>

        {/* Case Header */}
        <CaseHeader
          case={caseData.case}
          teamMembers={caseData.teamMembers}
          nextDeadline={caseData.nextDeadline}
          onAddTeamMember={handleAddTeamMember}
        />

        {/* Tab Bar */}
        <div className="sticky top-0 z-10 bg-linear-bg-secondary">
          <TabBar
            tabs={workspaceTabs}
            value={activeTab}
            onChange={(value) => setActiveTab(value)}
          />
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-hidden relative pb-32">{renderTabContent()}</div>

        {/* Add Team Member Modal */}
        <AddTeamMemberModal
          caseId={caseId}
          open={addMemberModalOpen}
          onOpenChange={setAddMemberModalOpen}
        />
      </div>
    </ErrorBoundary>
  );
}
