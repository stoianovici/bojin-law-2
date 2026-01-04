# Story 30: Layout System

**Parallelizable with**: NONE - run after Phase 2 (story-20)
**Depends on**: UI Components (Phase 1), Auth (Phase 2)
**Blocks**: Phase 4 (Pages)

---

## Parallel Group A: Layout Foundation

> These 2 tasks run simultaneously (different files)

### Task A1: Create UI Store

**File**: `src/store/uiStore.ts` (CREATE)

**Do**:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;

  // Command palette
  commandPaletteOpen: boolean;

  // View preferences
  activeView: string | null;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  collapseSidebar: (collapsed: boolean) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  setActiveView: (view: string | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      activeView: null,

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      collapseSidebar: (sidebarCollapsed) => set({ sidebarCollapsed }),
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      setActiveView: (activeView) => set({ activeView }),
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
```

**Done when**: Store works, sidebar state persists to localStorage

---

### Task A2: Create Command Palette Hook

**File**: `src/hooks/useCommandPalette.ts` (CREATE)

**Do**:

```typescript
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';

interface Command {
  id: string;
  title: string;
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category: 'navigation' | 'action' | 'recent';
}

const navigationCommands: Command[] = [
  { id: 'nav-home', title: 'Acasă', shortcut: 'G H', category: 'navigation', action: () => {} },
  { id: 'nav-cases', title: 'Cazuri', shortcut: 'G C', category: 'navigation', action: () => {} },
  {
    id: 'nav-documents',
    title: 'Documente',
    shortcut: 'G D',
    category: 'navigation',
    action: () => {},
  },
  { id: 'nav-tasks', title: 'Sarcini', shortcut: 'G T', category: 'navigation', action: () => {} },
  { id: 'nav-email', title: 'Email', shortcut: 'G E', category: 'navigation', action: () => {} },
  { id: 'nav-time', title: 'Pontaj', shortcut: 'G P', category: 'navigation', action: () => {} },
];

export function useCommandPalette() {
  const router = useRouter();
  const { commandPaletteOpen, openCommandPalette, closeCommandPalette } = useUIStore();
  const [search, setSearch] = useState('');
  const [recentCommands, setRecentCommands] = useState<string[]>([]);

  // Initialize navigation commands with router
  const commands = useMemo(() => {
    return navigationCommands.map((cmd) => ({
      ...cmd,
      action: () => {
        const routes: Record<string, string> = {
          'nav-home': '/',
          'nav-cases': '/cases',
          'nav-documents': '/documents',
          'nav-tasks': '/tasks',
          'nav-email': '/email',
          'nav-time': '/time',
        };
        router.push(routes[cmd.id] || '/');
        closeCommandPalette();
      },
    }));
  }, [router, closeCommandPalette]);

  // Filter commands by search
  const filteredCommands = useMemo(() => {
    if (!search) return commands;
    const lower = search.toLowerCase();
    return commands.filter((cmd) => cmd.title.toLowerCase().includes(lower));
  }, [commands, search]);

  // Execute command
  const executeCommand = useCallback(
    (id: string) => {
      const command = commands.find((c) => c.id === id);
      if (command) {
        command.action();
        // Track recent
        setRecentCommands((prev) => [id, ...prev.filter((i) => i !== id)].slice(0, 5));
      }
    },
    [commands]
  );

  // Keyboard shortcut to open (⌘K or Ctrl+K)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openCommandPalette();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openCommandPalette]);

  return {
    isOpen: commandPaletteOpen,
    open: openCommandPalette,
    close: closeCommandPalette,
    search,
    setSearch,
    commands: filteredCommands,
    recentCommands,
    executeCommand,
  };
}
```

**Done when**: Hook manages commands, search filtering, ⌘K shortcut works

---

## Parallel Group B: Layout Components

> These 4 tasks run simultaneously (different files)

### Task B1: Create AppShell Component

**File**: `src/components/layout/AppShell.tsx` (CREATE)

**Do**:

```typescript
'use client'

import { useUIStore } from '@/store/uiStore'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: React.ReactNode
  sidebar?: React.ReactNode
  header?: React.ReactNode
}

