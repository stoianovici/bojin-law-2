'use client';

import { Monitor, Globe } from 'lucide-react';
import { useUserPreferences } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';

export function DocumentOpenMethodToggle() {
  const { data, updatePreferences, updateLoading } = useUserPreferences();
  const method = data?.documentOpenMethod || 'ONLINE';

  const handleMethodChange = async (newMethod: 'DESKTOP' | 'ONLINE') => {
    try {
      await updatePreferences({ documentOpenMethod: newMethod });
    } catch (err) {
      console.error('Failed to update document open method:', err);
    }
  };

  return (
    <div className="rounded-lg bg-linear-bg-tertiary p-1 inline-flex">
      <button
        type="button"
        onClick={() => handleMethodChange('DESKTOP')}
        disabled={updateLoading}
        className={cn(
          'px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors',
          method === 'DESKTOP'
            ? 'bg-linear-bg-elevated text-linear-text-primary shadow-sm'
            : 'text-linear-text-secondary hover:text-linear-text-primary',
          updateLoading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Monitor className="h-4 w-4" />
        Word Desktop
      </button>
      <button
        type="button"
        onClick={() => handleMethodChange('ONLINE')}
        disabled={updateLoading}
        className={cn(
          'px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors',
          method === 'ONLINE'
            ? 'bg-linear-bg-elevated text-linear-text-primary shadow-sm'
            : 'text-linear-text-secondary hover:text-linear-text-primary',
          updateLoading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Globe className="h-4 w-4" />
        Word Online
      </button>
    </div>
  );
}
