'use client';

import { ChevronRight, Users, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ClientGroupHeaderProps {
  client: {
    id: string;
    name: string;
    caseCount: number;
    activeCaseCount: number;
  };
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function ClientGroupHeader({
  client,
  isExpanded,
  isSelected,
  onToggleExpand,
  onSelect,
}: ClientGroupHeaderProps) {
  const router = useRouter();

  const handleAddCase = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/cases/new?clientId=${client.id}`);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-6 py-3 border-b border-linear-border-subtle transition-colors',
        'hover:bg-linear-bg-hover',
        isExpanded && 'bg-linear-bg-tertiary',
        isSelected && 'bg-linear-accent/10 border-l-2 border-l-linear-accent'
      )}
    >
      {/* Chevron - toggles expansion */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
        className="p-0.5 hover:bg-linear-bg-hover rounded"
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 text-linear-text-tertiary transition-transform flex-shrink-0',
            isExpanded && 'rotate-90'
          )}
        />
      </button>

      {/* Client name area - selects client */}
      <button onClick={onSelect} className="flex items-center gap-2 flex-1 min-w-0 text-left">
        <Users className="h-4 w-4 text-linear-text-tertiary flex-shrink-0" />
        <span
          className={cn(
            'text-sm font-medium truncate',
            isSelected ? 'text-linear-accent' : 'text-linear-text-primary'
          )}
        >
          {client.name}
        </span>
      </button>

      {/* Case count badge */}
      <span className="text-xs text-linear-text-tertiary whitespace-nowrap">
        {client.activeCaseCount || client.caseCount}{' '}
        {(client.activeCaseCount || client.caseCount) === 1 ? 'dosar' : 'dosare'}
      </span>

      {/* Add case button */}
      <button
        onClick={handleAddCase}
        className="p-1 text-linear-text-tertiary hover:text-linear-accent hover:bg-linear-accent/10 rounded transition-colors"
        title="Adaugă dosar nou pentru acest client"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export default ClientGroupHeader;
