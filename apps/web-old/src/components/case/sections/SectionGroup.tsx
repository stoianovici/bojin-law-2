/**
 * SectionGroup - Collapsible group container for case sections
 * OPS-225: Separates editable sections from read-only operational sections
 */

'use client';

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Pencil1Icon, EyeOpenIcon } from '@radix-ui/react-icons';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible';

// ============================================================================
// Types
// ============================================================================

export type SectionGroupVariant = 'editable' | 'readonly';

export interface SectionGroupProps {
  /**
   * Title displayed in the group header (Romanian)
   */
  title: string;
  /**
   * Variant determines icon and styling
   * - 'editable': Pencil icon, white background
   * - 'readonly': Eye icon, gray background
   */
  variant: SectionGroupVariant;
  /**
   * Whether the group is expanded by default
   * @default true
   */
  defaultOpen?: boolean;
  /**
   * Optional localStorage key to persist collapsed state
   */
  storageKey?: string;
  /**
   * Optional badge count to show in header
   */
  count?: number;
  /**
   * Content sections to render inside the group
   */
  children: React.ReactNode;
  /**
   * Additional CSS classes for the container
   */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * SectionGroup Component
 *
 * Collapsible container that groups related sections with a descriptive header.
 * Uses Radix Collapsible with smooth height animation.
 *
 * @example
 * <SectionGroup title="Informații Dosar" variant="editable">
 *   <CaseDetailsSection ... />
 *   <ContactsSection ... />
 * </SectionGroup>
 */
export function SectionGroup({
  title,
  variant,
  defaultOpen = true,
  storageKey,
  count,
  children,
  className,
}: SectionGroupProps) {
  // Initialize state from localStorage if storageKey provided
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined' || !storageKey) return defaultOpen;
    const stored = localStorage.getItem(`section-group-${storageKey}`);
    return stored !== null ? stored === 'true' : defaultOpen;
  });

  // Persist state to localStorage when it changes
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(`section-group-${storageKey}`, String(isOpen));
    }
  }, [isOpen, storageKey]);

  // Styling based on variant
  const isEditable = variant === 'editable';
  const Icon = isEditable ? Pencil1Icon : EyeOpenIcon;
  const iconColor = isEditable ? 'text-linear-accent' : 'text-linear-text-tertiary';
  const bgColor = isEditable ? 'bg-linear-bg-secondary' : 'bg-linear-bg-tertiary';
  const borderColor = isEditable ? 'border-linear-accent/30' : 'border-linear-border-subtle';
  const headerBg = isEditable ? 'hover:bg-linear-accent/5' : 'hover:bg-linear-bg-quaternary';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div
        className={clsx(
          'rounded-xl border shadow-sm',
          bgColor,
          borderColor,
          'transition-colors duration-200'
        )}
      >
        {/* Header */}
        <CollapsibleTrigger
          className={clsx(
            'flex w-full items-center justify-between px-5 py-4',
            'rounded-t-xl transition-colors duration-150',
            headerBg
          )}
        >
          <div className="flex items-center gap-3">
            <Icon className={clsx('h-5 w-5', iconColor)} />
            <span className="text-base font-semibold text-linear-text-primary">{title}</span>
            {count !== undefined && count > 0 && (
              <span
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  isEditable
                    ? 'bg-linear-accent/15 text-linear-accent'
                    : 'bg-linear-bg-quaternary text-linear-text-secondary'
                )}
              >
                {count}
              </span>
            )}
          </div>
          <div
            className={clsx(
              'flex h-7 w-7 items-center justify-center rounded-full',
              'transition-colors duration-150',
              isOpen ? 'bg-linear-bg-quaternary' : 'bg-linear-bg-tertiary'
            )}
          >
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-linear-text-secondary" />
            ) : (
              <ChevronDown className="h-4 w-4 text-linear-text-secondary" />
            )}
          </div>
        </CollapsibleTrigger>

        {/* Content */}
        <CollapsibleContent>
          <div
            className={clsx(
              'px-5 pb-5 pt-2',
              // Add top border when expanded
              'border-t',
              isEditable ? 'border-linear-accent/20' : 'border-linear-border-subtle'
            )}
          >
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

SectionGroup.displayName = 'SectionGroup';
