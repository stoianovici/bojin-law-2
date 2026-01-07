'use client';

import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

export function CreateFAB() {
  const pathname = usePathname();
  const { showCreateSheet, setShowCreateSheet } = useUIStore();

  // Only show FAB on specific routes
  const visibleRoutes = ['/m', '/m/cases', '/m/calendar'];
  const shouldShow = visibleRoutes.includes(pathname) && !showCreateSheet;

  if (!shouldShow) {
    return null;
  }

  return (
    <button
      onClick={() => setShowCreateSheet(true)}
      className={cn(
        'fixed bottom-24 right-6 z-40',
        'flex items-center justify-center w-14 h-14 rounded-full',
        'bg-mobile-text-primary text-mobile-bg-primary',
        'shadow-lg shadow-black/40',
        'hover:scale-105 active:scale-95 transition-transform'
      )}
    >
      <Plus className="w-[18px] h-[18px]" strokeWidth={2.5} />
    </button>
  );
}
