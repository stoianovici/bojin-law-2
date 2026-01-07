'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  indeterminate?: boolean;
}

const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  ({ className, indeterminate, ...props }, ref) => (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'peer h-4 w-4 shrink-0 rounded border transition-colors',
        'border-[rgba(0,0,0,0.12)] dark:border-linear-border-default',
        'bg-white dark:bg-linear-bg-tertiary',
        'hover:border-[rgba(0,0,0,0.2)] dark:hover:border-linear-text-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent focus-visible:ring-offset-2 focus-visible:ring-offset-linear-bg-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-linear-accent data-[state=checked]:border-linear-accent data-[state=checked]:text-white',
        'data-[state=indeterminate]:bg-linear-accent data-[state=indeterminate]:border-linear-accent data-[state=indeterminate]:text-white',
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-current')}>
        {indeterminate ? <Minus className="h-3 w-3" /> : <Check className="h-3 w-3" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
);
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
