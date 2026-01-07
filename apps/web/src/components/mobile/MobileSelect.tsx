'use client';

import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileSelectOption {
  value: string;
  label: string;
}

interface MobileSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  error?: string;
  options: MobileSelectOption[];
  placeholder?: string;
}

export const MobileSelect = forwardRef<HTMLSelectElement, MobileSelectProps>(
  ({ label, error, options, placeholder, className, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="text-[13px] font-medium text-mobile-text-secondary">{label}</label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              'w-full px-4 py-3.5 pr-10 rounded-[12px]',
              'bg-mobile-bg-elevated border',
              'text-[15px] text-mobile-text-primary',
              'outline-none transition-colors appearance-none',
              error
                ? 'border-red-500/50 focus:border-red-500'
                : 'border-mobile-border focus:border-mobile-accent',
              !props.value && 'text-mobile-text-tertiary',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-mobile-text-tertiary pointer-events-none"
            strokeWidth={2}
          />
        </div>
        {error && <p className="text-[13px] text-red-400">{error}</p>}
      </div>
    );
  }
);

MobileSelect.displayName = 'MobileSelect';
