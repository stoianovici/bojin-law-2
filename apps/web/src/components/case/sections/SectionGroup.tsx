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
  const iconColor = isEditable ? 'text-blue-600' : 'text-gray-500';
  const bgColor = isEditable ? 'bg-white' : 'bg-gray-50';
  const borderColor = isEditable ? 'border-blue-200' : 'border-gray-200';
  const headerBg = isEditable ? 'hover:bg-blue-50/50' : 'hover:bg-gray-100/50';

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
            <span className="text-base font-semibold text-gray-900">{title}</span>
            {count !== undefined && count > 0 && (
              <span
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  isEditable ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
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
              isOpen ? 'bg-gray-200' : 'bg-gray-100'
            )}
          >
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-600" />
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
              isEditable ? 'border-blue-100' : 'border-gray-100'
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
