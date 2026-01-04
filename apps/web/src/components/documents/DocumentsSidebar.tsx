'use client';

import { useState } from 'react';
import {
  ChevronRight,
  Plus,
  Archive,
  FileText,
  Clock,
  Star,
  Upload,
  FolderOpen,
  Briefcase,
} from 'lucide-react';
import { ScrollArea, Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useDocumentsStore } from '@/store/documentsStore';
import type { CaseWithMape } from '@/types/mapa';
import { MapaSidebarItem } from './MapaCard';

interface DocumentsSidebarProps {
  cases: CaseWithMape[];
  onCreateMapa?: (caseId: string) => void;
  className?: string;
}

// Storage display
function StorageIndicator() {
  const used = 2.4; // GB
  const total = 10; // GB
  const percent = (used / total) * 100;

  return (
    <div className="px-4 py-3 border-t border-linear-border-subtle">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-linear-text-tertiary">Storage Used</span>
        <span className="text-xs text-linear-text-secondary">
          {used} GB / {total} GB
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-linear-bg-tertiary">
        <div
          className="h-full rounded-full bg-linear-accent transition-all"
          style={{ width: `${percent}%` }}
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
            <span>Add Mapa</span>
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
        <h2 className="font-semibold text-sm text-linear-text-primary">Documents</h2>
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
              <span className="flex-1 text-left">All Documents</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-linear-bg-tertiary text-linear-text-tertiary">
                {totalDocuments}
              </span>
            </button>
          </div>

          {/* Cases Section */}
          <div className="mt-4">
            <div className="px-4 py-2">
              <span className="text-xs font-medium uppercase tracking-wider text-linear-text-muted">
                Cases
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
                  Unassigned
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
                  <span className="flex-1 text-left">Unassigned Documents</span>
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
                Quick Access
              </span>
            </div>
            <div className="px-2 space-y-0.5">
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-linear-text-secondary hover:bg-linear-bg-hover transition-colors">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">Recent</span>
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-linear-text-secondary hover:bg-linear-bg-hover transition-colors">
                <Star className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">Starred</span>
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-linear-text-secondary hover:bg-linear-bg-hover transition-colors">
                <Upload className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">My Uploads</span>
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
