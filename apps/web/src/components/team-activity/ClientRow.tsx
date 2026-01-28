'use client';

/**
 * ClientRow Component
 * Displays a client in the hierarchical list with expandable case list
 *
 * Features:
 * - Expandable row showing client name
 * - Total hours across all cases
 * - Attention count badge
 * - Nested case list when expanded
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronRight, Building2, AlertTriangle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CaseRow } from './CaseRow';
import type { ClientGroup } from '@/hooks/useTeamOverview';

// ============================================================================
// Types
// ============================================================================

export interface ClientRowProps {
  clientGroup: ClientGroup;
  defaultOpen?: boolean;
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
// Component
// ============================================================================

export function ClientRow({ clientGroup, defaultOpen = true, className }: ClientRowProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const { client, cases, totalHours, attentionCount } = clientGroup;
  const hasAttention = attentionCount > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={clsx(
            'w-full flex items-center gap-3 py-2.5 px-4',
            'text-left transition-colors',
            'hover:bg-linear-bg-hover',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent focus-visible:ring-inset',
            'border-b border-linear-border-subtle'
          )}
        >
          {/* Expand chevron */}
          <ChevronRight
            className={clsx(
              'h-4 w-4 text-linear-text-muted transition-transform flex-shrink-0',
              isOpen && 'rotate-90'
            )}
          />

          {/* Client icon */}
          <Building2 className="h-4 w-4 text-linear-text-secondary flex-shrink-0" />

          {/* Client name */}
          <span className="text-sm font-medium text-linear-text-primary flex-1 truncate">
            {client.name}
          </span>

          {/* Total hours */}
          <span className="text-xs text-linear-text-muted flex-shrink-0">
            {formatHours(totalHours)}
          </span>

          {/* Attention count badge */}
          {hasAttention && (
            <span className="flex items-center gap-1 text-xs text-linear-warning flex-shrink-0">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{attentionCount}</span>
            </span>
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-b border-linear-border-subtle">
          {cases.map((caseProgress) => (
            <CaseRow key={caseProgress.case.id} caseProgress={caseProgress} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

ClientRow.displayName = 'ClientRow';

export default ClientRow;
