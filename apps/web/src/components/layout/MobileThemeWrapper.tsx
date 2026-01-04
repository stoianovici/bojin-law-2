'use client';

import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

interface MobileThemeWrapperProps {
  children: React.ReactNode;
}

export function MobileThemeWrapper({ children }: MobileThemeWrapperProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div
      data-mobile
      data-theme={resolvedTheme}
      className={cn(
        'min-h-screen bg-mobile-bg-primary text-mobile-text-primary',
        resolvedTheme === 'light' && 'light'
      )}
    >
      {children}
    </div>
  );
}
