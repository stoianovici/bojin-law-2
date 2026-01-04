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
