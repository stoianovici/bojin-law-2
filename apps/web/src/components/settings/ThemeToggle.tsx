'use client';

import { Sun, Moon } from 'lucide-react';
import { useUserPreferences } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { data, updatePreferences, updateLoading } = useUserPreferences();
  const theme = data?.theme?.toLowerCase() || 'dark';

  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    try {
      await updatePreferences({ theme: newTheme.toUpperCase() as 'DARK' | 'LIGHT' });
    } catch (err) {
      console.error('Failed to update theme:', err);
    }
  };

  return (
    <div className="rounded-lg bg-linear-bg-tertiary p-1 inline-flex">
      <button
        type="button"
        onClick={() => handleThemeChange('light')}
        disabled={updateLoading}
        className={cn(
          'px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors',
          theme === 'light'
            ? 'bg-linear-bg-elevated text-linear-text-primary shadow-sm'
            : 'text-linear-text-secondary hover:text-linear-text-primary',
          updateLoading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Sun className="h-4 w-4" />
        Light
      </button>
      <button
        type="button"
        onClick={() => handleThemeChange('dark')}
        disabled={updateLoading}
        className={cn(
          'px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors',
          theme === 'dark'
            ? 'bg-linear-bg-elevated text-linear-text-primary shadow-sm'
            : 'text-linear-text-secondary hover:text-linear-text-primary',
          updateLoading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Moon className="h-4 w-4" />
        Dark
      </button>
    </div>
  );
}
