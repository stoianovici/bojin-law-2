'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, ScrollArea } from '@/components/ui';
import { useCommandPalette } from '@/hooks/useCommandPalette';
import { cn } from '@/lib/utils';

export function CommandPalette() {
  const { isOpen, close, search, setSearch, commands, executeCommand } = useCommandPalette();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, commands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (commands[selectedIndex]) {
          executeCommand(commands[selectedIndex].id);
        }
        break;
      case 'Escape':
        close();
        break;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="overflow-hidden p-0 sm:max-w-lg"
        onKeyDown={handleKeyDown}
        showCloseButton={false}
      >
        {/* Search input */}
        <div className="flex items-center border-b border-linear-border-subtle px-3">
          <Search className="h-4 w-4 text-linear-text-muted" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Caută comenzi..."
            className="flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-linear-text-muted"
          />
        </div>

        {/* Results */}
        <ScrollArea className="max-h-80">
          <div className="p-2">
            {commands.length === 0 ? (
              <p className="py-6 text-center text-sm text-linear-text-muted">Niciun rezultat</p>
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
                    <kbd className="text-xs text-linear-text-muted">{command.shortcut}</kbd>
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
