'use client';

import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import { ContextPanel } from './ContextPanel';

interface AppShellProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  hideContextPanel?: boolean;
}

export function AppShell({ children, sidebar, header, hideContextPanel }: AppShellProps) {
  const { sidebarOpen, sidebarCollapsed, contextPanelVisible } = useUIStore();

  // Show context panel when sidebar is collapsed and panel is visible, unless explicitly hidden
  const showContextPanel = sidebarCollapsed && contextPanelVisible && !hideContextPanel;

  return (
    <div className="flex h-screen bg-linear-bg-primary">
      {/* Sidebar */}
      {sidebar && (
        <aside
          className={cn(
            'flex-shrink-0 border-r border-linear-border-subtle bg-linear-bg-secondary transition-all duration-200',
            sidebarCollapsed ? 'w-16' : 'w-60',
            !sidebarOpen && 'hidden md:flex'
          )}
        >
          {sidebar}
        </aside>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Header */}
        {header && (
          <header className="flex-shrink-0 border-b border-linear-border-subtle bg-linear-bg-primary">
            {header}
          </header>
        )}

        {/* Page content */}
        <main className="flex flex-1 min-h-0 min-w-0 overflow-auto">{children}</main>
      </div>

      {/* Context Panel - always rendered, width animated */}
      <aside
        className={cn(
          'flex-shrink-0 border-l border-linear-border-subtle bg-linear-bg-secondary overflow-hidden',
          'transition-[width,opacity] duration-300 ease-spring',
          showContextPanel ? 'w-80 xl:w-96 opacity-100' : 'w-0 opacity-100 border-l-0'
        )}
      >
        <div className="w-80 xl:w-96 h-full">
          <ContextPanel />
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => useUIStore.getState().setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
