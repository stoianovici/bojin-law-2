'use client';

import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { ChevronLeft } from 'lucide-react';
import { NotificationBell } from '@/components/notifications';

// ============================================
// Types
// ============================================

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  showNotifications?: boolean;
  transparent?: boolean;
  className?: string;
}

// ============================================
// Component
// ============================================

export function Header({
  title,
  subtitle,
  showBack = false,
  onBack,
  leftAction,
  rightAction,
  showNotifications = false,
  transparent = false,
  className,
}: HeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <header
      className={clsx(
        'sticky top-0 z-40',
        'px-4 py-3',
        'flex items-center gap-3',
        !transparent && 'backdrop-blur-header border-b border-border-subtle',
        className
      )}
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
      }}
    >
      {/* Left section */}
      <div className="w-10 shrink-0">
        {showBack ? (
          <button
            onClick={handleBack}
            className={clsx(
              'flex items-center justify-center',
              'w-10 h-10 -ml-2',
              'rounded-full',
              'text-text-secondary',
              'hover:bg-bg-hover active:bg-bg-card',
              'transition-colors duration-150'
            )}
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        ) : (
          leftAction
        )}
      </div>

      {/* Center section - Title */}
      <div className="flex-1 min-w-0 text-center">
        {title && <h1 className="text-base font-semibold text-text-primary truncate">{title}</h1>}
        {subtitle && <p className="text-xs text-text-secondary truncate">{subtitle}</p>}
      </div>

      {/* Right section */}
      <div className="shrink-0 flex items-center justify-end gap-1">
        {showNotifications && <NotificationBell />}
        {rightAction}
      </div>
    </header>
  );
}

// ============================================
// Large Header (for landing pages)
// ============================================

interface LargeHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  showNotifications?: boolean;
  className?: string;
}

export function LargeHeader({
  title,
  subtitle,
  action,
  showNotifications = false,
  className,
}: LargeHeaderProps) {
  return (
    <header
      className={clsx('px-6 pt-4 pb-2', className)}
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 16px)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
          {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {showNotifications && <NotificationBell />}
          {action}
        </div>
      </div>
    </header>
  );
}
