'use client';

/**
 * Time / Team Activity Page
 * Partner/BusinessOwner view for team oversight and timesheet generation
 *
 * Features:
 * - Two-column layout (filters sidebar + content area)
 * - View mode: Read-only activity grouped by time/member
 * - Timesheet mode: Editable table for invoicing
 * - Filters: Case, team members, date range
 * - Toggle to show/hide team member attribution (persisted)
 */

import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import {
  ModeToggle,
  TimesheetFilters,
  TimesheetEditor,
  TeamActivityView,
  getDefaultFiltersValue,
} from '@/components/team-activity';
import type { TimesheetFiltersValue } from '@/components/team-activity';
import type { ActivityViewMode } from '@/hooks/useTeamActivity';

// ============================================================================
// Constants
// ============================================================================

const ATTRIBUTION_STORAGE_KEY = 'timesheet-show-attribution';

// ============================================================================
// Page Component
// ============================================================================

export default function TimePage() {
  const [viewMode, setViewMode] = useState<ActivityViewMode>('view');
  const [filters, setFilters] = useState<TimesheetFiltersValue>(getDefaultFiltersValue);
  // Team attribution toggle with localStorage persistence
  const [showAttribution, setShowAttribution] = useState<boolean>(true);

  // Load persisted preference on mount
  useEffect(() => {
    const stored = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (stored !== null) {
      setShowAttribution(stored === 'true');
    }
  }, []);

  // Persist preference when changed
  const handleAttributionChange = (value: boolean) => {
    setShowAttribution(value);
    localStorage.setItem(ATTRIBUTION_STORAGE_KEY, String(value));
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* Page Header */}
      <header className="flex-shrink-0 px-6 py-4 border-b border-linear-border-subtle bg-linear-bg-secondary">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-accent/20 rounded-lg">
              <Users className="h-5 w-5 text-linear-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-linear-text-primary">Activitate Echipă</h1>
              <p className="text-sm text-linear-text-secondary">
                {viewMode === 'view'
                  ? 'Vizualizează activitatea echipei'
                  : 'Generează fișe de pontaj pentru facturare'}
              </p>
            </div>
          </div>
          <ModeToggle value={viewMode} onChange={setViewMode} />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Filters Sidebar */}
        <aside className="w-60 flex-shrink-0 border-r border-linear-border-subtle bg-linear-bg-tertiary p-4 overflow-y-auto">
          <TimesheetFilters value={filters} onChange={setFilters} />
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-y-auto bg-linear-bg-primary">
          {viewMode === 'view' ? (
            <ViewModeContent filters={filters} />
          ) : (
            <TimesheetModeContent
              filters={filters}
              showAttribution={showAttribution}
              onAttributionChange={handleAttributionChange}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// View Mode Content
// ============================================================================

interface ContentProps {
  filters: TimesheetFiltersValue;
}

function ViewModeContent({ filters }: ContentProps) {
  return <TeamActivityView filters={filters} />;
}

// ============================================================================
// Timesheet Mode Content
// ============================================================================

interface TimesheetContentProps extends ContentProps {
  showAttribution: boolean;
  onAttributionChange: (value: boolean) => void;
}

function TimesheetModeContent({
  filters,
  showAttribution,
  onAttributionChange,
}: TimesheetContentProps) {
  return (
    <TimesheetEditor
      filters={filters}
      showTeamMember={showAttribution}
      onShowTeamMemberChange={onAttributionChange}
    />
  );
}
