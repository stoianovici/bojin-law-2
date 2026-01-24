'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { StickyNote, Clock, CheckCircle2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';

interface TaskActionPopoverProps {
  taskId: string;
  taskTitle: string;
  children: React.ReactNode;
  onAddNote?: (taskId: string, note: string) => void;
  onLogTime?: (taskId: string, duration: string, description: string) => void;
  /** Called when task is completed. If timeJustLogged is true, skip the time check dialog */
  onComplete?: (taskId: string, options?: { timeJustLogged?: boolean }) => void;
  /** When true, popover opens on right-click instead of left-click (for drag-enabled contexts) */
  contextMenuMode?: boolean;
  /** When true, skips menu and shows only the complete (time input) view */
  completeOnly?: boolean;
  /** Estimated time to prefill the duration input (e.g. "2h", "1h 30m") */
  estimatedTime?: string;
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
  completeOnly = false,
  estimatedTime = '',
}: TaskActionPopoverProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ActionView>(completeOnly ? 'complete' : 'menu');
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);

  // Form states
  const [note, setNote] = useState('');
  const [duration, setDuration] = useState(estimatedTime);
  const [confirming, setConfirming] = useState(false);

  const noteRef = useRef<HTMLTextAreaElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);

  // Auto-focus inputs when view changes
  useEffect(() => {
    if (view === 'note' && noteRef.current) {
      noteRef.current.focus();
    } else if ((view === 'time' || view === 'complete') && timeRef.current) {
      timeRef.current.focus();
    }
  }, [view]);

  const resetAndClose = () => {
    setView(completeOnly ? 'complete' : 'menu');
    setNote('');
    setDuration(estimatedTime);
    setConfirming(false);
    setOpen(false);
  };

  // Save note on close if there's content
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && view === 'note' && note.trim()) {
      onAddNote?.(taskId, note.trim());
    }
    if (!isOpen) {
      setTimeout(() => {
        setView(completeOnly ? 'complete' : 'menu');
        setNote('');
        setDuration(estimatedTime);
      }, 150);
    }
    setOpen(isOpen);
  };

  const handleLogTime = () => {
    if (duration.trim()) {
      setConfirming(true);
      onLogTime?.(taskId, duration.trim(), '');
      setTimeout(() => {
        resetAndClose();
      }, 300);
    }
  };

  const handleComplete = () => {
    setConfirming(true);
    const hasTime = duration.trim().length > 0;
    if (hasTime) {
      onLogTime?.(taskId, duration.trim(), '');
    }
    onComplete?.(taskId, { timeJustLogged: hasTime });
    setTimeout(() => {
      resetAndClose();
    }, 300);
  };

  // Handle right-click for context menu mode
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPopoverPosition({ x: e.clientX, y: e.clientY });
    setOpen(true);
  };

  // Handle click to capture position for default mode
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPopoverPosition({ x: e.clientX, y: e.clientY });
    setOpen(true);
  };

  // Shared popover content - each view renders independently
  const renderContent = () => {
    if (view === 'time' || view === 'complete') {
      return (
        <div className="p-1 flex items-center gap-1">
          <input
            ref={timeRef}
            type="text"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="1h 30m"
            className="w-20 px-2 py-1.5 text-sm bg-linear-bg-primary border border-linear-border-subtle rounded-md focus:outline-none focus:border-linear-accent text-linear-text-primary placeholder:text-linear-text-muted"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                view === 'complete' ? handleComplete() : handleLogTime();
              }
            }}
          />
          <button
            onClick={view === 'complete' ? handleComplete : handleLogTime}
            disabled={view === 'time' && !duration.trim()}
            className={cn(
              'p-1 transition-colors',
              confirming
                ? 'text-green-400'
                : 'text-linear-text-tertiary hover:text-linear-text-secondary'
            )}
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      );
    }

    if (view === 'note') {
      return (
        <div>
          <div className="p-2 pb-1">
            <textarea
              ref={noteRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Scrie o nota..."
              className="w-52 h-24 px-2.5 py-2 text-sm bg-linear-bg-primary border border-linear-border-subtle rounded-lg resize-none focus:outline-none focus:border-linear-accent text-linear-text-primary placeholder:text-linear-text-muted"
            />
          </div>
          <div className="p-1 pt-0">
            <button
              onClick={() => setView('menu')}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm bg-amber-500/15 text-amber-400 rounded-md"
            >
              <StickyNote className="h-3.5 w-3.5" />
              Nota
            </button>
            <button
              onClick={() => setView('time')}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-linear-text-primary hover:bg-linear-bg-hover rounded-md"
            >
              <Clock className="h-3.5 w-3.5 text-blue-400" />
              Pontare
            </button>
            <button
              onClick={() => setView('complete')}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-linear-text-primary hover:bg-linear-bg-hover rounded-md"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
              Finalizare
            </button>
          </div>
        </div>
      );
    }

    // Menu view
    return (
      <div className="p-1">
        <button
          onClick={() => setView('note')}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-linear-text-primary hover:bg-linear-bg-hover rounded-md"
        >
          <StickyNote className="h-3.5 w-3.5 text-amber-400" />
          Nota
        </button>
        <button
          onClick={() => setView('time')}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-linear-text-primary hover:bg-linear-bg-hover rounded-md"
        >
          <Clock className="h-3.5 w-3.5 text-blue-400" />
          Pontare
        </button>
        <button
          onClick={() => setView('complete')}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-linear-text-primary hover:bg-linear-bg-hover rounded-md"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
          Finalizare
        </button>
      </div>
    );
  };

  // Context menu mode
  if (contextMenuMode) {
    const childWithContextMenu = React.isValidElement(children)
      ? React.cloneElement(
          children as React.ReactElement<{ onContextMenu?: (e: React.MouseEvent) => void }>,
          { onContextMenu: handleContextMenu }
        )
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
            className="!p-0 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'fit-content',
              minWidth: 0,
              ...(popoverPosition
                ? {
                    position: 'fixed',
                    left: popoverPosition.x,
                    top: popoverPosition.y,
                  }
                : {}),
            }}
          >
            {renderContent()}
          </PopoverContent>
        </Popover>
      </>
    );
  }

  // Clone child to add click handler
  const childWithClick = React.isValidElement(children)
    ? React.cloneElement(
        children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>,
        { onClick: handleClick }
      )
    : children;

  // Default mode: popover opens on click at mouse position
  return (
    <>
      {childWithClick}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <span style={{ display: 'none' }} />
        </PopoverTrigger>
        <PopoverContent
          align="center"
          className="!p-0 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'fit-content',
            minWidth: 0,
            ...(popoverPosition
              ? {
                  position: 'fixed',
                  left: popoverPosition.x,
                  top: popoverPosition.y,
                  transform: 'translate(-50%, -50%)',
                }
              : {}),
          }}
        >
          {renderContent()}
        </PopoverContent>
      </Popover>
    </>
  );
}

export default TaskActionPopover;
