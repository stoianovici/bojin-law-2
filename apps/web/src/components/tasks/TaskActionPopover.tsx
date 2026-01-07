'use client';

import * as React from 'react';
import { useState } from 'react';
import { StickyNote, Clock, CheckCircle2, X, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';

interface TaskActionPopoverProps {
  taskId: string;
  taskTitle: string;
  children: React.ReactNode;
  onAddNote?: (taskId: string, note: string) => void;
  onLogTime?: (taskId: string, duration: string, description: string) => void;
  onComplete?: (taskId: string, note?: string) => void;
  /** When true, popover opens on right-click instead of left-click (for drag-enabled contexts) */
  contextMenuMode?: boolean;
}

type ActionView = 'menu' | 'note' | 'time' | 'complete';

export function TaskActionPopover({
  taskId,
  taskTitle,
  children,
  onAddNote,
  onLogTime,
  onComplete,
  contextMenuMode = false,
}: TaskActionPopoverProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ActionView>('menu');
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);

  // Form states
  const [note, setNote] = useState('');
  const [duration, setDuration] = useState('');
  const [timeDescription, setTimeDescription] = useState('');
  const [completeNote, setCompleteNote] = useState('');

  const resetAndClose = () => {
    setView('menu');
    setNote('');
    setDuration('');
    setTimeDescription('');
    setCompleteNote('');
    setOpen(false);
  };

  const handleAddNote = () => {
    if (note.trim()) {
      onAddNote?.(taskId, note.trim());
      resetAndClose();
    }
  };

  const handleLogTime = () => {
    if (duration.trim()) {
      onLogTime?.(taskId, duration.trim(), timeDescription.trim());
      resetAndClose();
    }
  };

  const handleComplete = () => {
    onComplete?.(taskId, completeNote.trim() || undefined);
    resetAndClose();
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      // Reset view when closing
      setTimeout(() => setView('menu'), 200);
    }
  };

  // Handle right-click for context menu mode
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPopoverPosition({ x: e.clientX, y: e.clientY });
    setOpen(true);
  };

  // In context menu mode, we clone the child element to add context menu handler
  // This allows drag to work on left-click while popover opens on right-click
  // Using cloneElement avoids wrapper divs that interfere with framer-motion drag
  if (contextMenuMode) {
    const childWithContextMenu = React.isValidElement(children)
      ? React.cloneElement(children as React.ReactElement<{ onContextMenu?: (e: React.MouseEvent) => void }>, {
          onContextMenu: handleContextMenu,
        })
      : children;

    return (
      <>
        {childWithContextMenu}
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <span style={{ display: 'none' }} />
          </PopoverTrigger>
          <PopoverContent
          align="start"
          side="right"
          className="w-72 p-0 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          style={popoverPosition ? {
            position: 'fixed',
            left: popoverPosition.x,
            top: popoverPosition.y,
          } : undefined}
        >
          {view === 'menu' && (
            <div className="p-1">
              <div className="px-3 py-2 text-xs text-linear-text-tertiary truncate border-b border-linear-border-subtle mb-1">
                {taskTitle}
              </div>
              <button
                onClick={() => setView('note')}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-linear-text-primary hover:bg-linear-bg-hover rounded-md transition-colors"
              >
                <StickyNote className="h-4 w-4 text-amber-400" />
                Adauga nota
              </button>
              <button
                onClick={() => setView('time')}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-linear-text-primary hover:bg-linear-bg-hover rounded-md transition-colors"
              >
                <Clock className="h-4 w-4 text-blue-400" />
                Pontare timp
              </button>
              <button
                onClick={() => setView('complete')}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-linear-text-primary hover:bg-linear-bg-hover rounded-md transition-colors"
              >
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                Finalizeaza
              </button>
            </div>
          )}

          {view === 'note' && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-normal text-linear-text-primary">Adauga nota</span>
                </div>
                <button
                  onClick={() => setView('menu')}
                  className="p-1 text-linear-text-tertiary hover:text-linear-text-secondary rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Scrie o nota..."
                className="w-full h-24 px-3 py-2 text-sm bg-linear-bg-primary border border-linear-border-subtle rounded-lg resize-none focus:outline-none focus:border-linear-accent text-linear-text-primary placeholder:text-linear-text-muted"
                autoFocus
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={handleAddNote}
                  disabled={!note.trim()}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 text-sm font-light rounded-lg transition-colors',
                    note.trim()
                      ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                      : 'bg-linear-bg-tertiary text-linear-text-muted cursor-not-allowed'
                  )}
                >
                  <Send className="h-3.5 w-3.5" />
                  Salveaza
                </button>
              </div>
            </div>
          )}

          {view === 'time' && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-normal text-linear-text-primary">Pontare timp</span>
                </div>
                <button
                  onClick={() => setView('menu')}
                  className="p-1 text-linear-text-tertiary hover:text-linear-text-secondary rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-linear-text-tertiary mb-1">Durata</label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="ex: 1h 30m"
                    className="w-full px-3 py-2 text-sm bg-linear-bg-primary border border-linear-border-subtle rounded-lg focus:outline-none focus:border-linear-accent text-linear-text-primary placeholder:text-linear-text-muted"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs text-linear-text-tertiary mb-1">
                    Descriere (optional)
                  </label>
                  <textarea
                    value={timeDescription}
                    onChange={(e) => setTimeDescription(e.target.value)}
                    placeholder="Ce ai lucrat..."
                    className="w-full h-16 px-3 py-2 text-sm bg-linear-bg-primary border border-linear-border-subtle rounded-lg resize-none focus:outline-none focus:border-linear-accent text-linear-text-primary placeholder:text-linear-text-muted"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <button
                  onClick={handleLogTime}
                  disabled={!duration.trim()}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 text-sm font-light rounded-lg transition-colors',
                    duration.trim()
                      ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                      : 'bg-linear-bg-tertiary text-linear-text-muted cursor-not-allowed'
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Inregistreaza
                </button>
              </div>
            </div>
          )}

          {view === 'complete' && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-sm font-normal text-linear-text-primary">
                    Finalizeaza sarcina
                  </span>
                </div>
                <button
                  onClick={() => setView('menu')}
                  className="p-1 text-linear-text-tertiary hover:text-linear-text-secondary rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={completeNote}
                onChange={(e) => setCompleteNote(e.target.value)}
                placeholder="Nota finala (optional)..."
                className="w-full h-20 px-3 py-2 text-sm bg-linear-bg-primary border border-linear-border-subtle rounded-lg resize-none focus:outline-none focus:border-linear-accent text-linear-text-primary placeholder:text-linear-text-muted"
                autoFocus
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={handleComplete}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-light bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Finalizeaza
                </button>
              </div>
            </div>
          )}
        </PopoverContent>
        </Popover>
      </>
    );
  }

  // Default mode: popover opens on click
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {view === 'menu' && (
          <div className="p-1">
            <div className="px-3 py-2 text-xs text-linear-text-tertiary truncate border-b border-linear-border-subtle mb-1">
              {taskTitle}
            </div>
            <button
              onClick={() => setView('note')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-linear-text-primary hover:bg-linear-bg-hover rounded-md transition-colors"
            >
              <StickyNote className="h-4 w-4 text-amber-400" />
              Adauga nota
            </button>
            <button
              onClick={() => setView('time')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-linear-text-primary hover:bg-linear-bg-hover rounded-md transition-colors"
            >
              <Clock className="h-4 w-4 text-blue-400" />
              Pontare timp
            </button>
            <button
              onClick={() => setView('complete')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-linear-text-primary hover:bg-linear-bg-hover rounded-md transition-colors"
            >
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              Finalizeaza
            </button>
          </div>
        )}

        {view === 'note' && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-normal text-linear-text-primary">Adauga nota</span>
              </div>
              <button
                onClick={() => setView('menu')}
                className="p-1 text-linear-text-tertiary hover:text-linear-text-secondary rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Scrie o nota..."
              className="w-full h-24 px-3 py-2 text-sm bg-linear-bg-primary border border-linear-border-subtle rounded-lg resize-none focus:outline-none focus:border-linear-accent text-linear-text-primary placeholder:text-linear-text-muted"
              autoFocus
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleAddNote}
                disabled={!note.trim()}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-sm font-light rounded-lg transition-colors',
                  note.trim()
                    ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                    : 'bg-linear-bg-tertiary text-linear-text-muted cursor-not-allowed'
                )}
              >
                <Send className="h-3.5 w-3.5" />
                Salveaza
              </button>
            </div>
          </div>
        )}

        {view === 'time' && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-normal text-linear-text-primary">Pontare timp</span>
              </div>
              <button
                onClick={() => setView('menu')}
                className="p-1 text-linear-text-tertiary hover:text-linear-text-secondary rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-linear-text-tertiary mb-1">Durata</label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="ex: 1h 30m"
                  className="w-full px-3 py-2 text-sm bg-linear-bg-primary border border-linear-border-subtle rounded-lg focus:outline-none focus:border-linear-accent text-linear-text-primary placeholder:text-linear-text-muted"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-linear-text-tertiary mb-1">
                  Descriere (optional)
                </label>
                <textarea
                  value={timeDescription}
                  onChange={(e) => setTimeDescription(e.target.value)}
                  placeholder="Ce ai lucrat..."
                  className="w-full h-16 px-3 py-2 text-sm bg-linear-bg-primary border border-linear-border-subtle rounded-lg resize-none focus:outline-none focus:border-linear-accent text-linear-text-primary placeholder:text-linear-text-muted"
                />
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button
                onClick={handleLogTime}
                disabled={!duration.trim()}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-sm font-light rounded-lg transition-colors',
                  duration.trim()
                    ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                    : 'bg-linear-bg-tertiary text-linear-text-muted cursor-not-allowed'
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                Inregistreaza
              </button>
            </div>
          </div>
        )}

        {view === 'complete' && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="text-sm font-normal text-linear-text-primary">
                  Finalizeaza sarcina
                </span>
              </div>
              <button
                onClick={() => setView('menu')}
                className="p-1 text-linear-text-tertiary hover:text-linear-text-secondary rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={completeNote}
              onChange={(e) => setCompleteNote(e.target.value)}
              placeholder="Nota finala (optional)..."
              className="w-full h-20 px-3 py-2 text-sm bg-linear-bg-primary border border-linear-border-subtle rounded-lg resize-none focus:outline-none focus:border-linear-accent text-linear-text-primary placeholder:text-linear-text-muted"
              autoFocus
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleComplete}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-light bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Finalizeaza
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default TaskActionPopover;
