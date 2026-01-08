'use client';

import * as React from 'react';
import { useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Search, Plus, Server, Globe, CheckSquare, Calendar, MessageSquare } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui';
import { useUIStore } from '@/store/uiStore';
import { useAuth } from '@/hooks/useAuth';
import { useGateway } from '@/hooks/useGateway';
import { CreateFormPopover } from '@/components/popovers/CreateFormPopover';
import { TaskForm } from '@/components/forms/TaskForm';
import { EventForm } from '@/components/forms/EventForm';
import { NotificationsDropdown } from '@/components/notifications/NotificationsDropdown';

// Captured at build time for client-side use
const isDev = process.env.NODE_ENV === 'development';

export function Header() {
  const {
    openCommandPalette,
    contextPanelVisible,
    setContextPanelVisible,
    sidebarCollapsed,
    collapseSidebar,
  } = useUIStore();
  const { user: _user } = useAuth();
  const { mode, setMode, isHydrated } = useGateway();
  const pathname = usePathname();
  const plusButtonRef = useRef<HTMLButtonElement>(null);

  // Form popover state
  const [formPopoverOpen, setFormPopoverOpen] = React.useState(false);
  const [formType, setFormType] = React.useState<'task' | 'event'>('task');
  const [popoverPosition, setPopoverPosition] = React.useState({ x: 0, y: 0 });

  // Determine context-aware behavior
  const isCalendarPage = pathname === '/calendar';
  const isTasksPage = pathname === '/tasks';

  // Calculate popover position below the plus button
  const updatePopoverPosition = React.useCallback(() => {
    if (plusButtonRef.current) {
      const rect = plusButtonRef.current.getBoundingClientRect();
      setPopoverPosition({
        x: rect.right - 400, // Align right edge with button
        y: rect.bottom + 8,
      });
    }
  }, []);

  // Handle plus button click
  const handlePlusClick = React.useCallback(() => {
    if (isCalendarPage) {
      // On calendar page, open event form directly
      setFormType('event');
      updatePopoverPosition();
      setFormPopoverOpen(true);
    } else if (isTasksPage) {
      // On tasks page, open task form directly
      setFormType('task');
      updatePopoverPosition();
      setFormPopoverOpen(true);
    }
    // For other routes, the dropdown menu handles it
  }, [isCalendarPage, isTasksPage, updatePopoverPosition]);

  // Handle dropdown menu selection
  const handleSelectTask = React.useCallback(() => {
    setFormType('task');
    updatePopoverPosition();
    setFormPopoverOpen(true);
  }, [updatePopoverPosition]);

  const handleSelectEvent = React.useCallback(() => {
    setFormType('event');
    updatePopoverPosition();
    setFormPopoverOpen(true);
  }, [updatePopoverPosition]);

  // Handle form completion
  const handleFormSuccess = React.useCallback(() => {
    setFormPopoverOpen(false);
  }, []);

  const handleFormCancel = React.useCallback(() => {
    setFormPopoverOpen(false);
  }, []);

  return (
    <div className="flex h-14 items-center justify-between px-4">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-2">
        {/* Breadcrumbs component - can be simple initially */}
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-md xl:max-w-xl 2xl:max-w-2xl mx-4">
        <button
          onClick={openCommandPalette}
          className="flex w-full items-center gap-2 rounded-md border border-linear-border-subtle bg-linear-bg-elevated px-3 py-2 text-linear-sm text-linear-text-muted hover:border-linear-border-default"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Căutare...</span>
          <kbd className="hidden rounded bg-linear-bg-tertiary px-1.5 py-0.5 text-linear-xs text-linear-text-muted sm:inline">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Quick create - context aware */}
        {isCalendarPage || isTasksPage ? (
          // Direct button on calendar/tasks pages
          <Button ref={plusButtonRef} variant="ghost" size="sm" onClick={handlePlusClick}>
            <Plus className="h-4 w-4" />
          </Button>
        ) : (
          // Dropdown menu on other pages
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button ref={plusButtonRef} variant="ghost" size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Caz nou</DropdownMenuItem>
              <DropdownMenuItem onSelect={handleSelectTask}>
                <CheckSquare className="h-4 w-4 mr-2" />
                Sarcină nouă
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleSelectEvent}>
                <Calendar className="h-4 w-4 mr-2" />
                Eveniment nou
              </DropdownMenuItem>
              <DropdownMenuItem>Document nou</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Activity Panel Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (!sidebarCollapsed) {
              collapseSidebar(true);
            }
            setContextPanelVisible(!contextPanelVisible || !sidebarCollapsed);
          }}
          title={contextPanelVisible && sidebarCollapsed ? 'Închide chat' : 'Deschide chat'}
          className={contextPanelVisible && sidebarCollapsed ? 'text-blue-500' : ''}
        >
          <MessageSquare className="h-4 w-4" />
        </Button>

        {/* Notifications */}
        <NotificationsDropdown />

        {/* Gateway Toggle - Dev Only (hidden in production) */}
        {isHydrated && isDev && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={mode === 'local' ? 'text-blue-500' : 'text-green-500'}
                title={mode === 'local' ? 'Local (port 4000)' : 'Production (Render)'}
              >
                {mode === 'local' ? <Server className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5">
                <p className="text-linear-xs font-medium text-linear-text-muted">Gateway Mode</p>
              </div>
              <DropdownMenuItem
                onClick={() => setMode('local')}
                className={mode === 'local' ? 'bg-linear-bg-elevated' : ''}
              >
                <Server className="h-4 w-4 mr-2 text-blue-500" />
                Local
                <span className="ml-auto text-linear-xs text-linear-text-muted">:4000</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setMode('production')}
                className={mode === 'production' ? 'bg-linear-bg-elevated' : ''}
              >
                <Globe className="h-4 w-4 mr-2 text-green-500" />
                Production
                <span className="ml-auto text-linear-xs text-linear-text-muted">Render</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Create Form Popover */}
      <CreateFormPopover
        open={formPopoverOpen}
        onOpenChange={setFormPopoverOpen}
        position={popoverPosition}
        title={formType === 'task' ? 'New Task' : 'New Event'}
      >
        {formType === 'task' ? (
          <TaskForm onSuccess={handleFormSuccess} onCancel={handleFormCancel} />
        ) : (
          <EventForm onSuccess={handleFormSuccess} onCancel={handleFormCancel} />
        )}
      </CreateFormPopover>
    </div>
  );
}
