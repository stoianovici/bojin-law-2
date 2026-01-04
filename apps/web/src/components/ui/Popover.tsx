'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverClose = PopoverPrimitive.Close;

const PopoverArrow = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Arrow>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Arrow>
>(({ className, ...props }, ref) => (
  <PopoverPrimitive.Arrow
    ref={ref}
    className={cn('fill-linear-bg-elevated', className)}
    {...props}
  />
));
PopoverArrow.displayName = PopoverPrimitive.Arrow.displayName;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', side = 'bottom', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      side={side}
      sideOffset={sideOffset}
      className={cn(
        'z-linear-popover w-72 rounded-lg p-4',
        'border border-linear-border-subtle bg-linear-bg-elevated shadow-lg',
        'outline-none',
        'data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut',
        'data-[side=top]:animate-slideDown',
        'data-[side=bottom]:animate-slideUp',
        'data-[side=left]:animate-slideRight',
        'data-[side=right]:animate-slideLeft',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export type PopoverProps = React.ComponentPropsWithoutRef<typeof Popover>;
export type PopoverContentProps = React.ComponentPropsWithoutRef<typeof PopoverContent>;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverClose, PopoverArrow };
