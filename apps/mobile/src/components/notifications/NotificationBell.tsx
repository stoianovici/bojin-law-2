'use client';

import { clsx } from 'clsx';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRealtimeStore } from '@/store/realtime';

// ============================================================================
// Component
// ============================================================================

export function NotificationBell() {
  const { unreadNotificationCount, setNotificationsOpen } = useRealtimeStore();

  const handleClick = () => setNotificationsOpen(true);

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'relative',
        'w-10 h-10 rounded-full',
        'flex items-center justify-center',
        'text-text-secondary',
        'hover:bg-bg-hover active:bg-bg-card',
        'transition-colors duration-150'
      )}
      aria-label={`Notificări${unreadNotificationCount > 0 ? ` (${unreadNotificationCount} necitite)` : ''}`}
    >
      <Bell className="w-5 h-5" />

      {/* Unread badge */}
      <AnimatePresence>
        {unreadNotificationCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className={clsx(
              'absolute top-1 right-1',
              'min-w-4 h-4 px-1 rounded-full',
              'bg-red-500 text-white',
              'text-[10px] font-semibold',
              'flex items-center justify-center'
            )}
          >
            {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
