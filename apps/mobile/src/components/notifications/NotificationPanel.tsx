'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { X, Bell, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { useRealtimeStore, InAppNotification } from '@/store/realtime';
import { NotificationItem } from './NotificationItem';
import { Skeleton } from '@/components/ui/Skeleton';

// ============================================================================
// Component
// ============================================================================

export function NotificationPanel() {
  const router = useRouter();
  const { notificationsOpen, setNotificationsOpen } = useRealtimeStore();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();

  // Lock body scroll when open
  useEffect(() => {
    if (notificationsOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [notificationsOpen]);

  const handleClose = () => setNotificationsOpen(false);

  const handleNotificationPress = async (notification: InAppNotification) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate based on action
    if (notification.action) {
      const { type, entityId, caseId } = notification.action;

      if (type === 'case' && caseId) {
        router.push(`/cases/${caseId}`);
        handleClose();
      } else if (type === 'task' && entityId) {
        router.push(`/tasks/${entityId}`);
        handleClose();
      }
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {notificationsOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60"
            onClick={handleClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={clsx(
              'fixed bottom-0 left-0 right-0 z-50',
              'bg-bg-elevated rounded-t-2xl',
              'flex flex-col',
              'h-[85vh]'
            )}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Notificări</h2>
                  <p className="text-xs text-text-secondary">
                    {unreadCount > 0 ? `${unreadCount} necitite` : 'Toate citite'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="px-3 py-1.5 rounded-full text-xs font-medium text-accent hover:bg-accent/10 active:bg-accent/20 transition-colors"
                  >
                    <CheckCheck className="w-4 h-4 inline mr-1" />
                    Marchează citite
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-text-secondary hover:bg-bg-hover active:bg-bg-card transition-colors"
                  aria-label="Închide"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Notifications list */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {loading && notifications.length === 0 ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <Bell className="w-12 h-12 text-text-tertiary mb-3" />
                  <p className="text-text-secondary">Nicio notificare</p>
                  <p className="text-sm text-text-tertiary mt-1">
                    Vei primi notificări când se întâmplă ceva important
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onPress={handleNotificationPress}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
