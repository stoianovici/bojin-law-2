'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Popover, PopoverContent, PopoverAnchor, PopoverClose } from '@/components/ui/Popover';

interface CreateFormPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: { x: number; y: number };
  children: React.ReactNode;
  title: string;
}

export function CreateFormPopover({
  open,
  onOpenChange,
  position,
  children,
  title,
}: CreateFormPopoverProps) {
  // Calculate safe position that keeps popover within viewport
  const safePosition = React.useMemo(() => {
    // Handle SSR - return original position if window not available
    if (typeof window === 'undefined') {
      return { ...position, maxHeight: undefined };
    }

    const popoverWidth = 400;
    const padding = 16;
    const maxPopoverHeight = window.innerHeight - padding * 2;

    // Ensure x position keeps popover within horizontal bounds
    let safeX = position.x;
    if (safeX + popoverWidth > window.innerWidth - padding) {
      safeX = window.innerWidth - popoverWidth - padding;
    }
    if (safeX < padding) {
      safeX = padding;
    }

    // Position Y at top padding - popover will fill available space with scroll
    const safeY = padding;

    return { x: safeX, y: safeY, maxHeight: maxPopoverHeight };
  }, [position.x, position.y, position]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div
          style={{
            position: 'fixed',
            left: safePosition.x,
            top: safePosition.y,
            width: 1,
            height: 1,
            pointerEvents: 'none',
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        className="w-[400px] overflow-y-auto p-0"
        style={{ maxHeight: safePosition.maxHeight || 'calc(100vh - 32px)' }}
        align="start"
        side="bottom"
        sideOffset={0}
        collisionPadding={16}
        avoidCollisions={true}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-linear-border-subtle">
          <h3 className="text-sm font-medium text-linear-text-primary">{title}</h3>
          <PopoverClose asChild>
            <button className="p-1 rounded hover:bg-linear-bg-tertiary text-linear-text-secondary">
              <X className="h-4 w-4" />
            </button>
          </PopoverClose>
        </div>
        {/* Content */}
        <div className="p-4">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
