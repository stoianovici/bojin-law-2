'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';

export type CaseEmailFilterMode = 'case' | 'client';

interface CaseEmailFilterProps {
  value: CaseEmailFilterMode;
  onChange: (value: CaseEmailFilterMode) => void;
  disabled?: boolean;
  className?: string;
}

export function CaseEmailFilter({ value, onChange, disabled, className }: CaseEmailFilterProps) {
  return (
    <Select value={value} onValueChange={onChange as (value: string) => void} disabled={disabled}>
      <SelectTrigger size="sm" className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="case">Acest dosar</SelectItem>
        <SelectItem value="client">Toate dosarele clientului</SelectItem>
      </SelectContent>
    </Select>
  );
}
