'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-4 w-4 shrink-0 rounded-[3px]',
      'bg-linear-bg-tertiary border border-linear-border-default',
      'transition-colors duration-100',
      'hover:bg-linear-bg-hover hover:border-linear-border-default',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent focus-visible:ring-offset-1 focus-visible:ring-offset-linear-bg-primary',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-linear-accent data-[state=checked]:border-linear-accent data-[state=checked]:text-white',
      'data-[state=indeterminate]:bg-linear-accent data-[state=indeterminate]:border-linear-accent data-[state=indeterminate]:text-white',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-current')}>
      <Check className="h-3 w-3" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
