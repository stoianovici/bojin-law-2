'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Filter, GitBranch, Calendar, List, LayoutGrid, User, Plus, Search } from 'lucide-react';

// ====================================================================
// TasksPageHeader - Header with view toggles, filters, and add button
// ====================================================================

export type TaskViewMode = 'list' | 'kanban' | 'calendar';

export interface TasksPageHeaderProps {
  /** Current view mode */
  viewMode: TaskViewMode;
  /** Callback when view mode changes */
  onViewModeChange: (mode: TaskViewMode) => void;
  /** Search query */
  searchQuery: string;
  /** Callback when search changes */
  onSearchChange: (query: string) => void;
  /** Whether "My Tasks" filter is active */
  myTasksOnly: boolean;
  /** Callback when "My Tasks" filter toggles */
  onMyTasksToggle: () => void;
  /** Callback when "+ Sarcina noua" is clicked */
  onNewTask: () => void;
  /** Additional filters UI (optional) */
  additionalFilters?: React.ReactNode;
  /** Page title override */
  title?: string;
  /** Additional className */
  className?: string;
}

/**
 * TasksPageHeader renders the header matching the mockup:
 * - Title + view toggle + new task button
 * - Search input + filter buttons
 */
export function TasksPageHeader({
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  myTasksOnly,
  onMyTasksToggle,
  onNewTask,
  additionalFilters,
  title = 'Sarcini',
  className,
}: TasksPageHeaderProps) {
  return (
    <header
      className={cn(
        'border-b border-linear-border-subtle bg-linear-bg-secondary px-6 py-4',
        className
      )}
    >
      {/* Top Row: Title + View Toggle + New Button */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-linear-text-primary">{title}</h1>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex rounded-md bg-linear-bg-tertiary p-0.5">
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              className={cn(
                'flex items-center justify-center rounded px-2.5 py-1.5 transition-colors',
                viewMode === 'list'
                  ? 'bg-linear-bg-hover text-linear-text-primary'
                  : 'text-linear-text-tertiary hover:text-linear-text-secondary'
              )}
              title="Lista"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('kanban')}
              className={cn(
                'flex items-center justify-center rounded px-2.5 py-1.5 transition-colors',
                viewMode === 'kanban'
                  ? 'bg-linear-bg-hover text-linear-text-primary'
                  : 'text-linear-text-tertiary hover:text-linear-text-secondary'
              )}
              title="Kanban"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('calendar')}
              className={cn(
                'flex items-center justify-center rounded px-2.5 py-1.5 transition-colors',
                viewMode === 'calendar'
                  ? 'bg-linear-bg-hover text-linear-text-primary'
                  : 'text-linear-text-tertiary hover:text-linear-text-secondary'
              )}
              title="Calendar"
            >
              <Calendar className="h-4 w-4" />
            </button>
          </div>

          {/* New Task Button */}
          <button
            type="button"
            onClick={onNewTask}
            className="flex items-center gap-1.5 rounded-md bg-linear-accent px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-linear-accent-hover"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Sarcina noua
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-2.5">
        {/* Search Input */}
        <div className="flex min-w-[200px] items-center gap-2 rounded-md border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2">
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-linear-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cauta sarcini..."
            className="w-full bg-transparent text-[13px] text-linear-text-primary placeholder:text-linear-text-muted focus:outline-none"
          />
        </div>

        {/* My Tasks Filter */}
        <button
          type="button"
          onClick={onMyTasksToggle}
          className={cn(
            'flex items-center gap-1.5 rounded-md border px-3 py-2 text-[13px] transition-colors',
            myTasksOnly
              ? 'border-linear-accent bg-linear-accent text-white'
              : 'border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-secondary hover:bg-linear-bg-hover hover:text-linear-text-primary'
          )}
        >
          <User className="h-3.5 w-3.5" />
          Sarcinile mele
        </button>

        {/* Filters Button */}
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2 text-[13px] text-linear-text-secondary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
        >
          <Filter className="h-3.5 w-3.5" />
          Filtre
        </button>

        {/* Case Filter */}
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2 text-[13px] text-linear-text-secondary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
        >
          <GitBranch className="h-3.5 w-3.5" />
          Caz
        </button>

        {/* Due Date Filter */}
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2 text-[13px] text-linear-text-secondary transition-colors hover:bg-linear-bg-hover hover:text-linear-text-primary"
        >
          <Calendar className="h-3.5 w-3.5" />
          Scadenta
        </button>

        {/* Additional Filters */}
        {additionalFilters}
      </div>
    </header>
  );
}
