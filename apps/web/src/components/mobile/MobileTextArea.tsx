'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface MobileTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const MobileTextArea = forwardRef<HTMLTextAreaElement, MobileTextAreaProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="text-[13px] font-medium text-mobile-text-secondary">{label}</label>
        )}
        <textarea
          ref={ref}
          className={cn(
            'w-full px-4 py-3.5 rounded-[12px]',
            'bg-mobile-bg-elevated border',
            'text-[15px] text-mobile-text-primary',
            'placeholder:text-mobile-text-tertiary',
            'outline-none transition-colors resize-none',
            'min-h-[120px]',
            error
              ? 'border-red-500/50 focus:border-red-500'
              : 'border-mobile-border focus:border-mobile-accent',
            className
          )}
          {...props}
        />
        {error && <p className="text-[13px] text-red-400">{error}</p>}
      </div>
    );
  }
);

MobileTextArea.displayName = 'MobileTextArea';
