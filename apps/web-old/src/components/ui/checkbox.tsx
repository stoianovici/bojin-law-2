'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ====================================================================
// Checkbox Variants
// ====================================================================

const checkboxVariants = cva(
  [
    'peer shrink-0 rounded',
    'bg-linear-bg-tertiary border border-linear-border-default',
    'transition-colors duration-100',
    'hover:bg-linear-bg-hover hover:border-linear-border-default',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent focus-visible:ring-offset-1 focus-visible:ring-offset-linear-bg-primary',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      /** Size variant - task (18px) for main tasks, subtask (16px) for nested items */
      size: {
        task: 'h-[18px] w-[18px] rounded',
        subtask: 'h-4 w-4 rounded-[3px]',
        sm: 'h-3.5 w-3.5 rounded-[2px]',
      },
      /** Color variant when checked */
      variant: {
        accent:
          'data-[state=checked]:bg-linear-accent data-[state=checked]:border-linear-accent data-[state=checked]:text-white data-[state=indeterminate]:bg-linear-accent data-[state=indeterminate]:border-linear-accent data-[state=indeterminate]:text-white',
        success:
          'data-[state=checked]:bg-linear-status-done data-[state=checked]:border-linear-status-done data-[state=checked]:text-white data-[state=indeterminate]:bg-linear-status-done data-[state=indeterminate]:border-linear-status-done data-[state=indeterminate]:text-white',
      },
    },
    defaultVariants: {
      size: 'task',
      variant: 'accent',
    },
  }
);

const checkIconVariants = cva('', {
  variants: {
    size: {
      task: 'h-3 w-3',
      subtask: 'h-2.5 w-2.5',
      sm: 'h-2 w-2',
    },
  },
  defaultVariants: {
    size: 'task',
  },
});

// ====================================================================
// Checkbox Component
// ====================================================================

export interface CheckboxProps
  extends Omit<React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>, 'size'>,
    VariantProps<typeof checkboxVariants> {}

/**
 * Checkbox component with Linear styling
 *
 * Size variants:
 * - task (18px): For main task items
 * - subtask (16px): For nested subtasks
 * - sm (14px): For compact lists
 *
 * Color variants:
 * - accent: Blue/purple accent color when checked
 * - success: Green color for completed tasks
 *
 * @example
 * // Main task checkbox
 * <Checkbox size="task" variant="success" />
 *
 * // Subtask checkbox
 * <Checkbox size="subtask" variant="accent" />
 */
const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  ({ className, size, variant, ...props }, ref) => (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(checkboxVariants({ size, variant }), className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className={checkIconVariants({ size })} strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
);
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox, checkboxVariants };
