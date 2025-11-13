/**
 * Tooltip Component
 *
 * An accessible tooltip component built with Radix UI Tooltip primitive.
 * Supports multiple positions and WCAG AA compliance.
 * Supports Romanian diacritics (ă, â, î, ș, ț).
 *
 * @example
 * ```tsx
 * <Tooltip content="Salvați modificările" position="top">
 *   <Button>Salvează</Button>
 * </Tooltip>
 *
 * <Tooltip content="Acest câmp este obligatoriu" position="right">
 *   <span>Nume *</span>
 * </Tooltip>
 * ```
 */

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { clsx } from 'clsx';
import { TooltipProps } from '@legal-platform/types';

/**
 * Tooltip component with multiple position options
 *
 * @param content - Tooltip content to display
 * @param children - Element that triggers the tooltip
 * @param position - Position of the tooltip (top, bottom, left, right)
 * @param className - Additional CSS classes
 */
export const Tooltip = ({
  content,
  children,
  position = 'top',
  className,
}: TooltipProps) => {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          {children}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={position}
            sideOffset={5}
            className={clsx(
              'z-tooltip max-w-xs rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white shadow-lg animate-in fade-in zoom-in-95 duration-100',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95',
              className
            )}
            aria-live="polite"
          >
            {content}
            <TooltipPrimitive.Arrow
              className="fill-neutral-900"
              width={11}
              height={5}
            />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
};

Tooltip.displayName = 'Tooltip';
