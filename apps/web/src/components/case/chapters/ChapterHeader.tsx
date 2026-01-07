'use client';

import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// ============================================================================
// Types
// ============================================================================

// CasePhase enum matching Prisma schema
export type CasePhase =
  | 'ConsultantaInitiala'
  | 'Negociere'
  | 'DueDiligence'
  | 'PrimaInstanta'
  | 'Apel'
  | 'Executare'
  | 'Mediere'
  | 'Arbitraj'
  | 'Inchis';

export interface ChapterHeaderProps {
  phase: CasePhase;
  title: string;
  summary: string;
  startDate: string | null;
  endDate: string | null;
  eventCount: number;
  isExpanded?: boolean;
}

// ============================================================================
// Phase Display Name Mapping (Romanian)
// ============================================================================

const phaseDisplayNames: Record<CasePhase, string> = {
  ConsultantaInitiala: 'Consultanta initiala',
  Negociere: 'Negociere',
  DueDiligence: 'Due Diligence',
  PrimaInstanta: 'Prima instanta',
  Apel: 'Apel',
  Executare: 'Executare',
  Mediere: 'Mediere',
  Arbitraj: 'Arbitraj',
  Inchis: 'Inchis',
};

// ============================================================================
// Romanian Month Abbreviations
// ============================================================================

const romanianMonths: Record<number, string> = {
  0: 'Ian',
  1: 'Feb',
  2: 'Mar',
  3: 'Apr',
  4: 'Mai',
  5: 'Iun',
  6: 'Iul',
  7: 'Aug',
  8: 'Sep',
  9: 'Oct',
  10: 'Noi',
  11: 'Dec',
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatDateRomanian(dateString: string | null): string | null {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;

  const month = romanianMonths[date.getMonth()];
  const year = date.getFullYear();

  return `${month} ${year}`;
}

function formatDateRange(startDate: string | null, endDate: string | null): string | null {
  const formattedStart = formatDateRomanian(startDate);
  const formattedEnd = formatDateRomanian(endDate);

  if (!formattedStart && !formattedEnd) return null;
  if (formattedStart && !formattedEnd) return formattedStart;
  if (!formattedStart && formattedEnd) return formattedEnd;
  if (formattedStart === formattedEnd) return formattedStart;

  return `${formattedStart} - ${formattedEnd}`;
}

// ============================================================================
// Component
// ============================================================================

export function ChapterHeader({
  phase,
  title,
  summary,
  startDate,
  endDate,
  eventCount,
  isExpanded = false,
}: ChapterHeaderProps) {
  const dateRange = formatDateRange(startDate, endDate);
  const displayTitle = title || phaseDisplayNames[phase];

  return (
    <div className="flex items-start gap-3 w-full py-3 px-4">
      {/* Chevron Icon */}
      <ChevronDown
        className={cn(
          'h-4 w-4 text-linear-text-tertiary shrink-0 mt-0.5 transition-transform duration-200',
          isExpanded && 'rotate-180'
        )}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header Row: Title, Date Range, Event Count */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Phase Title */}
          <span className="text-linear-sm font-medium text-linear-text-primary">
            {displayTitle}
          </span>

          {/* Date Range */}
          {dateRange && (
            <span className="text-linear-xs text-linear-text-secondary">{dateRange}</span>
          )}

          {/* Event Count Badge */}
          <Badge variant="default" size="sm" className="ml-auto shrink-0">
            {eventCount} {eventCount === 1 ? 'eveniment' : 'evenimente'}
          </Badge>
        </div>

        {/* AI Summary Preview */}
        {summary && (
          <p className="mt-1 text-linear-xs text-linear-text-tertiary line-clamp-2">{summary}</p>
        )}
      </div>
    </div>
  );
}
