'use client';

import { useQuery } from '@apollo/client/react';
import {
  ChevronRight,
  Plus,
  FileText,
  Clock,
  Star,
  Upload,
  FolderOpen,
  Briefcase,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useDocumentsStore } from '@/store/documentsStore';
import { GET_STORAGE_QUOTA } from '@/graphql/queries';
import type { CaseWithMape } from '@/types/mapa';
import { MapaSidebarItem } from './MapaCard';

interface DocumentsSidebarProps {
  cases: CaseWithMape[];
  onCreateMapa?: (caseId: string) => void;
  className?: string;
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Storage quota response type
interface StorageQuotaResponse {
  storageQuota: {
    total: number;
    used: number;
    remaining: number;
    state: string;
  } | null;
}

// Storage display
function StorageIndicator() {
  const { data, loading } = useQuery<StorageQuotaResponse>(GET_STORAGE_QUOTA, {
    fetchPolicy: 'cache-first',
    pollInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const quota = data?.storageQuota;

  // Don't render if no data or loading
  if (loading || !quota) {
    return null;
  }

  const percent = quota.total > 0 ? (quota.used / quota.total) * 100 : 0;
  const isWarning = quota.state === 'nearing' || quota.state === 'critical';
  const isExceeded = quota.state === 'exceeded';

  return (
    <div className="px-4 py-3 border-t border-linear-border-subtle">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-linear-text-tertiary">Spațiu ocupat</span>
        <span
          className={cn(
            'text-xs',
            isExceeded
              ? 'text-linear-error'
              : isWarning
                ? 'text-linear-warning'
                : 'text-linear-text-secondary'
          )}
        >
          {formatBytes(quota.used)} / {formatBytes(quota.total)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-linear-bg-tertiary">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isExceeded ? 'bg-linear-error' : isWarning ? 'bg-linear-warning' : 'bg-linear-accent'
          )}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

// Case item with expansion
function CaseItem({
  caseData,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  onCreateMapa,
}: {
  caseData: CaseWithMape;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onCreateMapa?: () => void;
}) {
  const { sidebarSelection, setSidebarSelection } = useDocumentsStore();

  // Status color
  const statusColors: Record<string, string> = {
    Active: 'text-linear-warning',
    PendingApproval: 'text-linear-accent',
    OnHold: 'text-linear-text-tertiary',
    Closed: 'text-linear-success',
  };

  return (
    <div className="mb-1">
      <button
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
          isSelected
            ? 'bg-linear-accent-muted text-linear-accent'
            : 'text-linear-text-secondary hover:bg-linear-bg-hover'
        )}
        onClick={onSelect}
      >
        <ChevronRight
          className={cn('w-4 h-4 flex-shrink-0 transition-transform', isExpanded && 'rotate-90')}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        />
        <Briefcase className={cn('w-4 h-4 flex-shrink-0', statusColors[caseData.status])} />
        <span className="flex-1 text-left truncate">{caseData.name}</span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-linear-bg-tertiary text-linear-text-tertiary">
          {caseData.documentCount}
        </span>
      </button>

      {/* Expanded: Mape list */}
      {isExpanded && (
        <div className="ml-4 pl-2 border-l border-linear-border-subtle mt-1 space-y-0.5">
          {caseData.mape.map((mapa) => (
            <MapaSidebarItem
              key={mapa.id}
              mapa={mapa}
              isSelected={sidebarSelection.type === 'mapa' && sidebarSelection.mapaId === mapa.id}
              onClick={() => setSidebarSelection({ type: 'mapa', mapaId: mapa.id })}
            />
          ))}
          {/* Add Mapa button */}
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-linear-text-tertiary hover:text-linear-text-secondary hover:bg-linear-bg-hover transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onCreateMapa?.();
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adaugă mapă</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function DocumentsSidebar({ cases, onCreateMapa, className }: DocumentsSidebarProps) {
  const {
    sidebarSelection,
    setSidebarSelection,
    selectedCaseId,
    setSelectedCase,
    expandedCases,
    toggleCaseExpanded,
  } = useDocumentsStore();

  // Calculate total unassigned
  const totalUnassigned = cases.reduce((sum, c) => sum + c.unassignedDocumentCount, 0);
  const totalDocuments = cases.reduce((sum, c) => sum + c.documentCount, 0);

  return (
    <aside
      className={cn(
        'w-80 flex-shrink-0 border-r border-linear-border-subtle flex flex-col bg-linear-bg-secondary',
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-linear-border-subtle">
        <h2 className="font-semibold text-sm text-linear-text-primary">Documente</h2>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {/* All Documents */}
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
              <FolderOpen className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">Toate documentele</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-linear-bg-tertiary text-linear-text-tertiary">
                {totalDocuments}
              </span>
            </button>
          </div>

          {/* Cases Section */}
          <div className="mt-4">
            <div className="px-4 py-2">
              <span className="text-xs font-medium uppercase tracking-wider text-linear-text-muted">
                Dosare
              </span>
            </div>
            <div className="px-2">
              {cases.map((caseData) => (
                <CaseItem
                  key={caseData.id}
                  caseData={caseData}
                  isExpanded={expandedCases.includes(caseData.id)}
                  isSelected={selectedCaseId === caseData.id}
                  onToggle={() => toggleCaseExpanded(caseData.id)}
                  onSelect={() => {
                    setSelectedCase(caseData.id);
                    setSidebarSelection({ type: 'case', caseId: caseData.id });
                  }}
                  onCreateMapa={() => onCreateMapa?.(caseData.id)}
                />
              ))}
            </div>
          </div>

          {/* Unassigned Documents */}
          {totalUnassigned > 0 && (
            <div className="mt-4">
              <div className="px-4 py-2">
                <span className="text-xs font-medium uppercase tracking-wider text-linear-text-muted">
                  Neatribuite
                </span>
              </div>
              <div className="px-2">
                <button
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                    sidebarSelection.type === 'unassigned'
                      ? 'bg-linear-accent-muted text-linear-accent'
                      : 'text-linear-text-secondary hover:bg-linear-bg-hover'
                  )}
                  onClick={() => setSidebarSelection({ type: 'unassigned' })}
                >
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">Documente neatribuite</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-linear-warning/15 text-linear-warning">
                    {totalUnassigned}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Access */}
          <div className="mt-4">
            <div className="px-4 py-2">
              <span className="text-xs font-medium uppercase tracking-wider text-linear-text-muted">
                Acces rapid
              </span>
            </div>
            <div className="px-2 space-y-0.5">
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-linear-text-secondary hover:bg-linear-bg-hover transition-colors">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">Recente</span>
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-linear-text-secondary hover:bg-linear-bg-hover transition-colors">
                <Star className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">Favorite</span>
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-linear-text-secondary hover:bg-linear-bg-hover transition-colors">
                <Upload className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">Încărcările mele</span>
              </button>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Storage Footer */}
      <StorageIndicator />
    </aside>
  );
}
