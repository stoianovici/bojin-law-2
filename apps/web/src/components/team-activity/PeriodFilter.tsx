'use client';

/**
 * Period Filter Component
 * Simple select dropdown for filtering by time period
 */

import { clsx } from 'clsx';
import { Calendar } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OverviewPeriod } from '@/hooks/useTeamOverview';

// ============================================================================
// Types
// ============================================================================

interface PeriodFilterProps {
  value: OverviewPeriod;
  onChange: (value: OverviewPeriod) => void;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PERIOD_OPTIONS: Array<{ value: OverviewPeriod; label: string }> = [
  { value: 'THIS_WEEK', label: 'Această săptămână' },
  { value: 'THIS_MONTH', label: 'Luna aceasta' },
  { value: 'LAST_MONTH', label: 'Luna trecută' },
];

// ============================================================================
// Component
// ============================================================================

export function PeriodFilter({ value, onChange, className }: PeriodFilterProps) {
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <Calendar className="h-4 w-4 text-linear-text-secondary" />
      <Select value={value} onValueChange={(v) => onChange(v as OverviewPeriod)}>
        <SelectTrigger className="w-[180px]" size="sm">
          <SelectValue placeholder="Selectează perioada" />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

PeriodFilter.displayName = 'PeriodFilter';

export default PeriodFilter;
