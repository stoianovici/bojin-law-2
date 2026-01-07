'use client';

import * as React from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { cn } from '@/lib/utils';
import { ChapterHeader, type CasePhase } from './ChapterHeader';
import { TimelineView } from './TimelineView';

// ============================================================================
// Types
// ============================================================================

// Re-define shared types locally to avoid circular import issues
// These should match the types in TimelineEvent.tsx
export type CaseChapterEventType =
  | 'Document'
  | 'Email'
  | 'Task'
  | 'CourtOutcome'
  | 'ContractSigned'
  | 'Negotiation'
  | 'Deadline'
  | 'ClientDecision'
  | 'TeamChange'
  | 'StatusChange'
  | 'Milestone';

export interface DocumentQuickInfo {
  id: string;
  name: string;
  fileType: string;
  size?: number;
  uploadedAt?: string;
}

export interface EmailQuickInfo {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
}

export interface CaseChapterEvent {
  id: string;
  eventType: CaseChapterEventType;
  title: string;
  summary: string;
  occurredAt: string;
  metadata: {
    documentIds?: string[];
    emailIds?: string[];
    documents?: DocumentQuickInfo[];
    emails?: EmailQuickInfo[];
  };
}

export interface CaseChapter {
  id: string;
  phase: CasePhase;
  title: string;
  summary: string;
  startDate: string | null;
  endDate: string | null;
  eventCount: number;
  events?: CaseChapterEvent[];
}

// ============================================================================
// Component Props
// ============================================================================

export interface ChapterAccordionProps {
  /** List of chapters to render */
  chapters: CaseChapter[];
  /** ID of chapter to expand by default */
  defaultExpandedId?: string;
  /** Allow multiple chapters to be open simultaneously */
  allowMultiple?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when a chapter is expanded/collapsed */
  onChapterToggle?: (chapterId: string, isExpanded: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export function ChapterAccordion({
  chapters,
  defaultExpandedId,
  allowMultiple = false,
  className,
  onChapterToggle,
}: ChapterAccordionProps) {
  // Track expanded state for callback
  const handleValueChange = React.useCallback(
    (value: string | string[]) => {
      if (!onChapterToggle) return;

      // Determine which chapter was toggled
      const expandedIds = Array.isArray(value) ? value : value ? [value] : [];
      chapters.forEach((chapter) => {
        const isExpanded = expandedIds.includes(chapter.id);
        onChapterToggle(chapter.id, isExpanded);
      });
    },
    [chapters, onChapterToggle]
  );

  // Empty state
  if (!chapters || chapters.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12 px-6',
          'bg-linear-bg-primary rounded-lg border border-linear-border-subtle',
          className
        )}
      >
        <div className="text-linear-text-tertiary text-sm text-center">
          <p className="font-medium text-linear-text-secondary mb-1">Nu exista capitole</p>
          <p>
            Istoricul dosarului va fi organizat automat in capitole pe masura ce se adauga documente
            si evenimente.
          </p>
        </div>
      </div>
    );
  }

  // Render accordion based on mode (single or multiple)
  if (allowMultiple) {
    return (
      <Accordion.Root
        type="multiple"
        defaultValue={defaultExpandedId ? [defaultExpandedId] : []}
        onValueChange={handleValueChange}
        className={cn('flex flex-col gap-2', className)}
      >
        {chapters.map((chapter) => (
          <ChapterAccordionItem key={chapter.id} chapter={chapter} />
        ))}
      </Accordion.Root>
    );
  }

  return (
    <Accordion.Root
      type="single"
      defaultValue={defaultExpandedId}
      onValueChange={handleValueChange}
      collapsible
      className={cn('flex flex-col gap-2', className)}
    >
      {chapters.map((chapter) => (
        <ChapterAccordionItem key={chapter.id} chapter={chapter} />
      ))}
    </Accordion.Root>
  );
}

// ============================================================================
// Accordion Item Sub-component
// ============================================================================

interface ChapterAccordionItemProps {
  chapter: CaseChapter;
}

function ChapterAccordionItem({ chapter }: ChapterAccordionItemProps) {
  return (
    <Accordion.Item
      value={chapter.id}
      className={cn(
        'bg-linear-bg-elevated rounded-lg border border-linear-border-subtle',
        'overflow-hidden',
        'data-[state=open]:ring-1 data-[state=open]:ring-linear-accent/20',
        'transition-shadow duration-200'
      )}
    >
      <Accordion.Header asChild>
        <Accordion.Trigger
          className={cn(
            'w-full text-left',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent focus-visible:ring-inset',
            'group'
          )}
        >
          <ChapterHeader
            phase={chapter.phase}
            title={chapter.title}
            summary={chapter.summary}
            startDate={chapter.startDate}
            endDate={chapter.endDate}
            eventCount={chapter.eventCount}
          />
        </Accordion.Trigger>
      </Accordion.Header>

      <Accordion.Content
        className={cn(
          'overflow-hidden',
          'data-[state=open]:animate-accordion-down',
          'data-[state=closed]:animate-accordion-up'
        )}
      >
        <div className="border-t border-linear-border-subtle">
          <TimelineView events={chapter.events || []} />
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}

ChapterAccordion.displayName = 'ChapterAccordion';

// Re-export CasePhase for convenience
export type { CasePhase } from './ChapterHeader';
