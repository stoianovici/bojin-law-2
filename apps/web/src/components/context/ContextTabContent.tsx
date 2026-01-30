'use client';

import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContextSection } from './ContextSection';
import type { UserCorrection, CorrectionType } from '@/graphql/unified-context';

// ============================================================================
// Types
// ============================================================================

interface ContextTabContentProps {
  section: {
    id: string;
    title: string;
    content: string;
    tokenCount: number;
  } | null;
  corrections: UserCorrection[];
  onAddCorrection: (data: {
    sectionId: string;
    correctedValue: string;
    correctionType: CorrectionType;
    reason?: string;
  }) => Promise<void>;
  className?: string;
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 bg-linear-bg-tertiary rounded-full mb-4">
        <FileText className="h-8 w-8 text-linear-text-muted" />
      </div>
      <h2 className="text-lg font-medium text-linear-text-primary mb-2">Nu exista date</h2>
      <p className="text-sm text-linear-text-muted max-w-md">
        Aceasta sectiune nu contine informatii disponibile momentan.
      </p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextTabContent({
  section,
  corrections,
  onAddCorrection,
  className,
}: ContextTabContentProps) {
  // Empty state when no section data
  if (!section || !section.content) {
    return (
      <div className={className}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <ContextSection
        section={section}
        corrections={corrections}
        onAddCorrection={onAddCorrection}
      />
    </div>
  );
}

ContextTabContent.displayName = 'ContextTabContent';

export default ContextTabContent;
