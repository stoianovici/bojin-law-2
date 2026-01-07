'use client';

import { CheckSquare, Calendar } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';

interface SlotContextMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: { x: number; y: number };
  onSelectTask: () => void;
  onSelectEvent: () => void;
}

export function SlotContextMenu({
  open,
  onOpenChange,
  position,
  onSelectTask,
  onSelectEvent,
}: SlotContextMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <div
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            width: 1,
            height: 1,
          }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={0}>
        <DropdownMenuItem onClick={onSelectTask}>
          <CheckSquare className="mr-2 h-4 w-4" />
          New Task
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSelectEvent}>
          <Calendar className="mr-2 h-4 w-4" />
          New Event
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
