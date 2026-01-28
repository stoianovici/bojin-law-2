'use client';

/**
 * Time / Team Activity Page
 * Partner/BusinessOwner view for team oversight
 *
 * Features:
 * - Sidebar navigation for clients and cases
 * - Case-centric overview with progress cards
 * - Client-level view for tasks not tied to cases
 * - Attention indicators for items needing review
 * - Collapsible activity stream
 */

import { Users } from 'lucide-react';
import {
  TeamOverview,
  TeamActivitySidebar,
  ClientActivityView,
  CaseActivityView,
} from '@/components/team-activity';
import { useTeamOverview } from '@/hooks/useTeamOverview';
import { useTeamActivityStore } from '@/store/teamActivityStore';

// ============================================================================
// Page Component
// ============================================================================

export default function TimePage() {
  const { clientGroups, loading } = useTeamOverview();
  const { sidebarSelection } = useTeamActivityStore();

  return (
    <div className="h-full w-full flex flex-col">
      {/* Page Header */}
      <header className="flex-shrink-0 px-6 py-4 border-b border-linear-border-subtle bg-linear-bg-secondary">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-linear-accent/20 rounded-lg">
            <Users className="h-5 w-5 text-linear-accent" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-linear-text-primary">Activitate Echipă</h1>
            <p className="text-sm text-linear-text-secondary">Vizualizează activitatea echipei</p>
          </div>
        </div>
      </header>

      {/* Main Content Area with Sidebar */}
      <div className="flex-1 flex overflow-hidden bg-linear-bg-primary">
        {/* Sidebar */}
        <TeamActivitySidebar clientGroups={clientGroups} loading={loading} />

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {sidebarSelection.type === 'all' && <TeamOverview className="h-full" />}
          {sidebarSelection.type === 'client' && (
            <ClientActivityView clientId={sidebarSelection.clientId} className="h-full" />
          )}
          {sidebarSelection.type === 'case' && (
            <CaseActivityView caseId={sidebarSelection.caseId} className="h-full" />
          )}
        </main>
      </div>
    </div>
  );
}
