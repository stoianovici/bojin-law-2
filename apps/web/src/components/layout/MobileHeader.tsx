'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  transparent?: boolean;
}

export function MobileHeader({
  title,
  showBack = false,
  rightAction,
  transparent = false,
}: MobileHeaderProps) {
  const router = useRouter();

  return (
    <header
      className={cn(
        'sticky top-0 z-40 h-14 pt-safe',
        'flex items-center gap-3 px-6',
        transparent ? 'bg-transparent' : 'bg-mobile-bg-primary'
      )}
    >
      {/* Left: Back button */}
      {showBack && (
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-8 h-8 -ml-2 text-mobile-text-secondary rounded-lg hover:bg-mobile-bg-hover transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Title - left-aligned, larger font */}
      <h1 className="flex-1 text-[22px] font-medium tracking-[-0.02em] text-mobile-text-primary truncate">
        {title}
      </h1>

      {/* Right: Action */}
      {rightAction && <div className="flex items-center">{rightAction}</div>}
    </header>
  );
}
