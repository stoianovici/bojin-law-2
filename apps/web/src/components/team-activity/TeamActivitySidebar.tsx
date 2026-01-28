'use client';

/**
 * Team Activity Sidebar
 * Navigation sidebar for the /time page
 *
 * Features:
 * - "Toate" button to show all cases overview
 * - Clients section with expandable accordions
 * - "Client" row under each client (client-level items only)
 * - Cases listed under each client
 * - Summary footer with total hours + attention count
 */

import { ChevronRight, Building2, Briefcase, AlertTriangle, Inbox, LayoutGrid } from 'lucide-react';
import { ScrollArea } from '@/components/ui';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useTeamActivityStore, TeamActivitySelection } from '@/store/teamActivityStore';
import type { ClientGroup } from '@/hooks/useTeamOverview';

// ============================================================================
// Types
// ============================================================================

interface TeamActivitySidebarProps {
  clientGroups: ClientGroup[];
  loading?: boolean;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatHours(hours: number): string {
  if (hours === 0) return '0h';
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours.toFixed(1)}h`;
}

// ============================================================================
// Client Accordion
// ============================================================================

interface ClientAccordionProps {
  clientGroup: ClientGroup;
  isExpanded: boolean;
  selection: TeamActivitySelection;
  onToggle: () => void;
  onSelectClient: () => void;
  onSelectCase: (caseId: string) => void;
}

function ClientAccordion({
  clientGroup,
  isExpanded,
  selection,
  onToggle,
  onSelectClient,
  onSelectCase,
}: ClientAccordionProps) {
  const { client, cases, totalHours, attentionCount } = clientGroup;
  const hasAttention = attentionCount > 0;

  // Check if this client row is selected
  const isClientSelected = selection.type === 'client' && selection.clientId === client.id;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      {/* Client Header */}
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
            'text-linear-text-secondary hover:bg-linear-bg-hover',
            isExpanded && 'bg-linear-bg-tertiary'
          )}
        >
          <ChevronRight
            className={cn('w-4 h-4 flex-shrink-0 transition-transform', isExpanded && 'rotate-90')}
          />
          <Building2 className="w-4 h-4 flex-shrink-0 text-linear-text-tertiary" />
          <span className="flex-1 text-left truncate font-medium">{client.name}</span>

          {/* Total hours */}
          <span className="text-xs text-linear-text-muted flex-shrink-0">
            {formatHours(totalHours)}
          </span>

          {/* Attention count */}
          {hasAttention && (
            <span className="flex items-center gap-1 text-xs text-linear-warning flex-shrink-0">
              <AlertTriangle className="h-3 w-3" />
              <span>{attentionCount}</span>
            </span>
          )}
        </button>
      </CollapsibleTrigger>

      {/* Expanded: Client row + Cases */}
      <CollapsibleContent>
        <div className="ml-4 pl-2 border-l border-linear-border-subtle mt-1 space-y-0.5">
          {/* Client-level row (like inbox in /documents) */}
          <button
            onClick={onSelectClient}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
              isClientSelected
                ? 'bg-linear-accent-muted text-linear-accent'
                : 'text-linear-text-secondary hover:bg-linear-bg-hover'
            )}
          >
            <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-0" />
            <Inbox className="w-4 h-4 flex-shrink-0 text-linear-text-tertiary" />
            <span className="flex-1 text-left truncate">Client</span>
          </button>

          {/* Cases */}
          {cases.map((caseProgress) => {
            const isCaseSelected =
              selection.type === 'case' && selection.caseId === caseProgress.case.id;
            const caseAttentionCount = caseProgress.attentionFlags.length;

            return (
              <button
                key={caseProgress.case.id}
                onClick={() => onSelectCase(caseProgress.case.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                  isCaseSelected
                    ? 'bg-linear-accent-muted text-linear-accent'
                    : 'text-linear-text-secondary hover:bg-linear-bg-hover'
                )}
              >
                <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-0" />
                <Briefcase className="w-4 h-4 flex-shrink-0 text-linear-text-tertiary" />
                <span className="flex-1 text-left truncate">{caseProgress.case.title}</span>

                {/* Hours */}
                <span className="text-xs text-linear-text-muted flex-shrink-0">
                  {formatHours(caseProgress.timeProgress.totalHours)}
                </span>

                {/* Attention badge */}
                {caseAttentionCount > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-linear-warning flex-shrink-0">
                    <AlertTriangle className="h-3 w-3" />
                    <span>{caseAttentionCount}</span>
                  </span>
                )}
              </button>
            );
          })}

          {/* Empty state */}
          {cases.length === 0 && (
            <div className="px-3 py-2 text-xs text-linear-text-tertiary italic">
              Niciun dosar activ
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Component
// ============================================================================

export function TeamActivitySidebar({
  clientGroups,
  loading,
  className,
}: TeamActivitySidebarProps) {
  const { sidebarSelection, setSidebarSelection, expandedClients, toggleClientExpanded } =
    useTeamActivityStore();

  // Calculate totals for footer
  const totalHours = clientGroups.reduce((sum, g) => sum + g.totalHours, 0);
  const totalAttention = clientGroups.reduce((sum, g) => sum + g.attentionCount, 0);

  return (
    <aside
      className={cn(
        'w-80 flex-shrink-0 border-r border-linear-border-subtle flex flex-col bg-linear-bg-secondary',
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-linear-border-subtle">
        <h2 className="font-semibold text-sm text-linear-text-primary">Navigare</h2>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {/* All Cases / Overview */}
          <div className="px-2">
            <button
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                sidebarSelection.type === 'all'
                  ? 'bg-linear-accent-muted text-linear-accent'
                  : 'text-linear-text-secondary hover:bg-linear-bg-hover'
              )}
              onClick={() => setSidebarSelection({ type: 'all' })}
            >
              <LayoutGrid className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">Toate</span>
              <span className="text-xs text-linear-text-muted">{formatHours(totalHours)}</span>
            </button>
          </div>

          {/* Clients Section */}
          <div className="mt-4">
            <div className="px-4 py-2">
              <span className="text-xs font-medium uppercase tracking-wider text-linear-text-muted">
                Clienți
              </span>
            </div>
            <div className="px-2 space-y-0.5">
              {loading && clientGroups.length === 0 ? (
                // Loading skeleton
                <div className="space-y-1 animate-pulse">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md">
                      <div className="h-4 w-4 bg-linear-bg-tertiary rounded" />
                      <div className="h-4 w-4 bg-linear-bg-tertiary rounded" />
                      <div className="h-4 flex-1 bg-linear-bg-tertiary rounded" />
                    </div>
                  ))}
                </div>
              ) : clientGroups.length === 0 ? (
                // Empty state
                <div className="px-3 py-4 text-center text-sm text-linear-text-muted">
                  Nicio activitate curentă
                </div>
              ) : (
                // Client list
                clientGroups.map((clientGroup) => (
                  <ClientAccordion
                    key={clientGroup.client.id}
                    clientGroup={clientGroup}
                    isExpanded={expandedClients.includes(clientGroup.client.id)}
                    selection={sidebarSelection}
                    onToggle={() => toggleClientExpanded(clientGroup.client.id)}
                    onSelectClient={() =>
                      setSidebarSelection({ type: 'client', clientId: clientGroup.client.id })
                    }
                    onSelectCase={(caseId) => setSidebarSelection({ type: 'case', caseId })}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer with totals */}
      <div className="px-4 py-3 border-t border-linear-border-subtle">
        <div className="flex items-center justify-between text-xs">
          <span className="text-linear-text-muted">Total estimat</span>
          <div className="flex items-center gap-3">
            <span className="text-linear-text-secondary font-medium">
              {formatHours(totalHours)}
            </span>
            {totalAttention > 0 && (
              <span className="flex items-center gap-1 text-linear-warning">
                <AlertTriangle className="h-3 w-3" />
                <span>{totalAttention}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

TeamActivitySidebar.displayName = 'TeamActivitySidebar';

export default TeamActivitySidebar;