export function AppShell({ children, sidebar, header }: AppShellProps) {
  const { sidebarOpen, sidebarCollapsed } = useUIStore()

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
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        {header && (
          <header className="flex-shrink-0 border-b border-linear-border-subtle bg-linear-bg-primary">
            {header}
          </header>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => useUIStore.getState().setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
```

**Done when**: Layout renders, sidebar collapses, mobile responsive

---

### Task B2: Create Sidebar Component

**File**: `src/components/layout/Sidebar.tsx` (CREATE)

**Do**:

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Briefcase, FileText, CheckSquare, Mail, Clock,
  ChevronLeft, ChevronRight, Settings, LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/uiStore'
import { useAuth } from '@/hooks/useAuth'
import { Avatar, Tooltip, TooltipContent, TooltipTrigger, Separator } from '@/components/ui'

const navItems = [
  { href: '/', label: 'Acasă', icon: Home },
  { href: '/cases', label: 'Cazuri', icon: Briefcase },
  { href: '/documents', label: 'Documente', icon: FileText },
  { href: '/tasks', label: 'Sarcini', icon: CheckSquare },
  { href: '/email', label: 'Email', icon: Mail },
  { href: '/time', label: 'Pontaj', icon: Clock },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, collapseSidebar } = useUIStore()
  const { user, logout } = useAuth()

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center px-4">
        {!sidebarCollapsed && (
          <span className="font-semibold text-linear-text-primary">Legal Platform</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-linear-accent/10 text-linear-accent'
                  : 'text-linear-text-secondary hover:bg-linear-bg-tertiary hover:text-linear-text-primary'
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          )

          if (sidebarCollapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            )
          }

          return link
        })}
      </nav>

      <Separator />

      {/* Collapse toggle */}
      <button
        onClick={() => collapseSidebar(!sidebarCollapsed)}
        className="flex items-center gap-3 px-4 py-3 text-sm text-linear-text-muted hover:text-linear-text-primary"
      >
        {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        {!sidebarCollapsed && <span>Restrânge</span>}
      </button>

      {/* User menu */}
      {user && (
        <div className="border-t border-linear-border-subtle p-2">
          <div className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2',
            sidebarCollapsed && 'justify-center'
          )}>
            <Avatar name={user.name} size="sm" />
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-linear-text-primary truncate">{user.name}</p>
                <p className="text-xs text-linear-text-muted truncate">{user.email}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Done when**: Nav items render, active state works, collapse animates, user menu shows

---

### Task B3: Create Header Component

**File**: `src/components/layout/Header.tsx` (CREATE)

**Do**:

```typescript
'use client'

import { Search, Plus, Bell } from 'lucide-react'
import { Button, Input, Avatar, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui'
import { useUIStore } from '@/store/uiStore'
import { useAuth } from '@/hooks/useAuth'
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs' // Create simple breadcrumb hook

export function Header() {
  const { openCommandPalette } = useUIStore()
  const { user, logout } = useAuth()

  return (
    <div className="flex h-14 items-center justify-between px-4">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-2">
        {/* Breadcrumbs component - can be simple initially */}
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-md mx-4">
        <button
          onClick={openCommandPalette}
          className="flex w-full items-center gap-2 rounded-md border border-linear-border-subtle bg-linear-bg-elevated px-3 py-1.5 text-sm text-linear-text-muted hover:border-linear-border-default"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Căutare...</span>
          <kbd className="hidden rounded bg-linear-bg-tertiary px-1.5 py-0.5 text-xs text-linear-text-muted sm:inline">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Quick create */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Caz nou</DropdownMenuItem>
            <DropdownMenuItem>Sarcină nouă</DropdownMenuItem>
            <DropdownMenuItem>Document nou</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {/* Badge for unread count */}
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full">
              <Avatar name={user?.name || ''} size="sm" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-linear-text-muted">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Setări</DropdownMenuItem>
            <DropdownMenuItem onClick={logout} className="text-linear-error">
              Deconectare
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
```

**Done when**: Search triggers command palette, quick create menu works, user menu works

---

### Task B4: Create CommandPalette Component

**File**: `src/components/layout/CommandPalette.tsx` (CREATE)

**Do**:

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Dialog, DialogContent, Input, ScrollArea } from '@/components/ui'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import { cn } from '@/lib/utils'

export function CommandPalette() {
  const {
    isOpen,
    close,
    search,
    setSearch,
    commands,
    executeCommand,
  } = useCommandPalette()

  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, commands.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (commands[selectedIndex]) {
          executeCommand(commands[selectedIndex].id)
        }
        break
      case 'Escape':
        close()
        break
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && close()}>
      <DialogContent
        className="overflow-hidden p-0 sm:max-w-lg"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center border-b border-linear-border-subtle px-3">
          <Search className="h-4 w-4 text-linear-text-muted" />
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Caută comenzi..."
            className="flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-linear-text-muted"
          />
        </div>

        {/* Results */}
        <ScrollArea className="max-h-80">
          <div className="p-2">
            {commands.length === 0 ? (
              <p className="py-6 text-center text-sm text-linear-text-muted">
                Niciun rezultat
              </p>
            ) : (
              commands.map((command, index) => (
                <button
                  key={command.id}
                  onClick={() => executeCommand(command.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm',
                    index === selectedIndex
                      ? 'bg-linear-bg-tertiary text-linear-text-primary'
                      : 'text-linear-text-secondary hover:bg-linear-bg-tertiary'
                  )}
                >
                  {command.icon}
                  <span className="flex-1 text-left">{command.title}</span>
                  {command.shortcut && (
                    <kbd className="text-xs text-linear-text-muted">
                      {command.shortcut}
                    </kbd>
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
```

**Done when**: Opens with ⌘K, search filters, keyboard navigation, executes commands

---

## Sequential: After Group B

### Task C: Create Layout Index

**File**: `src/components/layout/index.ts` (CREATE)

**Do**:

```typescript
export * from './AppShell';
export * from './Sidebar';
export * from './Header';
export * from './CommandPalette';
```

**Done when**: All exports work

---

## Done when (entire story)

- UI store persists sidebar state
- Command palette hook manages commands and shortcuts
- AppShell renders sidebar + header + content
- Sidebar has navigation, collapse, user area
- Header has search, quick create, notifications, user menu
- Command palette opens with ⌘K, searches, navigates
- All components use Romanian labels
- Build passes
