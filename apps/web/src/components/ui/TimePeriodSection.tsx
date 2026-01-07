'use client';

import { useState, useEffect, useCallback } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { clsx } from 'clsx';
import { Calendar, ChevronDown } from 'lucide-react';

// ============================
// Types
// ============================

export interface TimePeriodSectionProps {
  /** Unique key for this period (used for localStorage) */
  periodKey: string;
  /** Display label (e.g., "Săptămâna aceasta") */
  label: string;
  /** Item count to display */
  count: number;
  /** Whether section should be open by default */
  defaultOpen?: boolean;
  /** Storage key prefix for localStorage persistence */
  storageKey?: string;
  /** Children to render inside collapsible content */
  children: React.ReactNode;
  /** Optional className for the container */
  className?: string;
}

// ============================
// Helpers
// ============================

function getStorageKey(storageKey: string, periodKey: string): string {
  return `${storageKey}-${periodKey}`;
}

function getPersistedState(storageKey: string, periodKey: string, defaultOpen: boolean): boolean {
  if (typeof window === 'undefined') return defaultOpen;
  const key = getStorageKey(storageKey, periodKey);
  const stored = localStorage.getItem(key);
  if (stored === null) return defaultOpen;
  return stored === 'true';
}

function persistState(storageKey: string, periodKey: string, isOpen: boolean): void {
  if (typeof window === 'undefined') return;
  const key = getStorageKey(storageKey, periodKey);
  localStorage.setItem(key, String(isOpen));
}

// ============================
// Component
// ============================

export function TimePeriodSection({
  periodKey,
  label,
  count,
  defaultOpen = true,
  storageKey = 'time-section',
  children,
  className,
}: TimePeriodSectionProps) {
  // Initialize state from localStorage or default
  const [isOpen, setIsOpen] = useState(() => getPersistedState(storageKey, periodKey, defaultOpen));

  // Sync to localStorage when state changes
  useEffect(() => {
    persistState(storageKey, periodKey, isOpen);
  }, [storageKey, periodKey, isOpen]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange} className={className}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={clsx(
            'flex w-full items-center justify-between gap-2 px-3 py-2',
            'rounded-lg bg-linear-bg-secondary hover:bg-linear-bg-tertiary transition-colors',
            'text-sm font-medium text-linear-text-primary',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent focus-visible:ring-offset-2'
          )}
          aria-expanded={isOpen}
          aria-controls={`time-section-content-${periodKey}`}
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-linear-text-secondary" aria-hidden="true" />
            <span>{label}</span>
            <span className="inline-flex items-center justify-center rounded-full bg-linear-bg-tertiary px-2 py-0.5 text-xs font-medium text-linear-text-secondary">
              {count}
            </span>
          </div>
          <ChevronDown
            className={clsx(
              'h-4 w-4 text-linear-text-muted transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent id={`time-section-content-${periodKey}`}>
        <div className="pt-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

TimePeriodSection.displayName = 'TimePeriodSection';
