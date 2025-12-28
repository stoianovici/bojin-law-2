/**
 * Notification Center Component
 * Story 2.8.2: Case Approval Workflow - Task 19
 * OPS-330: Linear Design Migration
 * OPS-332: TopBar & NotificationCenter Linear Design
 *
 * Displays in-app notifications with bell icon and badge count
 * Uses Radix UI DropdownMenu for accessibility and animations
 */

'use client';

import Link from 'next/link';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Bell } from 'lucide-react';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationAsRead,
} from '@/hooks/useNotifications';
import type { Notification } from '@legal-platform/types';

export function NotificationCenter() {
  const { notifications, refetch } = useNotifications({ limit: 10 });
  const { unreadCount } = useUnreadNotificationCount();
  const { markNotificationAsRead } = useMarkNotificationAsRead();

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
      refetch();
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'CasePendingApproval':
        return '📋';
      case 'CaseApproved':
        return '✅';
      case 'CaseRejected':
        return '❌';
      default:
        return '🔔';
    }
  };

  const getTimeAgo = (date: Date | string) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffInMs = now.getTime() - notificationDate.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'Acum';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInDays < 7) return `${diffInDays}z`;
    return notificationDate.toLocaleDateString('ro-RO');
  };

  return (
    <DropdownMenu.Root>
      {/* Bell Icon with Badge */}
      <DropdownMenu.Trigger asChild>
        <button
          className="
            relative p-2 rounded-lg
            text-linear-text-secondary hover:text-linear-text-primary
            hover:bg-linear-bg-hover
            focus:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent
            transition-colors
          "
          aria-label="Notificări"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="
              absolute -top-0.5 -right-0.5
              inline-flex items-center justify-center
              min-w-[18px] h-[18px] px-1
              text-[10px] font-bold leading-none text-white
              bg-linear-error rounded-full
            ">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>

      {/* Dropdown Menu */}
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="
            w-96 max-h-[500px]
            bg-linear-bg-elevated rounded-xl
            shadow-xl border border-linear-border-subtle
            overflow-hidden flex flex-col
            z-50
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
            data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
            data-[side=bottom]:slide-in-from-top-2
          "
          align="end"
          sideOffset={8}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-linear-border-subtle flex items-center justify-between">
            <h3 className="text-sm font-semibold text-linear-text-primary">Notificări</h3>
            {unreadCount > 0 && (
              <span className="text-xs text-linear-text-tertiary">
                {unreadCount} necitite
              </span>
            )}
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Bell className="w-10 h-10 mx-auto mb-3 text-linear-text-muted" />
                <p className="text-sm text-linear-text-tertiary">Nicio notificare</p>
              </div>
            ) : (
              <div>
                {notifications.map((notification: Notification) => (
                  <DropdownMenu.Item
                    key={notification.id}
                    className={`
                      px-4 py-3 cursor-pointer outline-none
                      transition-colors duration-100
                      hover:bg-linear-bg-hover focus:bg-linear-bg-hover
                      border-b border-linear-border-subtle last:border-b-0
                      ${!notification.read ? 'bg-linear-accent-muted' : ''}
                    `}
                    onSelect={() => handleNotificationClick(notification)}
                    asChild={!!notification.link}
                  >
                    {notification.link ? (
                      <Link href={notification.link} className="block">
                        <NotificationItem
                          notification={notification}
                          getNotificationIcon={getNotificationIcon}
                          getTimeAgo={getTimeAgo}
                        />
                      </Link>
                    ) : (
                      <div>
                        <NotificationItem
                          notification={notification}
                          getNotificationIcon={getNotificationIcon}
                          getTimeAgo={getTimeAgo}
                        />
                      </div>
                    )}
                  </DropdownMenu.Item>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-linear-border-subtle bg-linear-bg-tertiary">
              <DropdownMenu.Item asChild>
                <Link
                  href="/notifications"
                  className="
                    block text-center text-sm text-linear-accent
                    hover:text-linear-accent-hover font-medium
                    transition-colors outline-none
                  "
                >
                  Vezi toate notificările
                </Link>
              </DropdownMenu.Item>
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// Notification Item Component
function NotificationItem({
  notification,
  getNotificationIcon,
  getTimeAgo,
}: {
  notification: Notification;
  getNotificationIcon: (type: string) => string;
  getTimeAgo: (date: Date | string) => string;
}) {
  return (
    <div className="flex items-start space-x-3">
      <div className="flex-shrink-0 text-2xl">{getNotificationIcon(notification.type)}</div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium text-linear-text-primary ${!notification.read ? 'font-semibold' : ''}`}
        >
          {notification.title}
        </p>
        <p className="text-sm text-linear-text-secondary mt-1">{notification.message}</p>
        <p className="text-xs text-linear-text-tertiary mt-1">{getTimeAgo(notification.createdAt)}</p>
      </div>
      {!notification.read && (
        <div className="flex-shrink-0">
          <span className="inline-block w-2 h-2 bg-linear-accent rounded-full"></span>
        </div>
      )}
    </div>
  );
}
